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

  // 🔍 Obtener calendario por sede y año
  obtenerPorSedeYAnio(sede: number, anio: number) {
    return this.http.get<any>(`${this.baseUrl}/sede/${sede}/anio/${anio}`);
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
  }) {
    const payload = {
      año: data.año,
      sede: data.sede,
      tipo: data.tipo,
      descripcion: data.descripcion || '',
      fecha: typeof data.fecha === 'string' ? data.fecha : data.fecha.toISOString()
    };

    return this.http.post<any>(`${this.baseUrl}/agregar-dia`, payload);
  }

  // ✏️ Editar un día especial
  editarDia(data: {
    año: number;
    sede: number;
    fecha: Date | string;
    tipo: string;
    descripcion: string;
  }) {
    const payload = {
      año: data.año,
      sede: data.sede,
      tipo: data.tipo,
      descripcion: data.descripcion || '',
      fecha: typeof data.fecha === 'string' ? data.fecha : data.fecha.toISOString()
    };

    return this.http.put<any>(`${this.baseUrl}/editar-dia`, payload);
  }

  // ❌ Eliminar un día especial (con contraseña)
  eliminarDia(data: {
    año: number;
    sede: number;
    fecha: Date | string;
    contraseña?: string;
  }) {
    const payload = {
      año: data.año,
      sede: data.sede,
      fecha: typeof data.fecha === 'string' ? data.fecha : data.fecha.toISOString(),
      contraseña: data.contraseña
    };

    return this.http.request<any>('delete', `${this.baseUrl}/eliminar-dia`, {
      body: payload
    });
  }

  // 🆕 Alias para compatibilidad con detalle-sede
  guardarDiaEspecial(data: {
    año: number;
    sede: number;
    fecha: Date | string;
    tipo: string;
    descripcion: string;
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
  obtenerEventosDeTrabajador(idTrabajador: string): Observable<{ diasEspeciales: any[] }> {
    return this.http.get<{ diasEspeciales: any[] }>(`${this.baseUrl}/trabajador/${idTrabajador}`);
  }

  obtenerEventosDeSede(idSede: string, anio: number): Observable<{ diasEspeciales: any[] }> {
    return this.http.get<{ diasEspeciales: any[] }>(`${this.baseUrl}/sede/${idSede}/anio/${anio}`);
  }
}
