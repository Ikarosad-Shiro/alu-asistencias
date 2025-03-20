import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';

  constructor(private router: Router) {
    console.log("📌 Constructor ejecutado.");
    this.obtenerUsuario(); // Intentar obtener usuario al inicio

    // **Escuchar cambios en localStorage (cuando el usuario inicia sesión)**
    window.addEventListener('storage', () => {
      console.log("🔄 Cambio detectado en localStorage.");
      this.obtenerUsuario(); // Vuelve a obtener los datos
    });
  }

  ngOnInit(): void {
    console.log("📌 ngOnInit ejecutado.");

    // **Asegurar que los datos se actualicen después de la carga inicial**
    setTimeout(() => {
      this.obtenerUsuario();
    }, 500);
  }

  // 📌 **Obtener usuario desde localStorage**
  obtenerUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuario.nombre) {
      this.usuarioNombre = usuario.nombre;
    }
    if (usuario.rol) {
      this.usuarioRol = usuario.rol;
    }

    console.log("✅ Usuario actualizado:", usuario);
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

  // 📌 Redirigir al `AdminDashboard`
  verUsuarios() {
    this.router.navigate(['/admin-dashboard']);
  }

  // 📌 Función para cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
