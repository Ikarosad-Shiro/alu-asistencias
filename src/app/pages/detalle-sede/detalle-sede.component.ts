import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { AuthService } from 'src/app/services/auth.service';
import { CalendarioService } from 'src/app/services/calendario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detalle-sede',
  templateUrl: './detalle-sede.component.html',
  styleUrls: ['./detalle-sede.component.css']
})
export class DetalleSedeComponent implements OnInit {
  sede: any = {};
  trabajadores: any[] = [];
  eventos: any[] = [];
  todasLasSedes: any[] = [];
  anioActual: number = new Date().getFullYear();
  sidebarAbierto: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sedeService: SedeService,
    private trabajadoresService: TrabajadoresService,
    private calendarioService: CalendarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const idSede = this.route.snapshot.paramMap.get('id');
    if (idSede) {
      const sedeId = parseInt(idSede);
      this.obtenerSede(sedeId);
      this.obtenerTrabajadores(sedeId);
      this.obtenerEventos(sedeId, this.anioActual);
      this.obtenerTodasLasSedes();
    }
  }

  obtenerSede(id: number): void {
    this.sedeService.obtenerSedePorId(id).subscribe({
      next: (res) => this.sede = res,
      error: (err) => console.error('❌ Error al obtener sede', err)
    });
  }

  obtenerTodasLasSedes(): void {
    this.sedeService.obtenerSedes().subscribe({
      next: (data) => this.todasLasSedes = data,
      error: (err) => console.error('❌ Error al cargar todas las sedes', err)
    });
  }

  obtenerTrabajadores(idSede: number): void {
    this.trabajadoresService.obtenerTrabajadores().subscribe({
      next: (data) => {
        this.trabajadores = data.filter(t => t.sede === idSede);
      },
      error: (err) => console.error('❌ Error al obtener trabajadores', err)
    });
  }

  obtenerEventos(idSede: number, anio: number): void {
    this.calendarioService.obtenerPorSedeYAnio(idSede, anio).subscribe({
      next: (res) => this.eventos = res?.diasEspeciales || [],
      error: (err) => console.error('❌ Error al obtener eventos del calendario', err)
    });
  }

  guardarEventoDesdeCalendario(evento: any): void {
    if (this.esSoloRevisor()) return;

    const data = {
      año: this.anioActual,
      sede: evento.sede,
      fecha: evento.fecha,
      tipo: evento.tipo,
      descripcion: evento.descripcion
    };

    const servicio = evento.editar
      ? this.calendarioService.editarDia(data)
      : this.calendarioService.agregarDia(data);

    servicio.subscribe({
      next: () => this.obtenerEventos(this.sede.id, this.anioActual),
      error: (err) => console.error('❌ Error al guardar evento desde detalle-sede:', err)
    });
  }

  eliminarEventoDesdeCalendario(evento: any): void {
    if (this.esSoloRevisor()) return;

    const data = {
      año: this.anioActual,
      sede: evento.sede,
      fecha: evento.fecha
    };

    this.calendarioService.eliminarDia(data).subscribe({
      next: () => {
        Swal.fire('✅ Eliminado', 'El día fue eliminado correctamente', 'success');
        this.obtenerEventos(this.sede.id, this.anioActual);
      },
      error: (err) => {
        console.error('❌ Error al eliminar evento desde detalle-sede:', err);
        Swal.fire('Error', 'No se pudo eliminar el día', 'error');
      }
    });
  }

  guardarCambios(): void {
    if (this.esSoloRevisor()) return;

    this.sedeService.actualizarSede(this.sede.id, {
      direccion: this.sede.direccion,
      zona: this.sede.zona,
      responsable: this.sede.responsable
    }).subscribe({
      next: () => {
        Swal.fire('✅ Cambios guardados', 'La sede ha sido actualizada', 'success');
      },
      error: (err) => {
        console.error('❌ Error al guardar cambios', err);
        Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
      }
    });
  }

  busquedaTrabajador: string = '';

  trabajadoresFiltrados(): any[] {
    if (!this.busquedaTrabajador) return this.trabajadores;

    const filtro = this.busquedaTrabajador.toLowerCase();
    return this.trabajadores.filter(t =>
      (t.nombre?.toLowerCase().includes(filtro) || t.apellido?.toLowerCase().includes(filtro))
    );
  }

  verDetalleTrabajador(id: string): void {
    this.router.navigate(['/trabajadores', id]);
  }

  toggleSidebar(): void {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  // 🎖️ Roles
  get rolUsuario(): string {
    const usuario = this.authService.obtenerDatosDesdeToken();
    return usuario?.rol || '';
  }

  esDios(): boolean {
    return this.rolUsuario === 'Dios';
  }

  esAdmin(): boolean {
    return this.rolUsuario === 'Administrador';
  }

  esSoloRevisor(): boolean {
    return this.rolUsuario === 'Revisor';
  }
}
