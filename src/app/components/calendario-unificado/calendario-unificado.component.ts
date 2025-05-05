import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Asistencia, EventoEspecial, RegistroDetalle } from 'src/app/models/asistencia.model';

@Component({
  selector: 'app-calendario-unificado',
  templateUrl: './calendario-unificado.component.html',
  styleUrls: ['./calendario-unificado.component.css']
})
export class CalendarioUnificadoComponent implements OnInit, OnChanges {
  @Input() asistencias: Asistencia[] = [];
  @Input() eventosSede: EventoEspecial[] = [];
  @Input() eventosTrabajador: EventoEspecial[] = [];

  fechaActual: Date = new Date(); // Mes actual
  diasDelMes: DiaCalendario[] = [];

  ngOnInit(): void {
    this.generarDiasDelMes(this.fechaActual);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asistencias'] || changes['eventosSede'] || changes['eventosTrabajador']) {
      this.generarDiasDelMes(this.fechaActual);
    }
  }

  generarDiasDelMes(fechaBase: Date): void {
    const anio = fechaBase.getFullYear();
    const mes = fechaBase.getMonth();

    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);

    const dias: DiaCalendario[] = [];

    // 🟨 Días vacíos al inicio
    const diaSemanaPrimerDia = primerDia.getDay();
    for (let i = 0; i < diaSemanaPrimerDia; i++) {
      dias.push({ fecha: null, estado: null });
    }

    // 🗓️ Días del mes con estado
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(anio, mes, dia);
      const estado = this.obtenerEstadoDelDia(fecha);
      dias.push({ fecha, estado });
    }

    // 🟪 Días vacíos al final
    const totalCeldas = dias.length;
    const faltantes = 7 - (totalCeldas % 7);
    if (faltantes < 7) {
      for (let i = 0; i < faltantes; i++) {
        dias.push({ fecha: null, estado: null });
      }
    }

    this.diasDelMes = dias;
  }

  obtenerEstadoDelDia(fecha: Date): string {
    const fechaStr = fecha.toISOString().split('T')[0];
    const hoyStr = new Date().toISOString().split('T')[0];

    // 🟡 1️⃣ Eventos del trabajador (tienen prioridad)
    const eventoTrabajador = this.eventosTrabajador.find(e => e.fecha === fechaStr);
    if (eventoTrabajador) return eventoTrabajador.tipo;

    // 🔵 2️⃣ Eventos de la sede
    const eventoSede = this.eventosSede.find(e => e.fecha === fechaStr);
    if (eventoSede) return eventoSede.tipo;

    // 🔒 3️⃣ Si es futuro y no hay evento → mostrar en blanco
    if (fechaStr > hoyStr) return '';

    // 🕒 4️⃣ Asistencias
    const asistencia = this.asistencias.find(a => a.fecha === fechaStr);
    if (asistencia && asistencia.detalle?.length > 0) {
      const tieneEntrada = asistencia.detalle.some((d: RegistroDetalle) => d.tipo === 'Entrada');
      const tieneSalida = asistencia.detalle.some((d: RegistroDetalle) => d.tipo === 'Salida');

      if (tieneEntrada && tieneSalida) return 'Asistencia Completa';
      if (tieneEntrada && fechaStr < hoyStr) return 'Salida Automática';
      if (tieneEntrada && fechaStr === hoyStr) return 'Pendiente';
    }

    // ❌ 5️⃣ Si no hay nada y es día pasado → marcar como falta
    return 'Falta';
  }

  getClaseEstado(estado: string | null): string {
    return estado ? estado.toLowerCase().replace(/ /g, '-') : '';
  }

  getDescripcionEstado(estado: string | null): string {
    const mapa: { [clave: string]: string } = {
      'Asistencia Completa': 'Entrada y salida registradas correctamente',
      'Salida Automática': 'Entrada registrada, pero sin salida',
      'Pendiente': 'Entrada registrada, pero sin salida (día en curso)',
      'Falta': 'No se registró ninguna entrada',
      'Vacaciones': 'Vacaciones programadas',
      'Vacaciones Pagadas': 'Vacaciones con goce',
      'Permiso': 'Permiso personal',
      'Permiso con Goce': 'Permiso con goce de sueldo',
      'Incapacidad': 'Incapacidad médica',
      'Descanso': 'Día libre programado',
      'Festivo': 'Día festivo oficial',
      'Puente': 'Día puente',
      'Media Jornada': 'Medio día trabajado',
      'Capacitación': 'Sesión de capacitación',
      'Evento': 'Evento institucional',
      'Suspensión': 'Actividad suspendida',
      'Asistencia': 'Presente'
    };
    return estado ? mapa[estado] || estado : '';
  }

  getIconoEstado(estado: string | null): string {
    const iconos: { [clave: string]: string } = {
      'Asistencia Completa': '✅',
      'Salida Automática': '🕒',
      'Pendiente': '⏳',
      'Falta': '❌',
      'Vacaciones': '🏖️',
      'Vacaciones Pagadas': '💸',
      'Permiso': '📝',
      'Permiso con Goce': '🧾',
      'Incapacidad': '🏥',
      'Descanso': '🛌',
      'Festivo': '🎉',
      'Puente': '🌉',
      'Media Jornada': '🌓',
      'Capacitación': '📚',
      'Evento': '🎤',
      'Suspensión': '🚫',
      'Asistencia': '✔️'
    };
    return estado ? iconos[estado] || '📌' : '';
  }

  mesAnterior(): void {
    const nuevaFecha = new Date(this.fechaActual);
    nuevaFecha.setMonth(nuevaFecha.getMonth() - 1);
    this.fechaActual = nuevaFecha;
    this.generarDiasDelMes(this.fechaActual);
  }

  mesSiguiente(): void {
    const nuevaFecha = new Date(this.fechaActual);
    nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
    this.fechaActual = nuevaFecha;
    this.generarDiasDelMes(this.fechaActual);
  }
}

interface DiaCalendario {
  fecha: Date | null;
  estado: string | null;
}
