import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import { Location } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';

import { Asistencia, EventoEspecial } from 'src/app/models/asistencia.model';

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

  // 📌 Calendario unificado
  eventosSede: EventoEspecial[] = [];
  eventosTrabajador: EventoEspecial[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trabajadoresService: TrabajadoresService,
    private sedeService: SedeService,
    private location: Location,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const datosUsuario = this.authService.obtenerDatosDesdeToken();
    this.rolUsuario = datosUsuario?.rol || '';
    console.log('🎯 Rol cargado correctamente desde el token:', this.rolUsuario);

    // 🔥 Obtener lista de sedes
    this.sedeService.obtenerSedes().subscribe(
      (sedes: any[]) => {
        this.sedes = sedes;
      },
      (error: any) => console.error('❌ Error al obtener sedes:', error)
    );

    // 🔥 Obtener datos del trabajador
    const trabajadorId = this.route.snapshot.paramMap.get('id');
    if (trabajadorId) {
      this.trabajadoresService.obtenerTrabajador(trabajadorId).subscribe(
        (data: any) => {
          this.trabajador = data;
          this.trabajadorOriginal = JSON.parse(JSON.stringify(data));

          // 🔥 Obtener asistencias
          this.trabajadoresService.obtenerAsistencias(trabajadorId).subscribe(
            (asistencias: Asistencia[]) => {
              // Normalizamos fechas a string YYYY-MM-DD
              this.trabajador.asistencias = asistencias.map(a => ({
                ...a,
                fecha: new Date(a.fecha).toISOString().split('T')[0],
                detalle: a.detalle?.map((d: any) => ({
                  ...d,
                  fechaHora: d.fechaHora
                }))
              }));
            },
            (error: any) => console.error('❌ Error al obtener asistencias:', error)
          );

          // 🔥 Obtener calendario de sede
          this.sedeService.obtenerEventosCalendario(this.trabajador.sede, new Date().getFullYear()).subscribe(
            (calendario: any) => {
              this.eventosSede = (calendario?.diasEspeciales || []).map((e: any) => ({
                ...e,
                fecha: new Date(e.fecha).toISOString().split('T')[0]
              }));
            },
            (error: any) => {
              console.error('❌ Error al obtener calendario de sede:', error);
              this.eventosSede = [];
            }
          );

          // 🔥 Obtener calendario del trabajador
          this.trabajadoresService.obtenerEventosCalendarioTrabajador(trabajadorId, new Date().getFullYear()).subscribe(
            (calendario: any) => {
              this.eventosTrabajador = (calendario?.diasEspeciales || []).map((e: any) => ({
                ...e,
                fecha: new Date(e.fecha).toISOString().split('T')[0]
              }));
            },
            (error: any) => {
              console.error('❌ Error al obtener eventos del trabajador:', error);
              this.eventosTrabajador = [];
            }
          );
        },
        (error: any) => console.error('❌ Error al obtener trabajador:', error)
      );
    }
  }

  activarEdicion() {
    if (this.rolUsuario === 'Revisor') return;
    this.modoEdicion = true;
  }

  cancelarEdicion() {
    this.modoEdicion = false;
    this.trabajador = JSON.parse(JSON.stringify(this.trabajadorOriginal));
  }

  actualizarTrabajador() {
    if (this.rolUsuario === 'Revisor') {
      alert('⛔ No tienes permiso para editar esta información.');
      this.cancelarEdicion();
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
    console.log('✅ Evento guardado:', evento);
    this.refrescarEventosTrabajador();
  }

  onEventoEliminado(evento: any) {
    console.log('🗑️ Evento eliminado:', evento);
    this.refrescarEventosTrabajador();
  }

  refrescarEventosTrabajador(): void {
    if (this.trabajador?._id) {
      this.trabajadoresService
        .obtenerEventosCalendarioTrabajador(this.trabajador._id, new Date().getFullYear())
        .subscribe(
          (calendario: any) => {
            this.eventosTrabajador = (calendario?.diasEspeciales || []).map((e: any) => ({
              ...e,
              fecha: new Date(e.fecha).toISOString().split('T')[0]
            }));
          },
          (error: any) => {
            console.error('❌ Error al refrescar eventos del trabajador:', error);
            this.eventosTrabajador = [];
          }
        );
    }
  }

  actualizarEventosTrabajadorDesdeVisual(nuevosEventos: EventoEspecial[]) {
    this.eventosTrabajador = nuevosEventos.map(e => ({
      ...e,
      fecha: new Date(e.fecha).toISOString().split('T')[0]
    }));
  }

}
