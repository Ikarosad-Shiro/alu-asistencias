// ✅ Vamos a ampliar el servicio de sedes para que sea reutilizable en la página de sedes

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SedeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 📌 Obtener todas las sedes
  obtenerSedes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sedes/todas`);
  }

  // ➕ Agregar nueva sede
  agregarSede(sede: { nombre: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/sedes`, sede);
  }

  // ❌ Eliminar sede (por si se requiere luego)
  eliminarSede(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sedes/${id}`);
  }

  // ✏️ Editar sede (opcional)
  editarSede(id: number, cambios: { nombre: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/sedes/${id}`, cambios);
  }
}
