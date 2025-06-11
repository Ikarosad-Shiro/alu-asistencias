import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import { Location } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { AsistenciaService } from 'src/app/services/asistencia.service';
import { CalendarioService } from 'src/app/services/calendario.service';

import { forkJoin, Observable, lastValueFrom, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DateTime } from 'luxon';

import { Asistencia as AsistenciaModel, EventoEspecial as EventoEspecialModel } from 'src/app/models/asistencia.model';
import Swal from 'sweetalert2';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import * as ExcelJS from 'exceljs';

// ✅ Forma correcta de asignar las fuentes
(pdfMake as any).vfs = pdfFonts.vfs;

interface RegistroAsistencia {
  tipo: string;
  fechaHora: string | Date;
  salida_automatica?: boolean;
  sincronizado?: boolean;
}

interface Asistencia extends Omit<AsistenciaModel, 'detalle'> {
  detalle?: RegistroAsistencia[];
  observacion?: string; // Añadir esta propiedad
}

// Por esta:
interface EventoEspecial extends EventoEspecialModel { // ✅ Usa el modelo directamente
  descripcion?: string;
  horaEntrada?: string; // ⏰ Añadir este campo
  horaSalida?: string;  // ⏰ Y este también
}

interface DiaProcesado {
  fecha: string;
  diaSemana: string;
  entrada?: string;
  salida?: string;
  estado: string;
  observacion?: string;
}

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
  diasProcesados: DiaProcesado[] = [];
  fechaInicio!: Date;
  fechaFin!: Date;

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
    this.sedeService.obtenerSedes().subscribe({
      next: (sedes: any[]) => this.sedes = sedes,
      error: (error: HttpErrorResponse) => {
        console.error('❌ Error al obtener sedes:', error);
        this.mostrarMensaje('Error al cargar las sedes', 'error');
      }
    });

    const trabajadorId = this.route.snapshot.paramMap.get('id');
    if (!trabajadorId) {
      this.mostrarMensaje('No se encontró ID de trabajador', 'error');
      this.router.navigate(['/trabajadores']);
      return;
    }

    // 🔥 Paso 1: obtener el trabajador
    this.trabajadoresService.obtenerTrabajador(trabajadorId).subscribe({
      next: (trabajador: any) => {
        this.trabajador = trabajador;
        this.trabajadorOriginal = JSON.parse(JSON.stringify(trabajador));

        // 🔥 Paso 2: obtener en paralelo asistencias + eventos
        forkJoin({
          asistencias: this.trabajadoresService.obtenerAsistencias(trabajadorId),
          calendarioSede: this.sedeService.obtenerEventosCalendario(
            trabajador.sede,
            new Date().getFullYear()
          ) as unknown as Observable<{ diasEspeciales: EventoEspecial[] }>,
          calendarioTrabajador: this.trabajadoresService.obtenerEventosCalendarioTrabajador(
            trabajadorId,
            new Date().getFullYear()
          ) as unknown as Observable<{ diasEspeciales: EventoEspecial[] }>
        }).subscribe({
          next: ({ asistencias, calendarioSede, calendarioTrabajador }) => {
            // 📅 Procesar asistencias
            this.trabajador.asistencias = asistencias.map((a: any) => ({
              ...a,
              fecha: this.normalizarFecha(a.fecha),
              detalle: a.detalle?.map((d: any) => ({
                ...d,
                fechaHora: this.normalizarFechaHora(d.fechaHora)
              }))
            }));

            // 📅 Procesar eventos sede
            this.eventosSede = (calendarioSede?.diasEspeciales || []).map((e: EventoEspecial) => ({
              ...e,
              fecha: this.normalizarFecha(e.fecha),
              descripcion: e.descripcion || e.tipo || ''
            }));

            // 📅 Procesar eventos trabajador
            this.eventosTrabajador = (calendarioTrabajador?.diasEspeciales || []).map((e: EventoEspecial) => ({
              ...e,
              fecha: this.normalizarFecha(e.fecha),
              descripcion: e.descripcion || e.tipo || ''
            }));
          },
          error: (error: HttpErrorResponse) => {
            console.error('❌ Error al obtener información relacionada:', error);
            this.mostrarMensaje('Error al cargar asistencias o calendarios', 'error');
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        console.error('❌ Error al obtener trabajador:', error);
        this.mostrarMensaje('Error al cargar datos del trabajador', 'error');
        this.router.navigate(['/trabajadores']);
      }
    });
  }

  private normalizarFechaHora(fechaHora: string | Date | undefined): string {
    if (!fechaHora) return '';

    try {
      const fechaISO = typeof fechaHora === 'string'
        ? DateTime.fromISO(fechaHora, { zone: 'America/Mexico_City' })
        : DateTime.fromJSDate(fechaHora, { zone: 'America/Mexico_City' });

      return fechaISO.toISO() || '';
    } catch (e) {
      console.error('❌ Error al normalizar fechaHora con zona:', fechaHora, e);
      return '';
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

  refrescarVista(): void {
    // 🔁 Básicamente volvemos a ejecutar todo el ciclo de inicio
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigate(['/trabajadores', id]);
      });
    }
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
              fecha: this.normalizarFecha(e.fecha)
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

  abrirSelectorDeFechasExcel() {
    Swal.fire({
      title: '📊 Selecciona el rango de fechas',
      html: `
        <input type="date" id="fechaInicio" class="swal2-input">
        <input type="date" id="fechaFin" class="swal2-input">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Generar Excel',
      didOpen: () => {
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

        if (!inicio || !fin) {
          Swal.showValidationMessage('⚠️ Ambas fechas son necesarias');
          return;
        }

        return { inicio, fin };
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        const { inicio, fin } = result.value;
        const fechaInicio = new Date(`${inicio}T00:00:00`);
        const fechaFin = new Date(`${fin}T00:00:00`);

        // 💾 Guardar fechas para el encabezado del Excel
        this.fechaInicio = fechaInicio;
        this.fechaFin = fechaFin;

        try {
          const datos = await lastValueFrom(
            this.asistenciaService.obtenerDatosUnificados(this.trabajador._id, fechaInicio, fechaFin).pipe(
              map(({ asistencias, eventosTrabajador, eventosSede }) => {
                const asistenciasValidas = asistencias.filter((a: Asistencia) =>
                  (a?.detalle?.length ?? 0) > 0 || a?.estado !== undefined
                );
                const dias = this.generarDias(fechaInicio, fechaFin);
                const procesados = this.procesarDias(
                  dias,
                  asistenciasValidas,
                  eventosTrabajador || [],
                  eventosSede || []
                );

                this.diasProcesados = procesados;
                return procesados;
              }),
              catchError((error: unknown) => {
                console.error('❌ Error al procesar datos para Excel:', error);
                throw error;
              })
            )
          );

          const nombreLimpio = `${this.trabajador.nombre || ''}_${this.trabajador.apellido || ''}`.replace(/\s+/g, '_');
          const nombreArchivo = `Reporte_Asistencias_${nombreLimpio}_${inicio}_a_${fin}.xlsx`;

          this.exportarExcelConEstilo(nombreArchivo);
          await Swal.fire('✅ ¡Listo!', 'Se generó el archivo Excel correctamente', 'success');

        } catch (error: any) {
          console.error('🔥 Error generando Excel:', error);
          await Swal.fire('❌ Error', 'No se pudo generar el Excel', 'error');
        }
      }
    });
  }

  // Modifica los métodos que procesan fechas para asegurar que siempre sean strings
  private normalizarFecha(fecha: any): string {
    if (!fecha) return '';

    // Si ya es string en formato YYYY-MM-DD
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }

    // Para objetos Date u otros formatos de string
    try {
      return new Date(fecha).toISOString().split('T')[0];
    } catch (e) {
      console.error('Error al normalizar fecha:', fecha, e);
      return '';
    }
  }

  async generarPDF(fechaInicio: Date, fechaFin: Date) {
    try {
      console.log('📅 Rango solicitado:', fechaInicio, fechaFin);

      // ✅ Nueva forma unificada usando solo una llamada al backend
      const datos = await lastValueFrom(
        this.asistenciaService.obtenerDatosUnificados(this.trabajador._id, fechaInicio, fechaFin).pipe(
          map(({ asistencias, eventosTrabajador, eventosSede }) => {
            if (!Array.isArray(asistencias)) {
              throw new Error('Formato de asistencias inválido');
            }

            const asistenciasValidas = asistencias.filter(a => a?.detalle?.length > 0 || a?.estado !== undefined);
            console.log('🔍 Asistencias válidas:', asistenciasValidas.length, '/', asistencias.length);

            const dias = this.generarDias(fechaInicio, fechaFin);
            const datosProcesados = this.procesarDias(
              dias,
              asistenciasValidas,
              eventosTrabajador || [],
              eventosSede || []
            );

            this.diasProcesados = datosProcesados;

            if (!datosProcesados || !Array.isArray(datosProcesados)) {
              throw new Error('No se pudieron procesar los datos para el reporte');
            }

            return datosProcesados;
          }),
          catchError((error: unknown) => {
            console.error('❌ Error al procesar datos unificados:', error);
            throw error;
          })
        )
      );

      // 2. Generar PDF con datos validados
      this.generarPDFConPdfMake(datos, fechaInicio, fechaFin);

      // 3. Mostrar resumen al usuario
      await Swal.fire({
        title: '✅ Reporte generado',
        text: `Se procesaron ${datos.length} días de información`,
        icon: 'success',
        timer: 3000
      });

    } catch (error: unknown) {
      console.error('🔥 Error al generar PDF:', error);

      let errorMessage = 'No se pudo generar el PDF';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      await Swal.fire({
        title: '❌ Error',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    }
  }

  formatearFecha(fecha: Date | undefined): string {
    if (!fecha || isNaN(fecha.getTime())) return '—';

    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  generarPDFConPdfMake(dias: any[], fechaInicio: Date, fechaFin: Date) {
    console.log('📄 Días procesados para PDF:', dias.map(d => ({
      fecha: d.fecha,
      entrada: d.entrada,
      salida: d.salida
    })));

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
              [
                { text: 'Día', bold: true },
                { text: 'Fecha', bold: true },
                { text: 'Entrada', bold: true },
                { text: 'Salida', bold: true },
                { text: 'Estado', bold: true },
                { text: 'Observación', bold: true }
              ],
              ...dias.map(d => {let fillColor = null;
                const obs = d.observacion?.toLowerCase() || '';
                const estado = (d.estado?.split(' ').slice(1).join(' ') || '').toLowerCase(); // 💡 quita emoji

                if (estado.includes('vacaciones pagadas')) {
                  fillColor = '#E1BEE7'; // 💜 Lila claro
                } else if (estado.includes('vacaciones')) {
                  fillColor = '#C8E6C9'; // 🌿 Verde suave
                } else if (estado.includes('permiso con goce')) {
                  fillColor = '#FFCCBC'; // 🍑 Naranja claro
                } else if (estado.includes('permiso')) {
                  fillColor = '#FFE0B2'; // 🍊 Suave
                } else if (estado.includes('incapacidad')) {
                  fillColor = '#BBDEFB'; // 💙 Azul cielo
                } else if (estado.includes('falta')) {
                  fillColor = '#FFCDD2'; // 🔴 Rojo clarito
                } else if (estado.includes('asistencia completa')) {
                  fillColor = '#A5D6A7'; // ✅ Verde claro
                } else if (estado.includes('asistencia')) {
                  fillColor = '#B2EBF2'; // 🩵 Cian suave
                } else if (estado.includes('salida automática')) {
                  fillColor = '#B3E5FC'; // 💧 Azul pastel
                } else if (estado.includes('pendiente')) {
                  fillColor = '#FFF59D'; // 🟡 Amarillo claro
                } else if (estado.includes('descanso')) {
                  fillColor = '#CFD8DC'; // 💤 Gris azulado claro
                } else if (estado.includes('festivo')) {
                  fillColor = '#F8BBD0'; // 💖 Rosado claro
                } else if (estado.includes('puente')) {
                  fillColor = '#BBDEFB'; // 🌉 Azul cielo claro
                } else if (estado.includes('media jornada')) {
                  fillColor = '#FFE082'; // ☀️ Amarillo pastel
                } else if (estado.includes('capacitación')) {
                  fillColor = '#B2EBF2'; // 🧠 Cian claro
                } else if (estado.includes('evento')) {
                  fillColor = '#D7CCC8'; // ☕ Marrón pastel
                } else if (estado.includes('suspensión')) {
                  fillColor = '#FFCDD2'; // 🚫 Rojo claro
                }

                return [
                  { text: d.diaSemana, fillColor },
                  { text: d.fecha, fillColor },
                  { text: d.entrada || '-', fillColor },
                  { text: d.salida || '-', fillColor },
                  { text: d.estado, fillColor },
                  { text: d.observacion || '-', fillColor }
                ];
              })
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

    const doc = pdfMake.createPdf(docDefinition);
    setTimeout(() => doc.open(), 0);
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

  private procesarDias(
    dias: { fecha: string; diaSemana: string }[],
    asistencias: Asistencia[],
    eventosTrabajador: EventoEspecial[],
    eventosSede: EventoEspecial[]
  ): DiaProcesado[] {
    const hoy = DateTime.now().setZone('America/Mexico_City').toISODate() || '';

    return dias.map(dia => {
      const fecha = dia.fecha;

      const eventoTrabajador = this.buscarEvento(fecha, eventosTrabajador);
      const asistencia = this.buscarAsistencia(fecha, asistencias);
      const eventoSede = this.buscarEvento(fecha, eventosSede);

      // 🔮 Si es futuro, dejar vacío sin estado ni observación
      if (fecha > hoy) {
        return {
          ...dia,
          entrada: '',
          salida: '',
          estado: '',
          observacion: ''
        };
      }

      // 🆕 Caso especial: Media Jornada en calendario de sede
      if (eventoSede?.tipo === 'Media Jornada') {
        if (asistencia) {
          const diaProcesado = this.procesarAsistencia(dia, asistencia, eventoSede);

          // Aseguramos que se muestre como asistencia completa aunque sea media jornada
          if (diaProcesado.entrada !== '-' && diaProcesado.salida !== '-') {
            diaProcesado.estado = '✅ Asistencia Completa';
            diaProcesado.observacion = 'Media Jornada registrada' +
              (eventoSede.descripcion ? ` (${eventoSede.descripcion})` : '');
          }
          return diaProcesado;
        } else {
          return {
            ...dia,
            estado: '❌ Falta',
            observacion: 'Media Jornada programada - ' +
              (eventoSede.descripcion || 'Sin registro de asistencia'),
            entrada: eventoSede.horaEntrada ? this.formatearHoraManual(eventoSede.horaEntrada) : '-',
            salida: eventoSede.horaSalida ? this.formatearHoraManual(eventoSede.horaSalida) : '-'
          };
        }
      }

      // Lógica normal para otros casos
      const opciones: { fuente: string; tipo: string; data: any }[] = [];

      if (eventoTrabajador) opciones.push({ fuente: 'trabajador', tipo: eventoTrabajador.tipo, data: eventoTrabajador });
      if (asistencia) {
        const tipoAsistencia = this.definirTipoAsistencia(asistencia, dia.fecha, hoy);
        opciones.push({ fuente: 'asistencia', tipo: tipoAsistencia, data: asistencia });
      }
      if (eventoSede) opciones.push({ fuente: 'sede', tipo: eventoSede.tipo, data: eventoSede });

      const opcionGanadora = opciones.sort((a, b) =>
        this.obtenerPrioridadEstado(b.tipo) - this.obtenerPrioridadEstado(a.tipo)
      )[0];

      if (!opcionGanadora) {
        return {
          ...dia,
          estado: '❌ Falta',
          observacion: 'No registrado',
          entrada: '-', salida: '-'
        };
      }

      switch (opcionGanadora.fuente) {
        case 'trabajador':
          if (opcionGanadora.tipo === 'Asistencia') {
            return {
              ...dia,
              entrada: opcionGanadora.data.horaEntrada
                ? this.formatearHoraManual(opcionGanadora.data.horaEntrada)
                : '-',
              salida: opcionGanadora.data.horaSalida
                ? this.formatearHoraManual(opcionGanadora.data.horaSalida)
                : '-',
              estado: this.iconoEstado('Asistencia'),
              observacion: 'Asistencia marcada manualmente'
            };
          } else {
            return {
              ...dia,
              estado: this.iconoEstado(opcionGanadora.tipo),
              observacion: opcionGanadora.data.descripcion || this.descripcionPorTipo(opcionGanadora.tipo),
              entrada: '-', salida: '-'
            };
          }

        case 'asistencia':
          return this.procesarAsistencia(dia, opcionGanadora.data, eventoSede || undefined);

        case 'sede':
          const tiposConAsistencia = ['Capacitación', 'Evento'];
          if (tiposConAsistencia.includes(opcionGanadora.tipo) && asistencia) {
            return this.procesarAsistencia(dia, asistencia, eventoSede || undefined);
          }

          return {
            ...dia,
            estado: this.iconoEstado(opcionGanadora.tipo),
            observacion: opcionGanadora.data.descripcion || this.descripcionPorTipo(opcionGanadora.tipo),
            entrada: '-', salida: '-'
          };

        default:
          return {
            ...dia,
            estado: '❌ Falta',
            observacion: 'No registrado',
            entrada: '-', salida: '-'
          };
      }
    });
  }

  private buscarEvento(fecha: string, eventos: EventoEspecial[]): EventoEspecial | null {
    return eventos?.find((e: EventoEspecial) =>
      e?.fecha && this.normalizarFecha(e.fecha) === fecha
    ) || null;
  }

  private buscarAsistencia(fecha: string, asistencias: Asistencia[]): Asistencia | null {
    // Buscar primero coincidencia exacta por a.fecha
    const exacta = asistencias.find((a: Asistencia) => {
      if (!a) return false;
      return a.fecha && this.normalizarFecha(a.fecha) === fecha;
    });

    if (exacta) return exacta;

    // Si no hay coincidencia por fecha directa, buscar en el detalle
    return asistencias.find((a: Asistencia) => {
      if (!a?.detalle?.length) return false;
      return a.detalle.some((reg: RegistroAsistencia) =>
        reg.fechaHora && this.normalizarFecha(reg.fechaHora) === fecha
      );
    }) || null;
  }

  private procesarAsistencia(dia: any, asistencia: Asistencia, eventoSede?: EventoEspecial): DiaProcesado {
    const entrada = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Entrada');
    const salida = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Salida');
    const hoyDateStr = DateTime.now().setZone('America/Mexico_City').toISODate() || '';

    const diaProcesado: DiaProcesado = {
        ...dia,
        entrada: entrada ? this.formatoHora(this.normalizarFechaHora(entrada.fechaHora)) : '-',
        salida: salida ? this.formatoHora(this.normalizarFechaHora(salida.fechaHora)) : '-'
    };

    // 🆕 Primero verificamos si es Media Jornada desde el calendario de sede
    const esMediaJornada = eventoSede?.tipo === 'Media Jornada';

    if (esMediaJornada) {
        if (entrada && salida) {
            diaProcesado.estado = '✅ Asistencia Completa';
            diaProcesado.observacion = 'Media Jornada registrada';
        } else if (entrada) {
            diaProcesado.estado = '⚠️ Media Jornada';
            diaProcesado.observacion = 'Falta registro de salida para Media Jornada';
        } else {
            diaProcesado.estado = '❌ Falta';
            diaProcesado.observacion = 'Falta registro de entrada para Media Jornada';
        }
    }
    // Lógica normal para otros casos
    else if (entrada && salida) {
        diaProcesado.estado = '✅ Asistencia Completa';
        diaProcesado.observacion = asistencia.observacion || 'Entrada y salida registradas';
    } else if (entrada && dia.fecha === hoyDateStr) {
        diaProcesado.estado = '🕓 Entrada sin salida';
        diaProcesado.observacion = 'En espera del registro de salida';
    } else if (entrada && dia.fecha < hoyDateStr) {
        diaProcesado.estado = '🕒 Salida Automática';
        diaProcesado.observacion = entrada.salida_automatica
            ? 'Salida automática registrada'
            : 'Falta registro de salida';
    } else if (salida) {
        diaProcesado.estado = '⚠️ Incompleta';
        diaProcesado.observacion = 'Falta registro de entrada';
    } else {
        diaProcesado.estado = '❌ Falta';
        diaProcesado.observacion = 'Sin registros de asistencia';
    }

    // 💡 Si hay evento sede (incluyendo Media Jornada), lo mencionamos
    if (eventoSede) {
        diaProcesado.observacion += ` (${eventoSede.tipo}${eventoSede.descripcion ? ': ' + eventoSede.descripcion : ''})`;
    }

    return diaProcesado;
}

  private normalizarTipoEvento(tipo: string): string {
    // Mapeo de tipos de sede a formatos consistentes
    const tipos: {[key: string]: string} = {
      'festivo': 'Festivo',
      'descanso': 'Descanso',
      'puente': 'Puente',
      'media jornada': 'Media Jornada',
      'capacitación': 'Capacitación',
      'evento': 'Evento',
      'suspensión': 'Suspensión'
    };

    return tipos[tipo.toLowerCase()] || tipo;
  }

  private definirTipoAsistencia(asistencia: Asistencia, fecha: string, hoy: string): string {
    const entrada = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Entrada');
    const salida = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Salida');

    if (entrada && salida) return 'Asistencia Completa';
    if (entrada && fecha === hoy) return 'Entrada sin salida';
    if (entrada && fecha < hoy) return 'Salida Automática';
    if (salida) return 'Incompleta';
    return 'Falta';
  }

  obtenerPrioridadEstado(tipo: string): number {
    const mapa: { [key: string]: number } = {
      // 1. Manual (más alto)
      'Falta': 100,
      'Asistencia': 100,

      // 2. Asistencia real
      'Asistencia Completa': 90,
      'Salida Automática': 85,
      'Entrada sin salida': 80,

      // 3. Justificaciones del trabajador
      'Incapacidad': 70,
      'Permiso': 70,
      'Permiso con Goce': 70,
      'Vacaciones': 70,
      'Vacaciones Pagadas': 70,

      // 4. Calendario sede
      'Media Jornada': 60,
      'Capacitación': 60,
      'Evento': 60,
      'Festivo': 50,
      'Descanso': 50,
      'Puente': 50,
      'Suspensión': 50,

      // Por defecto
      'Falta Default': 10
    };

    return mapa[tipo] || 0;
  }

  contarEstados(dias: any[]): string[] {
    const conteo: { [key: string]: number } = {};

    dias.forEach(d => {
      const estado = d.estado || 'Sin estado';
      conteo[estado] = (conteo[estado] || 0) + 1;
    });

    return Object.entries(conteo).map(
      ([estado, cantidad]) => `${estado}: ${cantidad} día(s)`
    );
  }

  formatoHora(fechaHora: string): string {
    try {
      return DateTime.fromISO(fechaHora, { zone: 'America/Mexico_City' }).toFormat('hh:mm a');
    } catch (e) {
      console.error('🕓 Error al formatear hora:', fechaHora, e);
      return '-';
    }
  }

  formatearHoraManual(horaStr: string): string {
    if (!horaStr) return '-';
    try {
      return DateTime.fromFormat(horaStr, 'HH:mm')
        .setZone('America/Mexico_City')
        .toFormat('hh:mm a'); // 👉 12 horas con AM/PM
    } catch {
      return horaStr; // Por si acaso
    }
  }

  descripcionPorTipo(tipo: string): string {
    const descripciones: { [key: string]: string } = {
      'Incapacidad': 'Día justificado por incapacidad médica',
      'Permiso': 'Permiso autorizado',
      'Permiso con Goce': 'Permiso con goce de sueldo',
      'Vacaciones': 'Periodo vacacional autorizado',
      'Vacaciones Pagadas': 'Vacaciones pagadas',
      'Falta': 'Falta justificada manualmente',
      'Asistencia': 'Asistencia marcada manualmente',
      'Media Jornada': 'Jornada parcial autorizada'
    };

    return descripciones[tipo] || tipo;
  }

  iconoEstado(tipo: string): string {
    const mapaEstados: { [key: string]: string } = {
      // Calendario del Trabajador
      'Incapacidad': '🩺 Incapacidad',
      'Vacaciones Pagadas': '💰 Vacaciones Pagadas',
      'Vacaciones': '🌴 Vacaciones',
      'Permiso con Goce': '🧾 Permiso con Goce',
      'Permiso': '📄 Permiso',
      'Falta': '❌ Falta Manual',

      // Asistencia
      'Asistencia Completa': '✅ Asistencia Completa',
      'Salida Automática': '🕒 Salida Automática',
      'Pendiente': '⏳ Pendiente',
      'Entrada sin salida': '🕓 Entrada sin salida',

      // Calendario de Sede
      'Festivo': '🎉 Festivo',
      'Descanso': '😴 Descanso',
      'Puente': '🌉 Puente',
      'Media Jornada': '🌓 Media Jornada',
      'Capacitación': '📚 Capacitación',
      'Evento': '🎤 Evento',
      'Suspensión': '🚫 Suspensión'
    };

    // Buscar coincidencia exacta
    if (mapaEstados[tipo]) {
      return mapaEstados[tipo];
    }

    // Buscar coincidencia insensible a mayúsculas/minúsculas
    const tipoLower = tipo.toLowerCase();
    for (const key in mapaEstados) {
      if (key.toLowerCase() === tipoLower) {
        return mapaEstados[key];
      }
    }

    return `📌 ${tipo}`;
  }

  exportarExcelConEstilo(nombreArchivo: string = 'Reporte_Asistencias.xlsx'): void {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asistencias');

    // 🧾 Encabezado con datos del trabajador
    worksheet.addRow([`👤 Nombre:`, `${this.trabajador.nombre || ''} ${this.trabajador.apellido || ''}`]);
    worksheet.addRow([`🏢 Sede:`, this.obtenerNombreSede(this.trabajador.sede)]);
    worksheet.addRow([`📅 Periodo:`, `${this.formatearFecha(this.fechaInicio)} a ${this.formatearFecha(this.fechaFin)}`]);
    worksheet.addRow([]); // Separación

    // 📌 Cabecera de tabla
    const header = ['Día', 'Fecha', 'Entrada', 'Salida', 'Estado', 'Observación'];
    const headerRow = worksheet.addRow(header);

    headerRow.eachCell((cell: ExcelJS.Cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 📅 Agregar filas de días
    for (const dia of this.diasProcesados) {
      const fila = worksheet.addRow([
        dia.diaSemana,
        dia.fecha,
        dia.entrada || '—',
        dia.salida || '—',
        dia.estado || '—',
        dia.observacion || ''
      ]);

      // 🎨 Colorear filas según estado
      let color = 'FFFFFFFF'; // blanco
      const estado = (dia.estado || '').toLowerCase();

      if (estado.includes('asistencia completa')) color = 'FFA5D6A7';
      else if (estado.includes('asistencia')) color = 'FFB2EBF2';
      else if (estado.includes('falta')) color = 'FFFFCDD2';
      else if (estado.includes('pendiente')) color = 'FFFFF59D';
      else if (estado.includes('vacaciones')) color = 'FFC8E6C9';
      else if (estado.includes('permiso')) color = 'FFFFECB3';
      else if (estado.includes('incapacidad')) color = 'FFBBDEFB';

      fila.eachCell((cell: ExcelJS.Cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };
      });
    }

    // 📐 Ajustar ancho
    worksheet.columns.forEach((col: Partial<ExcelJS.Column>) => {
      if (col) col.width = 25;
    });

    // 💾 Guardar archivo
    workbook.xlsx.writeBuffer().then((buffer: any) => {
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      FileSaver.saveAs(blob, nombreArchivo);
    });
  }
}
