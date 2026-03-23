const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, init } = require('./db');
const path = require('path');
const https = require('https');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3000;

init();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create initial admin if not exists
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@exemplo.com';
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASS || '123456';

function ensureAdmin() {
  db.get('SELECT * FROM users WHERE email = ?', [DEFAULT_ADMIN_EMAIL], (err, row) => {
    if (err) return console.error('DB error', err);
    if (!row) {
      bcrypt.hash(DEFAULT_ADMIN_PASS, 10).then(hash => {
        db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [DEFAULT_ADMIN_EMAIL, hash, 'admin'], (e) => {
          if (e) console.error('Failed to create admin', e);
          else console.log('Admin user created:', DEFAULT_ADMIN_EMAIL);
        });
      });
    } else {
      console.log('Admin exists:', DEFAULT_ADMIN_EMAIL);
    }
  });
}

ensureAdmin();

// Auth
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing credentials' });
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'db' });
    if (!user) return res.status(401).json({ error: 'invalid' });
    bcrypt.compare(password, user.password).then(match => {
      if (!match) return res.status(401).json({ error: 'invalid' });
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
      res.json({ token });
    });
  });
});

// Register (simple)
app.post('/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing' });
  bcrypt.hash(password, 10).then(hash => {
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], function (err) {
      if (err) return res.status(500).json({ error: 'exists' });
      const id = this.lastID;
      const token = jwt.sign({ id, email, role: 'client' }, JWT_SECRET, { expiresIn: '12h' });
      res.json({ token });
    });
  });
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'no auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'bad auth' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'invalid token' });
    req.user = payload;
    next();
  });
}

// Optional auth: if Authorization header present, verify and set req.user, otherwise continue
function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return next();
  const parts = auth.split(' ');
  if (parts.length !== 2) return next();
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (!err) req.user = payload;
    return next();
  });
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'forbidden' });
}

function sendEmailViaEmailJS(templateId, toEmail, params={}){
  return new Promise((resolve, reject)=>{
    const service_id = process.env.EMAILJS_SERVICE_ID;
    const user_id = process.env.EMAILJS_USER_ID;
    const private_key = process.env.EMAILJS_PRIVATE_KEY;
    if (!service_id || !templateId || (!user_id && !private_key)){
      console.log('EmailJS not configured - skipping send', {service_id, templateId});
      return resolve(false);
    }

    const body = {
      service_id: service_id,
      template_id: templateId,
      template_params: params
    };
    if (private_key) body.private_key = private_key; else body.user_id = user_id;

    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.emailjs.com',
      port: 443,
      path: '/api/v1.0/email/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let resp = '';
      res.on('data', (d) => resp += d);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >=200 && res.statusCode < 300) resolve(true);
        else { console.error('EmailJS send failed', res.statusCode, resp); resolve(false); }
      });
    });
    req.on('error', (e) => { console.error('EmailJS request error', e); resolve(false); });
    req.write(data);
    req.end();
  });
}

// Create booking (can be anonymous or with user via token)
app.post('/bookings', optionalAuth, (req, res) => {
  const b = req.body;
  // expected: name, phone, email, service, date, time, optionally token user
  const cancelToken = uuidv4();
  const sql = 'INSERT INTO bookings (user_id, name, phone, email, service, date, time, cancel_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const userId = req.user ? req.user.id : null;
  db.run(sql, [userId, b.name, b.phone, b.email, b.service, b.date, b.time, cancelToken], function (err) {
    if (err) return res.status(500).json({ error: 'db' });
    const id = this.lastID;
    res.json({ id, cancel_token: cancelToken });

    // Send notifications (if EmailJS templates configured)
    try {
      const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
      const cancelLink = `${serverUrl}/cancel?token=${cancelToken}`;
      const templateClient = process.env.EMAILJS_TEMPLATE_CREATE_CLIENT;
      const templateAdmin = process.env.EMAILJS_TEMPLATE_CREATE_ADMIN;
      const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

      const params = {
        name: b.name,
        service: b.service,
        date: b.date,
        time: b.time,
        phone: b.phone,
        email: b.email,
        cancel_link: cancelLink
      };

      if (b.email && templateClient) {
        sendEmailViaEmailJS(templateClient, b.email, params).catch(() => {});
      }
      if (adminEmail && templateAdmin) {
        sendEmailViaEmailJS(templateAdmin, adminEmail, params).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to trigger create booking emails', e);
    }
  });
});

// Admin list bookings
app.get('/bookings', authMiddleware, adminOnly, (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

// Admin mark complete
app.post('/bookings/:id/complete', authMiddleware, adminOnly, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE bookings SET status = ? WHERE id = ?', ['completed', id], function (err) {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ ok: true });
  });
});

