import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BookingService } from './booking.service';
import { AuthService } from './auth.service';
import { environment } from '../environments/environment';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-meus-agendamentos',
  templateUrl: './meus-agendamentos.component.html',
  styleUrls: ['./meus-agendamentos.component.scss']
})
export class MeusAgendamentosComponent implements OnInit {
  bookings: any[] = [];
  error = '';

  constructor(private http: HttpClient, public auth: AuthService, private toast: ToastService, private router: Router, private bookingService: BookingService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.error = '';
    this.http.get<any[]>(`${(environment as any).apiUrl}/my/bookings`).subscribe({
      next: (res) => { this.bookings = res || []; },
      error: (err) => {
        console.error('Erro ao carregar /my/bookings', err);
        if (err && err.status === 401) {
          this.toast.show('Sessão inválida ou expirada. Faça login novamente.', 'error');
          this.auth.logout();
          this.router.navigate(['/login']);
          return;
        }
        this.error = 'Falha ao carregar agendamentos. Verifique a API.';
      }
    });
  }

  cancel(b: any) {
    if (!b || !b.cancel_token) {
      this.toast.show('Cancelamento não disponível para este agendamento.', 'error');
      return;
    }
    const ok = confirm('Deseja realmente cancelar este agendamento?');
    if (!ok) return;
    // if user logged in and booking has id, call authenticated cancel
    const apiBase = (environment as any).apiUrl;
    if (this.auth.isLoggedIn() && b.id) {
      this.http.post(`${apiBase}/bookings/${b.id}/cancel`, {}).subscribe({
        next: () => {
          try {
            const ok = this.bookingService.removeBooking(b);
            if (!ok) this.bookingService.removeBookingByDateTime(b.date, b.time);
          } catch (e) {}
          this.toast.show('Agendamento cancelado.', 'success');
          this.load();
        },
        error: () => this.toast.show('Falha ao cancelar. Tente novamente mais tarde.', 'error')
      });
      return;
    }
    // fallback to token-based cancel (link from email)
    this.http.get(`${apiBase}/cancel?token=${b.cancel_token}`, { responseType: 'text' }).subscribe({
      next: () => {
        // remove local copy if exists so the timeslots are freed immediately
        try {
          const ok = this.bookingService.removeBooking(b);
          if (!ok) this.bookingService.removeBookingByDateTime(b.date, b.time);
        } catch (e) {}
        this.toast.show('Agendamento cancelado.', 'success');
        this.load();
      },
      error: () => this.toast.show('Falha ao cancelar. Tente novamente mais tarde.', 'error')
    });
  }

  startEdit(b: any) {
    b.editing = true;
    b._editDate = b.date;
    b._editTime = b.time;
    b._editService = b.service;
  }

  cancelEdit(b: any) {
    b.editing = false;
    delete b._editDate; delete b._editTime; delete b._editService;
  }

  saveEdit(b: any) {
    if (!b.id) { this.toast.show('Agendamento sem identificação. Recarregue a página.', 'error'); return; }
    const payload = { date: b._editDate, time: b._editTime, service: b._editService };
    const apiBase = (environment as any).apiUrl;
    this.http.put<any>(`${apiBase}/bookings/${b.id}`, payload).subscribe({
      next: (res) => {
        this.toast.show('Agendamento atualizado.', 'success');
        this.load();
      },
      error: (err) => {
        if (err && err.status === 409) this.toast.show('Horário já ocupado. Escolha outro.', 'error');
        else this.toast.show('Falha ao atualizar. Tente novamente.', 'error');
      }
    });
  }

  claim() {
    const user = this.auth.currentUser();
    if (!user || !user.email) {
      this.toast.show('Não foi possível obter seu e-mail. Faça login novamente.', 'error');
      return;
    }
    // request server to send confirmation email with token
    this.http.post<any>(`${(environment as any).apiUrl}/my/bookings/claim-request`, { email: user.email }).subscribe({
      next: (res) => {
        this.toast.show('Enviamos um email com instruções para confirmar a associação.', 'info');
      },
      error: () => this.toast.show('Falha ao solicitar associação. Tente novamente.', 'error')
    });
  }
}
