import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';

  constructor(private router: Router) {
    // 📌 Obtener usuario directamente en el constructor para evitar errores
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuario.nombre) {
      this.usuarioNombre = usuario.nombre;
    }
    if (usuario.rol) {
      this.usuarioRol = usuario.rol;
    }

    console.log("✅ Usuario cargado en el constructor:", usuario);
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
    console.log("🛠️ Verificando rol en esAdmin():", this.usuarioRol);
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
