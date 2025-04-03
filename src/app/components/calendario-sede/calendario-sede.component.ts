import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday
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

  // 💖 Nuevas funcionalidades
  @Input() todasLasSedes: { id: number, nombre: string, seleccionada?: boolean }[] = [];
  aplicarAMasSedes: boolean = false;

  mesActual = new Date();
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  diasMes: any[] = [];
  mostrarModal = false;
  fechaSeleccionada!: Date;

  nuevoEvento = {
    tipo: '',
    descripcion: ''
  };

  ngOnInit(): void {
    this.mesActual = new Date(this.anio, 0, 1); // Enero del año seleccionado
    this.generarDiasMes();
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

    const primerDia = inicioMes.getDay(); // 0 (Domingo) - 6 (Sábado)
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
    if (dia.evento) {
      this.nuevoEvento = { ...dia.evento };
    } else {
      this.nuevoEvento = { tipo: '', descripcion: '' };
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

  guardarEvento(): void {
    const sedesAplicables = [this.sede]; // Sede actual

    if (this.aplicarAMasSedes) {
      const sedesExtra = this.todasLasSedes
        .filter(s => s.seleccionada && s.id !== this.sede)
        .map(s => s.id);

      sedesAplicables.push(...sedesExtra);
    }

    sedesAplicables.forEach(sedeId => {
      const evento = {
        fecha: this.fechaSeleccionada,
        tipo: this.nuevoEvento.tipo,
        descripcion: this.nuevoEvento.descripcion,
        sede: sedeId,
        año: this.mesActual.getFullYear()
      };

      // Aquí llamas al servicio (emit, http, etc.)
      console.log('Guardar evento en sede', sedeId, evento);
      // this.calendarioService.agregarDia(evento).subscribe(...);
    });

    this.cerrarModal();
    this.generarDiasMes(); // Refrescar vista
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  onToggleAplicarSedes(): void {
    if (!this.aplicarAMasSedes) {
      // 💡 Limpiar las selecciones si se desactiva
      this.todasLasSedes.forEach(s => s.seleccionada = false);
    }
  }
}
