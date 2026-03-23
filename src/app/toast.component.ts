import { Component, OnInit } from '@angular/core';
import { ToastService, ToastMessage } from './toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent implements OnInit {
  messages: ToastMessage[] = [];

  constructor(private toast: ToastService) {}

  ngOnInit(): void {
    this.toast.messages$.subscribe(list => this.messages = list);
  }

  dismiss(id: number) { this.toast.dismiss(id); }
}
