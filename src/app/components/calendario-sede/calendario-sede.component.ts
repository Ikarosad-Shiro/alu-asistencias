import {
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import {
  CalendarEvent,
  CalendarView
} from 'angular-calendar';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-calendario-sede',
  templateUrl: './calendario-sede.component.html',
  styleUrls: ['./calendario-sede.component.css']
})
export class CalendarioSedeComponent implements OnChanges {
  @Input() sede!: number;
  @Input() anio!: number;
  @Input() dias: any[] = [];

  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  eventos: CalendarEvent[] = [];
  locale: string = 'es';
  refresh = new Subject<void>();

  CalendarView = CalendarView;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dias']) {
      this.generarEventos();
    }
  }

  generarEventos(): void {
    this.eventos = this.dias.map((dia) => {
      let color = { primary: '#1e90ff', secondary: '#D1E8FF' };
      if (dia.tipo === 'descanso') color = { primary: '#ad2121', secondary: '#FAE3E3' };
      if (dia.tipo === 'festivo') color = { primary: '#f6c23e', secondary: '#fff3cd' };

      return {
        start: new Date(dia.fecha),
        title: `${dia.tipo.toUpperCase()}: ${dia.descripcion}`,
        color,
        allDay: true
      };
    });

    this.refresh.next(); // Actualiza la vista
  }

  onDayClick(date: Date): void {
    console.log("📅 Día clickeado:", date);
    // Aquí podrías abrir un modal o hacer lógica para agregar/eliminar
  }
}