// Cancel by token (link from email)
app.get('/cancel', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('<h3>Token ausente</h3>');
  db.get('SELECT * FROM bookings WHERE cancel_token = ?', [token], (err, row) => {
    if (err) return res.status(500).send('<h3>Erro no servidor</h3>');
    if (!row) return res.status(404).send('<h3>Agendamento não encontrado</h3>');
    if (row.status === 'cancelled') return res.send('<h3>Agendamento já cancelado</h3>');
    db.run('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', row.id], function (e) {
      if (e) return res.status(500).send('<h3>Falha ao cancelar</h3>');
      // try to notify via EmailJS (if configured)
      const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
      const templateClient = process.env.EMAILJS_TEMPLATE_CANCEL_CLIENT;
      const templateAdmin = process.env.EMAILJS_TEMPLATE_CANCEL_ADMIN;
      // notify client
      if (row.email && templateClient) {
        sendEmailViaEmailJS(templateClient, row.email, { name: row.name, service: row.service, date: row.date, time: row.time, email: row.email });
      }
      // notify admin/establishment
      if (adminEmail && templateAdmin) {
        sendEmailViaEmailJS(templateAdmin, adminEmail, { name: row.name, service: row.service, date: row.date, time: row.time, email: row.email });
      }
      res.send(`<h3>Agendamento cancelado</h3><p>Serviço: ${row.service}<br/>Data: ${row.date} às ${row.time}</p>`);
    });
  });
});

// Authenticated cancel by id (owner or admin) — returns JSON
app.post('/bookings/:id/cancel', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    if (!row) return res.status(404).json({ error: 'not found' });
    // only owner or admin can cancel
    if (!(req.user.role === 'admin' || req.user.id === row.user_id)) return res.status(403).json({ error: 'forbidden' });
    if (row.status === 'cancelled') return res.json({ ok: true, message: 'already cancelled' });
    db.run('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', id], function (e) {
      if (e) return res.status(500).json({ error: 'db' });
      // send notifications
      const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
      const templateClient = process.env.EMAILJS_TEMPLATE_CANCEL_CLIENT;
      const templateAdmin = process.env.EMAILJS_TEMPLATE_CANCEL_ADMIN;
      if (row.email && templateClient) {
        sendEmailViaEmailJS(templateClient, row.email, { name: row.name, service: row.service, date: row.date, time: row.time, email: row.email });
      }
      if (adminEmail && templateAdmin) {
        sendEmailViaEmailJS(templateAdmin, adminEmail, { name: row.name, service: row.service, date: row.date, time: row.time, email: row.email });
      }
      return res.json({ ok: true });
    });
  });
});

// Edit booking (owner or admin) with availability check
app.put('/bookings/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { date, time, service } = req.body;
  if (!date || !time) return res.status(400).json({ error: 'missing date or time' });
  db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    if (!row) return res.status(404).json({ error: 'not found' });
    if (!(req.user.role === 'admin' || req.user.id === row.user_id)) return res.status(403).json({ error: 'forbidden' });
    if (row.status === 'cancelled') return res.status(400).json({ error: 'booking cancelled' });
    // check availability: no other active booking at same date/time
    db.get('SELECT COUNT(*) AS cnt FROM bookings WHERE date = ? AND time = ? AND status = ? AND id != ?', [date, time, 'active', id], (err2, crow) => {
      if (err2) return res.status(500).json({ error: 'db' });
      if (crow && crow.cnt > 0) return res.status(409).json({ error: 'time taken' });
      // perform update
      db.run('UPDATE bookings SET date = ?, time = ?, service = ? WHERE id = ?', [date, time, service || row.service, id], function (e) {
        if (e) return res.status(500).json({ error: 'db' });
        // fetch updated row
        db.get('SELECT * FROM bookings WHERE id = ?', [id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: 'db' });
          // notify client and admin via EmailJS templates if configured
          const templateClient = process.env.EMAILJS_TEMPLATE_EDIT_CLIENT;
          const templateAdmin = process.env.EMAILJS_TEMPLATE_EDIT_ADMIN;
          const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
          if (updated.email && templateClient) {
            sendEmailViaEmailJS(templateClient, updated.email, { name: updated.name, service: updated.service, date: updated.date, time: updated.time, email: updated.email });
          }
          if (adminEmail && templateAdmin) {
            sendEmailViaEmailJS(templateAdmin, adminEmail, { name: updated.name, service: updated.service, date: updated.date, time: updated.time, email: updated.email });
          }
          res.json({ ok: true, booking: updated });
        });
      });
    });
  });
});

