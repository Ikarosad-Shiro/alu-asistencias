import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { DateTime } from 'luxon';
import { Asistencia, EventoEspecial } from 'src/app/models/asistencia.model';

@Component({
  selector: 'app-calendario-unificado',
  templateUrl: './calendario-unificado.component.html',
  styleUrls: ['./calendario-unificado.component.css']
})
export class CalendarioUnificadoComponent implements OnInit, OnChanges {
  @Input() asistencias: Asistencia[] = [];
  @Input() eventosSede: EventoEspecial[] = [];
  @Input() eventosTrabajador: EventoEspecial[] = [];

  // Si algún día lo quieres parametrizar, cambia esta constante
  private readonly ZONE = 'America/Mexico_City';

  fechaActual: Date = new Date(); // mes visible
  diasDelMes: DiaCalendario[] = [];

  ngOnInit(): void {
    this.generarDiasDelMes(this.fechaActual);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['asistencias'] || changes['eventosSede'] || changes['eventosTrabajador']) {
      this.generarDiasDelMes(this.fechaActual);
    }
  }

  // =============== helpers de fecha (zona CDMX) ===============
  private mxDay(v: string | Date | undefined | null): string {
    if (!v) return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // ya es YYYY-MM-DD
    try {
      const dt = typeof v === 'string' ? DateTime.fromISO(v) : DateTime.fromJSDate(v);
      return dt.setZone(this.ZONE).toISODate() || '';
    } catch {
      // fallback (no debería usarse)
      const d = new Date(v as any);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }

  // =============== grilla del calendario ===============
  generarDiasDelMes(fechaBase: Date): void {
    const anio = fechaBase.getFullYear();
    const mes = fechaBase.getMonth();

    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);

    const dias: DiaCalendario[] = [];

    // vacíos al inicio
    const diaSemanaPrimerDia = primerDia.getDay(); // 0=Dom
    for (let i = 0; i < diaSemanaPrimerDia; i++) dias.push({ fecha: null, estado: null });

    // días del mes
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const fecha = new Date(anio, mes, d);
      const estado = this.obtenerEstadoDelDia(fecha);
      dias.push({ fecha, estado });
    }

    // vacíos al final
    const faltantes = (7 - (dias.length % 7)) % 7;
    for (let i = 0; i < faltantes; i++) dias.push({ fecha: null, estado: null });

    this.diasDelMes = dias;
  }

  // =============== estado por día (multi-sede + zona) ===============
  obtenerEstadoDelDia(fecha: Date): string {
    const fechaStr = this.mxDay(fecha);
    const hoyStr   = this.mxDay(new Date());

    // 1) Evento del trabajador (máxima prioridad)
    const evtTrab = (this.eventosTrabajador || []).find(e => this.mxDay(e.fecha as any) === fechaStr);
    if (evtTrab) {
      const t = (evtTrab.tipo || '').toLowerCase().trim();
      return t === 'asistencia' ? 'Asistencia' : evtTrab.tipo;
    }

    // 2) Tomar TODAS las asistencias del día (todas las sedes)
    const asistenciasDelDia = (this.asistencias || []).filter(a =>
      this.mxDay(a.fecha as any) === fechaStr ||
      (a.detalle || []).some(d => this.mxDay(d.fechaHora as any) === fechaStr)
    );

    // aplanar marcas del día
    const regsDelDia = asistenciasDelDia
      .flatMap(a => a.detalle || [])
      .filter(d => this.mxDay(d.fechaHora as any) === fechaStr);

    // considerar tipos manuales
    const isEntrada = (t?: string) =>
      t === 'Entrada' || t === 'Asistencia' || t === 'Entrada Manual';
    const isSalida  = (t?: string) =>
      !!t && (t === 'Salida' || t.startsWith('Salida') || t === 'Salida Manual');

    const entradas = regsDelDia.filter(d => isEntrada(d.tipo));
    const salidas  = regsDelDia.filter(d => isSalida(d.tipo));

    if (entradas.length || salidas.length) {
      if (entradas.length && salidas.length) return 'Asistencia Completa';
      if (entradas.length && fechaStr === hoyStr) return 'Pendiente';
      if (entradas.length && fechaStr < hoyStr)  return 'Salida Automática';
      if (!entradas.length && salidas.length)    return 'Incompleta';
    }

    // 3) Evento de sede (si no hubo asistencia real ni evento de trabajador)
    const evtSede = (this.eventosSede || []).find(e => this.mxDay(e.fecha as any) === fechaStr);
    if (evtSede) return evtSede.tipo;

    // 4) Futuro sin nada
    if (fechaStr > hoyStr) return '';

    // 5) Default
    return 'Falta';
  }

  // =============== presentación ===============
  getClaseEstado(estado: string | null): string {
    if (!estado) return '';
    return estado
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tildes
      .replace(/ /g, '-')      // espacios -> guiones
      .replace(/[^\w-]/g, ''); // limpia
  }

  getDescripcionEstado(estado: string | null): string {
    const mapa: { [k: string]: string } = {
      'Asistencia Completa': 'Entrada y salida registradas correctamente',
      'Salida Automática': 'Entrada registrada, pero sin salida',
      'Pendiente': 'Entrada registrada, pero sin salida (día en curso)',
      'Incompleta': 'Salida sin registro de entrada',
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
      'Asistencia': 'Presente (marcada manualmente)'
    };
    return estado ? (mapa[estado] || estado) : '';
  }

  getIconoEstado(estado: string | null): string {
    const iconos: { [k: string]: string } = {
      'Asistencia Completa': '✅',
      'Salida Automática': '🕒',
      'Pendiente': '⏳',
      'Incompleta': '⚠️',
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

  // =============== navegación ===============
  mesAnterior(): void {
    const f = new Date(this.fechaActual);
    f.setMonth(f.getMonth() - 1);
    this.fechaActual = f;
    this.generarDiasDelMes(this.fechaActual);
  }

  mesSiguiente(): void {
    const f = new Date(this.fechaActual);
    f.setMonth(f.getMonth() + 1);
    this.fechaActual = f;
    this.generarDiasDelMes(this.fechaActual);
  }
}

interface DiaCalendario {
  fecha: Date | null;
  estado: string | null;
}
