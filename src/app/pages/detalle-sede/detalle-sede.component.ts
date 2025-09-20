import { ChangeDetectionStrategy, ChangeDetectorRef,Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { CalendarioService } from 'src/app/services/calendario.service';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

import { excelSanitize, EXCEL_MIME } from 'src/app/utils/excel';
import * as FileSaver from 'file-saver';
import * as ExcelJS from 'exceljs';
import { lastValueFrom, firstValueFrom } from 'rxjs';
import type { BorderStyle } from 'exceljs';

import { DateTime } from 'luxon';
import { AsistenciaService } from 'src/app/services/asistencia.service'; // Asegúrate de tenerlo

interface PdfTableNode {
  table: {
    headerRows: number;
    widths: any[];
    body: any[][];
    dontBreakRows: boolean;
  };
  layout: PdfTableLayout;
  margin: number[];
  pageBreak?: 'before' | 'after' | 'both';
}

interface PdfTableLayout {
  fillColor?: (rowIndex: number, node: any, columnIndex: number) => string | null;
  hLineWidth: (i: number, node: any) => number;
  vLineWidth: (i: number, node: any) => number;
  hLineColor: (i: number, node: any) => string;
  paddingTop: (i: number, node: any) => number;
  paddingBottom: (i: number, node: any) => number;
  paddingLeft: (i: number, node: any) => number;
  paddingRight: (i: number, node: any) => number;
}

// ✅ Forma correcta de asignar las fuentes
(pdfMake as any).vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detalle-sede',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  codigoVerificacion: string = '';
  trabajadoresProcesados: any[] = [];
  fechasRango: string[] = [];
  fechaInicio!: Date;
  fechaFin!: Date;
  busquedaTrabajador: string = '';

  bordeCelda: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' as BorderStyle, color: { argb: 'FFDEE2E6' } },
    left: { style: 'thin' as BorderStyle, color: { argb: 'FFDEE2E6' } },
    bottom: { style: 'thin' as BorderStyle, color: { argb: 'FFDEE2E6' } },
    right: { style: 'thin' as BorderStyle, color: { argb: 'FFDEE2E6' } }
  };

  trackByIndex = (_: number, __: unknown) => _;

  // 🕒 Horario Base (Reactive Forms)
