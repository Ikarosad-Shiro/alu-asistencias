//detlle-trabajador.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import { Location } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { AsistenciaService } from 'src/app/services/asistencia.service';
import { CalendarioService } from 'src/app/services/calendario.service';

// + añade esto
import { TrabajadorUI } from 'src/app/services/trabajadores.service';

import { forkJoin, Observable, lastValueFrom, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DateTime } from 'luxon';

import { Asistencia as AsistenciaModel, EventoEspecial as EventoEspecialModel } from 'src/app/models/asistencia.model';
import Swal from 'sweetalert2';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

import { excelSanitize, EXCEL_MIME } from 'src/app/utils/excel';
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

interface HistorialSede {
  idSede: string;
  nombre: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

interface Trabajador {
  _id?: string;
  nombre: string;
  sede: number | null;
  sincronizado: boolean;
  correo?: string;
  telefono?: string;
  telefonoEmergencia?: string;
  direccion?: string;
  puesto?: string;
  estado?: 'activo' | 'inactivo';
  historialSedes?: HistorialSede[];
}

type SedeChip = { id: number; nombre: string; tipo: 'principal' | 'foranea' };

@Component({
  selector: 'app-detalle-trabajador',
  templateUrl: './detalle-trabajador.component.html',
  styleUrls: ['./detalle-trabajador.component.css']
})

export class DetalleTrabajadorComponent implements OnInit {
  trabajador: any = {};
  sidebarAbierto: boolean = false;
  trabajadorOriginal: any;
  modoEdicion: boolean = false;
  rolUsuario: string = '';
  sedes: any[] = [];
  diasProcesados: DiaProcesado[] = [];
  fechaInicio!: Date;
  fechaFin!: Date;
  // 📌 Asistencias que verá el calendario (mezcladas de todas las sedes)
  asistenciasCalendario: Asistencia[] = [];

  sedesChips: SedeChip[] = [];
  // para *ngFor trackBy en el template
  trackById = (_: number, item: SedeChip) => item.id;

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
    next: (sedes: any[]) => {
      this.sedes = sedes;
      this.buildSedesChips();   // 👈 chips para UI
    },
    error: (error: HttpErrorResponse) => { /* manejar error si quieres */ }
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
      this.normalizarYOrdenarHistorialEnTrabajador(); // ← normaliza historial
      this.buildSedesChips();  // 👈 actualiza chips con datos del trabajador

      const sedeBase = Number(trabajador.sedePrincipal ?? trabajador.sede);

