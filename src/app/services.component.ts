import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

interface ServiceItem { id: string; title: string; description: string; image?: string }

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent {
  services: ServiceItem[] = [
    { id: 'simples', title: 'Lavagem Simples', description: 'Lavagem Básica', image: 'assets/lavagem simples.jpg' },
    { id: 'completa', title: 'Lavagem Completa', description: 'Lavagem Completa com secagem', image: 'assets/lavagem completa.jpg' },
    { id: 'premium', title: 'Lavagem Premium', description: 'Polimento e proteção', image: 'assets/lavagem premium.webp' }
  ];

  selectedService: ServiceItem | null = null;
  showModal = false;
  showLoginPrompt = false;

  constructor(private auth: AuthService, private router: Router) {}

  openModal(s: ServiceItem) {
    // só abre o modal de agendamento se o usuário estiver autenticado
    if (!this.auth.isLoggedIn()) {
      this.showLoginPrompt = true;
      return;
    }
    this.selectedService = s;
    this.showModal = true;
  }

  closeLoginPrompt() {
    this.showLoginPrompt = false;
  }

  goToLogin() {
    // fecha o prompt e navega para a tela de login
    this.showLoginPrompt = false;
    this.router.navigate(['/login']);
  }

  // fechar prompt automaticamente ao navegar para evitar estado preso
  ngOnInit() {
    this.router.events.subscribe(e => {
      // any navigation should close the login prompt
      this.showLoginPrompt = false;
    });
  }

  closeModal() {
    this.selectedService = null;
    this.showModal = false;
  }

  onBooked() {
    // fecha modal quando um agendamento for confirmado
    this.closeModal();
  }
}
