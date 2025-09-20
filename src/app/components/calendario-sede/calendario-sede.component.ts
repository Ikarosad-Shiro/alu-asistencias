import {
  Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter
} from '@angular/core';
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isToday
} from 'date-fns';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-calendario-sede',
  templateUrl: './calendario-sede.component.html',
  styleUrls: ['./calendario-sede.component.css']
})
export class CalendarioSedeComponent implements OnInit, OnChanges {
  @Input() sede!: number;
  @Input() sedeNombre: string = '';
  @Input() anio!: number;

  private _eventos: any[] = [];

  @Input()
  set eventos(value: any[]) {
    // Normaliza a YMD string por robustez
    this._eventos = (value || []).map(e => ({
      ...e,
      // e.fecha puede venir como Date/ISO/BSON — lo dejamos en 'YYYY-MM-DD'
      fecha: e?.fecha
        ? new Date(e.fecha).toISOString().slice(0, 10)
        : null
    }));
    this.reconstruirIndiceEventos();
    this.generarDiasMes();
  }
  get eventos(): any[] { return this._eventos; }

  @Input() todasLasSedes: { id: number, nombre: string, seleccionada?: boolean }[] = [];
  @Input() asistenteDomingoActivo: boolean = false;

  @Output() eventoGuardado = new EventEmitter<any>();
  @Output() eventoEliminado = new EventEmitter<any>();

  mesActual = new Date();
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  diasMes: Array<{ fecha: Date | null; seleccionado: boolean; evento: any | null }> = [];

  mostrarModal = false;
  fechaSeleccionada!: Date;    // Date local SOLO para UI
  ymdSeleccionado: string = ''; // YMD para emitir al backend

  nuevoEvento = {
    tipo: '',
    descripcion: '',
    horaInicio: '',
    horaFin: ''
  };

  aplicarAMasSedes: boolean = false;
  usuarioRol: string = '';
  modoEdicion: boolean = false;
  eventoExistente: any = null;

  // Set para lookup O(1) por YMD
  private eventosYmd = new Set<string>();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.definirMesInicial();
    this.obtenerRol();
    this.generarDiasMes();

