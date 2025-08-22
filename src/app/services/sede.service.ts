// ✅ Servicio actualizado de sedes para la gestión completa

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SedeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ✅ Obtener headers con token
  // sede.service.ts
  private getAuthHeaders() {
    let token = localStorage.getItem('token') || '';
    token = token.replace(/^"|"$/g, ''); // quita comillas si las tuviera
    if (!token) {
      // opcional: redirige a login o lanza error controlado
      console.warn('⚠️ No hay token. Redirigiendo a login...');
    }
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  // 📌 Obtener todas las sedes
  obtenerSedes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sedes/todas`, this.getAuthHeaders());
  }

  // ➕ Agregar nueva sede
  agregarSede(sede: { nombre: string; id: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/sedes/agregar`, sede, this.getAuthHeaders());
  }

  // ❌ Eliminar sede (solo para uso especial)
  eliminarSede(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sedes/${id}`, this.getAuthHeaders());
  }

  // ✏️ Editar nombre u otros datos básicos
  editarSede(id: number, cambios: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/sedes/${id}`, cambios, this.getAuthHeaders());
  }

  // 🔍 Obtener sede por ID
  obtenerSedePorId(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sedes/${id}`, this.getAuthHeaders());
  }

  // ⏰ Actualizar horario base
  actualizarHorarioBaseDeSede(idSede: number, body: any) {
    return this.http.put(`${this.apiUrl}/sedes/${idSede}/horario-base`, body, this.getAuthHeaders());
  }

  // 📅 Obtener calendario de sede
  obtenerEventosCalendario(sedeId: number, anio: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/calendario/sede/${sedeId}/anio/${anio}`, this.getAuthHeaders());
  }

  // 🔥 Marcar sede como en proceso de eliminación
  marcarEliminacionSede(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/sedes/marcar-eliminacion/${id}`, {}, this.getAuthHeaders());
  }

  // 🔄 Cancelar eliminación de sede
  cancelarEliminacionSede(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/sedes/cancelar-eliminacion/${id}`, {}, this.getAuthHeaders());
  }

  // SedeService
  actualizarSede(id: number, body: any) {
    return this.http.put(`${this.apiUrl}/sedes/${id}`, body, this.getAuthHeaders());
  }

}
