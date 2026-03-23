import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface Booking {
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. 10:00
  vehicle?: string; // marca/modelo
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private storageKey = 'bookings';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getBookings(): Booking[] {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  saveBooking(b: Booking) {
    const arr = this.getBookings();
    arr.push(b);
    localStorage.setItem(this.storageKey, JSON.stringify(arr));
  }

  removeBooking(b: Booking) {
    const arr = this.getBookings();
    const idx = arr.findIndex(x => x.date === b.date && x.time === b.time && x.name === b.name && x.email === b.email);
    if (idx !== -1) {
      arr.splice(idx, 1);
      localStorage.setItem(this.storageKey, JSON.stringify(arr));
      return true;
    }
    return false;
  }

  /**
   * Remove local bookings matching date+time. Returns number of removed entries.
   * Useful when exact name/email don't match but timeslot should be freed.
   */
  removeBookingByDateTime(date: string, time: string): number {
    const arr = this.getBookings();
    const filtered = arr.filter(x => !(x.date === date && x.time === time));
    const removed = arr.length - filtered.length;
    if (removed > 0) {
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    }
    return removed;
  }

  isTimeTaken(date: string, time: string): boolean {
    return this.getBookings().some(b => b.date === date && b.time === time);
  }

  // Sends email via EmailJS REST API. Requires user to configure environment variables.
  sendEmail(booking: Booking, config: { service_id: string; template_id: string; user_id: string; private_key?: string; }) {
    const emailUrl = 'https://api.emailjs.com/api/v1.0/email/send';
    const apiBase = (environment as any).apiUrl || '';

    // First create booking on backend to get cancel_token
    return this.http.post<any>(`${apiBase}/bookings`, booking).pipe(
      switchMap((res) => {
        const cancelToken = res && res.cancel_token ? res.cancel_token : null;
        const cancelUrl = cancelToken ? `${apiBase}/cancel?token=${cancelToken}` : (`mailto:${(environment as any).admin_email}`);

        const body: any = {
          service_id: config.service_id,
          template_id: config.template_id,
            template_params: {
            name: booking.name,
            phone: booking.phone,
            email: booking.email,
            service: booking.service,
            date: booking.date,
            time: booking.time,
            vehicle: booking.vehicle || '',
            title: `Novo agendamento: ${booking.service} — ${booking.date} às ${booking.time}`,
            message: `Olá,\n\nVocê recebeu um novo agendamento pelo site. Seguem os detalhes:\n\nNome: ${booking.name}\nServiço: ${booking.service}\nData: ${booking.date} às ${booking.time}\nVeículo: ${booking.vehicle || ''}\nTelefone: ${booking.phone}\nE-mail: ${booking.email}\n\nPor favor confirme a disponibilidade e entre em contato com o cliente quando possível.\n\nAtenciosamente,\nEquipe Auto Lavagem`,
            // cancel link/button generated with token from backend
            cancel_link: cancelUrl,
            cancel_button_html: `<a href="${cancelUrl}" style="display:inline-block;padding:10px 16px;background:#e3342f;color:#fff;border-radius:6px;text-decoration:none;">Cancelar agendamento</a>`
          }
        };

        if (config.private_key) {
          body.private_key = config.private_key;
        } else {
          body.user_id = config.user_id;
        }

        // Debug payload
        // eslint-disable-next-line no-console
        console.log('BookingService.sendEmail payload (email):', { emailUrl, body });

        return this.http.post(emailUrl, body, { responseType: 'text' });
      })
    );
  }
}
