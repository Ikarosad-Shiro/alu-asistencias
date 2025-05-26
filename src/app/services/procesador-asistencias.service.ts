import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';

interface RegistroAsistencia {
  tipo: string;
  fechaHora: string | Date;
  salida_automatica?: boolean;
  sincronizado?: boolean;
}

interface Asistencia {
  fecha: string;
  estado?: string;
  detalle?: RegistroAsistencia[];
  observacion?: string;
}

interface EventoEspecial {
  tipo: string;
  fecha: string;
  descripcion?: string;
  horaEntrada?: string;
  horaSalida?: string;
}

interface DiaProcesado {
  fecha: string;
  diaSemana: string;
  entrada?: string;
  salida?: string;
  estado: string;
  observacion?: string;
}

@Injectable({ providedIn: 'root' })
export class ProcesadorAsistenciasService {
  procesarDias(
    dias: { fecha: string; diaSemana: string }[],
    asistencias: Asistencia[],
    eventosTrabajador: EventoEspecial[],
    eventosSede: EventoEspecial[]
  ): DiaProcesado[] {
    const hoy = DateTime.now().setZone('America/Mexico_City').toISODate() || '';

    return dias.map(dia => {
      const fecha = dia.fecha;

      const eventoTrabajador = this.buscarEvento(fecha, eventosTrabajador);
      const asistencia = this.buscarAsistencia(fecha, asistencias);
      const eventoSede = this.buscarEvento(fecha, eventosSede);

      const opciones: { fuente: string; tipo: string; data: any }[] = [];

      if (eventoTrabajador) opciones.push({ fuente: 'trabajador', tipo: eventoTrabajador.tipo, data: eventoTrabajador });
      if (asistencia) {
        const tipoAsistencia = this.definirTipoAsistencia(asistencia, dia.fecha, hoy);
        opciones.push({ fuente: 'asistencia', tipo: tipoAsistencia, data: asistencia });
      }
      if (eventoSede) opciones.push({ fuente: 'sede', tipo: eventoSede.tipo, data: eventoSede });

      const opcionGanadora = opciones.sort((a, b) =>
        this.obtenerPrioridadEstado(b.tipo) - this.obtenerPrioridadEstado(a.tipo)
      )[0];

      if (!opcionGanadora) {
        return {
          ...dia,
          estado: '❌ Falta',
          observacion: 'No registrado',
          entrada: '-', salida: '-'
        };
      }

      switch (opcionGanadora.fuente) {
        case 'trabajador':
          if (opcionGanadora.tipo === 'Asistencia') {
            return {
              ...dia,
              entrada: opcionGanadora.data.horaEntrada
                ? this.formatearHoraManual(opcionGanadora.data.horaEntrada)
                : '-',
              salida: opcionGanadora.data.horaSalida
                ? this.formatearHoraManual(opcionGanadora.data.horaSalida)
                : '-',
              estado: this.iconoEstado('Asistencia'),
              observacion: 'Asistencia marcada manualmente'
            };
          } else {
            return {
              ...dia,
              estado: this.iconoEstado(opcionGanadora.tipo),
              observacion: opcionGanadora.data.descripcion || this.descripcionPorTipo(opcionGanadora.tipo),
              entrada: '-', salida: '-'
            };
          }

        case 'asistencia':
          return this.procesarAsistencia(dia, opcionGanadora.data, eventoSede || undefined);

        case 'sede':
          const tiposConAsistencia = ['Capacitación', 'Evento'];
          if (tiposConAsistencia.includes(opcionGanadora.tipo) && asistencia) {
            return this.procesarAsistencia(dia, asistencia, eventoSede || undefined);
          }
          return {
            ...dia,
            estado: this.iconoEstado(opcionGanadora.tipo),
            observacion: opcionGanadora.data.descripcion || this.descripcionPorTipo(opcionGanadora.tipo),
            entrada: '-', salida: '-'
          };

        default:
          return {
            ...dia,
            estado: '❌ Falta',
            observacion: 'No registrado',
            entrada: '-', salida: '-'
          };
      }
    });
  }

  private buscarEvento(fecha: string, eventos: EventoEspecial[]): EventoEspecial | null {
    return eventos?.find(e => e?.fecha && this.normalizarFecha(e.fecha) === fecha) || null;
  }

  private buscarAsistencia(fecha: string, asistencias: Asistencia[]): Asistencia | null {
    return asistencias.find(a => a.fecha === fecha || a.detalle?.some(d => this.normalizarFecha(d.fechaHora) === fecha)) || null;
  }

