import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface HistorialSedeUI {
  idSede: string | number;
  nombre: string;
  fechaInicio: string | Date | null;
  fechaFin: string | Date | null;
}

export interface TrabajadorUI {
  _id?: string;
  id_checador?: number | string | null;
  nombre: string;
  sede: number | null;
  sincronizado: boolean;
  estado?: 'activo' | 'inactivo';
  correo?: string;
  telefono?: string;
  telefonoEmergencia?: string;
  direccion?: string;
  puesto?: string;
  sedesForaneas?: number[];
  sedePrincipal?: number | null;
  nuevoIngreso?: boolean;
  fechaAlta?: string | null;

  // 👇 **AÑADE ESTO**
  historialSedes?: HistorialSedeUI[];
}

/** ===== Posibles formas que devuelve/espera el backend (legacy / nuevo) ===== */
interface TrabajadorApi {
  _id?: string;
    id_checador?: number | string | null; // ✅ AGREGAR
  nombre: string;
  // legacy:
  sede?: number | null;
  // nuevo:
  sedePrincipal?: number | null;
  sedesForaneas?: number[];

  sincronizado: boolean;
  estado?: 'activo' | 'inactivo';

  correo?: string;
  telefono?: string;
  telefonoEmergencia?: string;
  direccion?: string;
  puesto?: string;

  // alta
  nuevoIngreso?: boolean;
  fechaAlta?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TrabajadoresService {
  private apiUrl = `${environment.apiUrl}/trabajadores`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  /** =========================
   *  Normalización (API → UI)
   *  ========================= */
  private normalizeTrabajador = (t: TrabajadorApi): TrabajadorUI => {
    const sedePrincipal = (t.sedePrincipal ?? t.sede ?? null) as number | null;

    return {
      _id: t._id,
       id_checador: t.id_checador ?? null,
      nombre: t.nombre,
      // la UI sigue usando `sede` como “principal”
      sede: sedePrincipal,
      // espejo por si lo necesitas más adelante
      sedePrincipal,
      sedesForaneas: t.sedesForaneas || [],
      sincronizado: !!t.sincronizado,
      estado: t.estado,
      correo: t.correo,
      telefono: t.telefono,
      telefonoEmergencia: t.telefonoEmergencia,
      direccion: t.direccion,
      puesto: t.puesto,
      nuevoIngreso: t.nuevoIngreso,
      fechaAlta: t.fechaAlta ?? null,

      historialSedes: Array.isArray((t as any).historialSedes)
        ? (t as any).historialSedes.map((h: any) => ({
          idSede: typeof h.idSede === 'number' ? String(h.idSede) : h.idSede,
          nombre: h.nombre || '',
          fechaInicio: h.fechaInicio ? new Date(h.fechaInicio) : null,
          fechaFin: h.fechaFin ? new Date(h.fechaFin) : null,
        }))
      : [],
    };
  };

  /** =========================
   *  Normalización (UI → API)
   *  Envío compatible: siempre
   *  incluye `sede` = principal
   *  ========================= */
  private toApiPayload = (t: Partial<TrabajadorUI>): TrabajadorApi => {
    const sedePrincipal = (t.sedePrincipal ?? t.sede ?? null) as number | null;

    return {
      _id: t._id,
      nombre: t.nombre || '',
      // compatibilidad con back anterior:
      sede: sedePrincipal,
      // y listo para el back nuevo:
      sedePrincipal,
      sedesForaneas: t.sedesForaneas || [],

      sincronizado: !!t.sincronizado,
      estado: t.estado,

      correo: t.correo,
      telefono: t.telefono,
      telefonoEmergencia: t.telefonoEmergencia,
      direccion: t.direccion,
      puesto: t.puesto,

      nuevoIngreso: t.nuevoIngreso,
      fechaAlta: t.fechaAlta ?? null,
    };
  };

  // 🔥 Obtener todos los trabajadores (normalizados)
  obtenerTrabajadores(): Observable<TrabajadorUI[]> {
    return this.http
      .get<TrabajadorApi[]>(this.apiUrl, { headers: this.getAuthHeaders() })
      .pipe(map(arr => (arr || []).map(this.normalizeTrabajador)));
  }

  // 🔥 Agregar un nuevo trabajador (multisede compatible)
  agregarTrabajador(trabajador: Partial<TrabajadorUI>): Observable<TrabajadorUI> {
    const payload = this.toApiPayload(trabajador);
    return this.http
      .post<TrabajadorApi>(this.apiUrl, payload, { headers: this.getAuthHeaders() })
      .pipe(map(this.normalizeTrabajador));
  }

  // 🔥 Eliminar un trabajador
  eliminarTrabajador(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  // 🔥 Verificar contraseña (acciones sensibles)
  verificarContraseña(contraseña: string): Observable<boolean> {
    return this.http.post<boolean>(
      `${this.apiUrl}/verificar-password`,
      { contraseña },
      { headers: this.getAuthHeaders() }
    );
  }

  // 🔥 Obtener un trabajador específico (normalizado)
  obtenerTrabajador(id: string): Observable<TrabajadorUI> {
    return this.http
      .get<TrabajadorApi>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() })
      .pipe(map(this.normalizeTrabajador));
  }

