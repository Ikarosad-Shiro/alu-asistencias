import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CalendarioTrabajadorService {
  private apiUrl = `${environment.apiUrl}/calendario-trabajador`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  // 📌 Obtener el calendario de un trabajador para un año específico
  obtenerCalendarioTrabajador(trabajadorId: string, anio: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${trabajadorId}/${anio}`, this.getAuthHeaders());
  }

  // 📌 Crear o actualizar días especiales del trabajador
  guardarCalendarioTrabajador(data: { trabajador: string, anio: number, diasEspeciales: any[] }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, data, this.getAuthHeaders());
  }

  // 📌 Eliminar un día especial (se envía la nueva lista de días)
  eliminarDiaEspecial(trabajadorId: string, anio: number, nuevaListaDias: any[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${trabajadorId}/${anio}`, { nuevaListaDias }, this.getAuthHeaders());
  }
}
