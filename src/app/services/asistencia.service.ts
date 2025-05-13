import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaService {
  private apiUrl = `${environment.apiUrl}/asistencias`;

  constructor(private http: HttpClient) {}

  obtenerPorTrabajadorYRango(idTrabajador: string, inicio: Date, fin: Date): Observable<any[]> {
    // Usamos solo la parte de la fecha (YYYY-MM-DD) para la consulta
    const params = new HttpParams()
      .set('inicio', inicio.toISOString().split('T')[0])
      .set('fin', fin.toISOString().split('T')[0]);

    return this.http.get<any[]>(
      `${this.apiUrl}/reporte/trabajador/${idTrabajador}`,
      { params }
    ).pipe(
      // Normalizamos la respuesta para asegurar consistencia
      map(response => {
        if (!response || !Array.isArray(response)) {
          console.warn('La respuesta del servidor no es un array válido:', response);
          return [];
        }

        return response.map(item => ({
          ...item,
          // Aseguramos formato YYYY-MM-DD para la fecha principal
          fecha: item.fecha ? item.fecha.split('T')[0] : '',
          // Normalizamos los detalles de asistencia
          detalle: (item.detalle || []).map((d: any) => ({
            ...d,
            // Convertimos fechaHora a string ISO si no lo está
            fechaHora: d.fechaHora ?
              (typeof d.fechaHora === 'string' ? d.fechaHora : new Date(d.fechaHora).toISOString()) :
              null,
            // Preservamos flags especiales
            ...(d.salida_automatica && { salida_automatica: true }),
            ...(d.sincronizado && { sincronizado: true })
          })),
          // Preservamos el estado si existe
          ...(item.estado && { estado: item.estado })
        }));
      }),
      // Manejo de errores robusto
      catchError(error => {
        console.error('Error al obtener asistencias:', error);
        return of([]); // Retornamos array vacío en caso de error
      })
    );
  }

  // Método adicional para verificar conexión con el servidor
  verificarConexion(): Observable<boolean> {
    return this.http.get<{status: string}>(`${this.apiUrl}/health`).pipe(
      map(response => response?.status === 'OK'),
      catchError(() => of(false))
    );
  }

  obtenerDatosUnificados(trabajadorId: string, inicio: Date, fin: Date): Observable<any> {
    const params = new HttpParams()
      .set('inicio', inicio.toISOString().split('T')[0])
      .set('fin', fin.toISOString().split('T')[0]);

      return this.http.get(`${this.apiUrl}/unificado/${trabajadorId}`, { params });
  }
}
