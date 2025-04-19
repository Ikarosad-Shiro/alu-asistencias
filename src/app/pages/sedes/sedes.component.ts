import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.component.html',
  styleUrls: ['./sedes.component.css']
})
export class SedesComponent implements OnInit {
  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';
  sidebarAbierto: boolean = false;

  constructor(private router: Router) {
    console.log('📌 Constructor de Sedes ejecutado');
    this.obtenerUsuario();

    // Detecta cambios en otras pestañas
    window.addEventListener('storage', () => {
      console.log('🔁 Cambio en localStorage detectado');
      this.obtenerUsuario();
    });
  }

  ngOnInit(): void {
    console.log('📌 ngOnInit ejecutado en Sedes');
    setTimeout(() => {
      this.obtenerUsuario();
    }, 300);
  }

  // 📌 Obtener nombre y rol del usuario
  obtenerUsuario(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuario?.nombre) this.usuarioNombre = usuario.nombre;
    if (usuario?.rol) this.usuarioRol = usuario.rol;

    console.log('✅ Usuario cargado:', usuario);
  }

  // 📌 Mostrar u ocultar el sidebar (modo responsivo)
  toggleSidebar(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    }
  }

  // 📌 Verifica si es administrador o Dios
  esAdmin(): boolean {
    console.log('🛠️ Verificando rol:', this.usuarioRol);
    return this.usuarioRol === 'Administrador' || this.usuarioRol === 'Dios';
  }

  // 📌 Cerrar sesión
  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
