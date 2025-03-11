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

  // 📌 Método para verificar un usuario (Opcional, si quieres confirmar usuarios activos)
  verify(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/verify/${userId}`);
  }

  // 📌 Método para cerrar sesión
  logout(): void {
    localStorage.removeItem('token'); // Eliminar el token del localStorage
    this.router.navigate(['/login']); // Redirigir al login
  }

  // 📌 Método para comprobar si el usuario está autenticado
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token'); // Retorna true si hay un token guardado
  }

  // 📌 Método para obtener el rol del usuario
  getUserRole(): string | null {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1])); // Decodificar token
      return payload.rol || null;
    }
    return null;
  }

  // 📌 Método para solicitar restablecimiento de contraseña
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // 📌 Método para confirmar restablecimiento de contraseña
  resetPasswordConfirm(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password/confirm`, { token, password });
  }
}