  private procesarAsistencia(dia: any, asistencia: Asistencia, eventoSede?: EventoEspecial): DiaProcesado {
    const entrada = asistencia.detalle?.find(d => d.tipo === 'Entrada');
    const salida = asistencia.detalle?.find(d => d.tipo === 'Salida');
    const hoy = DateTime.now().setZone('America/Mexico_City').toISODate() || '';

    const diaProcesado: DiaProcesado = {
      ...dia,
      entrada: entrada ? this.formatoHora(entrada.fechaHora) : '-',
      salida: salida ? this.formatoHora(salida.fechaHora) : '-'
    };

    if (entrada && salida) {
      diaProcesado.estado = '✅ Asistencia Completa';
      diaProcesado.observacion = asistencia.observacion || 'Entrada y salida registradas';
    } else if (entrada && dia.fecha === hoy) {
      diaProcesado.estado = '🕓 Entrada sin salida';
      diaProcesado.observacion = 'En espera del registro de salida';
    } else if (entrada && dia.fecha < hoy) {
      diaProcesado.estado = '🕒 Salida Automática';
      diaProcesado.observacion = 'Falta registro de salida';
    } else if (salida) {
      diaProcesado.estado = '⚠️ Incompleta';
      diaProcesado.observacion = 'Falta registro de entrada';
    } else {
      diaProcesado.estado = '❌ Falta';
      diaProcesado.observacion = 'Sin registros de asistencia';
    }

    if (eventoSede) {
      diaProcesado.observacion += ` (${eventoSede.tipo}${eventoSede.descripcion ? ': ' + eventoSede.descripcion : ''})`;
    }

    return diaProcesado;
  }

  private formatoHora(fechaHora: string | Date): string {
    try {
      return DateTime.fromISO(typeof fechaHora === 'string' ? fechaHora : new Date(fechaHora).toISOString(), { zone: 'America/Mexico_City' }).toFormat('hh:mm a');
    } catch {
      return '-';
    }
  }

  private formatearHoraManual(horaStr: string): string {
    if (!horaStr) return '-';
    try {
      return DateTime.fromFormat(horaStr, 'HH:mm').setZone('America/Mexico_City').toFormat('hh:mm a');
    } catch {
      return horaStr;
    }
  }

  private descripcionPorTipo(tipo: string): string {
    const descripciones: { [key: string]: string } = {
      'Incapacidad': 'Día justificado por incapacidad médica',
      'Permiso': 'Permiso autorizado',
      'Permiso con Goce': 'Permiso con goce de sueldo',
      'Vacaciones': 'Periodo vacacional autorizado',
      'Vacaciones Pagadas': 'Vacaciones pagadas',
      'Falta': 'Falta justificada manualmente',
      'Asistencia': 'Asistencia marcada manualmente',
      'Media Jornada': 'Jornada parcial autorizada'
    };
    return descripciones[tipo] || tipo;
  }

  private iconoEstado(tipo: string): string {
    const mapa: { [key: string]: string } = {
      'Incapacidad': '🩺 Incapacidad',
      'Vacaciones Pagadas': '💰 Vacaciones Pagadas',
      'Vacaciones': '🌴 Vacaciones',
      'Permiso con Goce': '🧾 Permiso con Goce',
      'Permiso': '📄 Permiso',
      'Falta': '❌ Falta Manual',
      'Asistencia Completa': '✅ Asistencia Completa',
      'Salida Automática': '🕒 Salida Automática',
      'Entrada sin salida': '🕓 Entrada sin salida',
      'Festivo': '🎉 Festivo',
      'Descanso': '😴 Descanso',
      'Puente': '🌉 Puente',
      'Media Jornada': '🌓 Media Jornada',
      'Capacitación': '📚 Capacitación',
      'Evento': '🎤 Evento',
      'Suspensión': '🚫 Suspensión'
    };
    return mapa[tipo] || tipo;
  }

  private definirTipoAsistencia(asistencia: Asistencia, fecha: string, hoy: string): string {
    const entrada = asistencia.detalle?.find(d => d.tipo === 'Entrada');
    const salida = asistencia.detalle?.find(d => d.tipo === 'Salida');

    if (entrada && salida) return 'Asistencia Completa';
    if (entrada && fecha === hoy) return 'Entrada sin salida';
    if (entrada && fecha < hoy) return 'Salida Automática';
    if (salida) return 'Incompleta';
    return 'Falta';
  }

  obtenerPrioridadEstado(tipo: string): number {
    const mapa: { [key: string]: number } = {
      'Falta': 100,
      'Asistencia': 100,
      'Asistencia Completa': 90,
      'Salida Automática': 85,
      'Entrada sin salida': 80,
      'Incapacidad': 70,
      'Permiso': 70,
      'Permiso con Goce': 70,
      'Vacaciones': 70,
      'Vacaciones Pagadas': 70,
      'Media Jornada': 60,
      'Capacitación': 60,
      'Evento': 60,
      'Festivo': 50,
      'Descanso': 50,
      'Puente': 50,
      'Suspensión': 50,
      'Falta Default': 10
    };
    return mapa[tipo] || 0;
  }

  normalizarEventosEspeciales(eventos: any[]): EventoEspecial[] {
    return (eventos || []).map((e: any) => ({
      ...e,
      fecha: this.normalizarFecha(e.fecha),
      descripcion: e.descripcion || e.tipo || '',
      horaEntrada: e.horaEntrada,
      horaSalida: e.horaSalida
    }));
  }

  private normalizarFecha(fecha: any): string {
    if (!fecha) return '';
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    try {
      return new Date(fecha).toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

}
