import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  usuarioNombre: string = 'Usuario'; // Esto debería venir desde el servicio de autenticación

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Simulación de obtener nombre del usuario
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuario && usuario.nombre) {
      this.usuarioNombre = usuario.nombre;
    }
  }

  // 📌 Función para mostrar/ocultar la sidebar en móviles
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('active');
    }
  }

  // 📌 Función para verificar si es administrador
  esAdmin(): boolean {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return usuario.rol === 'Administrador' || usuario.rol === 'Dios';
  }

  // 📌 Función para cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
