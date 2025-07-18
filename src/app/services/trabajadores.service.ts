import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

interface Trabajador {
  _id?: string;
  nombre: string;
  sede: number;
  sincronizado: boolean;
  correo?: string;
  telefono?: string;
  telefonoEmergencia?: string;
  direccion?: string;
}

import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TrabajadoresService {
  private apiUrl = `${environment.apiUrl}/trabajadores`;  // 🌟 Usa la URL del environment

  constructor(private http: HttpClient) {}

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // 🔥 Obtener todos los trabajadores
  obtenerTrabajadores(): Observable<Trabajador[]> {
    return this.http.get<Trabajador[]>(this.apiUrl, { headers: this.getAuthHeaders() });
  }

  // 🔥 Agregar un nuevo trabajador
  agregarTrabajador(trabajador: Trabajador): Observable<Trabajador> {
    return this.http.post<Trabajador>(this.apiUrl, trabajador, { headers: this.getAuthHeaders() });
  }

  // 🔥 Eliminar un trabajador
  eliminarTrabajador(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  // 🔥 Verificar contraseña antes de eliminar
  verificarContraseña(contraseña: string): Observable<boolean> {
    return this.http.post<boolean>(
      `${this.apiUrl}/verificar-password`,
      { contraseña },
      { headers: this.getAuthHeaders() }
    );
  }

  //--------------------------------- para un solo trabajador------------------//
  // 🔥 Obtener un trabajador específico
  obtenerTrabajador(id: string): Observable<Trabajador> {
    return this.http.get<Trabajador>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  // 🔥 Obtener asistencias de un trabajador específico
  obtenerAsistencias(trabajadorId: string): Observable<any[]> {
    const url = `${this.apiUrl}/${trabajadorId}/asistencias`;
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() });
  }

  // 🔥 Actualizar un trabajador existente
  actualizarTrabajador(id: string, trabajador: any) {
    return this.http.put(`${this.apiUrl}/${id}`, trabajador, { headers: this.getAuthHeaders() });
  }

  obtenerEventosCalendarioTrabajador(trabajadorId: string, anio: number): Observable<any> {
    const url = `${environment.apiUrl}/calendario-trabajador/${trabajadorId}/${anio}`;
    return this.http.get<any>(url, { headers: this.getAuthHeaders() });
  }

  actualizarSincronizacion(id: string, sincronizado: boolean) {
    return this.http.put(`${this.apiUrl}/sincronizacion/${id}`, { sincronizado }, { headers: this.getAuthHeaders() });
  }

}
