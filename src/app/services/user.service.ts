import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';  // 🌟 Importa el environment

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/auth/usuarios`; // Asegúrate de que la URL es correcta

  constructor(private http: HttpClient) {}

  // 📌 Obtener el token almacenado en el localStorage
  private getAuthHeaders() {
    const token = localStorage.getItem('token'); // 🔥 Recupera el token
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`, // 🔥 Agrega el token en los headers
      'Content-Type': 'application/json'
    });
  }

  // 📌 Obtener usuarios
  obtenerUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, { headers: this.getAuthHeaders() });
  }

  // 📌 Obtener perfil del usuario autenticado 🔥🔥
  obtenerPerfil(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/auth/perfil`, { headers: this.getAuthHeaders() });
  }

  // 📌 Actualizar usuario (cambiar rol o activar/desactivar)
  actualizarUsuario(userId: string, updateData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${userId}`, updateData, { headers: this.getAuthHeaders() });
  }

  // 📌 Eliminar usuario (con contraseña en el body)
  eliminarUsuario(userId: string, contraseña: string): Observable<any> {
    const headers = this.getAuthHeaders(); // Recupera los headers con el token
    const body = { contraseña }; // Incluye la contraseña en el body
    return this.http.request('delete', `${this.apiUrl}/${userId}`, { headers, body });
  }

  // 📌 Verificar contraseña antes de eliminar o desactivar
  verificarContraseña(contraseña: string): Observable<any> {
    const token = localStorage.getItem("token");
    return this.http.post(`${this.apiUrl}/verificar-password`, { contraseña }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