  // 🔥 Obtener asistencias de un trabajador específico
  obtenerAsistencias(trabajadorId: string): Observable<any[]> {
    const url = `${this.apiUrl}/${trabajadorId}/asistencias`;
    return this.http.get<any[]>(url, { headers: this.getAuthHeaders() });
  }

  // 🔥 Actualizar un trabajador existente (multisede compatible)
  actualizarTrabajador(id: string, trabajador: Partial<TrabajadorUI>): Observable<TrabajadorUI> {
    const payload = this.toApiPayload(trabajador);
    return this.http
      .put<TrabajadorApi>(`${this.apiUrl}/${id}`, payload, { headers: this.getAuthHeaders() })
      .pipe(map(this.normalizeTrabajador));
  }

  // 🔥 (Opcional) Actualizar SOLO estructura de sedes (si implementas endpoint dedicado en el back)
  // 🔁 Actualizar sede principal y sedes foráneas
  actualizarSedes(
    id: string,
    data: { sedePrincipal: number; sedesForaneas: number[] }
  ): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/${id}/sedes`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

    // 🧰 Reparar historial (server-side)
  repararHistorial(id: string): Observable<TrabajadorUI> {
    return this.http
      .put<{ message: string; trabajador: TrabajadorApi }>(
        `${this.apiUrl}/${id}/historial/reparar`,
        {},
        { headers: this.getAuthHeaders() }
      )
      .pipe(map(resp => this.normalizeTrabajador(resp.trabajador)));
  }

  // 🔥 Calendario por trabajador
  obtenerEventosCalendarioTrabajador(trabajadorId: string, anio: number): Observable<any> {
    const url = `${environment.apiUrl}/calendario-trabajador/${trabajadorId}/${anio}`;
    return this.http.get<any>(url, { headers: this.getAuthHeaders() });
  }

  // 🔥 Actualizar estado de sincronización
  actualizarSincronizacion(id: string, sincronizado: boolean) {
    return this.http.put(
      `${this.apiUrl}/sincronizacion/${id}`,
      { sincronizado },
      { headers: this.getAuthHeaders() }
    );
  }

  // 🔥 Cambiar estados de nuevos registros
// trabajadores.service.ts
cerrarNuevoIngresoMasivo(dryRun = false, setFechaFin = true) {
  const params = `?dry=${dryRun ? '1' : '0'}&setFechaFin=${setFechaFin ? '1' : '0'}`;
  return this.http.post<any>(
    `${this.apiUrl}/_cron/cerrar-nuevo-ingreso${params}`,
    {}, // body vacío
    { headers: this.getAuthHeaders() }
  );
}

}