// Simple endpoint for client to list own bookings
app.get('/my/bookings', authMiddleware, (req, res) => {
  db.all('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

// Claim existing anonymous bookings that match the provided email and assign them to the logged user
app.post('/my/bookings/claim', authMiddleware, (req, res) => {
  const email = req.body && req.body.email;
  if (!email) return res.status(400).json({ error: 'missing email' });
  // only allow claiming bookings that have no user_id (anonymous)
  const sql = 'UPDATE bookings SET user_id = ? WHERE user_id IS NULL AND email = ?';
  db.run(sql, [req.user.id, email], function (err) {
    if (err) return res.status(500).json({ error: 'db' });
    // return number of rows changed
    res.json({ claimed: this.changes });
  });
});

// Create a claim request: generate token and email a confirmation link to the user's email
app.post('/my/bookings/claim-request', authMiddleware, (req, res) => {
  const email = req.body && req.body.email;
  if (!email) return res.status(400).json({ error: 'missing email' });
  const token = uuidv4();
  db.run('INSERT INTO claim_tokens (user_id, email, token) VALUES (?, ?, ?)', [req.user.id, email, token], function (err) {
    if (err) return res.status(500).json({ error: 'db' });
    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    const link = `${serverUrl}/claim/confirm?token=${token}`;
    const template = process.env.EMAILJS_TEMPLATE_CLAIM_REQUEST;
    // send email to user with link (if configured)
    if (template) {
      sendEmailViaEmailJS(template, email, { name: req.user.email || '', link, email });
    }
    res.json({ ok: true, message: 'confirmation_sent' });
  });
});

// Confirm claim token and associate bookings to token.user_id
app.get('/claim/confirm', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('<h3>Token ausente</h3>');
  db.get('SELECT * FROM claim_tokens WHERE token = ?', [token], (err, row) => {
    if (err) return res.status(500).send('<h3>Erro no servidor</h3>');
    if (!row) return res.status(404).send('<h3>Token inválido</h3>');
    if (row.used) return res.send('<h3>Token já utilizado</h3>');
    // check expiry (24h)
    const created = new Date(row.created_at);
    const now = new Date();
    const ageHours = (now - created) / (1000*60*60);
    if (ageHours > 24) return res.send('<h3>Token expirado</h3>');
    // associate bookings with matching email that are anonymous
    db.run('UPDATE bookings SET user_id = ? WHERE user_id IS NULL AND email = ?', [row.user_id, row.email], function (e) {
      if (e) return res.status(500).send('<h3>Falha ao associar</h3>');
      db.run('UPDATE claim_tokens SET used = 1 WHERE id = ?', [row.id], () => {
        res.send(`<h3>Associação concluída</h3><p>${this.changes} agendamento(s) associados à sua conta.</p>`);
      });
    });
  });
});

// Root status page
app.get('/', (req, res) => {
  res.send(`
    <h2>Agendamento Server</h2>
    <p>API disponível. Endpoints úteis:</p>
    <ul>
      <li>POST /auth/login</li>
      <li>POST /auth/register</li>
      <li>POST /bookings</li>
      <li>GET /cancel?token=...</li>
      <li>GET /bookings (admin)</li>
      <li>GET /my/bookings (auth)</li>
    </ul>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
