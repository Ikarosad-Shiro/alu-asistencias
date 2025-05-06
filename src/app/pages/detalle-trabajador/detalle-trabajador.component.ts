import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import { Location } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { AsistenciaService } from 'src/app/services/asistencia.service';
import { CalendarioService } from 'src/app/services/calendario.service';

import { Asistencia, EventoEspecial } from 'src/app/models/asistencia.model';
import Swal from 'sweetalert2';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// ✅ Forma correcta de asignar las fuentes
(pdfMake as any).vfs = pdfFonts.vfs;

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
    private authService: AuthService,
    private asistenciaService: AsistenciaService, // ✅ agrega este
    private calendarioService: CalendarioService  // ✅ y este
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

  abrirSelectorDeFechas() {
    Swal.fire({
      title: '📄 Selecciona el rango de fechas',
      html: `
        <input type="date" id="fechaInicio" class="swal2-input">
        <input type="date" id="fechaFin" class="swal2-input">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Generar PDF',
      didOpen: () => {
        const hoy = new Date().toISOString().split('T')[0];
        const inputInicio = document.getElementById('fechaInicio') as HTMLInputElement;
        const inputFin = document.getElementById('fechaFin') as HTMLInputElement;
        if (inputInicio && inputFin) {
          inputInicio.value = '';
          inputFin.value = '';
        }
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const inicio = (popup?.querySelector('#fechaInicio') as HTMLInputElement)?.value;
        const fin = (popup?.querySelector('#fechaFin') as HTMLInputElement)?.value;

        console.log('🕵️ Valores capturados:', { inicio, fin });

        if (!inicio || !fin) {
          Swal.showValidationMessage('⚠️ Ambas fechas son necesarias');
          return;
        }

        return { inicio, fin };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { inicio, fin } = result.value;
        const fechaInicio = new Date(`${inicio}T00:00:00`);
        const fechaFin = new Date(`${fin}T00:00:00`);
        this.generarPDF(fechaInicio, fechaFin);
      }
    });
  }

  async generarPDF(fechaInicio: Date, fechaFin: Date) {
    try {
      const asistencias = await this.asistenciaService.obtenerPorTrabajadorYRango(this.trabajador._id, fechaInicio, fechaFin).toPromise();

      const eventosTrabajadorResp = await this.calendarioService.obtenerEventosDeTrabajador(this.trabajador._id).toPromise();
      const eventosTrabajador = Array.isArray(eventosTrabajadorResp) ? eventosTrabajadorResp : [];

      const eventosSedeResp = await this.calendarioService.obtenerEventosDeSede(this.trabajador.sede, fechaInicio.getFullYear()).toPromise();
      const eventosSede = Array.isArray(eventosSedeResp) ? eventosSedeResp : [];

      const dias = this.generarDias(fechaInicio, fechaFin);
      const datosProcesados = this.procesarDias(
        dias,
        asistencias || [],
        eventosTrabajador,
        eventosSede
      );

      this.generarPDFConPdfMake(datosProcesados, fechaInicio, fechaFin);
    } catch (error) {
      Swal.fire('❌ Error', 'No se pudo generar el PDF', 'error');
      console.error(error);
    }
  }

  formatearFecha(fecha: Date): string {
    const fechaLocal = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()); // precisión local
    return fechaLocal.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  generarPDFConPdfMake(dias: any[], fechaInicio: Date, fechaFin: Date) {
    const docDefinition = {
      content: [
        { text: 'Reporte de Asistencias', style: 'header', alignment: 'center' },
        { text: `Nombre: ${this.trabajador.nombre || ''} ${this.trabajador.apellido || ''}` },
        { text: `ID: ${this.trabajador._id}` },
        { text: `Sede: ${this.obtenerNombreSede(this.trabajador.sede)}` },
        { text: `Periodo: ${this.formatearFecha(fechaInicio)} al ${this.formatearFecha(fechaFin)}` },
        { text: `Fecha de generación: ${this.formatearFecha(new Date())}` },
        { text: ' ', margin: [0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', '*', 'auto', '*'],
            body: [
              ['Día', 'Fecha', 'Entrada', 'Salida', 'Estado', 'Observación'],
              ...dias.map(d => [
                d.diaSemana,
                d.fecha,
                d.entrada || '-',
                d.salida || '-',
                d.estado,
                d.observacion || '-'
              ])
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: ' ', margin: [0, 10] },
        { text: 'Resumen:', style: 'subheader' },
        { text: this.contarEstados(dias).join('\n') },
        { text: ' ', margin: [0, 10] },
        {
          text: 'Generado automáticamente por Alu Asistencias',
          style: 'footer',
          alignment: 'center',
          color: '#888'
        }
      ],
      styles: {
        header: { fontSize: 16, bold: true },
        subheader: { fontSize: 12, bold: true },
        footer: { fontSize: 9, italics: true }
      },
      defaultStyle: {
        fontSize: 10
      }
    };

    pdfMake.createPdf(docDefinition).open(); // O .download() si prefieres descargar directo
  }

  generarDias(inicio: Date, fin: Date): any[] {
    const dias: any[] = [];
    const fechaActual = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()); // 🔍 precisión local

    while (fechaActual <= fin) {
      const fechaStr = fechaActual.toISOString().split('T')[0];

      const diaSemana = fechaActual.toLocaleDateString('es-MX', {
        weekday: 'long'
      });

      dias.push({
        fecha: fechaStr,
        diaSemana,
        entrada: null,
        salida: null,
        estado: '',
        observacion: ''
      });

      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return dias;
  }

  procesarDias(dias: any[], asistencias: any[], eventosTrabajador: any[], eventosSede: any[]): any[] {
    return dias.map(d => {
      const fecha = d.fecha;

      const eventoTrabajador = eventosTrabajador?.find(e => e.fecha === fecha);
      const eventoSede = eventosSede?.find(e => e.fecha === fecha);
      const asistencia = asistencias?.find(a => a.fecha === fecha);

      // Jerarquía: evento trabajador > evento sede > asistencia > falta
      if (eventoTrabajador) {
        d.estado = this.iconoEstado(eventoTrabajador.tipo);
        d.observacion = eventoTrabajador.tipo;
      } else if (eventoSede) {
        d.estado = this.iconoEstado(eventoSede.tipo);
        d.observacion = eventoSede.tipo;
      } else if (asistencia) {
        // ✅ Añade validación para asistencia.detalle
        const detalleAsistencia = asistencia.detalle || [];
        const entrada = detalleAsistencia.find((d: any) => d.tipo === 'Entrada');
        const salida = detalleAsistencia.find((d: any) => d.tipo === 'Salida');

        d.entrada = entrada ? this.formatoHora(entrada.fechaHora) : '-';
        d.salida = salida ? this.formatoHora(salida.fechaHora) : '-';

        if (entrada && salida) {
          d.estado = '✅ Asistencia Completa';
        } else {
          d.estado = '⚠️ Incompleta';
          d.observacion = entrada ? 'Falta salida' : 'Falta entrada';
        }
      } else {
        d.estado = '❌ Falta';
      }

      return d;
    });
  }

  contarEstados(dias: any[]): string[] {
    const conteo: { [key: string]: number } = {};

    dias.forEach(d => {
      const estado = d.estado || 'Sin estado';
      conteo[estado] = (conteo[estado] || 0) + 1;
    });

    return Object.entries(conteo).map(([estado, cantidad]) => `${estado}: ${cantidad} día(s)`);
  }

  formatoHora(fechaHora: string): string {
    const fecha = new Date(fechaHora);
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }


  iconoEstado(tipo: string): string {
    switch (tipo) {
      case 'Vacaciones': return '🌴 Vacaciones';
      case 'Vacaciones pagadas': return '🛑 Vacaciones pagadas';
      case 'Incapacidad': return '🩺 Incapacidad';
      case 'Permiso': return '📄 Permiso';
      case 'Permiso con goce': return '💰 Permiso con goce';
      case 'Descanso': return '😴 Descanso';
      case 'Día festivo': return '🎉 Día festivo';
      default: return '📌 Evento';
    }
  }

}
