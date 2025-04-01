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
  sedeSeleccionadaNombre: string = '';
  anioSeleccionado: number = new Date().getFullYear();
  diasEspeciales: any[] = [];
  sidebarAbierto: boolean = false;
  usuarioNombre: string = '';
  usuarioRol: string = '';
  busquedaRealizada: boolean = false;

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
    const usuario = this.authService.obtenerDatosDesdeToken();
    this.usuarioNombre = usuario?.nombre || 'Usuario';
    this.usuarioRol = usuario?.rol || '';
  }

  obtenerSedes() {
    this.sedeService.obtenerSedes().subscribe({
      next: (res: any) => {
        this.sedes = res;
      },
      error: (err: any) => {
        console.error('Error al obtener sedes:', err);
      }
    });
  }

  onSedeChange() {
    const sede = this.sedes.find(s => s.id === this.sedeSeleccionada);
    this.sedeSeleccionadaNombre = sede ? sede.nombre : '';
    this.consultarCalendario();
  }

  consultarCalendario() {
    if (!this.sedeSeleccionada || !this.anioSeleccionado) return;

    this.calendarioService.obtenerPorSedeYAnio(this.sedeSeleccionada, this.anioSeleccionado).subscribe({
      next: (res: any) => {
        this.diasEspeciales = Array.isArray(res?.diasEspeciales) ? res.diasEspeciales : [];
        this.busquedaRealizada = true;
      },
      error: (err: any) => {
        console.error('Error al consultar calendario:', err);
        this.diasEspeciales = [];
        this.busquedaRealizada = true;
      }
    });
  }

  onEventoGuardado(evento: any) {
    if (!this.sedeSeleccionada) return;

    const eventoCompleto = {
      ...evento,
      sede: this.sedeSeleccionada,
      año: this.anioSeleccionado
    };

    this.calendarioService.agregarDia(eventoCompleto).subscribe({
      next: () => {
        this.consultarCalendario();
      },
      error: (err: any) => {
        console.error('Error al guardar día especial:', err);
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
    this.sidebarAbierto = !this.sidebarAbierto;
  }
}
