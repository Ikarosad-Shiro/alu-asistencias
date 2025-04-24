import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import { environment } from 'src/environments/environment'; // Asegurar que el archivo de entorno esté bien configurado

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl; // URL del backend

  constructor(private http: HttpClient, private router: Router) {}

  // 📌 Método para registrar un usuario
  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, userData);
  }

  // 📌 Método para login de usuario
  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, credentials);
  }

  // 📌 Método para verificar un usuario
  verify(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/verify/${userId}`);
  }

  // 📌 Método para cerrar sesión
  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  // 📌 Método para comprobar si el usuario está autenticado
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  // 📌 Obtener el rol del usuario
  getUserRole(): string | null {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.rol || null;
    }
    return null;
  }

  // 📌 Obtener datos del token
  obtenerDatosDesdeToken(): { nombre: string; rol: string; email: string } | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        nombre: payload.nombre,
        rol: payload.rol,
        email: payload.email
      };
    } catch (error) {
      console.error('❌ Error al decodificar el token:', error);
      return null;
    }
  }

  // 📌 Solicitar restablecimiento de contraseña
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // 📌 Confirmar restablecimiento de contraseña
  resetPasswordConfirm(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password/confirm`, { token, password });
  }

  // 🔐 Verificar contraseña para acciones sensibles
  verificarPassword(contraseña: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/usuarios/verificar-password`, { contraseña });
  }

// auth.service.ts
enviarCodigoEliminacionSede(email: string, codigo: string): Observable<any> {
  return this.http.post(`${this.apiUrl}/auth/enviar-codigo`, { email, codigo });
}

}
