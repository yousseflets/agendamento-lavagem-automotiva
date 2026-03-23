import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ServicesComponent } from './services.component';
import { BookingModalComponent } from './booking-modal.component';
import { BookingService } from './booking.service';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';
import { MeusAgendamentosComponent } from './meus-agendamentos.component';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { TokenInterceptor } from './token.interceptor';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

@NgModule({
  declarations: [
    AppComponent,
    ServicesComponent,
    BookingModalComponent
    , LoginComponent, RegisterComponent, MeusAgendamentosComponent, ToastComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [
    BookingService,
    AuthService,
    ToastService,
    AuthGuard,
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
