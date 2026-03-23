import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BookingService, Booking } from './booking.service';
import { AuthService } from './auth.service';
import { Router, NavigationStart } from '@angular/router';
import { environment } from '../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-booking-modal',
  templateUrl: './booking-modal.component.html',
  styleUrls: ['./booking-modal.component.scss']
})
export class BookingModalComponent implements OnInit {
  @Input() serviceName = '';
  @Output() close = new EventEmitter<void>();
  @Output() booked = new EventEmitter<void>();

  form: FormGroup;
  times = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
  availableTimes: string[] = [];

  // EmailJS config is read from environment
  emailConfig = environment.emailJs;

  isSending = false;
  successMessage = '';
  errorMessage = '';

  private routerSub?: Subscription;

  constructor(private fb: FormBuilder, private bookingService: BookingService, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/)]],
      email: ['', [Validators.required, Validators.email]],
      service: [''],
      date: [this.today(), Validators.required],
      vehicle: ['', Validators.required],
      time: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.form.get('service')?.setValue(this.serviceName);
    this.updateAvailableTimes();
    this.form.get('date')?.valueChanges.subscribe(() => this.updateAvailableTimes());
    // close modal automatically when navigation starts to avoid blocking UI
    this.routerSub = this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        this.onClose();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
  }

  today(): string {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  updateAvailableTimes() {
    const date = this.form.get('date')?.value;
    this.availableTimes = this.times.filter(t => !this.bookingService.isTimeTaken(date, t));
    // If selected date is today, hide times that are too close to now.
    // Policy: allow bookings starting from (current hour + 2) to give a 2-hour buffer.
    const todayStr = this.today();
    if (date === todayStr) {
      const now = new Date();
      const minHour = now.getHours() + 2;
      this.availableTimes = this.availableTimes.filter(t => {
        const hour = parseInt(t.split(':')[0], 10);
        return hour >= minHour && hour >= 0 && hour <= 23;
      });
    }
    const selected = this.form.get('time')?.value;
    if (selected && !this.availableTimes.includes(selected)) {
      this.form.get('time')?.setValue('');
    }
  }

  confirm() {
    this.successMessage = '';
    this.errorMessage = '';
    // show immediate feedback while validating
    this.isSending = true;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.isSending = false;
      return;
    }

    if (!this.auth.isLoggedIn()) {
      // redirect to login and require authentication before booking
      this.isSending = false;
      this.router.navigate(['/login'], { queryParams: { returnUrl: window.location.pathname } });
      return;
    }

    const booking: Booking = {
      name: this.form.get('name')?.value,
      phone: this.form.get('phone')?.value,
      email: this.form.get('email')?.value,
      service: this.form.get('service')?.value,
      date: this.form.get('date')?.value,
      time: this.form.get('time')?.value,
      vehicle: this.form.get('vehicle')?.value
    };

    // persist locally (garante bloqueio imediato)
    this.bookingService.saveBooking(booking);

    // enviar email
    this.bookingService.sendEmail(booking, this.emailConfig).subscribe({
      next: (res) => {
        this.isSending = false;
        this.successMessage = 'Agendamento confirmado e notificação enviada por e-mail.';
        this.booked.emit();
      },
      error: (err) => {
        this.isSending = false;
        this.errorMessage = 'Agendamento salvo, mas falha ao enviar e-mail. Verifique a configuração.';
        this.booked.emit();
      }
    });
  }

  onPhoneInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    let formatted = v;
    if (v.length <= 2) {
      formatted = '(' + v;
    } else if (v.length <= 6) {
      formatted = '(' + v.slice(0, 2) + ') ' + v.slice(2);
    } else if (v.length <= 10) {
      formatted = '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
    } else {
      formatted = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    }
    this.form.get('phone')?.setValue(formatted, { emitEvent: false });
  }

  onClose() { this.close.emit(); }
}
