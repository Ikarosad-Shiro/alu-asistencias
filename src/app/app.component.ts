import { Component, OnInit } from '@angular/core';
import { BackendPingService } from './services/backend-ping.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'alu-asistencias';

  constructor(private pingService: BackendPingService) {}

  ngOnInit(): void {
    this.ping();
    setInterval(() => this.ping(), 5 * 60 * 1000); // 🔁 cada 5 minutos
  }

  ping(): void {
    this.pingService.pingBackend().subscribe({
      next: () => console.log('💖 Angular: "Hola backend, ¿cómo estás?"'),
      error: () => console.warn('💔 Angular: "No pude hablar con el backend..."')
    });
  }
}
