import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.component.html',
  styleUrls: ['./calendario.component.css']
})
export class CalendarioComponent implements OnInit {
  @Input() asistencias: any[] = [];  // 📌 Recibe las asistencias desde el componente padre

  // Variables para el calendario
  fechaActual = new Date();
  diasDelMes: any[] = [];
  mes: number;
  anio: number;
  asistenciasMap: Map<string, any> = new Map();  // 🔄 Optimización para búsqueda rápida

  constructor() {
    this.mes = this.fechaActual.getMonth();
    this.anio = this.fechaActual.getFullYear();
  }

  ngOnInit(): void {
    if (this.asistencias && this.asistencias.length > 0) {
      // 🔄 Crear un Map para búsqueda rápida de asistencias
      this.asistencias.forEach(asistencia => {
        const fechaISO = new Date(asistencia.fecha).toISOString().split('T')[0];
        this.asistenciasMap.set(fechaISO, asistencia);
      });
      this.generarCalendario();
    } else {
      console.warn("⚠️ No se encontraron asistencias.");
    }
  }

  // 📅 Generar los días del calendario
  generarCalendario() {
    const primerDiaMes = new Date(this.anio, this.mes, 1);
    const ultimoDiaMes = new Date(this.anio, this.mes + 1, 0);
    const diasEnBlanco = primerDiaMes.getDay();
    const diasTotales = ultimoDiaMes.getDate();

    this.diasDelMes = [];

    // Días en blanco antes del inicio del mes
    for (let i = 0; i < diasEnBlanco; i++) {
      this.diasDelMes.push(null);
    }

    // Días del mes con asistencias
    for (let dia = 1; dia <= diasTotales; dia++) {
      const fecha = new Date(this.anio, this.mes, dia).toISOString().split('T')[0];
      const asistenciaDelDia = this.asistenciasMap.get(fecha) || null;  // 🔥 Buscar asistencia por fecha exacta

      this.diasDelMes.push({
        dia,
        asistencia: asistenciaDelDia
      });
    }
  }

  // 📅 Cambiar mes
  cambiarMes(offset: number) {
    this.mes += offset;
    if (this.mes < 0) {
      this.mes = 11;
      this.anio--;
    } else if (this.mes > 11) {
      this.mes = 0;
      this.anio++;
    }
    this.generarCalendario();
  }

  // 📅 Formato para el nombre del mes
  obtenerNombreMes(mes: number): string {
    const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return nombresMes[mes];
  }

  // 🔄 Obtener clase según el estado de la asistencia
  obtenerClaseEstado(asistencia: any): string {
    if (!asistencia) return '';
    const estado = asistencia.estado;
    if (estado === 'Pendiente') return 'estado-pendiente';
    if (estado === 'Asistencia Completa') return 'estado-completa';
    if (estado === 'Asistencia con salida automática') return 'estado-automatica';
    return '';
  }

// 🔄 Métodos para determinar el estado de asistencia
tieneEntrada(asistencia: any): boolean {
  return asistencia?.detalle?.some((d: any) => d.tipo === 'Entrada') || false;
}

tieneSalida(asistencia: any): boolean {
  return asistencia?.detalle?.some((d: any) => d.tipo === 'Salida') || false;
}

esPendiente(asistencia: any): boolean {
  return asistencia?.estado === 'Pendiente';
}

esCompleta(asistencia: any): boolean {
  return asistencia?.estado === 'Asistencia Completa';
}

esAutomatica(asistencia: any): boolean {
  return asistencia?.estado === 'Asistencia con salida automática';
}
}
