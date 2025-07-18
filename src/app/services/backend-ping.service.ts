import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment'; // ✉️ aquí llega la carta

@Injectable({
  providedIn: 'root'
})
export class BackendPingService {
  private url = `${environment.apiUrl}/api/ping`; // 🧭 toma la dirección de la carta

  constructor(private http: HttpClient) {}

  pingBackend(): Observable<any> {
    return this.http.get(this.url); // 💌 “Ping de amor”   // 💌 envía un "¿estás ahí, amor?"
  }
}


