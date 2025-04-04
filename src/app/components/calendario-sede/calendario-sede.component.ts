import {
  Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter
} from '@angular/core';
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday
} from 'date-fns';

@Component({
  selector: 'app-calendario-sede',
  templateUrl: './calendario-sede.component.html',
  styleUrls: ['./calendario-sede.component.css']
})
export class CalendarioSedeComponent implements OnInit, OnChanges {
  @Input() sede!: number;
  @Input() sedeNombre: string = '';
  @Input() anio!: number;
  @Input() eventos: any[] = [];
  @Input() todasLasSedes: { id: number, nombre: string, seleccionada?: boolean }[] = [];

  @Output() eventoGuardado = new EventEmitter<any>();

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

  ngOnInit(): void {
    this.mesActual = new Date(this.anio, 0, 1);
    this.generarDiasMes();

    // Inicializar seleccionadas
    if (this.todasLasSedes) {
      this.todasLasSedes = this.todasLasSedes.map(s => ({
        ...s,
        seleccionada: s.seleccionada ?? false
      }));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventos']) {
      this.generarDiasMes();
    }
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
      ...dias.map(dia => ({
        fecha: dia,
        seleccionado: false,
        evento: this.eventos.find(e => e?.fecha && isSameDay(new Date(e.fecha), dia))
      })),
      ...diasVaciosDespues
    ];
  }

  seleccionarDia(dia: any): void {
    if (!dia.fecha) return;

    this.fechaSeleccionada = dia.fecha;
    this.nuevoEvento = dia.evento
      ? { ...dia.evento }
      : { tipo: '', descripcion: '' };

    // 🛡️ Asegurar que todasLasSedes estén listas y tengan `seleccionada`
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
        this.eventoGuardado.emit({ ...eventoBase, sede: sedeExtra.id });
      });
    }

    this.eventoGuardado.emit({ ...eventoBase, sede: this.sede });

    this.cerrarModal();
    this.generarDiasMes();
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.aplicarAMasSedes = false;
  }

  trackBySede(index: number, sede: any): number {
    return sede.id;
  }
}
