import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

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
    nuevoTipo: string;
    nuevaDescripcion: string;
  }) {
    const payload = {
      año: data.año,
      sede: data.sede,
      nuevoTipo: data.nuevoTipo,
      nuevaDescripcion: data.nuevaDescripcion,
      fecha: typeof data.fecha === 'string' ? data.fecha : data.fecha.toISOString()
    };

    return this.http.put<any>(`${this.baseUrl}/editar-dia`, payload);
  }

  // ❌ Eliminar un día especial
  eliminarDia(data: {
    año: number;
    sede: number;
    fecha: Date | string;
  }) {
    const payload = {
      año: data.año,
      sede: data.sede,
      fecha: typeof data.fecha === 'string' ? data.fecha : data.fecha.toISOString()
    };

    return this.http.request<any>('delete', `${this.baseUrl}/eliminar-dia`, {
      body: payload
    });
  }

  // 🩺 Verifica que la ruta esté viva
  ping() {
    return this.http.get(`${this.baseUrl}/ping`);
  }
}
