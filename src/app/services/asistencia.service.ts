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

  // =========================
  // Helpers
  // =========================

  // YYYY-MM-DD estable (evita problemas de zona/horario de verano)
  private toYmd(d: Date): string {
    if (!(d instanceof Date)) d = new Date(d);
    // construimos un UTC midnight para no "cruzar" de día
    const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
    return iso.slice(0, 10);
  }

  private normFechaYYYYMMDD(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') return v.split('T')[0];
    try { return new Date(v).toISOString().split('T')[0]; } catch { return ''; }
  }

  private normISO(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    try { return new Date(v).toISOString(); } catch { return null; }
  }

  private normalizeUnificadoPayload(res: any) {
    const safe = res || {};
    const asistencias = Array.isArray(safe.asistencias) ? safe.asistencias : [];

    const asistenciasNorm = asistencias.map((a: any) => {
      const fecha = this.normFechaYYYYMMDD(a?.fecha);
      const sedeDoc = (a?.sede ?? null);
      const detalle = Array.isArray(a?.detalle) ? a.detalle.map((d: any) => ({
        ...d,
        fechaHora: this.normISO(d?.fechaHora),
        salida_automatica: !!d?.salida_automatica,
        sincronizado: !!d?.sincronizado,
        // 👇 MUY IMPORTANTE para detectar "Otra Sede" en front
        sede: (d?.sede ?? sedeDoc ?? null)
      })) : [];

      return { ...a, fecha, detalle };
    });

    return {
      asistencias: asistenciasNorm,
      eventosTrabajador: Array.isArray(safe.eventosTrabajador) ? safe.eventosTrabajador : [],
      eventosSede: Array.isArray(safe.eventosSede) ? safe.eventosSede : []
    };
  }

  // =========================
  // Endpoints
  // =========================

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
          fecha: this.normFechaYYYYMMDD(item?.fecha),
          detalle: (item?.detalle || []).map((d: any) => ({
            ...d,
            fechaHora: this.normISO(d?.fechaHora),
            salida_automatica: !!d?.salida_automatica,
            sincronizado: !!d?.sincronizado,
            // fallback de sede a nivel doc
            sede: (d?.sede ?? item?.sede ?? null)
          })),
          ...(item?.estado && { estado: item.estado })
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

  // === Uso general (PDF/Excel/otros): respetando sede (por defecto en backend) ===
  obtenerDatosUnificados(trabajadorId: string, inicio: Date, fin: Date): Observable<any> {
    const params = new HttpParams()
      .set('inicio', this.toYmd(inicio))
      .set('fin', this.toYmd(fin));

    return this.http.get(`${this.apiUrl}/unificado/${trabajadorId}`, { params }).pipe(
      map(res => this.normalizeUnificadoPayload(res)),
      catchError(err => {
        console.error('Error en obtenerDatosUnificados:', err);
        return of({ asistencias: [], eventosTrabajador: [], eventosSede: [] });
      })
    );
  }

  // === SOLO para el CALENDARIO / cruces multi-sede: ignora sede ===
  obtenerDatosUnificadosParaCalendario(trabajadorId: string, inicio: Date, fin: Date): Observable<any> {
    const params = new HttpParams()
      .set('inicio', this.toYmd(inicio))
      .set('fin', this.toYmd(fin))
      .set('ignorarSede', 'true'); // 👈 mix de todas las sedes

    return this.http.get(`${this.apiUrl}/unificado/${trabajadorId}`, { params }).pipe(
      map(res => this.normalizeUnificadoPayload(res)),
      catchError(err => {
        console.error('Error en obtenerDatosUnificadosParaCalendario:', err);
        return of({ asistencias: [], eventosTrabajador: [], eventosSede: [] });
      })
    );
  }

  // === Unificado por SEDE (el backend ya calcula "Otra Sede" en datosPorDia) ===
  obtenerUnificadoPorSede(sedeId: number, inicio: string, fin: string): Observable<any> {
    const params = new HttpParams().set('inicio', inicio).set('fin', fin);
    return this.http.get(`${this.apiUrl}/unificado-sede/${sedeId}`, { params }).pipe(
      catchError(err => {
        console.error('Error en obtenerUnificadoPorSede:', err);
        return of({ sede: sedeId, rango: { inicio, fin }, trabajadores: [] });
      })
    );
  }

  obtenerAsistenciasDeHoy(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/hoy`);
  }

  // Compat heredada (si en algún lado la usas con strings)
  obtenerUnificadoPorTrabajador(id: string, inicio: string, fin: string): Observable<any> {
    const params = new HttpParams().set('inicio', inicio).set('fin', fin);
    return this.http.get(`${this.apiUrl}/unificado/${id}`, { params }).pipe(
      map(res => this.normalizeUnificadoPayload(res)),
      catchError(err => {
        console.error('Error en obtenerUnificadoPorTrabajador (compat):', err);
        return of({ asistencias: [], eventosTrabajador: [], eventosSede: [] });
      })
    );
  }
}
