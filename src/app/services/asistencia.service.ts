import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaService {
  private apiUrl = `${environment.apiUrl}/asistencias`;

  constructor(private http: HttpClient) {}

  obtenerPorTrabajadorYRango(idTrabajador: string, inicio: Date, fin: Date): Observable<any[]> {
    const params = new HttpParams()
      .set('inicio', inicio.toISOString())
      .set('fin', fin.toISOString());

    return this.http.get<any[]>(`${this.apiUrl}/reporte/trabajador/${idTrabajador}`, { params });
  }
}
