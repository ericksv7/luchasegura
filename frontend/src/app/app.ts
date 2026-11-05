import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly apiStatus = signal<'comprobando' | 'conectada' | 'sin conexión'>('comprobando');

  constructor() {
    // Verifica que la API y la base de datos respondan (el proxy redirige /api a localhost:3000)
    this.http.get<{ status: string }>('/api/health').subscribe({
      next: (r) => this.apiStatus.set(r.status === 'ok' ? 'conectada' : 'sin conexión'),
      error: () => this.apiStatus.set('sin conexión')
    });
  }
}
