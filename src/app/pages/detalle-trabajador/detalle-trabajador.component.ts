import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import { Location } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service'; // asegúrate de importar

@Component({
  selector: 'app-detalle-trabajador',
  templateUrl: './detalle-trabajador.component.html',
  styleUrls: ['./detalle-trabajador.component.css']
})
export class DetalleTrabajadorComponent implements OnInit {
  trabajador: any = {};
  trabajadorOriginal: any;
  modoEdicion: boolean = false;
  rolUsuario: string = '';
  sedes: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trabajadoresService: TrabajadoresService,
    private sedeService: SedeService,
    private location: Location,
    private authService: AuthService // 👉 inyectar aquí
  ) {}

  ngOnInit(): void {
    const datosUsuario = this.authService.obtenerDatosDesdeToken();
    this.rolUsuario = datosUsuario?.rol || '';
    console.log('🎯 Rol cargado correctamente desde el token:', this.rolUsuario);

    // 🔥 Cargar sedes dinámicamente
    this.sedeService.obtenerSedes().subscribe(
      (sedes: any[]) => {
        this.sedes = sedes;
      },
      (error: any) => console.error('❌ Error al obtener sedes:', error)
    );

    // 🔥 Cargar trabajador
    const trabajadorId = this.route.snapshot.paramMap.get('id');
    if (trabajadorId) {
      this.trabajadoresService.obtenerTrabajador(trabajadorId).subscribe(
        (data: any) => {
          this.trabajador = data;
          this.trabajadorOriginal = JSON.parse(JSON.stringify(data)); // Clonamos datos originales

          // 🔥 Obtener asistencias
          this.trabajadoresService.obtenerAsistencias(trabajadorId).subscribe(
            (asistencias: any[]) => {
              this.trabajador.asistencias = asistencias;
            },
            (error: any) => console.error('❌ Error al obtener asistencias:', error)
          );
        },
        (error: any) => console.error('❌ Error al obtener trabajador:', error)
      );
    }
  }

  activarEdicion() {
    if (this.rolUsuario === 'Revisor') {
      return; // No permitir activar edición
    }
    this.modoEdicion = true;
  }

  cancelarEdicion() {
    this.modoEdicion = false;
    this.trabajador = JSON.parse(JSON.stringify(this.trabajadorOriginal));
  }

  actualizarTrabajador() {
    if (this.rolUsuario === 'Revisor') {
      alert('⛔ No tienes permiso para editar esta información.');
      this.modoEdicion = false;

      // ✅ Revertimos los cambios por si modificó algo visualmente antes
      this.trabajador = JSON.parse(JSON.stringify(this.trabajadorOriginal));
      return;
    }

    const trabajadorId = this.trabajador._id || '';
    this.trabajadoresService.actualizarTrabajador(trabajadorId, this.trabajador).subscribe(
      (data: any) => {
        console.log('✅ Trabajador actualizado:', data);
        this.trabajador = data;
        this.trabajadorOriginal = JSON.parse(JSON.stringify(data));
        this.modoEdicion = false;
        this.mostrarMensaje('Trabajador actualizado correctamente.', 'exito');
      },
      (error: any) => {
        console.error('❌ Error al actualizar el trabajador', error);
        this.mostrarMensaje('❌ Error al actualizar el trabajador.', 'error');
      }
    );
  }


  mostrarMensaje(mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    alert(mensaje);
  }

  regresar() {
    this.location.back();
  }

  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  obtenerNombreSede(idSede: any): string {
    let sede = this.sedes.find(s => s.id === Number(idSede));
    if (!sede) {
      sede = this.sedes.find(s => s._id === idSede);
    }
    return sede ? sede.nombre : 'Sede no encontrada';
  }

  onEventoGuardado(evento: any) {
    console.log('Evento guardado:', evento);
  }

  onEventoEliminado(evento: any) {
    console.log('Evento eliminado:', evento);
  }
}
