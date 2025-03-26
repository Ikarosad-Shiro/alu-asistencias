import { Component, OnInit } from '@angular/core';
import { CalendarioService } from 'src/app/services/calendario.service';
import { AuthService } from 'src/app/services/auth.service';
import { SedeService } from 'src/app/services/sede.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-calendario-laboral',
  templateUrl: './calendario-laboral.component.html',
  styleUrls: ['./calendario-laboral.component.css']
})
export class CalendarioLaboralComponent implements OnInit {
  sedes: { id: number, nombre: string }[] = [];
  sedeSeleccionada: number | null = null;
  anioSeleccionado: number = new Date().getFullYear();
  diasEspeciales: { fecha: string, tipo: string, descripcion: string }[] = [];
  columnas: string[] = ['fecha', 'tipo', 'descripcion'];
  sidebarAbierto: boolean = false;
  usuarioNombre: string = '';
  usuarioRol: string = '';

  constructor(
    private calendarioService: CalendarioService,
    private authService: AuthService,
    private sedeService: SedeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.obtenerUsuario();
    this.obtenerSedes();
  }

  obtenerUsuario() {
    const usuario = this.authService.obtenerDatosDesdeToken?.(); // Manejo defensivo
    this.usuarioNombre = usuario?.nombre || 'Usuario';
    this.usuarioRol = usuario?.rol || '';
  }

  obtenerSedes() {
    this.sedeService.obtenerSedes().subscribe({
      next: (res: any) => {
        this.sedes = res;
      },
      error: (err: any) => {
        console.error('❌ Error al obtener sedes:', err);
      }
    });
  }

  consultarCalendario() {
    if (!this.sedeSeleccionada || !this.anioSeleccionado) return;

    this.calendarioService
      .obtenerPorSedeYAnio(this.sedeSeleccionada, this.anioSeleccionado)
      .subscribe({
        next: (res: any) => {
          this.diasEspeciales = res?.diasEspeciales || [];
        },
        error: (err: any) => {
          console.error('❌ Error al consultar calendario:', err);
          this.diasEspeciales = [];
        }
      });
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  esAdmin(): boolean {
    return this.usuarioRol === 'Administrador' || this.usuarioRol === 'Dios';
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    }
    this.sidebarAbierto = !this.sidebarAbierto;
  }
}
