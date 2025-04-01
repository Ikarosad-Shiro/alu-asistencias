import { Component, Input, OnInit } from '@angular/core';
import { addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

@Component({
  selector: 'app-calendario-sede',
  templateUrl: './calendario-sede.component.html',
  styleUrls: ['./calendario-sede.component.css']
})
export class CalendarioSedeComponent implements OnInit {
  @Input() sede!: number;
  @Input() sedeNombre: string = '';
  @Input() anio!: number;
  @Input() eventos: any[] = [];

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

  generarDiasMes(): void {
    const inicioMes = startOfMonth(this.mesActual);
    const finMes = endOfMonth(this.mesActual);
    const dias = eachDayOfInterval({ start: inicioMes, end: finMes });

    // Ajustar para que comience en domingo
    const primerDia = inicioMes.getDay();
    const diasVacios = Array(primerDia).fill(null);

    this.diasMes = [
      ...diasVacios,
      ...dias.map(dia => ({
        fecha: dia,
        seleccionado: false,
        evento: this.eventos.find(e => isSameDay(new Date(e.fecha), dia))
      }))
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
    // Lógica para guardar el evento
    const nuevoDiaEspecial = {
      fecha: this.fechaSeleccionada,
      tipo: this.nuevoEvento.tipo,
      descripcion: this.nuevoEvento.descripcion,
      sede: this.sede
    };

    // Aquí llamarías a tu servicio para guardar
    console.log('Guardando:', nuevoDiaEspecial);
    this.cerrarModal();
    this.generarDiasMes(); // Refrescar la vista
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }
}