    if (this.todasLasSedes) {
      this.todasLasSedes = this.todasLasSedes.map(s => ({
        ...s,
        seleccionada: s.seleccionada ?? false
      }));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anio'] || changes['sede']) {
      this.definirMesInicial();
      this.generarDiasMes();
    }
  }

  private ymdFromDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private reconstruirIndiceEventos(): void {
    this.eventosYmd = new Set(
      (this._eventos || [])
        .map(e => (e?.fecha ?? '').slice(0, 10))
        .filter(Boolean)
    );
  }

  esDomingo(fecha: Date | null | undefined): boolean {
    return !!fecha && fecha.getDay() === 0;
  }

  definirMesInicial(): void {
    const hoy = new Date();
    if (this.anio === hoy.getFullYear()) {
      this.mesActual = hoy;
    } else {
      this.mesActual = new Date(this.anio, 0, 1);
    }
  }

  obtenerRol(): void {
    const usuario = this.authService.obtenerDatosDesdeToken();
    this.usuarioRol = usuario?.rol || '';
  }

  get puedeEditar(): boolean {
    return this.usuarioRol === 'Dios' || this.usuarioRol === 'Administrador';
  }

  generarDiasMes(): void {
    const inicioMes = startOfMonth(this.mesActual);
    const finMes = endOfMonth(this.mesActual);
    const dias = eachDayOfInterval({ start: inicioMes, end: finMes });

    const primerDia = inicioMes.getDay();
    const diasVaciosAntes = Array(primerDia).fill({ fecha: null, seleccionado: false, evento: null });

    const ultimoDia = finMes.getDay();
    const diasVaciosDespues = Array(6 - ultimoDia).fill({ fecha: null, seleccionado: false, evento: null });

    this.diasMes = [
      ...diasVaciosAntes,
      ...dias.map(dia => {
        const ymd = this.ymdFromDateLocal(dia); // ← YMD LOCAL
        const evento = this._eventos.find(e => e?.fecha === ymd) || null;
        return { fecha: dia, seleccionado: false, evento };
      }),
      ...diasVaciosDespues
    ];
  }

  seleccionarDia(dia: any): void {
    if (!dia.fecha) return;

    this.fechaSeleccionada = dia.fecha;           // Date local para la UI
    this.ymdSeleccionado   = this.ymdFromDateLocal(dia.fecha); // YMD para backend

    if (!this.puedeEditar) {
      Swal.fire({
        icon: 'info',
        title: 'Solo lectura',
        text: 'Solo los usuarios con rol Dios o Administrador pueden modificar el calendario.'
      });
      return;
    }

    const eventoExistente = this._eventos.find(e => e?.fecha === this.ymdSeleccionado);

    if (eventoExistente) {
      this.modoEdicion = true;
      this.eventoExistente = eventoExistente;
      this.nuevoEvento = {
        tipo: eventoExistente.tipo,
        descripcion: eventoExistente.descripcion,
        horaInicio: eventoExistente.horaInicio || '',
        horaFin: eventoExistente.horaFin || ''
      };
    } else {
      this.modoEdicion = false;
      this.eventoExistente = null;
      this.nuevoEvento = { tipo: '', descripcion: '', horaInicio: '', horaFin: '' };

      // sugerencia de domingo (si activaste el asistente)
      if (this.asistenteDomingoActivo && this.esDomingo(dia.fecha)) {
        this.nuevoEvento = {
          tipo: 'descanso',
          descripcion: 'Sugerido por Asistente de Domingo',
          horaInicio: '',
          horaFin: ''
        };
      }
    }

    if (this.todasLasSedes) {
      this.todasLasSedes = this.todasLasSedes.map(s => ({ ...s, seleccionada: s.seleccionada ?? false }));
    }

    this.mostrarModal = true;
  }

  private to24h(s: string): string {
    if (!s) return '';
    const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return s; // ya viene "HH:mm"
    let h = +m[1], min = m[2], ap = (m[3]||'').toUpperCase();
    if (ap === 'AM' && h === 12) h = 0;
    if (ap === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2,'0')}:${min}`;
  }
  private minutes(v: string): number {
    const m = v.match(/^(\d{1,2}):(\d{2})$/); if(!m) return NaN;
    return (+m[1])*60 + (+m[2]);
  }

  esHoy(fecha: Date | null | undefined): boolean {
    return !!fecha && isToday(fecha);
  }

  mesAnterior(): void {
    this.mesActual = subMonths(this.mesActual, 1);
    this.generarDiasMes();
  }

  mesSiguiente(): void {
    this.mesActual = addMonths(this.mesActual, 1);
    this.generarDiasMes();
  }

  onToggleAplicarSedes(): void {
    if (!this.aplicarAMasSedes && this.todasLasSedes) {
      this.todasLasSedes.forEach(s => s.seleccionada = false);
    }
  }

  guardarEvento(): void {
    const isMJ = this.nuevoEvento.tipo === 'media jornada';
    let ini = '', fin = '';

    if (isMJ) {
      ini = this.to24h(this.nuevoEvento.horaInicio);
      fin = this.to24h(this.nuevoEvento.horaFin);
      if (!ini || !fin) { Swal.fire('Falta horario','Indica inicio y fin','warning'); return; }
      if (this.minutes(fin) <= this.minutes(ini)) { Swal.fire('Horario inválido','Fin > inicio','warning'); return; }
    }

    // Importante: emitimos fecha como YMD (string) para evitar desfases
    const eventoBase = {
      fecha: this.ymdSeleccionado,
      tipo: this.nuevoEvento.tipo,
      descripcion: this.nuevoEvento.descripcion,
      ...(isMJ ? { horaInicio: ini, horaFin: fin } : {})
    };

    // aplicar a sedes extra
    if (this.aplicarAMasSedes && this.todasLasSedes) {
      const sedesSeleccionadas = this.todasLasSedes.filter(s => s.seleccionada);
      sedesSeleccionadas.forEach(sedeExtra => {
        this.eventoGuardado.emit({ ...eventoBase, sede: sedeExtra.id, editar: false });
      });
    }

    // emitir para la sede actual
    this.eventoGuardado.emit({
      ...eventoBase,
      sede: this.sede,
      editar: this.modoEdicion
    });

    this.cerrarModal();
    this.generarDiasMes();
  }

  eliminarEvento(): void {
    Swal.fire({
      title: '¿Eliminar configuración de este día?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      input: 'password',
      inputLabel: 'Confirma tu contraseña',
      inputPlaceholder: 'Ingresa tu contraseña',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      preConfirm: (password) => {
        if (!password) {
          Swal.showValidationMessage('Debes ingresar tu contraseña');
        }
        return password;
      }
    }).then(result => {
      if (result.isConfirmed) {
        // Emitimos YMD (string) — NO Date
        const evento = {
          sede: this.sede,
          año: this.anio,
          fecha: this.ymdSeleccionado,
          contraseña: result.value
        };
        this.eventoEliminado.emit(evento);
        this.cerrarModal();
      }
    });
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.aplicarAMasSedes = false;
    this.modoEdicion = false;
    this.eventoExistente = null;
    this.nuevoEvento = { tipo: '', descripcion: '', horaInicio: '', horaFin: '' };
  }

  trackBySede(index: number, sede: any): number {
    return sede.id;
  }

  getTooltip(d: any): string {
    const e = d?.evento;
    if (!e) return '';
    const desc = e.descripcion ? ` — ${e.descripcion}` : '';
    if ((e.tipo || '') === 'media jornada') {
      const hi = e.horaInicio || '';
      const hf = e.horaFin || '';
      const rango = (hi && hf) ? `: ${hi}–${hf}` : '';
      return `Media Jornada${rango}${desc}`;
    }
    const tipo = (e.tipo || '');
    return `${tipo.charAt(0).toUpperCase()}${tipo.slice(1)}${desc}`;
  }
}
