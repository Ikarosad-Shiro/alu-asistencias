import { Component, Input, OnInit } from '@angular/core';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { CalendarioService } from '../../services/calendario.service';

@Component({
  selector: 'app-calendario-sede',
  templateUrl: './calendario-sede.component.html',
  styleUrls: ['./calendario-sede.component.css']
})
export class CalendarioSedeComponent implements OnInit {
  @Input() sede!: number;
  @Input() anio!: number;
  @Input() sedeNombre: string = '';

  // Calendario
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  eventos: CalendarEvent[] = [];
  locale: string = 'es';

  // Modal
  mostrarModal: boolean = false;
  fechaSeleccionada!: Date;
  nuevoEvento: any = {
    tipo: '',
    descripcion: ''
  };

  constructor(private calendarioService: CalendarioService) {}

  ngOnInit(): void {
    this.cargarEventos();
  }

  cargarEventos(): void {
    this.calendarioService.obtenerPorSedeYAnio(this.sede, this.anio).subscribe({
      next: (eventos) => {
        this.eventos = eventos.map((evento: any) => this.formatearEvento(evento));
      },
      error: (err) => console.error('Error al cargar eventos:', err)
    });
  }

  onDayClick(day: any): void {
    this.fechaSeleccionada = day.date;
    this.abrirModalAgregar();
  }

  abrirModalAgregar(): void {
    this.nuevoEvento = { tipo: '', descripcion: '' };
    this.mostrarModal = true;
  }

  guardarEvento(): void {
    const eventoData = {
      sede: this.sede,
      año: this.anio,
      fecha: this.fechaSeleccionada.toISOString(),
      tipo: this.nuevoEvento.tipo,
      descripcion: this.nuevoEvento.descripcion
    };

    this.calendarioService.agregarDia(eventoData).subscribe({
      next: () => {
        this.cargarEventos();
        this.cerrarModal();
      },
      error: (err) => console.error('Error al guardar:', err)
    });
  }

  private formatearEvento(evento: any): CalendarEvent {
    let color = { primary: '#1e90ff', secondary: '#D1E8FF' };
    if (evento.tipo === 'descanso') color = { primary: '#ad2121', secondary: '#FAE3E3' };
    if (evento.tipo === 'festivo') color = { primary: '#f6c23e', secondary: '#fff3cd' };

    return {
      start: new Date(evento.fecha),
      title: `${evento.tipo.toUpperCase()}: ${evento.descripcion}`,
      color,
      allDay: true
    };
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }
}
