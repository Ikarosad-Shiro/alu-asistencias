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

  formatearFecha(fecha: Date): string {
    const fechaLocal = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()); // precisión local
    return fechaLocal.toLocaleDateString('es-MX', {
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

    const doc = pdfMake.createPdf(docDefinition);
    setTimeout(() => doc.open(), 0); // ✅ Garantiza que el navegador no lo bloquee
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
    const hoy = new Date().toISOString().split('T')[0];

    return dias.map(dia => {
      const fecha = dia.fecha;

      // 1. Eventos del trabajador (máxima prioridad)
      const eventoTrabajador = this.buscarEvento(fecha, eventosTrabajador);
      if (eventoTrabajador) {
        return {
          ...dia,
          estado: this.iconoEstado(eventoTrabajador.tipo),
          observacion: eventoTrabajador.descripcion || eventoTrabajador.tipo || ''
        };
      }

      // 2. Asistencias
      const asistencia = this.buscarAsistencia(fecha, asistencias);
      if (asistencia) {
        return this.procesarAsistencia(dia, asistencia, hoy);
      }

      // 3. Eventos de sede
      const eventoSede = this.buscarEvento(fecha, eventosSede);
      if (eventoSede) {
        return {
          ...dia,
          estado: this.iconoEstado(eventoSede.tipo),
          observacion: eventoSede.descripcion || eventoSede.tipo || ''
        };
      }

      // 4. Ausencia por defecto
      return {
        ...dia,
        estado: '❌ Falta',
        observacion: 'No registrado'
      };
    });
  }

  private buscarEvento(fecha: string, eventos: EventoEspecial[]): EventoEspecial | null {
    return eventos?.find((e: EventoEspecial) =>
      e?.fecha && this.normalizarFecha(e.fecha) === fecha
    ) || null;
  }

  private buscarAsistencia(fecha: string, asistencias: Asistencia[]): Asistencia | null {
    return asistencias?.find((a: Asistencia) => {
      if (!a) return false;

      // Verificar por fecha directa
      if (a.fecha && this.normalizarFecha(a.fecha) === fecha) return true;

      // Verificar en los detalles
      if (a.detalle?.length) {
        return a.detalle.some((reg: RegistroAsistencia) =>
          reg.fechaHora && this.normalizarFecha(reg.fechaHora) === fecha
        );
      }

      return false;
    }) || null;
  }

  private procesarEventoTrabajador(dia: any, evento: any): DiaProcesado {
    return {
      ...dia,
      estado: this.iconoEstado(evento.tipo),
      observacion: evento.descripcion || evento.tipo
    };
  }

  private procesarAsistencia(dia: any, asistencia: Asistencia, hoy: string): DiaProcesado {
    console.log('🧪 Analizando asistencia:', asistencia);

    // ✅ Caso 1: Estado explícito sin necesidad de detalles
    if (asistencia.estado && asistencia.estado === 'Asistencia Completa') {
      const entrada = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Entrada');
      const salida = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Salida');

      return {
        ...dia,
        entrada: entrada ? this.formatoHora(this.normalizarFechaHora(entrada.fechaHora)) : '-',
        salida: salida ? this.formatoHora(this.normalizarFechaHora(salida.fechaHora)) : '-',
        estado: this.iconoEstado('Asistencia Completa'),
        observacion: asistencia.observacion || 'Asistencia completa registrada'
      };
    }

    // ✅ Caso 2: Con detalle (entrada y/o salida)
    const entrada = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Entrada');
    const salida = asistencia.detalle?.find((d: RegistroAsistencia) => d.tipo === 'Salida');

    const diaProcesado: DiaProcesado = {
      ...dia,
      entrada: entrada ? this.formatoHora(this.normalizarFechaHora(entrada.fechaHora)) : '-',
      salida: salida ? this.formatoHora(this.normalizarFechaHora(salida.fechaHora)) : '-'
    };

    if (entrada && salida) {
      diaProcesado.estado = '✅ Asistencia Completa';
      diaProcesado.observacion = asistencia.observacion || 'Entrada y salida registradas';
    } else if (entrada) {
      if (dia.fecha < hoy) {
        diaProcesado.estado = '🕒 Salida Automática';
        diaProcesado.observacion = entrada.salida_automatica
          ? 'Salida automática registrada'
          : 'Falta registro de salida';
      } else {
        diaProcesado.estado = '⏳ Pendiente';
        diaProcesado.observacion = 'Esperando registro de salida';
      }
    } else if (salida) {
      diaProcesado.estado = '⚠️ Incompleta';
      diaProcesado.observacion = 'Falta registro de entrada';
    } else {
      diaProcesado.estado = '❌ Falta';
      diaProcesado.observacion = 'Sin registros de asistencia';
    }

    return diaProcesado;
  }

  private procesarEventoSede(dia: any, evento: any): DiaProcesado {
    const tipoNormalizado = this.normalizarTipoEvento(evento.tipo);
    return {
      ...dia,
      estado: this.iconoEstado(tipoNormalizado),
      observacion: evento.descripcion || evento.tipo
    };
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

  contarEstados(dias: any[]): string[] {
    const conteo: { [key: string]: number } = {};

    dias.forEach(d => {
      const estado = d.estado || 'Sin estado';
      conteo[estado] = (conteo[estado] || 0) + 1;
    });

    return Object.entries(conteo).map(([estado, cantidad]) => `${estado}: ${cantidad} día(s)`);
  }

  formatoHora(fechaHora: string): string {
    try {
      return DateTime.fromISO(fechaHora, { zone: 'America/Mexico_City' }).toFormat('hh:mm a');
    } catch (e) {
      console.error('🕓 Error al formatear hora:', fechaHora, e);
      return '-';
    }
  }

  iconoEstado(tipo: string): string {
    const mapaEstados: {[key: string]: string} = {
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
}
