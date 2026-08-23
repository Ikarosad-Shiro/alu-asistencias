import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CalendarioService {
  private baseUrl = `${environment.apiUrl}/calendario`;

  constructor(private http: HttpClient) {}


  private toYmd(v: Date | string): string {
  if (typeof v === 'string') {
    // ya viene como YYYY-MM-DD o ISO → corta
    return v.split('T')[0];
  }
  // Fuerza a "fecha de calendario" estable
  const iso = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString();
  return iso.slice(0, 10); // YYYY-MM-DD
}

  // 🔍 Obtener calendario por sede y año (normaliza fechas a YMD)
  obtenerPorSedeYAnio(sede: number, anio: number) {
    return this.http.get<any>(`${this.baseUrl}/sede/${sede}/anio/${anio}`)
      .pipe(map(res => ({
        ...res,
        diasEspeciales: (res?.diasEspeciales || []).map((e: any) => ({
          ...e,
          // <- MUY IMPORTANTE: el front guarda sólo YMD
          fecha: new Date(e.fecha).toISOString().slice(0, 10)
        }))
      })));
  }

  // ✅ Obtener todos los calendarios
  obtenerTodos() {
    return this.http.get<any[]>(`${this.baseUrl}/todos`);
  }

// ➕ Agregar un día especial
agregarDia(data: {
  año: number;
  sede: number;
  fecha: Date | string;
  tipo: string;
  descripcion: string;
  horaInicio?: string;
  horaFin?: string;
}) {
  const payload: any = {
    año: data.año,
    sede: data.sede,
    tipo: data.tipo,
    descripcion: data.descripcion || '',
    fecha: this.toYmd(data.fecha)
  };

  const tipoNormalizado = String(data.tipo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (tipoNormalizado === 'media jornada') {
    payload.horaInicio = data.horaInicio;
    payload.horaFin = data.horaFin;
  }

  console.log('📤 Payload final agregarDia:', payload);

  return this.http.post<any>(`${this.baseUrl}/agregar-dia`, payload);
}

// ✏️ Editar
editarDia(data: {
  año: number;
  sede: number;
  fecha: Date | string;
  tipo: string;
  descripcion: string;
  horaInicio?: string;
  horaFin?: string;
}) {
  const payload: any = {
    año: data.año,
    sede: data.sede,
    tipo: data.tipo,
    descripcion: data.descripcion || '',
    fecha: this.toYmd(data.fecha)
  };

  const tipoNormalizado = String(data.tipo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (tipoNormalizado === 'media jornada') {
    payload.horaInicio = data.horaInicio;
    payload.horaFin = data.horaFin;
  }

  console.log('📤 Payload final editarDia:', payload);

  return this.http.put<any>(`${this.baseUrl}/editar-dia`, payload);
}

// ❌ Eliminar
eliminarDia(data: { año: number; sede: number; fecha: Date | string; contraseña?: string; }) {
  const payload = {
    año: data.año,
    sede: data.sede,
    fecha: this.toYmd(data.fecha), // <- YYYY-MM-DD
    contraseña: data.contraseña
  };
  return this.http.request<any>('delete', `${this.baseUrl}/eliminar-dia`, { body: payload });
}

  // 🆕 Alias para compatibilidad con detalle-sede
guardarDiaEspecial(data: {
  año: number;
  sede: number;
  fecha: Date | string;
  tipo: string;
  descripcion: string;
  horaInicio?: string;
  horaFin?: string;
  editar?: boolean;
}) {
  return data.editar
    ? this.editarDia(data)
    : this.agregarDia(data);
}

  eliminarDiaEspecial(data: {
    año: number;
    sede: number;
    fecha: Date | string;
    contraseña?: string;
  }) {
    return this.eliminarDia(data);
  }

  // 🩺 Verifica que la ruta esté viva
  ping() {
    return this.http.get(`${this.baseUrl}/ping`);
  }

  // ✅ CORREGIDOS: devolviendo solo el array de eventos
// En calendario.service.ts
  obtenerEventosDeTrabajador(idTrabajador: string): Observable<{ diasEspeciales: any[] }> {
    return this.http.get<{ diasEspeciales: any[] }>(
      `${this.baseUrl}/trabajador/${idTrabajador}`
    ).pipe(
      map(response => {
        // Normalizar fechas
        if (response?.diasEspeciales) {
          response.diasEspeciales = response.diasEspeciales.map(e => ({
            ...e,
            fecha: e.fecha ? new Date(e.fecha).toISOString().split('T')[0] : null
          }));
        }
        return response;
      })
    );
  }

  obtenerEventosDeSede(idSede: string, anio: number): Observable<{ diasEspeciales: any[] }> {
    return this.http.get<{ diasEspeciales: any[] }>(
      `${this.baseUrl}/sede/${idSede}/anio/${anio}`
    ).pipe(
      map(response => {
        if (response?.diasEspeciales) {
          response.diasEspeciales = response.diasEspeciales.map(e => ({
            ...e,
            fecha: e.fecha ? new Date(e.fecha).toISOString().split('T')[0] : null
          }));
        }
        return response;
      })
    );
  }
}