form!: FormGroup;
guardando = false;
nombresDias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private sedeService: SedeService,
    private trabajadoresService: TrabajadoresService,
    private calendarioService: CalendarioService,
    private authService: AuthService,
    private userService: UserService,
    private asistenciaService: AsistenciaService,
    private fb: FormBuilder
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
      this.form = this.fb.group({
          desde: [new Date(), Validators.required],
          dias: this.fb.array(this.nombresDias.map((_, i) => this.crearDia(i === 6))),
          // ⬇️ NUEVO bloque para nuevos ingresos
          nuevoIngreso: this.fb.group({
            activo: [false],
            duracionDias: [30, [Validators.min(1), Validators.max(180)]],
            aplicarSoloDiasActivosBase: [true],
            jornadas: this.fb.array([ this.createJornada('08:00','17:00') ])
          })
        });

        this.dias.controls.forEach(ctrl => this.configurarValidadoresDia(ctrl as FormGroup));
      }

  // ✅ Pon esto en la clase (junto a tus helpers)
  private toHHMM(v: any): string {
      if (!v) return '';
      if (/^\d{2}:\d{2}$/.test(v)) return v;           // ya viene 24h
      const s = String(v).trim();
      const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return s;                                 // por si llegara '09:00' u otro
      let h = parseInt(m[1], 10);
      const min = m[2];
      const ampm = m[3].toUpperCase();
      if (ampm === 'AM') { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
      return `${String(h).padStart(2,'0')}:${min}`;
  }

  private toYmdSafe(x: any): string {
    const raw = (typeof x === 'string') ? x : (x?.$date ?? x);
    return DateTime.fromJSDate(new Date(raw)).toFormat('yyyy-MM-dd');
  }

// Día YYYY-MM-DD en CDMX partiendo de ISO/string/Date
private ymdMX(x: any): string {
  try {
    const raw = (typeof x === 'string') ? x : (x?.$date ?? x);
    const dt = (raw instanceof Date)
      ? DateTime.fromJSDate(raw)
      : DateTime.fromISO(String(raw));
    return dt.setZone('America/Mexico_City').toFormat('yyyy-MM-dd');
  } catch {
    return '';
  }
}

// Normaliza "sede" a string para comparar sin dramas (number, string, ObjectId, nested, etc.)
private sedeIdToString(x: any): string | null {
  const raw = (x && (x.sede ?? x.sedeId ?? x.sede_id ?? x.sede?.id ?? x.sede?._id)) ?? x;
  if (raw === undefined || raw === null) return null;
  try { return String(raw); } catch { return null; }
}

private esEstadoInerte(estado: any): boolean {
  if (!estado) return true;
  const s = String(estado).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  return s === '' || s === '—' || s === 'falta' || s === 'pendiente';
}

private esCeldaVaciaOInerte(celda: any): boolean {
  if (!celda) return true;
  const entradaV = !celda.entrada || celda.entrada === '—';
  const salidaV  = !celda.salida  || celda.salida  === '—';
  return (entradaV && salidaV && this.esEstadoInerte(celda.estado));
}

  private createJornada(ini = '09:00', fin = '17:00', overnight = false): FormGroup {
    return this.fb.group({
      ini: [ini, Validators.required],
      fin: [fin, Validators.required],
      overnight: [overnight]
    });
  }

  crearDia(esDomingo = false): FormGroup {
    return this.fb.group({
      activo: [!esDomingo],
      // si es domingo, empieza sin jornadas; si no, con una por defecto
      jornadas: this.fb.array(esDomingo ? [] : [this.createJornada()])
    });
  }

  // ====== ACTUALIZA validadores por “activo” ======
  private configurarValidadoresDia(g: FormGroup): void {
    const activo = g.get('activo')!;
    const jornadasFA = g.get('jornadas') as FormArray<FormGroup>;

    const aplicar = (on: boolean) => {
      // habilita/deshabilita todos los controles según estado
      jornadasFA.controls.forEach(j => {
        const ini = j.get('ini')!;
        const fin = j.get('fin')!;
        if (on) {
          ini.setValidators([Validators.required]);
          fin.setValidators([Validators.required]);
          ini.enable({ emitEvent: false });
          fin.enable({ emitEvent: false });
        } else {
          ini.clearValidators();
          fin.clearValidators();
          ini.disable({ emitEvent: false });
          fin.disable({ emitEvent: false });
        }
        ini.updateValueAndValidity({ emitEvent: false });
        fin.updateValueAndValidity({ emitEvent: false });
      });

      // si se activa y no hay jornadas, crea una por defecto
      if (on && jornadasFA.length === 0) {
        jornadasFA.push(this.createJornada());
      }
      // si se desactiva, opcionalmente limpia
      if (!on) {
        jornadasFA.clear();
      }
    };

    aplicar(!!activo.value);
    activo.valueChanges.subscribe(aplicar);
  }

  // atajos
  get dias(): FormArray<FormGroup> {
    return this.form.get('dias') as FormArray<FormGroup>;
  }

// atajo
  getJornadas(i: number): FormArray<FormGroup> {
    return this.dias.at(i).get('jornadas') as FormArray<FormGroup>;
  }

  get ni(): FormGroup {
  return this.form.get('nuevoIngreso') as FormGroup;
  }

  get niJornadas(): FormArray<FormGroup> {
  return this.ni.get('jornadas') as FormArray<FormGroup>;
  }

  addNIJornada() { this.niJornadas.push(this.createJornada()); }
  removeNIJornada(idx: number) { this.niJornadas.removeAt(idx); }

  private getDomingosEnRango(inicio: Date, fin: Date): Date[] {
    const out: Date[] = [];
    const cur = new Date(inicio);
    while (cur.getDay() !== 0) cur.setDate(cur.getDate() + 1);
    while (cur <= fin) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }
    return out;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  abrirAsistenteDomingoSede(): void {
    Swal.fire({
      title: '🕊️ Asistente de Domingo',
      html: `
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <div>
            <label style="font-weight:bold">Inicio</label>
            <input type="date" id="ad-inicio" class="swal2-input" style="width:180px;margin:0"/>
          </div>
          <div>
            <label style="font-weight:bold">Fin</label>
            <input type="date" id="ad-fin" class="swal2-input" style="width:180px;margin:0"/>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Vista previa',
      didOpen: () => {
        const y = this.anioActual;
        (document.getElementById('ad-inicio') as HTMLInputElement).value = `${y}-01-01`;
        (document.getElementById('ad-fin') as HTMLInputElement).value    = `${y}-12-31`;
      },
      preConfirm: () => {
        const ini = (document.getElementById('ad-inicio') as HTMLInputElement).value;
        const fin = (document.getElementById('ad-fin') as HTMLInputElement).value;
        if (!ini || !fin) { Swal.showValidationMessage('Selecciona ambas fechas'); return; }
        if (ini > fin) { Swal.showValidationMessage('Inicio no puede ser mayor a fin'); return; }
        return { ini, fin };
      }
    }).then(prev => {
      if (!prev.isConfirmed || !prev.value) return;

      const ini = new Date(`${prev.value.ini}T00:00:00`);
      const fin = new Date(`${prev.value.fin}T00:00:00`);

      // Cargar calendario de esta sede y año actual (simple)
      this.calendarioService.obtenerPorSedeYAnio(this.sede.id, this.anioActual).subscribe({
        next: (res: any) => {
          const existentes = (res?.diasEspeciales || []).map((e: any) => new Date(e.fecha?.$date ?? e.fecha));
          const domingos = this.getDomingosEnRango(ini, fin);

          let aCrear = 0, conEvento = 0;
          const crear: Date[] = [];
          for (const d of domingos) {
            const ya = existentes.some((x: Date) => this.isSameDay(x, d));
            if (ya) conEvento++; else { aCrear++; crear.push(d); }
          }

          Swal.fire({
            title: 'Vista previa',
            text: `Domingos: ${domingos.length} | A crear: ${aCrear} | Ya ocupados: ${conEvento}`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Aplicar'
          }).then(goal => {
            if (!goal.isConfirmed || aCrear === 0) return;

            const batch = 12;
            const run = async () => {
              for (let i = 0; i < crear.length; i += batch) {
                const slice = crear.slice(i, i + batch);
                await Promise.all(slice.map(f => new Promise<void>(resolve => {
                  this.calendarioService.agregarDia({
                    año: this.anioActual,
                    sede: this.sede.id,
                    fecha: f,
                    tipo: 'descanso',
                    descripcion: 'Asistente de Domingo'
                  }).subscribe({ next: () => resolve(), error: () => resolve() });
                })));
              }
            };

            run().then(() => {
              Swal.fire('Listo', 'Se aplicaron los domingos como "Descanso".', 'success');
              this.obtenerEventos(this.sede.id, this.anioActual);
            }).catch(() => Swal.fire('Error', 'No se pudieron aplicar los cambios.', 'error'));
          });
        },
        error: () => Swal.fire('Error', 'No se pudo consultar el calendario.', 'error')
      });
    });
  }

  addJornada(i: number) {
    const dia = this.dias.at(i) as FormGroup;
    if (!dia.value.activo) dia.patchValue({ activo: true });
    this.getJornadas(i).push(this.createJornada());
  }

  removeJornada(i: number, jIdx: number) {
    const dia = this.dias.at(i) as FormGroup;                // 👈 ahora sí existe
    const jornadasFA = this.getJornadas(i);
    jornadasFA.removeAt(jIdx);

    // si ya no queda ninguna jornada, marcamos el día como inactivo (opcional)
    if (jornadasFA.length === 0) {
      dia.patchValue({ activo: false });
    }

    dia.markAsDirty();
    dia.markAsTouched();
  }

  obtenerSede(id: number): void {
    this.sedeService.obtenerSedePorId(id).subscribe({
      next: (res: any) => {
        this.sede = res;
        this.cargarHorarioBaseExistente(res?.horarioBase);
      },
      error: (err: any) => console.error('❌ Error al obtener sede', err)
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

  eliminarSede(): void {
    if (!this.esDios()) return;

    const enProceso = this.sede.estado === 'eliminacion_pendiente';

    Swal.fire({
      title: enProceso ? '¿Cancelar eliminación?' : '¿Estás seguro?',
      text: enProceso
        ? 'Esto cancelará la eliminación pendiente de esta sede.'
        : 'Esta acción eliminará la sede. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: enProceso ? 'Sí, cancelar' : 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then(confirm => {
      if (!confirm.isConfirmed) return;

      if (enProceso) {
        this.sedeService.cancelarEliminacionSede(this.sede.id).subscribe({
          next: () => {
            Swal.fire('✅ Eliminación cancelada', 'La sede ha sido restaurada.', 'success');
            this.obtenerSede(this.sede.id);
          },
          error: () => {
            Swal.fire('❌ Error', 'No se pudo cancelar la eliminación.', 'error');
          }
        });
      } else {
        Swal.fire({
          title: 'Confirmación necesaria',
          input: 'text',
          inputLabel: `Escribe exactamente: "Estoy seguro de eliminar la sede ${this.sede.nombre}"`,
          inputPlaceholder: `Estoy seguro de eliminar la sede ${this.sede.nombre}`,
          showCancelButton: true,
          preConfirm: (valor) => {
            if (valor !== `Estoy seguro de eliminar la sede ${this.sede.nombre}`) {
              Swal.showValidationMessage('❌ Texto incorrecto. Debes escribirlo exactamente igual.');
            }
            return valor;
          }
        }).then(confirmText => {
          if (!confirmText.isConfirmed) return;

          Swal.fire({
            title: 'Verificación final',
            text: 'Esto marcará la sede para eliminación. Ingresa tu contraseña para confirmar.',
            input: 'password',
            inputLabel: 'Contraseña',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            preConfirm: async (contraseña) => {
              try {
                const res = await firstValueFrom(this.userService.verificarContraseña(contraseña));
                if (!res.valido) {
                  Swal.showValidationMessage('❌ Contraseña incorrecta');
                  return false;
                }
                return true;
              } catch {
                Swal.showValidationMessage('❌ Error al verificar la contraseña');
                return false;
              }
            }
          }).then(passwordStep => {
            if (!passwordStep.isConfirmed || !passwordStep.value) return;

            const codigo = Math.floor(10000 + Math.random() * 90000).toString();
            this.codigoVerificacion = codigo;

            const email = this.authService.obtenerDatosDesdeToken()?.email;
            if (!email) {
              Swal.fire('❌ Error', 'No se pudo obtener el correo del usuario.', 'error');
              return;
            }

            this.authService.enviarCodigoEliminacionSede(email, codigo).subscribe({
              next: () => {
                Swal.fire({
                  title: 'Código enviado',
                  text: 'Se envió un código de verificación a tu correo. Ingrésalo para finalizar la acción.',
                  input: 'text',
                  inputLabel: 'Código de 5 dígitos',
                  inputPlaceholder: 'Ej: 12345',
                  showCancelButton: true,
                  confirmButtonText: 'Verificar',
                  preConfirm: (codigoIngresado) => {
                    if (codigoIngresado !== this.codigoVerificacion) {
                      Swal.showValidationMessage('❌ Código incorrecto.');
                      return false;
                    }
                    return true;
                  }
                }).then(codeConfirm => {
                  if (!codeConfirm.isConfirmed || !codeConfirm.value) return;

                  this.sedeService.marcarEliminacionSede(this.sede.id).subscribe({
                    next: () => {
                      Swal.fire('✅ Proceso iniciado', 'La sede ha sido marcada para eliminación.', 'success');
                      this.obtenerSede(this.sede.id);
                    },
                    error: () => {
                      Swal.fire('❌ Error', 'No se pudo iniciar el proceso de eliminación.', 'error');
                    }
                  });
                });
              },
              error: (err) => {
                console.error('❌ Error al enviar el código:', err);
                Swal.fire('❌ Error', 'No se pudo enviar el código de verificación.', 'error');
              }
            });
          });
        });
      }
    });
  }

  cancelarEliminacionSede(): void {
    Swal.fire({
      title: '¿Cancelar eliminación?',
      text: 'Esto restaurará la sede y detendrá el proceso de eliminación.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar eliminación',
      cancelButtonText: 'No'
    }).then(result => {
      if (result.isConfirmed) {
        this.sedeService.cancelarEliminacionSede(this.sede.id).subscribe({
          next: (res) => {
            Swal.fire('✅ Cancelado', 'La eliminación de la sede ha sido cancelada.', 'success');
            this.obtenerSede(this.sede.id); // Refrescamos los datos
          },
          error: (err) => {
            console.error('❌ Error al cancelar eliminación:', err);
            Swal.fire('Error', 'No se pudo cancelar la eliminación.', 'error');
          }
        });
      }
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
      fecha: evento.fecha,
      contraseña: evento.contraseña
    };
    this.calendarioService.eliminarDia(data).subscribe({
      next: () => this.obtenerEventos(this.sede.id, this.anioActual),
      error: (err) => console.error('❌ Error al eliminar evento desde detalle-sede:', err)
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

  // ====== COPIAR primer día a todos (deep copy) ======
  aplicarATodos(): void {
    const base = this.dias.at(0).value as { activo: boolean; jornadas: any[] };
    this.dias.controls.forEach((g: FormGroup, idx) => {
      if (idx === 0) return;
      const fa = g.get('jornadas') as FormArray;
      fa.clear();
      if (base.activo && base.jornadas?.length) {
        base.jornadas.forEach(j => fa.push(this.createJornada(j.ini, j.fin, j.overnight)));
        g.patchValue({ activo: true });
      } else {
        g.patchValue({ activo: false });
      }
    });
  }

  // ====== LIMPIAR ======
  limpiar(): void {
    this.dias.controls.forEach((g: FormGroup) => {
      g.patchValue({ activo: false });
      const fa = g.get('jornadas') as FormArray;
      fa.clear();
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  cargarHorarioBaseExistente(horario: any) {
    if (!horario) return;
    // 🛡️ soporta si vino como {horarioBase:{...}} o ya plano
    const hb = horario?.horarioBase ? horario.horarioBase : horario;

    try {
      if (hb.desde) {
        const d = DateTime.fromISO(hb.desde).toJSDate();
        this.form.patchValue({ desde: d });
      }
      // reset días
      this.dias.controls.forEach((g: FormGroup) => {
        g.patchValue({ activo: false });
        (g.get('jornadas') as FormArray).clear();
      });

      const toIndex = (dow: number) => (dow === 0 ? 6 : dow - 1);
      (hb.reglas || []).forEach((r: any) => {
        const i = toIndex(Number(r.dow ?? 0));
        const fa = this.getJornadas(i);
        (r.jornadas || []).forEach((j: any) => fa.push(this.createJornada(j.ini, j.fin, !!j.overnight)));
        if (fa.length) this.dias.at(i).patchValue({ activo: true });
      });

      if (hb.nuevoIngreso) {
        this.ni.patchValue({
          activo: !!hb.nuevoIngreso.activo,
          duracionDias: Number(hb.nuevoIngreso.duracionDias) || 30,
          aplicarSoloDiasActivosBase: hb.nuevoIngreso.aplicarSoloDiasActivosBase !== false
        });
        this.niJornadas.clear();
        (hb.nuevoIngreso.jornadas || []).forEach((j: any) =>
          this.niJornadas.push(this.createJornada(j.ini, j.fin, !!j.overnight))
        );
        if (this.ni.value.activo && this.niJornadas.length === 0) {
          this.niJornadas.push(this.createJornada('08:00','17:00'));
        }
      }
    } catch {}
  }

  // 🔁 Reemplaza tu buildHorarioPayload por este
  private buildHorarioPayload(): any {
    const desdeISO = DateTime.fromJSDate(this.form.value.desde)
      .toUTC().startOf('day').toISO();

    // Reglas base (Lun..Dom = 0..6 → dow 1..6,0)
    const reglas = this.dias.controls
      .map((g: FormGroup, idx: number) => {
        const activo = g.value.activo;
        const fa = g.get('jornadas') as FormArray<FormGroup>;
        const jornadas = (fa?.controls || []).map(j => ({
          ini: this.toHHMM(j.value.ini),
          fin: this.toHHMM(j.value.fin),
          overnight: !!j.value.overnight
        })).filter(j => j.ini && j.fin);
        return { dow: (idx + 1) % 7, jornadas: activo ? jornadas : [] };
      })
      .filter(r => r.jornadas.length > 0);

    // Bloque nuevo ingreso
    const niVal = this.ni.value;
    let nuevoIngreso: any = undefined;
    if (niVal?.activo) {
      const niJ = (this.niJornadas?.controls || []).map(j => ({
        ini: this.toHHMM(j.value.ini),
        fin: this.toHHMM(j.value.fin),
        overnight: !!j.value.overnight
      })).filter(j => j.ini && j.fin);

      nuevoIngreso = {
        activo: true,
        duracionDias: Number(niVal.duracionDias) > 0 ? Number(niVal.duracionDias) : 30,
        aplicarSoloDiasActivosBase: niVal.aplicarSoloDiasActivosBase !== false,
        jornadas: niJ
      };
    }

    // 👇 anidado en horarioBase (forma más segura)
    return { horarioBase: { desde: desdeISO, reglas, ...(nuevoIngreso ? { nuevoIngreso } : {}) } };
  }

  async guardar() {
    await this.guardarHorarioBase();
  }

  async guardarHorarioBase() {
    if (this.form.invalid || this.esSoloRevisor()) return;
    this.guardando = true;
    try {
      const payload = this.buildHorarioPayload();
      console.log('▶ payload', JSON.stringify(payload, null, 2)); // 👀 debug
      await firstValueFrom(
        this.sedeService.actualizarHorarioBaseDeSede(this.sede.id, payload)
      );
      Swal.fire('✅ Guardado', 'Horario base actualizado', 'success');
    } catch (e) {
      console.error('❌ Error guardando horario base', e);
      Swal.fire('❌ Error', 'No se pudo guardar el horario base', 'error');
    } finally {
      this.guardando = false;
    }
  }

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

  blurActivo() {
    (document.activeElement as HTMLElement)?.blur();
  }

  toggleSidebar() {
    this.blurActivo();
    this.sidebarAbierto = !this.sidebarAbierto;
    document.body.classList.toggle('no-scroll', this.sidebarAbierto);
  }

  onDatepickerOpened() {
  // por si el input recupera foco por algo del navegador
  setTimeout(() => (document.activeElement as HTMLElement)?.blur(), 0);
}

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

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

  // ======================
  // RESUMEN POR TRABAJADOR
  // ======================
  // ========= helpers de normalización ya usados =========
  private _norm(s: any): string {
    if (!s) return '';
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^\w\s]/g,'').trim();
  }

  private _canonEstado(s: any): string {
    const k = this._norm(s);
    if (!k) return 'sin estado';
    if (k.includes('asistenciamanual')) return 'asistencia manual';
    if (k.includes('asistenciacompleta')) return 'asistencia completa';
    if (k.includes('salidaautomatica')) return 'salida automática';
    if (k.includes('pendiente')) return 'pendiente';
    if (k.includes('vacacionespagadas')) return 'vacaciones pagadas';
    if (k.includes('vacaciones')) return 'vacaciones';
    if (k.includes('permisocongoce')) return 'permiso con goce de sueldo';
    if (k === 'permiso' || k.startsWith('permiso')) return 'permiso';
    if (k.includes('incapacidad')) return 'incapacidad';
    if (k.includes('descanso')) return 'descanso';
    if (k.includes('dia festivo') || k.includes('festivo')) return 'festivo';
    if (k.includes('dia puente') || k.includes('puente')) return 'puente';
    if (k.includes('evento')) return 'evento';
    if (k.includes('capacitacion')) return 'capacitación';
    if (k.includes('mediajornada') || k.includes('media jornada')) return 'media jornada';
    if (k.includes('suspension')) return 'suspensión';
    if (k.includes('otrasede') || k.includes('otra sede')) return 'otra sede';
    if (k === 'falta') return 'falta';
    return s;
  }

  private _displayEstado(canon: string): string {
    const map: Record<string,string> = {
      'asistencia completa':'Asistencia Completa','asistencia manual':'Asistencia Manual',
      'salida automática':'Salida Automática','pendiente':'Pendiente','falta':'Falta',
      'vacaciones':'Vacaciones','vacaciones pagadas':'Vacaciones Pagadas','permiso':'Permiso',
      'permiso con goce de sueldo':'Permiso con Goce','incapacidad':'Incapacidad','descanso':'Descanso',
      'festivo':'Festivo','puente':'Puente','evento':'Evento','capacitación':'Capacitación',
      'media jornada':'Media Jornada','suspensión':'Suspensión','otra sede':'Otra Sede','sin estado':'Sin estado'
    };
    const k = this._canonEstado(canon);
    return map[k] || (k ? k[0].toUpperCase()+k.slice(1) : 'Sin estado');
  }

  private _estadoDelDiaParaResumen(datos: any, fechaYmd: string, hoyYmd: string): string {
    if (fechaYmd > hoyYmd) return 'sin estado';
    const tipo = (datos?.tipo || '').toString().trim().toLowerCase();
    const esManual = (tipo === 'asistencia') && datos?.horaEntrada && datos?.horaSalida;
    if (esManual) return 'asistencia manual';
    const entradaVacia = !datos?.entrada || datos.entrada === '—';
    const salidaVacia  = !datos?.salida  || datos.salida  === '—';
    const estadoVacio  = !datos?.estado  || datos.estado  === '—';
    if (estadoVacio && !entradaVacia && !salidaVacia) return 'asistencia completa';
    if (estadoVacio && entradaVacia && salidaVacia)   return 'falta';
    return datos.estado || '';
  }

  /* Construye los nodos del resumen (nombre + bullets) */
  private _buildResumenPdfNodes(trabajadores: any[], fechas: string[]): any[] {
    const hoy = DateTime.now().toFormat('yyyy-MM-dd');
    const nodes: any[] = [];
    trabajadores.forEach(t => {
      const nombre = [t.nombre, t.apellido].filter(Boolean).join(' ') || '—';
      const counts: Record<string, number> = {};
      fechas.forEach(f => {
        const datos = t?.datosPorDia?.[f] || {};
        const est = this._estadoDelDiaParaResumen(datos, f, hoy);
        const k = this._canonEstado(est);
        counts[k] = (counts[k] || 0) + 1;
      });
      const items = Object.entries(counts)
        .filter(([,v]) => v>0)
        .sort((a,b)=>b[1]-a[1])
        .map(([k,v]) => `${this._displayEstado(k)}: ${v} día(s)`);
      nodes.push({ text: nombre, style: 'nombreTrabajador', margin: [0, 6, 0, 2] });
      nodes.push({ ul: items.length ? items : ['Sin estado: 0 día(s)'], margin: [10, 0, 0, 0] });
    });
    return nodes;
  }

/* 💪 Balancea columnas con First-Fit Decreasing (FFD) */
private _columnsForResumen(nodes: any[], pageWidthGuess?: number, preferredCols?: number): any {
  type Entry = { nodes: any[]; weight: number };

  // 1) Re-empaquetar: cada "entrada" = [nombre, lista]
  const entries: Entry[] = [];
  for (let i = 0; i < nodes.length; ) {
    const nameNode = nodes[i];
    const listNode = nodes[i + 1];

    // bullets
    const items = Array.isArray(listNode?.ul) ? listNode.ul.length : 1;

    // penaliza nombres largos (rompen línea y comen altura)
    const nameText = typeof nameNode?.text === 'string' ? nameNode.text : '';
    const extraNameLines = Math.max(0, Math.ceil(nameText.length / 26) - 1);

    // peso ~ líneas aproximadas (nombre + bullets)
    const weight = 2 + items + extraNameLines * 0.8;

    entries.push({ nodes: [nameNode, listNode], weight });
    i += 2;
  }

  if (!entries.length) return { columns: [{ stack: [] }] };

  // 2) ¿Cuántas columnas caben? (según ancho, preferencia y nº de entradas)
  const W =
    pageWidthGuess ||
    792; // LETTER landscape ≈ 792pt; LEGAL ≈ 936pt; custom -> ya lo pasas tú arriba

  // ancho mínimo por columna (texto cómodo)
  const minColWidth = 180;
  const maxByWidth = Math.max(2, Math.min(8, Math.floor((W - 80) / minColWidth)));
  let colsCount = Math.min(
    preferredCols || maxByWidth,
    Math.max(2, entries.length) // no más columnas que entradas
  );

  // 3) First-Fit Decreasing: ordenar por peso DESC y asignar al bucket más liviano
  entries.sort((a, b) => b.weight - a.weight);

  let placed = false;
  for (; colsCount >= 2; colsCount--) {
    const bins: { stack: any[]; sum: number }[] = Array.from({ length: colsCount }, () => ({ stack: [], sum: 0 }));
    for (const e of entries) {
      // elige la columna con MENOR peso acumulado
      let bestIdx = 0;
      for (let k = 1; k < bins.length; k++) {
        if (bins[k].sum < bins[bestIdx].sum) bestIdx = k;
      }
      bins[bestIdx].stack.push(...e.nodes);
      bins[bestIdx].sum += e.weight;
    }

    // 4) Si la diferencia entre la columna más alta y la más baja es razonable, aceptamos
    const sums = bins.map(b => b.sum).sort((a, b) => a - b);
    const spread = sums[sums.length - 1] - sums[0];

    // tolerancia (cuanto más contenido, un poco más de spread aceptable)
    const total = sums.reduce((s, x) => s + x, 0);
    const tol = Math.max(3, total * 0.08);

    if (spread <= tol) {
      placed = true;
      return {
        columns: bins.map(b => ({ stack: b.stack })),
        columnGap: 18
      };
    }

    // si no aprobó, probamos con UNA columna más (más columnas = menos alto cada stack)
    // (nota: estamos en loop decremental; si no aprobó, el "return" final usa la mejor que logremos)
  }

  // 5) Fallback (2 columnas) si no se logró balance “aceptable”
  const mid = Math.ceil(entries.length / 2);
  const left = entries.slice(0, mid).flatMap(e => e.nodes);
  const right = entries.slice(mid).flatMap(e => e.nodes);
  return {
    columns: [{ stack: left }, { stack: right }],
    columnGap: 18
  };
}

  generarPdfPorSede(): void {
    // Tipo del valor que devuelve el modal
    type RangoReporte = {
      inicio: string;
      fin: string;
      modo: 'una' | 'dividido';
      formato: 'carta' | 'oficio';
    };

    // Interfaces locales para tipado fuerte
    interface PdfTableNode {
      table: {
        headerRows: number;
        widths: any[];
        body: any[][];
        dontBreakRows: boolean;
      };
      layout: PdfTableLayout; // usa tu interfaz ya declarada arriba en el archivo
      margin: number[];
      pageBreak?: 'before' | 'after' | 'both';
    }

    interface PdfDocDefinition {
      pageOrientation: string;
      content: any[];
      styles: any;
      defaultStyle: any;
      footer?: (currentPage: number, pageCount: number) => any;
      pageSize?: any;
    }

    // 👇 Genérico permite null, y preConfirm siempre regresa RangoReporte | null
    Swal.fire<RangoReporte | null>({
      title: '📅 Selecciona el rango de fechas',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="fecha-inicio" style="width: 60px; font-weight: bold; text-align: right;">Inicio:</label>
            <input type="date" id="fecha-inicio" class="swal2-input" style="width: 180px; margin: 0;" />
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="fecha-fin" style="width: 60px; font-weight: bold; text-align: right;">Fin:</label>
            <input type="date" id="fecha-fin" class="swal2-input" style="width: 180px; margin: 0;" />
          </div>
          <div style="margin-top: 15px; text-align: left;">
            <label style="font-weight: bold;">Modo de reporte:</label><br/>
            <input type="radio" name="modo" id="modo-uno" checked
                  onclick="document.getElementById('formato-carta').disabled = true; document.getElementById('formato-oficio').disabled = true;" />
            <label for="modo-uno">Una sola hoja (ajustar tamaño)</label><br/>
            <input type="radio" name="modo" id="modo-dividido"
                  onclick="document.getElementById('formato-carta').disabled = false; document.getElementById('formato-oficio').disabled = false;" />
            <label for="modo-dividido">Dividir por hojas:</label><br/>
            <div style="margin-left: 20px;">
              <input type="radio" name="formato" id="formato-carta" checked disabled />
              <label for="formato-carta">📄 Carta (6 días)</label><br/>
              <input type="radio" name="formato" id="formato-oficio" disabled />
              <label for="formato-oficio">📄 Oficio (10 días)</label>
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'Generar PDF',
      showCancelButton: true,
      preConfirm: (): RangoReporte | null => {
        const inicio = (document.getElementById('fecha-inicio') as HTMLInputElement).value;
        const fin = (document.getElementById('fecha-fin') as HTMLInputElement).value;
        const modoUno = (document.getElementById('modo-uno') as HTMLInputElement).checked;
        const formatoCarta = (document.getElementById('formato-carta') as HTMLInputElement).checked;

        if (!inicio || !fin) {
          Swal.showValidationMessage('❌ Debes seleccionar ambas fechas');
          return null;
        }
        if (inicio > fin) {
          Swal.showValidationMessage('❌ La fecha de inicio no puede ser mayor que la de fin');
          return null;
        }

        return {
          inicio,
          fin,
          modo: modoUno ? 'una' : 'dividido',
          formato: formatoCarta ? 'carta' : 'oficio'
        };
      }
    }).then(({ isConfirmed, value }) => {
      if (!isConfirmed || !value) return; // value es RangoReporte | null

      const { inicio, fin, modo, formato } = value;

      this.asistenciaService.obtenerUnificadoPorSede(this.sede.id, inicio, fin).subscribe({
        next: async (res: any) => {
          const trabajadores = (res?.trabajadores || []) as any[];
          if (!trabajadores.length) {
            Swal.fire('⚠️ Sin datos', 'No se encontraron asistencias en ese rango.', 'info');
            return;
          }

          // ✅ Fechas del rango completo, no solo las que vienen en el payload
          const fechas = this.rangoFechasYmd(inicio, fin);

          // ✅ Marca “Otra Sede” usando el unificado por trabajador
          await this.marcarOtrasSedesEnMatriz(trabajadores, fechas, inicio, fin);

          // ✅ Completa faltantes: si sigue vacío (y no es futuro) = Falta
          const hoy = DateTime.now().toFormat('yyyy-MM-dd');
          fechas.forEach((f) => {
            trabajadores.forEach((t) => {
              const c = t.datosPorDia?.[f];
              const vacio = !c || (!c.entrada && !c.salida && !c.estado);
              if (vacio && f <= hoy) {
                if (!t.datosPorDia) t.datosPorDia = {};
                t.datosPorDia[f] = { estado: 'Falta' };
              }
            });
          });

          const chunkSize = formato === 'carta' ? 6 : 10;

          const obtenerColorPorEstado = (estado: string = '', entrada: string = '', salida: string = ''): string => {
            const coloresPorEstado: { [key: string]: string } = {
              'Asistencia Completa': '#d9f99d',
              'Asistencia Manual':   '#bbf7d0',
              'Salida Automática':   '#99f6e4',
              'Pendiente':           '#fef9c3',
              'Falta':               '#fecaca',
              'Vacaciones':          '#bae6fd',
              'Vacaciones Pagadas':  '#ddd6fe',
              'Permiso':             '#fde68a',
              'Permiso con Goce':    '#fef3c7',
              'Incapacidad':         '#fbcfe8',
              'Descanso':            '#e2e8f0',
              'Festivo':             '#fae8ff',
              'Puente':              '#f5f5f4',
              'Evento':              '#ccfbf1',
              'Capacitación':        '#ecfccb',
              'Media Jornada':       '#fef08a',
              'Suspensión':          '#fca5a5',
              // 👇 NUEVO
              'Otra Sede':           '#c7d2fe'
            };

            if (estado && estado !== '—') {
              const estN = estado
                .replace(/[^\w\sáéíóúÁÉÍÓÚ]/g, '')
                .trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              for (const [k, color] of Object.entries(coloresPorEstado)) {
                const kN = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (estN.includes(kN)) return color;
              }
            }
            if (entrada && entrada !== '—' && salida && salida !== '—') {
              return coloresPorEstado['Asistencia Completa'];
            }
            return '';
          };

          // …(el resto de tu función sigue igual usando "fechas", "trabajadores" y createTabla)…


          const crearTabla = (subFechas: string[], trabajadores: any[]): PdfTableNode => {
            const body: any[][] = [];

            // Header 1
            const header1 = ['Nombre del trabajador', ...subFechas.flatMap(f => [f, ''])];
            body.push(header1.map(text => ({
              text,
              style: 'tableHeader',
              fillColor: '#343a40',
              color: '#ffffff'
            })));

            // Header 2
            const header2 = [''].concat(subFechas.flatMap(() => ['Entrada', 'Salida']));
            body.push(header2.map(text => ({
              text,
              style: 'tableHeader',
              fillColor: '#495057',
              color: '#ffffff'
            })));

            const hoy = DateTime.now().toFormat('yyyy-MM-dd');
            const formatearHora = (h: string) => (!h ? '' : h.includes(':') ? h : `${h.slice(0,2)}:${h.slice(2)}`);

            trabajadores.forEach((t: any) => {
              const nombre = [t.nombre, t.apellido].filter(Boolean).join(' ');
              const fila: any[] = [{ text: nombre, style: 'nombreTrabajador', fillColor: '' }];

              const tz = (iso: string) => {
                try { return DateTime.fromISO(iso, { zone: 'utc' }).setZone('America/Mexico_City').toFormat('HH:mm'); }
                catch { return '—'; }
              };

              subFechas.forEach((fecha: string) => {
                const datos = t.datosPorDia[fecha] || {};
                let entrada = datos?.entrada || '—';
                let salida = datos?.salida || '—';
                if (entrada && entrada !== '—' && entrada.includes('T')) entrada = tz(entrada);
                if (salida && salida !== '—' && salida.includes('T')) salida = tz(salida);

                let estado = datos?.estado || '';
                const entradaVacia = !entrada || entrada === '—';
                const salidaVacia = !salida || salida === '—';
                const estadoVacio = !estado || estado === '—';
                const esManual = (datos?.tipo?.trim()?.toLowerCase() === 'asistencia') && datos?.horaEntrada && datos?.horaSalida;

                if (fecha > hoy) {
                  entrada = ''; salida = ''; estado = '';
                } else if (esManual) {
                  estado = 'Asistencia Manual';
                  entrada = formatearHora(datos.horaEntrada);
                  salida = formatearHora(datos.horaSalida);
                } else {
                  const sinDatos = entradaVacia && salidaVacia && estadoVacio;
                  if (sinDatos) estado = 'Falta';
                  else if (!estado && datos?.entrada && datos?.salida) estado = 'Asistencia Completa';
                }

                const color = obtenerColorPorEstado(estado, entrada, salida);
                fila.push({ text: entrada, style: 'celdaTexto', fillColor: color || undefined, estadoReal: estado });
                fila.push({ text: salida,  style: 'celdaTexto', fillColor: color || undefined, estadoReal: estado });
              });

              body.push(fila);
            });

            return {
              table: {
                headerRows: 2,
                widths: ['auto', ...Array(subFechas.length * 2).fill('auto')],
                body,
                dontBreakRows: true
              },
              layout: {
                fillColor: (rowIndex: number, node: any, columnIndex: number): string | null => {
                  if (rowIndex < 2 || columnIndex === 0) return null;
                  const celda = node.table.body[rowIndex][columnIndex];
                  const estado = celda?.estadoReal || celda?.text || '';
                  if (celda?.fillColor) return null;
                  if (estado.trim() === '—' || estado.trim() === '') return null;
                  return obtenerColorPorEstado(estado);
                },
                hLineWidth: (i: number) => (i === 0 || i === 1 || i === body.length) ? 1 : 0,
                vLineWidth: () => 0,
                hLineColor: () => '#999999',
                paddingTop: () => 4,
                paddingBottom: () => 4,
                paddingLeft: () => 4,
                paddingRight: () => 4
              },
              margin: [0, 0, 0, 10]
            };
          };

          const docDefinition: PdfDocDefinition = {
            pageOrientation: 'landscape',
            content: [
              { text: `Reporte de Asistencias por Sede`, style: 'header', margin: [0, 0, 0, 5] },
              { text: `📍 ${this.sede.nombre} (ID: ${this.sede.id})`, style: 'subheader', margin: [0, 0, 0, 2] },
              { text: `📅 Periodo: ${inicio} al ${fin}\n\n`, style: 'subheader', margin: [0, 0, 0, 10] }
            ],
            styles: {
              header: { fontSize: 18, bold: true, alignment: 'center', color: '#343a40' },
              subheader: { fontSize: 12, alignment: 'center', color: '#6c757d' },
              tableHeader: { bold: true, fontSize: 10, color: 'white', alignment: 'center' },
              nombreTrabajador: { bold: true, fontSize: 10, color: '#212529' },
              celdaTexto: { fontSize: 9, alignment: 'center', color: '#212529' }
            },
            defaultStyle: { font: 'Roboto', lineHeight: 1.2 },
            footer: (currentPage: number, pageCount: number) => ({
              text: `Página ${currentPage} de ${pageCount}`,
              alignment: 'center',
              fontSize: 9,
              margin: [0, 10, 0, 0],
              color: '#6c757d'
            })
          };

          if (modo === 'una') {
            const tabla = crearTabla(fechas, trabajadores);
            docDefinition.content.push(tabla);
            const anchoCalculado = Math.max(595, 100 + (fechas.length * 2 * 50));
            docDefinition.pageSize = { width: anchoCalculado, height: 842 };
          } else {
            for (let i = 0; i < fechas.length; i += chunkSize) {
              const subFechas = fechas.slice(i, i + chunkSize);
              const tabla = crearTabla(subFechas, trabajadores);
              const tablaConSalto: PdfTableNode = { ...tabla, ...(i > 0 && { pageBreak: 'before' }) };
              docDefinition.content.push(tablaConSalto);
            }
            docDefinition.pageSize = formato === 'carta' ? 'LETTER' : 'LEGAL';
          }

        docDefinition.content.push({
          text: 'Resumen por trabajador',
          style: 'header',
          margin: [0, 10, 0, 8],
          pageBreak: 'before' // dejamos el resumen en su propia hoja
        });

        // calcula un “ancho” estimado de página para decidir cuántas columnas
        const pageWidthGuess =
          (docDefinition.pageSize && typeof docDefinition.pageSize === 'object')
            ? (docDefinition.pageSize as any).width
            : (docDefinition.pageSize === 'LEGAL' ? 936
              : docDefinition.pageSize === 'LETTER' ? 792
              : 792);

        const resumenNodes = this._buildResumenPdfNodes(trabajadores, fechas);

        // 🔥 columnas (2–6) para que quepa en una sola página
        const resumenColumns = this._columnsForResumen(resumenNodes, pageWidthGuess);
        docDefinition.content.push(resumenColumns);

          pdfMake.createPdf(docDefinition).open();
        },
        error: (err: any) => {
          console.error('❌ Error al generar PDF de sede:', err);
          Swal.fire('Error', 'No se pudo generar el reporte de PDF por sede.', 'error');
        }
      });
    });
  }

  generarPdfPorSedeProcesado(): void {
    const fechas = this.fechasRango;
    const trabajadores = this.trabajadoresProcesados;

    // 💡 Asegurarse de que todos los días del rango estén presentes para todos los trabajadores
    fechas.forEach((fecha) => {
      trabajadores.forEach((trabajador) => {
        if (!trabajador.datosPorDia[fecha]) {
          trabajador.datosPorDia[fecha] = {}; // Día vacío = posible falta
        }
      });
    });

    const obtenerColorPorEstado = (estado: string = ''): string => {
      const coloresPorEstado: { [key: string]: string } = {
        'Asistencia Completa': '#C8E6C9', // Verde pastel
        'Asistencia Manual': '#A5D6A7',   // Verde más suave
        'Salida Automática': '#B2EBF2',   // Azul muy claro
        'Pendiente': '#FFF9C4',           // Amarillo claro
        'Falta': '#FFCDD2',               // Rojo suave
        'Vacaciones': '#B3E5FC',          // Azul cielo
        'Vacaciones Pagadas': '#D1C4E9',  // Lila clarito
        'Permiso': '#FFE0B2',             // Naranja claro
        'Permiso con Goce': '#FFECB3',    // Amarillo más pastel
        'Incapacidad': '#F8BBD0',         // Rosa bebé
        'Descanso': '#CFD8DC',            // Gris azulado claro
        'Festivo': '#FCE4EC',             // Rosado muy claro
        'Puente': '#D7CCC8',              // Gris café claro
        'Evento': '#E0F2F1',              // Verde agua pastel
        'Capacitación': '#F1F8E9',        // Verde limón muy tenue
        'Media Jornada': '#FFF9C4',       // Amarillo suave
        'Suspensión': '#FFCDD2'           // Rojo pastel
      };

      const estadoNormalizado = estado
        .replace(/[^\w\sáéíóúÁÉÍÓÚ]/g, '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const [key, color] of Object.entries(coloresPorEstado)) {
        const keyNormalizado = key
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (estadoNormalizado.includes(keyNormalizado)) {
          return color;
        }
      }

      return '';
    };

    // Construcción del cuerpo de la tabla
    const header1 = ['Nombre del trabajador', ...fechas];
    const header2 = ['Estado'].concat(fechas.map(() => ''));
    const body: any[][] = [header1, header2];

    // Recorremos cada trabajador para construir las filas
    trabajadores.forEach((trabajador: any) => {
      const fila: any[] = [{
        text: [trabajador.nombre, trabajador.apellido].filter(Boolean).join(' '),
        style: 'nombreTrabajador'
      }];

      // Añadimos el estado para cada fecha
      fechas.forEach((fecha: string) => {
        const dia = trabajador.datosPorDia[fecha];
        let estado = dia?.estado || '❌ Falta';

        // Detectar "falta" real si no hay entrada, salida ni evento
        const noHayNada = !dia?.entrada && !dia?.salida && !dia?.estado;
        if (noHayNada) estado = 'Falta';

        // Si no hay estado pero hay horas, considerar "Asistencia Completa"
        if ((!dia?.estado || dia.estado === '') && dia?.entrada && dia?.salida) {
          estado = 'Asistencia Completa';
        }

        const color = obtenerColorPorEstado(estado);
        fila.push({
          text: estado,
          fillColor: color || undefined,
          style: 'celdaTexto'
        });
      });

      body.push(fila);
    });

    const tabla = {
      table: {
        headerRows: 2,
        widths: ['auto', ...Array(fechas.length).fill('auto')],
        body,
        dontBreakRows: true
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1 || i === body.length) ? 1 : 0,
        vLineWidth: () => 0,
        hLineColor: () => '#999999',
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 4,
        paddingRight: () => 4
      },
      margin: [0, 0, 0, 10]
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: [
        {
          text: '📋 Reporte de Estados por Sede',
          style: 'header',
          margin: [0, 0, 0, 5]
        },
        {
          text: `📍 ${this.sede.nombre} (ID: ${this.sede.id})`,
          style: 'subheader',
          margin: [0, 0, 0, 2]
        },
        {
          text: `📅 Periodo: ${this.fechasRango[0]} al ${this.fechasRango[this.fechasRango.length - 1]}\n\n`,
          style: 'subheader',
          margin: [0, 0, 0, 10]
        },
        tabla
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          color: '#343a40'
        },
        subheader: {
          fontSize: 12,
          alignment: 'center',
          color: '#6c757d'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          alignment: 'center'
        },
        nombreTrabajador: {
          bold: true,
          fontSize: 10,
          color: '#212529'
        },
        celdaTexto: {
          fontSize: 9,
          alignment: 'center',
          color: '#212529'
        }
      },
      defaultStyle: {
        font: 'Roboto',
        lineHeight: 1.2
      },
      footer: (currentPage: number, pageCount: number) => {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 9,
          margin: [0, 10, 0, 0],
          color: '#6c757d'
        };
      }
    };

    pdfMake.createPdf(docDefinition).open();
  }

  abrirSelectorDeFechasExcel(): void {
    Swal.fire({
      title: '📅 Selecciona el rango de fechas',
      html: `
        <input type="date" id="fechaInicio" class="swal2-input">
        <input type="date" id="fechaFin" class="swal2-input">
      `,
      confirmButtonText: 'Generar Excel',
      showCancelButton: true,
      focusConfirm: false,
      didOpen: () => {
        const inputInicio = document.getElementById('fechaInicio') as HTMLInputElement;
        const inputFin = document.getElementById('fechaFin') as HTMLInputElement;
        const hoy = new Date().toISOString().split('T')[0];
        if (inputInicio && inputFin) {
          inputInicio.value = hoy;
          inputFin.value = hoy;
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
        if (inicio > fin) {
          Swal.showValidationMessage('⚠️ La fecha de inicio no puede ser mayor a la de fin');
          return;
        }

        return { inicio, fin };
      }
    }).then(async (result) => {
      if (!result.isConfirmed || !result.value) return;

      const { inicio, fin } = result.value;
      this.fechaInicio = new Date(`${inicio}T00:00:00`);
      this.fechaFin   = new Date(`${fin}T00:00:00`);

      // Lista de YYYY-MM-DD del rango
      const fechas: string[] = this.generarDias(this.fechaInicio, this.fechaFin)
        .map(d => DateTime.fromJSDate(d).toFormat('yyyy-MM-dd'));

      try {
        // 1) Base de la SEDE (solo lo que pasó en esta sede)
        const base: any = await lastValueFrom(
          this.asistenciaService.obtenerUnificadoPorSede(this.sede.id, inicio, fin)
        );

        const trabajadoresBase: any[] = (base?.trabajadores || []).map((t: any) => ({
          ...t,
          datosPorDia: t.datosPorDia || {}
        }));

        // 2) Por cada trabajador, traer su unificado (todas las sedes)
        const sedeActualStr = String(this.sede.id);

        const trabajadoresFusionados = await Promise.all(
          trabajadoresBase.map(async (t: any) => {
            const tid = this.getTrabId(t);
            if (!tid) {
              console.warn('⚠️ Trabajador sin _id usable para unificado:', t);
              return t; // seguimos sin cruce
            }

            let unificado: any = null;
            try {
              // 👇 mezcla TODAS las sedes (ignoraSede=true en el service)
              unificado = await lastValueFrom(
                this.asistenciaService.obtenerDatosUnificadosParaCalendario(tid, this.fechaInicio, this.fechaFin)
              );
              console.log('[unificado-cal]', t?.nombre, tid, 'asistencias:', (unificado?.asistencias || []).length);
            } catch (e) {
              console.warn('⚠️ unificado-cal falló para', tid, e);
            }

            // fecha -> Set<string> de sedes con marcas ese día
            const sedesPorFecha = new Map<string, Set<string>>();
            (unificado?.asistencias || []).forEach((a: any) => {
              if (a?.fecha) {
                const ymd = (typeof a.fecha === 'string' ? a.fecha : new Date(a.fecha).toISOString()).split('T')[0];
                if (ymd) {
                  const set = sedesPorFecha.get(ymd) || new Set<string>();
                  const sId = this.sedeIdToString(a);
                  if (sId) set.add(sId);
                  sedesPorFecha.set(ymd, set);
                }
              }
              (a?.detalle || []).forEach((d: any) => {
                if (!d?.fechaHora) return;
                const ymd = (typeof d.fechaHora === 'string' ? d.fechaHora : new Date(d.fechaHora).toISOString()).split('T')[0];
                if (!ymd) return;
                const set = sedesPorFecha.get(ymd) || new Set<string>();
                const sId = this.sedeIdToString(d);
                if (sId) set.add(sId);
                sedesPorFecha.set(ymd, set);
              });
            });

            // Rellena “Otra Sede”
            fechas.forEach(f => {
              const celda = t.datosPorDia[f];
              if (!this.esCeldaVaciaOInerte(celda)) return;

              const setSedes = sedesPorFecha.get(f) || new Set<string>();
              const hayEsta  = setSedes.has(sedeActualStr);
              const hayOtra  = [...setSedes].some(s => s !== sedeActualStr);

              if (!hayEsta && hayOtra) {
                if (!t.datosPorDia) t.datosPorDia = {};
                t.datosPorDia[f] = { entrada: '—', salida: '—', estado: 'Otra Sede' };
              }
            });

            return t;
          })
        );
        // 4) Exportar
        const nombreArchivo =
          `Reporte_Asistencias_Sede_${this.sede?.nombre || 'SinNombre'}_${inicio}_a_${fin}.xlsx`;

        this.exportarExcelPorSede(nombreArchivo, trabajadoresFusionados, fechas);

        await Swal.fire('✅ ¡Listo!', 'Se generó el archivo Excel correctamente', 'success');
      } catch (error) {
        console.error('❌ Error al generar Excel:', error);
        await Swal.fire('❌ Error', 'No se pudieron obtener las asistencias.', 'error');
      }
    });
  }

  generarDias(fechaInicio: Date, fechaFin: Date): Date[] {
    const dias: Date[] = [];
    const actual = new Date(fechaInicio);
    while (actual <= fechaFin) {
      dias.push(new Date(actual));
      actual.setDate(actual.getDate() + 1);
    }
    return dias;
  }

  exportarExcelPorSede(nombreArchivo: string, trabajadores: any[], fechas: string[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asistencias por sede');

    const eventosSede = this.eventos.filter(evento => {
      const fechaEvento = new Date(evento.fecha);
      return fechaEvento >= this.fechaInicio && fechaEvento <= this.fechaFin;
    });

    // 🧩 Cabecera (sanitizada)
    worksheet.addRow([ excelSanitize(`Sede: ${this.sede?.nombre || ''}`) ]);
    worksheet.addRow([ excelSanitize(`Periodo: ${this.fechaInicio.toLocaleDateString()} - ${this.fechaFin.toLocaleDateString()}`) ]);
    worksheet.addRow([]);

    // 🧱 Encabezados (sanitizados)
    const encabezados: string[] = ['Nombre Completo'];
    fechas.forEach(f => {
      encabezados.push(`${f} Entrada`, `${f} Salida`);
    });
    const headerRow = worksheet.addRow(encabezados.map(excelSanitize));

    worksheet.columns = [
      { width: 35 },
      ...fechas.flatMap(() => [{ width: 17 }, { width: 17 }])
    ];

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343A40' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.bordeCelda;
    });

    const normalizarEstado = (estado: string): { clave: string; texto: string } => {
      if (!estado || estado === '—') return { clave: 'falta', texto: 'Falta' };
      const textoMostrar = estado
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/([a-z])([A-Z])/g, '$1 $2');

      const clave = estado
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const mapaVariantes: { [key: string]: string } = {
        'capacitacion': 'capacitación',
        'dia festivo': 'festivo',
        'dia puente': 'puente',
        'descanso laboral': 'descanso',
        'permiso con goce': 'permiso con goce de sueldo',
        'media jornada': 'media jornada',
        'suspension': 'suspensión'
      };

      return { clave: mapaVariantes[clave] || clave, texto: textoMostrar };
    };

    const hoy = DateTime.now().toFormat('yyyy-MM-dd');

    trabajadores.forEach(t => {
      const row = worksheet.addRow([ excelSanitize(`${t.nombre || ''} ${t.apellido || ''}`.trim() || '—') ]);
      let colIndex = 2;

      fechas.forEach(f => {
        const esFuturo = f > hoy;
        const datos = t.datosPorDia?.[f] || {};
        const tipo = (datos?.tipo || '').toLowerCase();
        let entrada = datos?.entrada || '—';
        let salida = datos?.salida || '—';
        let estado = datos?.estado || '';

        const eventoDia = eventosSede.find(e => this.toYmdSafe(e.fecha) === f);

        // 🕒 Día futuro: celda en blanco sin color
        if (esFuturo) {
          const c1 = row.getCell(colIndex++); c1.value = ''; c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          c1.border = this.bordeCelda; c1.alignment = { horizontal: 'center', vertical: 'middle' };
          const c2 = row.getCell(colIndex++); c2.value = ''; c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          c2.border = this.bordeCelda; c2.alignment = { horizontal: 'center', vertical: 'middle' };
          return;
        }

        // 🧠 Jerarquía de estado
        if (eventoDia) {
          estado = eventoDia.tipo || eventoDia.descripcion || '';
          entrada = salida = '—';
        } else if (tipo === 'asistencia' && datos?.horaEntrada && datos?.horaSalida) {
          estado = 'Asistencia Manual';
          entrada = datos.horaEntrada;
          salida = datos.horaSalida;
        } else if (!estado && entrada !== '—' && salida !== '—') {
          estado = 'Asistencia Completa';
        } else if (!estado || estado === '—') {
          estado = 'Falta';
        }

        const { clave: claveColor, texto: textoEstado } = normalizarEstado(estado);
        const color = this.coloresEstados[claveColor] || this.coloresEstados['—'];

        const entradaTexto = excelSanitize(entrada === '—' && salida === '—' && estado ? textoEstado : entrada);
        const salidaTexto  = excelSanitize(entrada === '—' && salida === '—' && estado ? '' : salida);

        const celdaEntrada = row.getCell(colIndex++);
        celdaEntrada.value = entradaTexto;
        celdaEntrada.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        celdaEntrada.border = this.bordeCelda;
        celdaEntrada.alignment = { horizontal: 'center', vertical: 'middle' };

        const celdaSalida = row.getCell(colIndex++);
        celdaSalida.value  = salidaTexto;
        celdaSalida.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        celdaSalida.border = this.bordeCelda;
        celdaSalida.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });

    // 💾 Guardar con MIME correcto
    workbook.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], { type: EXCEL_MIME });
      FileSaver.saveAs(blob, nombreArchivo);
    });
  }

  // 👉 Genera fechas YYYY-MM-DD (inclusive) sin usar toISOString()
  private rangoFechasYmd(inicio: string, fin: string): string[] {
    const out: string[] = [];
    const d0 = new Date(inicio + 'T00:00:00');
    const d1 = new Date(fin    + 'T00:00:00');
    const pad = (n: number) => String(n).padStart(2, '0');

    const cur = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
    const end = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    while (cur <= end) {
      out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  // 👉 Marca "Otra Sede" SOLO si hubo ENTRADA en otra sede ese día.
  //    Toma además la primera Entrada y la última Salida de ese mismo día (en CDMX).
  private async marcarOtrasSedesEnMatriz(
    trabajadores: any[],
    fechas: string[],
    inicio: string,
    fin: string
  ): Promise<void> {
    const ini = new Date(`${inicio}T00:00:00`);
    const finD = new Date(`${fin}T00:00:00`);
    const sedeActualStr = String(this.sede.id);

    await Promise.all(
      (trabajadores || []).map(async (t: any) => {
        const tid = this.getTrabId(t);
        if (!tid) return;

        try {
          const full = await lastValueFrom(
            this.asistenciaService.obtenerDatosUnificadosParaCalendario(tid, ini, finD)
          );

          // fecha -> { entradaISO?, salidaISO? } (solo de otras sedes)
          const otrasPorDia = new Map<string, { entradaISO?: string; salidaISO?: string }>();

          (full?.asistencias || []).forEach((a: any) => {
            (a?.detalle || []).forEach((d: any) => {
              if (!d?.fechaHora) return;
              const ymd = this.ymdMX(d.fechaHora);
              if (!ymd) return;

              const sedeReg = (d?.sede ?? a?.sede ?? null);
              if (sedeReg == null) return;
              if (String(sedeReg) === sedeActualStr) return;  // solo “otras” sedes

              const cur = otrasPorDia.get(ymd) || {};
              const tipo = String(d?.tipo || '');

              if (tipo === 'Entrada') {
                if (!cur.entradaISO || new Date(d.fechaHora) < new Date(cur.entradaISO)) {
                  cur.entradaISO = d.fechaHora;
                }
              }
              if (tipo.startsWith('Salida')) {
                if (!cur.salidaISO || new Date(d.fechaHora) > new Date(cur.salidaISO)) {
                  cur.salidaISO = d.fechaHora;
                }
              }
              otrasPorDia.set(ymd, cur);
            });
          });

          // Solo si la celda está vacía/inerta y hubo ENTRADA en otra sede ese día
          fechas.forEach((f) => {
            const celda = t.datosPorDia?.[f];
            if (!this.esCeldaVaciaOInerte(celda)) return;

            const otras = otrasPorDia.get(f);
            if (otras?.entradaISO) {
              if (!t.datosPorDia) t.datosPorDia = {};
              t.datosPorDia[f] = {
                estado: 'Otra Sede',
                entrada: otras.entradaISO, // el PDF ya lo formatea a HH:mm CDMX
                salida:  otras.salidaISO ?? '—'
              };
            }
          });
        } catch (e) {
          console.warn('⚠️ cruzar otras sedes falló para', tid, e);
        }
      })
    );
  }

    // Convierte cualquier "id" (ObjectId, objeto, etc.) a string utilizable en la URL /unificado/:id
  private getTrabId(t: any): string | null {
    if (!t) return null;
    const cand = [t.id, t._id, t.trabajadorId, t?.id?.$oid, t?._id?.$oid];
    for (const c of cand) {
      if (!c) continue;
      try {
        if (typeof c === 'string') return c;
        if (typeof c?.toString === 'function') {
          const s = c.toString();
          if (s && s !== '[object Object]') return s;
        }
      } catch {}
    }
    return null;
  }

  // Colores actualizados con todas las variantes
  coloresEstados: { [estado: string]: string } = {
    'asistencia completa': 'FFD9F99D',
    'asistencia manual': 'FFBBF7D0',
    'salida automática': 'FF99F6E4',
    'pendiente': 'FFFEF9C3',
    'falta': 'FFFECACA',
    'vacaciones': 'FFBAE6FD',
    'vacaciones pagadas': 'FFDDD6FE',
    'permiso': 'FFFDE68A',
    'permiso con goce de sueldo': 'FFFEF3C7',
    'incapacidad': 'FFFBCFE8',
    'descanso': 'FFE2E8F0',
    'festivo': 'FFFAE8FF',
    'puente': 'FFF5F5F4',
    'evento': 'FFCCFBF1',
    'capacitación': 'FFECFCCB',
    'media jornada': 'FFFEF08A',
    'suspensión': 'FFFCA5A5',
    '—': 'FFFFFFFF',
    // Variantes comunes
    'capacitacion': 'FFECFCCB', // Sin tilde
    'dia festivo': 'FFFAE8FF',
    'dia puente': 'FFF5F5F4',
    'evento especial': 'FFCCFBF1',
    'descanso laboral': 'FFE2E8F0',
    'otra sede': 'FFC7D2FE', // 💠 (ARGB)
  };
}
