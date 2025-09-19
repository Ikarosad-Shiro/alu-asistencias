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

  // Helper para asegurar YYYY-MM-DD
  private toYmd(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  obtenerPorTrabajadorYRango(idTrabajador: string, inicio: Date, fin: Date): Observable<any[]> {
    const params = new HttpParams()
      .set('inicio', this.toYmd(inicio))
      .set('fin', this.toYmd(fin));

    return this.http.get<any[]>(
      `${this.apiUrl}/reporte/trabajador/${idTrabajador}`,
      { params }
    ).pipe(
      map(response => {
        if (!response || !Array.isArray(response)) {
          console.warn('La respuesta del servidor no es un array válido:', response);
          return [];
        }

        return response.map(item => ({
          ...item,
          fecha: item.fecha ? item.fecha.split('T')[0] : '',
          detalle: (item.detalle || []).map((d: any) => ({
            ...d,
            fechaHora: d.fechaHora
              ? (typeof d.fechaHora === 'string' ? d.fechaHora : new Date(d.fechaHora).toISOString())
              : null,
            ...(d.salida_automatica && { salida_automatica: true }),
            ...(d.sincronizado && { sincronizado: true })
          })),
          ...(item.estado && { estado: item.estado })
        }));
      }),
      catchError(error => {
        console.error('Error al obtener asistencias:', error);
        return of([]); // array vacío en caso de error
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

  // === Uso general (PDF/Excel/otros): SIN ignorar sede ===
  obtenerDatosUnificados(trabajadorId: string, inicio: Date, fin: Date): Observable<any> {
    const params = new HttpParams()
      .set('inicio', this.toYmd(inicio))
      .set('fin', this.toYmd(fin));

    return this.http.get(`${this.apiUrl}/unificado/${trabajadorId}`, { params }).pipe(
      catchError(err => {
        console.error('Error en obtenerDatosUnificados:', err);
        // Forma segura para consumidores que esperan estas llaves
        return of({ asistencias: [], eventosTrabajador: [], eventosSede: [] });
      })
    );
  }

  // === SOLO para el CALENDARIO del detalle: IGNORA sede ===
  obtenerDatosUnificadosParaCalendario(trabajadorId: string, inicio: Date, fin: Date): Observable<any> {
    const params = new HttpParams()
      .set('inicio', this.toYmd(inicio))
      .set('fin', this.toYmd(fin))
      .set('ignorarSede', 'true'); // 👈 clave para mezclar asistencias de todas las sedes

    return this.http.get(`${this.apiUrl}/unificado/${trabajadorId}`, { params }).pipe(
      catchError(err => {
        console.error('Error en obtenerDatosUnificadosParaCalendario:', err);
        return of({ asistencias: [], eventosTrabajador: [], eventosSede: [] });
      })
    );
  }

  obtenerUnificadoPorSede(sedeId: number, inicio: string, fin: string) {
    const params = new URLSearchParams({ inicio, fin });
    return this.http.get(`${this.apiUrl}/unificado-sede/${sedeId}?${params.toString()}`);
  }

  obtenerAsistenciasDeHoy(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/hoy`);
  }

  // Compat heredada (si en algún lado la usas con strings)
  obtenerUnificadoPorTrabajador(id: string, inicio: string, fin: string) {
    return this.http.get(`${environment.apiUrl}/asistencias/unificado/${id}?inicio=${inicio}&fin=${fin}`);
  }
}
