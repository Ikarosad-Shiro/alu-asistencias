import {
  Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter
} from '@angular/core';
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday
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
    this._eventos = value || [];
    this.generarDiasMes(); // ✅ Forzamos regeneración al recibir eventos
  }

  get eventos(): any[] {
    return this._eventos;
  }

  @Input() todasLasSedes: { id: number, nombre: string, seleccionada?: boolean }[] = [];

  @Output() eventoGuardado = new EventEmitter<any>();
  @Output() eventoEliminado = new EventEmitter<any>();

  mesActual = new Date();
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  diasMes: any[] = [];
  mostrarModal = false;
  fechaSeleccionada!: Date;

  nuevoEvento = {
    tipo: '',
    descripcion: ''
  };

  aplicarAMasSedes: boolean = false;
  usuarioRol: string = '';
  modoEdicion: boolean = false;
  eventoExistente: any = null;

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
    }
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
    const diasVaciosAntes = Array(primerDia).fill({ fecha: null });

    const ultimoDia = finMes.getDay();
    const diasVaciosDespues = Array(6 - ultimoDia).fill({ fecha: null });

    this.diasMes = [
      ...diasVaciosAntes,
      ...dias.map(dia => {
        const evento = this._eventos.find(e =>
          e?.fecha && isSameDay(new Date(e.fecha), dia)
        );
        return {
          fecha: dia,
          seleccionado: false,
          evento: evento || null
        };
      }),
      ...diasVaciosDespues
    ];
  }

  seleccionarDia(dia: any): void {
    if (!dia.fecha) return;

    this.fechaSeleccionada = dia.fecha;

    const eventoExistente = this._eventos.find(e =>
      e?.fecha && isSameDay(new Date(e.fecha), dia.fecha)
    );

    if (eventoExistente) {
      this.modoEdicion = true;
      this.eventoExistente = eventoExistente;
      this.nuevoEvento = {
        tipo: eventoExistente.tipo,
        descripcion: eventoExistente.descripcion
      };
    } else {
      this.modoEdicion = false;
      this.eventoExistente = null;
      this.nuevoEvento = { tipo: '', descripcion: '' };
    }

    if (this.todasLasSedes) {
      this.todasLasSedes = this.todasLasSedes.map(s => ({
        ...s,
        seleccionada: s.seleccionada ?? false
      }));
    }

    this.mostrarModal = true;
  }

  esHoy(fecha: Date): boolean {
    return isToday(fecha);
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
    const eventoBase = {
      fecha: this.fechaSeleccionada,
      tipo: this.nuevoEvento.tipo,
      descripcion: this.nuevoEvento.descripcion
    };

    if (this.aplicarAMasSedes && this.todasLasSedes) {
      const sedesSeleccionadas = this.todasLasSedes.filter(s => s.seleccionada);
      sedesSeleccionadas.forEach(sedeExtra => {
        this.eventoGuardado.emit({
          ...eventoBase,
          sede: sedeExtra.id,
          editar: false
        });
      });
    }

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
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
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
        const evento = {
          sede: this.sede,
          año: this.anio,
          fecha: this.fechaSeleccionada,
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
    this.nuevoEvento = { tipo: '', descripcion: '' };
  }

  trackBySede(index: number, sede: any): number {
    return sede.id;
  }
}
