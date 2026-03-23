import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';
import { MeusAgendamentosComponent } from './meus-agendamentos.component';
import { AuthGuard } from './auth.guard';
import { ServicesComponent } from './services.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'meus-agendamentos', component: MeusAgendamentosComponent, canActivate: [AuthGuard] },
  { path: '', pathMatch: 'full', component: ServicesComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
