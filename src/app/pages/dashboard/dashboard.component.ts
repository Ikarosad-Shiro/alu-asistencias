import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  usuarioNombre: string = '';
  usuarioRol: string = '';

  constructor(private router: Router) {
    this.usuarioNombre = localStorage.getItem('nombre') || 'Usuario';
    this.usuarioRol = localStorage.getItem('rol') || '';
  }

  // 🔥 Método para saber si el usuario es Admin o Dios
  esAdmin(): boolean {
    return this.usuarioRol === 'Dios' || this.usuarioRol === 'Administrador';
  }

  // 🔥 Redirigir al `AdminDashboard` cuando hagan clic en el botón
  verUsuarios() {
    this.router.navigate(['/admin-dashboard']);
  }

  // 🔥 Cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
