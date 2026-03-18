import { Component } from '@angular/core';

interface ServiceItem { id: string; title: string; description: string }

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent {
  services: ServiceItem[] = [
    { id: 'simples', title: 'Lavagem Simples', description: 'Lavagem Básica' },
    { id: 'completa', title: 'Lavagem Completa', description: 'Lavagem Completa com secagem' },
    { id: 'premium', title: 'Lavagem Premium', description: 'Polimento e proteção' }
  ];

  selectedService: ServiceItem | null = null;
  showModal = false;

  openModal(s: ServiceItem) {
    this.selectedService = s;
    this.showModal = true;
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
