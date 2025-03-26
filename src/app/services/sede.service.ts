import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SedeService {
  private baseUrl = `${environment.apiUrl}/sedes`;

  constructor(private http: HttpClient) {}

  // 📌 Obtener todas las sedes disponibles
  obtenerSedes(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }
}
