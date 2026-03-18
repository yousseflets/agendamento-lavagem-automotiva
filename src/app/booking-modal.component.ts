import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BookingService, Booking } from './booking.service';
import { environment } from '../environments/environment';

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

  constructor(private fb: FormBuilder, private bookingService: BookingService) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/)]],
      email: ['', [Validators.required, Validators.email]],
      service: [''],
      date: [this.today(), Validators.required],
      time: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.form.get('service')?.setValue(this.serviceName);
    this.updateAvailableTimes();
    this.form.get('date')?.valueChanges.subscribe(() => this.updateAvailableTimes());
  }

  today(): string {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  updateAvailableTimes() {
    const date = this.form.get('date')?.value;
    this.availableTimes = this.times.filter(t => !this.bookingService.isTimeTaken(date, t));
    const selected = this.form.get('time')?.value;
    if (selected && !this.availableTimes.includes(selected)) {
      this.form.get('time')?.setValue('');
    }
  }

  confirm() {
    this.successMessage = '';
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const booking: Booking = {
      name: this.form.get('name')?.value,
      phone: this.form.get('phone')?.value,
      email: this.form.get('email')?.value,
      service: this.form.get('service')?.value,
      date: this.form.get('date')?.value,
      time: this.form.get('time')?.value
    };

    // persist locally (garante bloqueio imediato)
    this.bookingService.saveBooking(booking);

    // enviar email
    this.isSending = true;
    this.bookingService.sendEmail(booking, this.emailConfig).subscribe({
      next: () => {
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
