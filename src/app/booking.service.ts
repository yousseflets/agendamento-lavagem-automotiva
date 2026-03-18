import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Booking {
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. 10:00
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private storageKey = 'bookings';

  constructor(private http: HttpClient) {}

  getBookings(): Booking[] {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  saveBooking(b: Booking) {
    const arr = this.getBookings();
    arr.push(b);
    localStorage.setItem(this.storageKey, JSON.stringify(arr));
  }

  isTimeTaken(date: string, time: string): boolean {
    return this.getBookings().some(b => b.date === date && b.time === time);
  }

  // Sends email via EmailJS REST API. Requires user to configure environment variables.
  sendEmail(booking: Booking, config: { service_id: string; template_id: string; user_id: string; private_key?: string; }) {
    const url = 'https://api.emailjs.com/api/v1.0/email/send';
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
        title: `Novo agendamento: ${booking.service}`,
        message: `Serviço: ${booking.service}\nData: ${booking.date}\nHora: ${booking.time}\nTelefone: ${booking.phone}\nE-mail: ${booking.email}`
      }
    };

    // If private_key is present, use it (strict/server-side mode) and DO NOT send user_id.
    if (config.private_key) {
      body.private_key = config.private_key;
    } else {
      // Fallback to public key for browser/non-strict mode
      body.user_id = config.user_id;
    }

    return this.http.post(url, body, { responseType: 'text' });
  }
}
