import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  usuarioNombre: string = 'Usuario'; // Nombre del usuario
  usuarioRol: string = ''; // Rol del usuario

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Obtener datos del usuario desde localStorage
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuario && usuario.nombre) {
      this.usuarioNombre = usuario.nombre;
    }
    if (usuario && usuario.rol) {
      this.usuarioRol = usuario.rol;
    }
  }

  // 📌 Función para mostrar/ocultar la sidebar en móviles
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  }

  // 📌 Función para verificar si es administrador o Dios
  esAdmin(): boolean {
    return this.usuarioRol === 'Administrador' || this.usuarioRol === 'Dios';
  }

  // 📌 Redirigir al `AdminDashboard` cuando hagan clic en el botón
  verUsuarios() {
    this.router.navigate(['/admin-dashboard']);
  }

  // 📌 Función para cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}