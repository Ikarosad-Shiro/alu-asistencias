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
        next: (res: any) => {
          const trabajadores = res.trabajadores as any[];
          if (!trabajadores?.length) {
            Swal.fire('⚠️ Sin datos', 'No se encontraron asistencias en ese rango.', 'info');
            return;
          }

          const fechas = Object.keys(trabajadores[0].datosPorDia);

          // Marcar explícitamente los días vacíos como Faltas
          fechas.forEach((fecha) => {
            trabajadores.forEach((trabajador) => {
              if (!trabajador.datosPorDia[fecha]) {
                trabajador.datosPorDia[fecha] = { estado: 'Falta' };
              }
            });
          });

          const chunkSize = formato === 'carta' ? 6 : 10;

          const obtenerColorPorEstado = (estado: string = '', entrada: string = '', salida: string = ''): string => {
            const coloresPorEstado: { [key: string]: string } = {
              'Asistencia Completa': '#d9f99d',
              'Asistencia Manual': '#bbf7d0',
              'Salida Automática': '#99f6e4',
              'Pendiente': '#fef9c3',
              'Falta': '#fecaca',
              'Vacaciones': '#bae6fd',
              'Vacaciones Pagadas': '#ddd6fe',
              'Permiso': '#fde68a',
              'Permiso con Goce': '#fef3c7',
              'Incapacidad': '#fbcfe8',
              'Descanso': '#e2e8f0',
              'Festivo': '#fae8ff',
              'Puente': '#f5f5f4',
              'Evento': '#ccfbf1',
              'Capacitación': '#ecfccb',
              'Media Jornada': '#fef08a',
              'Suspensión': '#fca5a5'
            };

            if (estado && estado !== '—') {
              const estN = estado
                .replace(/[^\w\sáéíóúÁÉÍÓÚ]/g, '')
                .trim()
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

        return { inicio, fin };
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        const { inicio, fin } = result.value;
        this.fechaInicio = new Date(`${inicio}T00:00:00`);
        this.fechaFin = new Date(`${fin}T00:00:00`);
        const nombreArchivo = `Reporte_Asistencias_Sede_${this.sede?.nombre || 'SinNombre'}_${inicio}_a_${fin}.xlsx`;

        try {
          const res: any = await lastValueFrom(this.asistenciaService.obtenerUnificadoPorSede(this.sede.id, inicio, fin));
          const trabajadoresUnificados = res.trabajadores || [];

          const fechasFormateadas = this.generarDias(this.fechaInicio, this.fechaFin).map(d =>
            DateTime.fromJSDate(d).toFormat('yyyy-MM-dd')
          );

          this.exportarExcelPorSede(nombreArchivo, trabajadoresUnificados, fechasFormateadas);
          Swal.fire('✅ ¡Listo!', 'Se generó el archivo Excel correctamente', 'success');
        } catch (error) {
          console.error('❌ Error al generar Excel:', error);
          Swal.fire('❌ Error', 'No se pudieron obtener las asistencias.', 'error');
        }
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

      const eventoDia = eventosSede.find(e => DateTime.fromISO(e.fecha).toFormat('yyyy-MM-dd') === f);

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
      celdaEntrada.value = excelSanitize(entradaTexto);
      celdaEntrada.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      celdaEntrada.border = this.bordeCelda;
      celdaEntrada.alignment = { horizontal: 'center', vertical: 'middle' };

      const celdaSalida = row.getCell(colIndex++);
      celdaSalida.value  = excelSanitize(salidaTexto);
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
    'descanso laboral': 'FFE2E8F0'
  };
}
