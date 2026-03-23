import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  form: FormGroup;
  error = '';

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  submit() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.error = '';
    const { email, password } = this.form.value;
    this.auth.register(email, password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: () => this.error = 'Falha ao criar conta. Talvez o e-mail já exista.'
    });
  }
}
