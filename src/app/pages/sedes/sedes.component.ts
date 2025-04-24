import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SedeService } from 'src/app/services/sede.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.component.html',
  styleUrls: ['./sedes.component.css']
})
export class SedesComponent implements OnInit {
  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';
  sidebarAbierto: boolean = false;

  // 📌 Lista de sedes
  sedes: any[] = [];

  constructor(
    private router: Router,
    private sedeService: SedeService,
    private authService: AuthService
  ) {
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
      this.cargarSedes(); // ✅ Cargamos sedes
    }, 300);
  }

  // 📌 Obtener nombre y rol del usuario desde el token
  obtenerUsuario(): void {
    const usuario = this.authService.obtenerDatosDesdeToken();

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

  esDios(): boolean {
    return this.usuarioRol === 'Dios';
  }

  // 📌 Cerrar sesión
  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  // 📌 Cargar sedes desde el backend
  cargarSedes(): void {
    this.sedeService.obtenerSedes().subscribe({
      next: (res) => {
        console.log('📥 Sedes cargadas:', res);
        this.sedes = res;
      },
      error: (err) => {
        console.error('❌ Error al obtener sedes:', err);
      }
    });
  }

  nuevaSede = {
    id: 0,
    nombre: ''
  };

  agregarSede(): void {
    if (!this.nuevaSede.id || !this.nuevaSede.nombre.trim()) {
      return;
    }

    this.sedeService.agregarSede({
      id: this.nuevaSede.id,
      nombre: this.nuevaSede.nombre.trim()
    }).subscribe({
      next: (res) => {
        console.log('✅ Sede agregada:', res);
        this.sedes.push(res.sede); // agregar a la lista local si quieres evitar reload
        this.nuevaSede = { id: 0, nombre: '' }; // limpiar form
      },
      error: (err) => {
        console.error('❌ Error al agregar sede:', err);
      }
    });
  }

  // 📌 Redireccionar a detalle de la sede
  verDetalleSede(id: number): void {
    this.router.navigate(['/sedes', id]);
  }
}