      // 🔥 Paso 2: obtener en paralelo asistencias + calendarios.
      // Si un calendario todavía no existe (404), continuamos con diasEspeciales vacío
      // para que las asistencias reales sí puedan mostrarse.
      forkJoin({
        asistencias: this.trabajadoresService.obtenerAsistencias(trabajadorId),

        calendarioSede: (
          this.sedeService.obtenerEventosCalendario(
            sedeBase,
            new Date().getFullYear()
          ) as unknown as Observable<{ diasEspeciales: EventoEspecial[] }>
        ).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 404) {
              console.warn(
                `⚠️ La sede ${sedeBase} no tiene calendario para ${new Date().getFullYear()}. Se continuará sin eventos de sede.`
              );
              return of({ diasEspeciales: [] as EventoEspecial[] });
            }

            return throwError(() => error);
          })
        ),

        calendarioTrabajador: (
          this.trabajadoresService.obtenerEventosCalendarioTrabajador(
            trabajadorId,
            new Date().getFullYear()
          ) as unknown as Observable<{ diasEspeciales: EventoEspecial[] }>
        ).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 404) {
              console.warn(
                `⚠️ El trabajador no tiene calendario individual para ${new Date().getFullYear()}. Se continuará sin eventos individuales.`
              );
              return of({ diasEspeciales: [] as EventoEspecial[] });
            }

            return throwError(() => error);
          })
        )
      }).subscribe({
        next: ({ asistencias, calendarioSede, calendarioTrabajador }) => {
          // 📅 Procesar asistencias legacy (se conservan para otras funciones/PDF/Excel)
          this.trabajador.asistencias = (asistencias || []).map((a: any) => ({
            ...a,
            fecha: this.normalizarFecha(a.fecha),
            detalle: (a.detalle || []).map((d: any) => ({
              ...d,
              fechaHora: this.normalizarFechaHora(d.fechaHora)
            }))
          }));

          // 📅 Procesar eventos de sede
          this.eventosSede = (calendarioSede?.diasEspeciales || []).map((e: EventoEspecial) => ({
            ...e,
            fecha: this.normalizarFechaCalendario(e.fecha),
            descripcion: e.descripcion || e.tipo || ''
          }));

          // 📅 Procesar eventos del trabajador
          this.eventosTrabajador = (calendarioTrabajador?.diasEspeciales || []).map((e: EventoEspecial) => ({
            ...e,
            fecha: this.normalizarFechaCalendario(e.fecha),
            descripcion: e.descripcion || e.tipo || ''
          }));

          // ✅ SOLO para el calendario visual del detalle:
          // traemos asistencias unificadas ignorando sede (mezcladas).
          const start = DateTime.now()
            .setZone('America/Mexico_City')
            .startOf('month')
            .toJSDate();

          const end = DateTime.now()
            .setZone('America/Mexico_City')
            .endOf('month')
            .toJSDate();

          this.asistenciaService
            .obtenerDatosUnificadosParaCalendario(trabajadorId, start, end)
            .subscribe({
              next: ({ asistencias: asistUnificadas }) => {
                console.log('📥 Asistencias unificadas recibidas:', asistUnificadas);

                const asistenciasNorm = (asistUnificadas || []).map((a: any) => ({
                  ...a,
                  fecha: this.normalizarFecha(a.fecha),
                  detalle: (a.detalle || []).map((d: any) => ({
                    ...d,
                    fechaHora: this.normalizarFechaHora(d.fechaHora)
                  }))
                }));

                console.log('📅 Asistencias normalizadas para calendario:', asistenciasNorm);

                // 👇 Datos que recibe el calendario visual
                this.asistenciasCalendario = asistenciasNorm;

                // Se conserva diasProcesados para PDF/Excel y otras funciones
                const dias = this.generarDias(start, end);
                this.diasProcesados = this.procesarDias(
                  dias,
                  asistenciasNorm,
                  this.eventosTrabajador,
                  this.eventosSede
                );
              },
              error: (err) => {
                console.error('❌ Error cargando calendario unificado:', err);
                this.asistenciasCalendario = [];
                this.diasProcesados = [];
              }
            });
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
cargarAsistenciasCalendarioPorRango(inicio: Date, fin: Date): void {
  if (!this.trabajador?._id) return;

  this.asistenciaService
    .obtenerDatosUnificadosParaCalendario(this.trabajador._id, inicio, fin)
    .subscribe({
      next: ({ asistencias: asistUnificadas }) => {
        this.asistenciasCalendario = (asistUnificadas || []).map((a: any) => ({
          ...a,
          fecha: this.normalizarFecha(a.fecha),
          detalle: (a.detalle || []).map((d: any) => ({
            ...d,
            fechaHora: this.normalizarFechaHora(d.fechaHora)
          }))
        }));
      },
      error: (err) => {
        console.error('❌ Error cargando asistencias del mes:', err);
        this.asistenciasCalendario = [];
      }
    });
}
  // 👉 Ordena y normaliza el historial para la tabla (activo arriba, luego por fechaInicio DESC)
get historialOrdenado(): HistorialSede[] {
  const sedesCat = this.sedes || [];
  const nombrePorId = (id: any) => {
    const n = Number(id);
    const s = sedesCat.find((x: any) => x.id === n);
    return s?.nombre || this.obtenerNombreSede(n) || '';
  };

  const h: HistorialSede[] = Array.isArray(this.trabajador?.historialSedes)
    ? this.trabajador.historialSedes.map((r: any) => ({
        idSede: (typeof r.idSede === 'number' ? String(r.idSede) : r.idSede) ?? '',
        nombre: r.nombre || nombrePorId(r.idSede),
        fechaInicio: r.fechaInicio ? new Date(r.fechaInicio) : null,
        fechaFin: r.fechaFin ? new Date(r.fechaFin) : null
      }))
    : [];

  return h.sort((a, b) => {
    // activo (fechaFin null) primero
    const aActivo = a.fechaFin === null || a.fechaFin === undefined;
    const bActivo = b.fechaFin === null || b.fechaFin === undefined;
    if (aActivo && !bActivo) return -1;
    if (!aActivo && bActivo) return 1;

    const ai = a.fechaInicio ? a.fechaInicio.getTime() : 0;
    const bi = b.fechaInicio ? b.fechaInicio.getTime() : 0;
    return bi - ai; // más reciente primero
  });
}
// ======================================================
// 📅 FECHAS DE CALENDARIO
// Vacaciones, permisos, descansos, asistencia manual, etc.
// Se conserva el YYYY-MM-DD SIN aplicar zona horaria.
// ======================================================
private normalizarFechaCalendario(fecha: any): string {
  if (!fecha) return '';

  // Ejemplos:
  // 2026-10-07
  // 2026-10-07T00:00:00.000Z
  // 2026-10-07T12:00:00.000Z
  //
  // Todos deben representar:
  // 2026-10-07

  if (typeof fecha === 'string') {
    const match = fecha.match(/^(\d{4}-\d{2}-\d{2})/);

    if (match) {
      return match[1];
    }
  }

  // Respaldo por si alguna vez llega como Date
  if (fecha instanceof Date && !isNaN(fecha.getTime())) {
    const anio = fecha.getUTCFullYear();
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  return '';
}
// 👉 Normaliza y asegura que el campo nombre esté si faltara
private normalizarYOrdenarHistorialEnTrabajador(): void {
  if (!Array.isArray(this.trabajador?.historialSedes)) return;
  // solo reasigna para asegurar tipos Date en el objeto base
  this.trabajador.historialSedes = this.trabajador.historialSedes.map((r: any) => ({
    idSede: (typeof r.idSede === 'number' ? String(r.idSede) : r.idSede) ?? '',
    nombre: r.nombre || this.obtenerNombreSede(r.idSede),
    fechaInicio: r.fechaInicio ? new Date(r.fechaInicio) : null,
    fechaFin: r.fechaFin ? new Date(r.fechaFin) : null
  }));
}

  cargarTrabajadorPorId(id: string) {
    this.trabajadoresService.obtenerTrabajador(id).subscribe({
      next: (trabajador: any) => {
        this.trabajador = trabajador;
        this.trabajadorOriginal = JSON.parse(JSON.stringify(trabajador));
        this.buildSedesChips();  // 👈 añade esto

        const sedeBase = Number(trabajador.sedePrincipal ?? trabajador.sede);

        forkJoin({
          asistencias: this.trabajadoresService.obtenerAsistencias(id),

          calendarioSede: (
            this.sedeService.obtenerEventosCalendario(
              sedeBase,
              new Date().getFullYear()
            ) as unknown as Observable<{ diasEspeciales: EventoEspecial[] }>
          ).pipe(
            catchError((error: HttpErrorResponse) => {
              if (error.status === 404) {
                console.warn(
                  `⚠️ La sede ${sedeBase} no tiene calendario para ${new Date().getFullYear()}. Se continuará sin eventos de sede.`
                );
                return of({ diasEspeciales: [] as EventoEspecial[] });
              }

              return throwError(() => error);
            })
          ),

          calendarioTrabajador: (
            this.trabajadoresService.obtenerEventosCalendarioTrabajador(
              id,
              new Date().getFullYear()
            ) as unknown as Observable<{ diasEspeciales: EventoEspecial[] }>
          ).pipe(
            catchError((error: HttpErrorResponse) => {
              if (error.status === 404) {
                console.warn(
                  `⚠️ El trabajador no tiene calendario individual para ${new Date().getFullYear()}. Se continuará sin eventos individuales.`
                );
                return of({ diasEspeciales: [] as EventoEspecial[] });
              }

              return throwError(() => error);
            })
          )
        }).subscribe({
          next: ({ asistencias, calendarioSede, calendarioTrabajador }) => {
            this.trabajador.asistencias = (asistencias || []).map((a: any) => ({
              ...a,
              fecha: this.normalizarFecha(a.fecha),
              detalle: (a.detalle || []).map((d: any) => ({
                ...d,
                fechaHora: this.normalizarFechaHora(d.fechaHora)
              }))
            }));

            this.eventosSede = (calendarioSede?.diasEspeciales || []).map((e: EventoEspecial) => ({
              ...e,
              //fecha: this.normalizarFecha(e.fecha),
              fecha: this.normalizarFechaCalendario(e.fecha),
              descripcion: e.descripcion || e.tipo || ''
            }));

            this.eventosTrabajador = (calendarioTrabajador?.diasEspeciales || []).map((e: EventoEspecial) => ({
              ...e,
              fecha: this.normalizarFechaCalendario(e.fecha),
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
              fecha: this.normalizarFechaCalendario(e.fecha)
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
      //fecha: new Date(e.fecha).toISOString().split('T')[0]
      fecha: this.normalizarFechaCalendario(e.fecha)
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
            this.asistenciaService.obtenerDatosUnificadosParaCalendario(this.trabajador._id, fechaInicio, fechaFin).pipe(
            map(({ asistencias, eventosTrabajador /* , eventosSede */ }) => {
              const eventosSedeBase = this.eventosSede; // ← el de sede principal ya cargado
              const asistenciasValidas = asistencias.filter(
                (a: Asistencia) => (a?.detalle?.length ?? 0) > 0 || a?.estado !== undefined);

              const dias = this.generarDias(fechaInicio, fechaFin);
              const procesados = this.procesarDias(
                dias,
                asistenciasValidas,
                eventosTrabajador || [],
                eventosSedeBase || []   // ← aquí usas el de la sede principal
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
  /*private normalizarFecha(fecha: any): string {
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
  }*/
private normalizarFecha(fecha: any): string {
  if (!fecha) return '';

  // Si ya viene como YYYY-MM-DD, conservarla tal cual
  if (
    typeof fecha === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    return fecha;
  }

  try {
    let dt: DateTime;

    if (typeof fecha === 'string') {
      dt = DateTime.fromISO(fecha, {
        zone: 'America/Mexico_City'
      }).setZone('America/Mexico_City');
    } else {
      dt = DateTime.fromJSDate(
        new Date(fecha)
      ).setZone('America/Mexico_City');
    }

    if (!dt.isValid) {
      return '';
    }

    return dt.toISODate() || '';

  } catch (e) {
    console.error(
      '❌ Error al normalizar fecha:',
      fecha,
      e
    );
    return '';
  }
}
  async generarPDF(fechaInicio: Date, fechaFin: Date) {
    try {
      console.log('📅 Rango solicitado:', fechaInicio, fechaFin);

      // ✅ Nueva forma unificada usando solo una llamada al backend
      const datos = await lastValueFrom(
        this.asistenciaService.obtenerDatosUnificadosParaCalendario(this.trabajador._id, fechaInicio, fechaFin).pipe(
          map(({ asistencias, eventosTrabajador /* , eventosSede */ }) => {
            const asistenciasValidas = asistencias.filter(
              (a: Asistencia) => (a?.detalle?.length ?? 0) > 0 || a?.estado !== undefined
            );

            const dias = this.generarDias(fechaInicio, fechaFin);
            const datosProcesados = this.procesarDias(
              dias,
              asistenciasValidas,
              eventosTrabajador || [],
              this.eventosSede || []   // 👉 usa el de sede principal ya cargado
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
        { text: `Sede principal: ${this.obtenerNombreSede(this.sedePrincipalId)}` },
        { text: `Sedes foráneas: ${(this.sedesForaneasLimpias || []).map(id => this.obtenerNombreSede(id)).join(', ') || '—'}` },

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
    // =====================================================
    // 1. BUSCAR TODOS LOS DOCUMENTOS DEL DÍA
    // =====================================================
    const asistenciasDelDia = (asistencias || []).filter((a: Asistencia) => {
      if (!a) return false;

      const asistenciaAny: any = a;

      // Fecha directa del documento
      if (a.fecha && this.normalizarFecha(a.fecha) === fecha) {
        return true;
      }

      // Formato nuevo: registros[]
      if (
        Array.isArray(asistenciaAny.registros) &&
        asistenciaAny.registros.some(
          (r: any) =>
            r?.fechaHora &&
            this.normalizarFecha(r.fechaHora) === fecha
        )
      ) {
        return true;
      }

      // Formato nuevo: primerRegistro
      if (
        asistenciaAny.primerRegistro?.fechaHora &&
        this.normalizarFecha(asistenciaAny.primerRegistro.fechaHora) === fecha
      ) {
        return true;
      }

      // Formato nuevo: ultimoRegistro
      if (
        asistenciaAny.ultimoRegistro?.fechaHora &&
        this.normalizarFecha(asistenciaAny.ultimoRegistro.fechaHora) === fecha
      ) {
        return true;
      }

      // Formato anterior: detalle[]
      if (
        Array.isArray(a.detalle) &&
        a.detalle.some(
          (r: RegistroAsistencia) =>
            r?.fechaHora &&
            this.normalizarFecha(r.fechaHora) === fecha
        )
      ) {
        return true;
      }

      return false;
    });

    if (asistenciasDelDia.length === 0) {
      return null;
    }

    // =====================================================
    // 2. REUNIR TODAS LAS MARCAS DEL DÍA
    // =====================================================
    const marcas: any[] = [];
    const claves = new Set<string>();
    let existeFormatoNuevo = false;

    const millisMarca = (fechaHora: any): number => {
      if (!fechaHora) return 0;

      try {
        let dt: DateTime;

        if (typeof fechaHora === 'string') {
          dt = DateTime.fromISO(fechaHora, {
            zone: 'America/Mexico_City'
          });
        } else {
          dt = DateTime.fromJSDate(new Date(fechaHora)).setZone(
            'America/Mexico_City'
          );
        }

        return dt.isValid ? dt.toMillis() : 0;
      } catch {
        return 0;
      }
    };

    const agregarMarca = (registro: any, sedeFallback: any = null) => {
      if (!registro?.fechaHora) return;

      if (this.normalizarFecha(registro.fechaHora) !== fecha) {
        return;
      }

      const sede = registro.sede ?? sedeFallback ?? null;
      const millis = millisMarca(registro.fechaHora);

      if (!millis) return;

      const clave = `${millis}|${sede ?? ''}`;

      if (claves.has(clave)) {
        return;
      }

      claves.add(clave);

      marcas.push({
        ...registro,
        sede
      });
    };

    // =====================================================
    // 3. RECORRER LOS DOCUMENTOS DEL DÍA
    // =====================================================
    for (const asistencia of asistenciasDelDia) {
      const a: any = asistencia;
      const sedeDocumento = a.sede ?? null;

      // ===================================================
      // FORMATO NUEVO PRINCIPAL: registros[]
      // ===================================================
      if (Array.isArray(a.registros) && a.registros.length > 0) {
        const registrosDia = a.registros.filter(
          (r: any) =>
            r?.fechaHora &&
            this.normalizarFecha(r.fechaHora) === fecha
        );

        if (registrosDia.length > 0) {
          existeFormatoNuevo = true;

          for (const registro of registrosDia) {
            agregarMarca(registro, sedeDocumento);
          }

          /*
           * No procesamos también primerRegistro / ultimoRegistro,
           * porque serían las mismas marcas.
           */
          continue;
        }
      }

      // ===================================================
      // FORMATO NUEVO RESUMIDO
      // ===================================================
      if (
        a.primerRegistro?.fechaHora &&
        this.normalizarFecha(a.primerRegistro.fechaHora) === fecha
      ) {
        existeFormatoNuevo = true;

        agregarMarca(a.primerRegistro, sedeDocumento);

        if (
          Number(a.totalRegistros || 0) > 1 &&
          a.ultimoRegistro?.fechaHora
        ) {
          agregarMarca(a.ultimoRegistro, sedeDocumento);
        }

        continue;
      }

      // ===================================================
      // FORMATO ANTERIOR
      // ===================================================
      if (Array.isArray(a.detalle)) {
        for (const detalle of a.detalle) {
          if (
            detalle?.fechaHora &&
            this.normalizarFecha(detalle.fechaHora) === fecha
          ) {
            agregarMarca(detalle, sedeDocumento);
          }
        }
      }
    }

    // =====================================================
    // 4. ORDENAR GLOBALMENTE
    // =====================================================
    marcas.sort(
      (a, b) =>
        millisMarca(a.fechaHora) -
        millisMarca(b.fechaHora)
    );

    // =====================================================
    // 5. CREAR detalle[] COMPATIBLE
    // =====================================================
    const detalleGlobal: RegistroAsistencia[] = [];

    if (existeFormatoNuevo) {
      // Primera marca global = Entrada
      if (marcas.length >= 1) {
        detalleGlobal.push({
          tipo: 'Entrada',
          fechaHora: marcas[0].fechaHora,
          sincronizado: !!marcas[0].sincronizado
        });
      }

      // Última marca global = Salida
      if (marcas.length >= 2) {
        const ultima = marcas[marcas.length - 1];

        detalleGlobal.push({
          tipo: 'Salida',
          fechaHora: ultima.fechaHora,
          sincronizado: !!ultima.sincronizado
        });
      }
    } else {
      /*
       * Para los registros antiguos conservamos Entrada / Salida
       * tal como estaban registrados.
       */
      const entradas = marcas
        .filter(
          (m: any) =>
            m.tipo === 'Entrada' ||
            m.tipo === 'Asistencia' ||
            m.tipo === 'Entrada Manual'
        )
        .sort(
          (a, b) =>
            millisMarca(a.fechaHora) -
            millisMarca(b.fechaHora)
        );

      const salidas = marcas
        .filter(
          (m: any) =>
            m.tipo === 'Salida' ||
            String(m.tipo || '').startsWith('Salida')
        )
        .sort(
          (a, b) =>
            millisMarca(a.fechaHora) -
            millisMarca(b.fechaHora)
        );

      if (entradas.length > 0) {
        detalleGlobal.push({
          tipo: 'Entrada',
          fechaHora: entradas[0].fechaHora,
          sincronizado: !!entradas[0].sincronizado,
          salida_automatica: !!entradas[0].salida_automatica
        });
      }

      if (salidas.length > 0) {
        const ultimaSalida = salidas[salidas.length - 1];

        detalleGlobal.push({
          tipo: 'Salida',
          fechaHora: ultimaSalida.fechaHora,
          sincronizado: !!ultimaSalida.sincronizado,
          salida_automatica: !!ultimaSalida.salida_automatica
        });
      }
    }

    // =====================================================
    // 6. DEVOLVER UNA SOLA ASISTENCIA LÓGICA DEL DÍA
    // =====================================================
    const primeraAsistencia = asistenciasDelDia[0];

    return {
      ...primeraAsistencia,
      fecha,
      detalle: detalleGlobal
    };
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

  // 🧾 Encabezado con datos del trabajador (sanitizado)
  worksheet.addRow([ excelSanitize('👤 Nombre:'), excelSanitize(`${this.trabajador.nombre || ''} ${this.trabajador.apellido || ''}`) ]);
  worksheet.addRow([ excelSanitize('🏢 Sede principal:'), excelSanitize(this.obtenerNombreSede(this.sedePrincipalId)) ]);
  worksheet.addRow([ excelSanitize('🏷️ Sedes foráneas:'), excelSanitize((this.sedesForaneasLimpias || []).map(id => this.obtenerNombreSede(id)).join(', ') || '—') ]);
  worksheet.addRow([ excelSanitize('📅 Periodo:'), excelSanitize(`${this.formatearFecha(this.fechaInicio)} a ${this.formatearFecha(this.fechaFin)}`) ]);
  worksheet.addRow([]); // Separación

  // 📌 Cabecera de tabla
  const header = ['Día', 'Fecha', 'Entrada', 'Salida', 'Estado', 'Observación'].map(excelSanitize);
  const headerRow = worksheet.addRow(header);

  headerRow.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // 📅 Agregar filas de días (sanitizado)
  for (const dia of this.diasProcesados) {
    const fila = worksheet.addRow([
      excelSanitize(dia.diaSemana),
      excelSanitize(dia.fecha),
      excelSanitize(dia.entrada || '—'),
      excelSanitize(dia.salida  || '—'),
      excelSanitize(dia.estado  || '—'),
      excelSanitize(dia.observacion || '')
    ]);

    // 🎨 Colorear filas según estado
    let color = 'FFFFFFFF'; // blanco
    const estado = (dia.estado || '').toLowerCase();

    if (estado.includes('asistencia completa')) color = 'FFA5D6A7';
    else if (estado.includes('asistencia'))      color = 'FFB2EBF2';
    else if (estado.includes('falta'))           color = 'FFFFCDD2';
    else if (estado.includes('pendiente'))       color = 'FFFFF59D';
    else if (estado.includes('vacaciones'))      color = 'FFC8E6C9';
    else if (estado.includes('permiso'))         color = 'FFFFECB3';
    else if (estado.includes('incapacidad'))     color = 'FFBBDEFB';

    fila.eachCell((cell: ExcelJS.Cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    });
  }

  // 📐 Ajustar ancho
  worksheet.columns.forEach((col: Partial<ExcelJS.Column>) => { if (col) col.width = 25; });

  // 💾 Guardar con MIME correcto
  workbook.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
  const blob = new Blob([buffer], { type: EXCEL_MIME });
    FileSaver.saveAs(blob, nombreArchivo);
  });
}

desactivarTrabajador() {
  Swal.fire({
    title: '¿Estás seguro de desactivar al trabajador?',
    html: `
      <p style="font-weight: bold; color: #a30202;">⚠️ Esta acción tiene consecuencias importantes:</p>
      <ul style="text-align: left; font-size: 0.95rem;">
        <li>🧼 Se eliminará el registro de la huella en el checador.</li>
        <li>📆 No se podrán visualizar los calendarios del trabajador.</li>
        <li>📤 Será desvinculado de su sede actual.</li>
      </ul>
      <p style="margin-top: 12px;">¿Deseas continuar?</p>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, desactivar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    width: 550
  }).then(result => {
    if (!result.isConfirmed) return;

    Swal.fire({
      title: '🔒 Ingresa tu contraseña',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'Confirmar'
    }).then(confirm => {
      if (!confirm.isConfirmed || !confirm.value) return;

      const contraseña = confirm.value;

      this.trabajadoresService.verificarContraseña(contraseña).subscribe({
        next: (valido) => {
          if (!valido) {
            Swal.fire('⚠️ Contraseña incorrecta', '', 'warning');
            return;
          }

          const dataActualizada: Partial<TrabajadorUI> = {
            estado: 'inactivo',
            sincronizado: false
          };

          this.trabajadoresService
            .actualizarTrabajador(this.trabajador._id!, dataActualizada)
            .subscribe({
              next: () => {
                Swal.fire({
                  icon: 'success',
                  title: 'Trabajador desactivado correctamente',
                  confirmButtonText: 'OK'
                }).then(() => {
                  this.router.navigate(['/trabajadores']);
                });
              },
              error: (err) => {
                console.error('❌ Error al desactivar trabajador:', err);
                Swal.fire('❌ Error al desactivar', '', 'error');
              }
            });
        },
        error: (err) => {
          console.error('❌ Error al verificar contraseña:', err);
          Swal.fire('❌ Error al verificar contraseña', '', 'error');
        }
      });
    });
  });
}
reactivarTrabajador() {
  const sedes = this.sedes || [];

  if (!sedes.length) {
    Swal.fire('⚠️ No hay sedes disponibles', 'No se puede reactivar sin asignar una sede.', 'warning');
    return;
  }

  const optionsHtml = sedes
    .map((s: any) => `<option value="${s.id}">${s.nombre}</option>`)
    .join('');

  const checksHtml = sedes
    .map((s: any) => `
      <label class="sw-item" style="display:flex;align-items:center;gap:6px;margin:4px 0;">
        <input type="checkbox" value="${s.id}" />
        <span>${s.nombre}</span>
      </label>
    `)
    .join('');

  Swal.fire({
    title: 'Reactivar trabajador',
    html: `
      <div style="text-align:left">
        <p style="margin-bottom:12px;">
          Para reactivar al trabajador debes asignarle nuevamente una sede principal.
        </p>

        <label style="font-weight:600;display:block;margin-bottom:6px;">
          Sede principal
        </label>

        <select id="sw-sede-principal" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0 0 12px 0;">
          <option value="">Selecciona una sede</option>
          ${optionsHtml}
        </select>

        <label style="font-weight:600;display:block;margin:6px 0;">
          Sedes foráneas opcionales
        </label>

        <div id="sw-foraneas" style="max-height:220px;overflow:auto;border:1px solid #eee;border-radius:8px;padding:8px;">
          ${checksHtml}
        </div>

        <small style="display:block;margin-top:8px;color:#666;">
          La sede principal no puede estar marcada como foránea.
        </small>
      </div>
    `,
    icon: 'question',
    width: 600,
    showCancelButton: true,
    confirmButtonText: 'Continuar',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    didOpen: () => {
      const principalSel = document.getElementById('sw-sede-principal') as HTMLSelectElement;
      const forasDiv = document.getElementById('sw-foraneas') as HTMLDivElement;

      const updateDisabled = () => {
        const principal = Number(principalSel.value);

        forasDiv.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(chk => {
          chk.disabled = Number(chk.value) === principal;

          if (chk.disabled) {
            chk.checked = false;
          }
        });
      };

      principalSel.addEventListener('change', updateDisabled);
      updateDisabled();
    },
    preConfirm: () => {
      const principalSel = document.getElementById('sw-sede-principal') as HTMLSelectElement;
      const forasDiv = document.getElementById('sw-foraneas') as HTMLDivElement;

      const principal = Number(principalSel.value);

      if (!principal || Number.isNaN(principal)) {
        Swal.showValidationMessage('Selecciona una sede principal válida');
        return;
      }

      const foraneas = Array.from(
        forasDiv.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')
      )
        .map(chk => Number(chk.value))
        .filter(v => v !== principal);

      return { principal, foraneas };
    }
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;

    const { principal, foraneas } = result.value as {
      principal: number;
      foraneas: number[];
    };

    Swal.fire({
      title: '🔒 Ingresa tu contraseña',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar'
    }).then(confirm => {
      if (!confirm.isConfirmed || !confirm.value) return;

      const contraseña = confirm.value;

      this.trabajadoresService.verificarContraseña(contraseña).subscribe({
        next: (valido) => {
          if (!valido) {
            Swal.fire('❌ Contraseña incorrecta', '', 'error');
            return;
          }

          const body: any = {
            estado: 'activo',
            sede: principal,
            sedePrincipal: principal,
            sedesForaneas: foraneas,
            sincronizado: false
          };

          this.trabajadoresService
            .actualizarTrabajador(this.trabajador._id!, body)
            .subscribe({
              next: () => {
                Swal.fire({
                  icon: 'success',
                  title: 'Trabajador reactivado correctamente',
                  text: 'El trabajador quedó activo y pendiente de sincronización.',
                  confirmButtonText: 'OK'
                }).then(() => {
                  this.cargarTrabajadorPorId(this.trabajador._id!);
                });
              },
              error: (err) => {
                console.error('❌ Error al reactivar trabajador:', err);
                Swal.fire('❌ Error', 'No se pudo reactivar el trabajador.', 'error');
              }
            });
        },
        error: (err) => {
          console.error('❌ Error al verificar contraseña:', err);
          Swal.fire('❌ Error', 'No se pudo verificar la contraseña.', 'error');
        }
      });
    });
  });
}

cambiarSede() {
  const sedes = this.sedes || [];
  const principalActual: number | null =
    this.trabajador?.sedePrincipal ?? this.trabajador?.sede ?? null;
  const foraneasActuales: number[] = Array.isArray(this.trabajador?.sedesForaneas)
    ? this.trabajador.sedesForaneas.map((x: any) => Number(x))
    : [];

  const optionsHtml = sedes
    .map((s: any) => `<option value="${s.id}" ${s.id === principalActual ? 'selected' : ''}>${s.nombre}</option>`)
    .join('');

  const checksHtml = sedes
    .map((s: any) => {
      const checked = foraneasActuales.includes(s.id) ? 'checked' : '';
      return `
        <label class="sw-item" style="display:flex;align-items:center;gap:6px;margin:4px 0;">
          <input type="checkbox" value="${s.id}" ${checked}/>
          <span>${s.nombre}</span>
        </label>`;
    })
    .join('');

  Swal.fire({
    title: 'Cambiar sede (principal y foráneas)',
    html: `
      <div style="text-align:left">
        <label style="font-weight:600;display:block;margin-bottom:6px;">Sede principal</label>
        <select id="sw-sede-principal" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0 0 12px 0;">
          ${optionsHtml}
        </select>

        <label style="font-weight:600;display:block;margin:6px 0;">Sedes foráneas</label>
        <div id="sw-foraneas" style="max-height:220px;overflow:auto;border:1px solid #eee;border-radius:8px;padding:8px;">
          ${checksHtml}
        </div>

        <small class="muted" style="display:block;margin-top:8px;color:#666;">
          La sede principal no puede estar marcada como foránea.
        </small>
      </div>
    `,
    width: 600,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    didOpen: () => {
      const principalSel = document.getElementById('sw-sede-principal') as HTMLSelectElement;
      const forasDiv = document.getElementById('sw-foraneas') as HTMLDivElement;

      const updateDisabled = () => {
        const principal = Number(principalSel.value);
        forasDiv.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(chk => {
          chk.disabled = Number(chk.value) === principal;
          if (chk.disabled) chk.checked = false;
        });
      };

      principalSel.addEventListener('change', updateDisabled);
      updateDisabled();
    },
    preConfirm: () => {
      const principalSel = document.getElementById('sw-sede-principal') as HTMLSelectElement;
      const forasDiv = document.getElementById('sw-foraneas') as HTMLDivElement;

      const principal = Number(principalSel.value);
      if (!principal || isNaN(principal)) {
        Swal.showValidationMessage('Selecciona una sede principal válida');
        return;
      }

      const foraneas = Array.from(
        forasDiv.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')
      )
        .map(chk => Number(chk.value))
        .filter(v => v !== principal);

      return { principal, foraneas };
    }
  }).then(result => {
    if (!result.isConfirmed || !result.value) return;
    const { principal, foraneas } = result.value as { principal: number; foraneas: number[] };

    // Confirmar contraseña
    Swal.fire({
      title: '🔒 Ingresa tu contraseña',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Confirmar'
    }).then(confirm => {
      if (!confirm.isConfirmed || !confirm.value) return;
      const contraseña = confirm.value;

      this.trabajadoresService.verificarContraseña(contraseña).subscribe(valido => {
        if (!valido) {
          Swal.fire('❌ Contraseña incorrecta', '', 'error');
          return;
        }

        // 🔁 Construir historial solo si cambió la principal
        const ahora = new Date();
        const historial: HistorialSede[] = Array.isArray(this.trabajador.historialSedes)
          ? [...this.trabajador.historialSedes]
          : [];

        const principalAnterior = Number(this.trabajador?.sedePrincipal ?? this.trabajador?.sede);
        if (!isNaN(principalAnterior) && principalAnterior !== principal) {
          const abierto = historial.find(h => !h.fechaFin);
          if (abierto) abierto.fechaFin = ahora;
          const sedeObj = sedes.find((s: any) => s.id === principal);
          historial.push({
            idSede: String(principal),
            nombre: sedeObj?.nombre || this.obtenerNombreSede(principal),
            fechaInicio: ahora,
            fechaFin: null
          });
        }

        const body: any = {
          sede: principal,              // compatibilidad
          sedePrincipal: principal,
          sedesForaneas: foraneas,
          sincronizado: false,
          historialSedes: historial
        };

        this.enviarCambiosSedes(this.trabajador._id!, body);
      });
    });
  });
}

// Id de sede principal (soporta legacy this.trabajador.sede)
get sedePrincipalId(): number | null {
  const v = this.trabajador?.sedePrincipal ?? this.trabajador?.sede ?? null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Foráneas normalizadas: números, únicas y sin la principal
get sedesForaneasLimpias(): number[] {
  const principal = this.sedePrincipalId;

  const arr: number[] = Array.isArray(this.trabajador?.sedesForaneas)
    ? (this.trabajador.sedesForaneas as any[]).map((x) => Number(x))
    : [];

  const unicos: number[] = Array.from(new Set<number>(arr.filter((n) => !Number.isNaN(n))));
  return unicos.filter((id) => (principal === null ? true : id !== principal));
}

// Normaliza y ordena historial en el front (por si llega legacy)
private normalizarHistorialLocal(hist: any[] = []) {
  const arr = (Array.isArray(hist) ? hist : []).map(h => ({
    idSede: typeof h.idSede === 'string' ? Number(h.idSede) : h.idSede,
    nombre: h.nombre || '',
    fechaInicio: h.fechaInicio ? new Date(h.fechaInicio) : null,
    fechaFin: h.fechaFin ? new Date(h.fechaFin) : null,
  }));

  arr.sort((a, b) => {
    const ai = a.fechaInicio ? a.fechaInicio.getTime() : 0;
    const bi = b.fechaInicio ? b.fechaInicio.getTime() : 0;
    return ai - bi;
  });

  // fusionar consecutivos misma sede
  const fusionados: any[] = [];
  for (const item of arr) {
    const last = fusionados[fusionados.length - 1];
    if (last && last.idSede === item.idSede) {
      if (!last.fechaInicio || (item.fechaInicio && item.fechaInicio < last.fechaInicio)) {
        last.fechaInicio = item.fechaInicio;
      }
      if (item.fechaFin && (!last.fechaFin || item.fechaFin > last.fechaFin)) {
        last.fechaFin = item.fechaFin;
      }
    } else {
      fusionados.push({ ...item });
    }
  }

  return fusionados;
}

// Acción de UI para reparar servidor y refrescar
repararHistorial() {
  if (!this.trabajador?._id) return;

  // (Opcional) pedir contraseña como en cambiarSede/desactivar
  Swal.fire({
    title: '🔒 Ingresa tu contraseña',
    input: 'password',
    inputPlaceholder: 'Contraseña',
    showCancelButton: true,
    confirmButtonText: 'Reparar'
  }).then(confirm => {
    if (!confirm.isConfirmed || !confirm.value) return;

    this.trabajadoresService.verificarContraseña(confirm.value).subscribe(valido => {
      if (!valido) {
        Swal.fire('⚠️ Contraseña incorrecta');
        return;
      }

      this.trabajadoresService.repararHistorial(this.trabajador._id!).subscribe({
        next: (t) => {
          this.trabajador = t;
          // asegura normalización local
          this.trabajador.historialSedes = this.normalizarHistorialLocal(t.historialSedes || []);
          Swal.fire('✅ Historial reparado');
        },
        error: (e) => {
          console.error(e);
          Swal.fire('❌ Error al reparar historial');
        }
      });
    });
  });
}

// 👉 Usa /:id/sedes si existe; si no, cae a actualizarTrabajador
private enviarCambiosSedes(id: string, body: any) {
  const svc: any = this.trabajadoresService as any;
  const req: Observable<any> =
    typeof svc.actualizarSedes === 'function'
      ? svc.actualizarSedes(id, {
          sedePrincipal: body.sedePrincipal,
          sedesForaneas: body.sedesForaneas
        })
      : this.trabajadoresService.actualizarTrabajador(id, body);

  req.subscribe({
    next: () => {
      Swal.fire('✅ Guardado', 'Sedes actualizadas correctamente', 'success');
      this.cargarTrabajadorPorId(id);
    },
    error: (err) => {
      console.error(err);
      Swal.fire('❌ Error', 'No se pudieron actualizar las sedes', 'error');
    }
  });
}
toggleSidebar(): void {
  this.sidebarAbierto = !this.sidebarAbierto;
}

private buildSedesChips(): void {
  if (!this.trabajador) { this.sedesChips = []; return; }

  const principalRaw = this.trabajador?.sedePrincipal ?? this.trabajador?.sede;
  const principal = Number(principalRaw);

  const foras: number[] = Array.isArray(this.trabajador?.sedesForaneas)
    ? Array.from(new Set((this.trabajador.sedesForaneas as any[]).map(x => Number(x))))
    : [];

  const nombre = (id: number) => {
    const s = (this.sedes || []).find((x: any) => Number(x.id) === Number(id) || x._id === id);
    return s?.nombre ?? `Sede ${id}`;
  };

  const chips: SedeChip[] = [];
  if (!Number.isNaN(principal)) {
    chips.push({ id: principal, nombre: nombre(principal), tipo: 'principal' });
  }
  for (const f of foras) {
    if (!Number.isNaN(f) && f !== principal) {
      chips.push({ id: f, nombre: nombre(f), tipo: 'foranea' });
    }
  }

  this.sedesChips = chips;
}


}