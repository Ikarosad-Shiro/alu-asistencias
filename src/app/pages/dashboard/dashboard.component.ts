import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsistenciaService } from 'src/app/services/asistencia.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';

  trabajadoresHoy: any[] = []; // 🆕 Asistencias del día actual
  columnas: string[] = ['nombre', 'hora', 'sede']; // Columnas para la tabla

  constructor(
    private router: Router,
    private asistenciaService: AsistenciaService
  ) {
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
      this.cargarAsistenciasHoy();
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

  cargarAsistenciasHoy() {
    this.asistenciaService.obtenerAsistenciasDeHoy().subscribe((data) => {
      this.trabajadoresHoy = data;
      console.log("✅ Asistencias de hoy:", this.trabajadoresHoy);
    });
  }

// 📌 Función para mostrar/ocultar la sidebar en móviles
toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (sidebar && overlay) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
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
