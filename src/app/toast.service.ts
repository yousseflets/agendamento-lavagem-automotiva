import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage { id: number; text: string; type: 'success' | 'error' | 'info' }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private messages: Subject<ToastMessage[]> = new Subject<ToastMessage[]>();
  private list: ToastMessage[] = [];
  private seq = 1;

  get messages$() { return this.messages.asObservable(); }

  show(text: string, type: 'success' | 'error' | 'info' = 'success', timeout = 3500) {
    const msg: ToastMessage = { id: this.seq++, text, type };
    this.list = [...this.list, msg];
    this.messages.next(this.list);
    if (timeout > 0) setTimeout(() => this.dismiss(msg.id), timeout);
  }

  dismiss(id: number) {
    this.list = this.list.filter(m => m.id !== id);
    this.messages.next(this.list);
  }
}
