import { Component, Input, OnInit } from '@angular/core';
import { CalendarioTrabajadorService } from 'src/app/services/calendario-trabajador.service';

interface DiaEspecial {
  fecha: string;
  tipo: string;
}

@Component({
  selector: 'app-calendario-trabajador-visual',
  templateUrl: './calendario-trabajador-visual.component.html',
  styleUrls: ['./calendario-trabajador-visual.component.css']
})
export class CalendarioTrabajadorVisualComponent implements OnInit {
  @Input() trabajadorId!: string; // 🔥 Necesario para saber de qué trabajador guardar
  @Input() diasEspeciales: DiaEspecial[] = [];

  anioActual: number = new Date().getFullYear();
  mesActual: number = new Date().getMonth();
  diasDelMes: (Date | null)[] = [];

  seleccionTipo: string = 'Permiso';
  esRango: boolean = false;
  fechaInicio!: string;
  fechaFin!: string;
  nuevosDias: string[] = [];


  constructor(private calendarioTrabajadorService: CalendarioTrabajadorService) {}

  ngOnInit(): void {
    if (!this.trabajadorId) {
      console.warn('⚠️ trabajadorId está vacío o undefined');
      return;
    }

    this.cargarDiasEspecialesDesdeMongo();
    this.generarDiasDelMes();
  }


  generarDiasDelMes() {
    this.diasDelMes = [];
    const primerDiaMes = new Date(this.anioActual, this.mesActual, 1);
    const ultimoDiaMes = new Date(this.anioActual, this.mesActual + 1, 0);

    // Espacios vacíos si el primer día no es domingo
    const primerDiaSemana = primerDiaMes.getDay();
    for (let i = 0; i < primerDiaSemana; i++) {
      this.diasDelMes.push(null);
    }

    // Días reales del mes
    for (let dia = 1; dia <= ultimoDiaMes.getDate(); dia++) {
      this.diasDelMes.push(new Date(this.anioActual, this.mesActual, dia));
    }
  }

  obtenerNombreMes(mes: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes];
  }

  mesAnterior() {
    if (this.mesActual === 0) {
      this.mesActual = 11;
      this.anioActual--;
    } else {
      this.mesActual--;
    }
    this.generarDiasDelMes();
  }

  mesSiguiente() {
    if (this.mesActual === 11) {
      this.mesActual = 0;
      this.anioActual++;
    } else {
      this.mesActual++;
    }
    this.generarDiasDelMes();
  }

  esDiaEspecial(dia: Date | null): DiaEspecial | null {
    if (!dia) return null;
    const diaISO = dia.toISOString().split('T')[0];
    return this.diasEspeciales.find(evento => evento.fecha.startsWith(diaISO)) || null;
  }

  agregarDiaEspecial() {
    // ⚡ Aquí guardamos la lista de nuevos días
    this.nuevosDias = [];

    if (!this.fechaInicio) {
      alert('⚠️ Por favor selecciona una fecha válida.');
      return;
    }

    const nuevosDias: DiaEspecial[] = [];

    if (this.esRango && this.fechaFin) {
      const inicio = new Date(this.fechaInicio);
      const fin = new Date(this.fechaFin);

      if (inicio > fin) {
        alert('⚠️ La fecha de inicio no puede ser después de la fecha de fin.');
        return;
      }

      let actual = new Date(inicio);
      while (actual <= fin) {
        const fechaISO = actual.toISOString();
        nuevosDias.push({ fecha: fechaISO, tipo: this.seleccionTipo });
        this.nuevosDias.push(fechaISO);
        actual.setDate(actual.getDate() + 1);
      }
    } else {
      const fechaISO = new Date(this.fechaInicio).toISOString();
      nuevosDias.push({ fecha: fechaISO, tipo: this.seleccionTipo });
      this.nuevosDias.push(fechaISO);
    }

    const todosLosDias = [...this.diasEspeciales, ...nuevosDias];

    const payload = {
      trabajador: this.trabajadorId,
      anio: this.anioActual,
      diasEspeciales: todosLosDias
    };

    this.calendarioTrabajadorService.guardarCalendarioTrabajador(payload)
      .subscribe({
        next: () => {
          this.diasEspeciales = todosLosDias;
          this.generarDiasDelMes();
          alert('✅ Día(s) guardado(s) correctamente en MongoDB.');
        },
        error: (err) => {
          console.error('❌ Error al guardar día especial:', err);
          alert('❌ Error al guardar en la base de datos.');
        }
      });
  }

  // ✅ Función para saber si el día debe animarse
  esDiaNuevo(dia: Date | null): boolean {
    if (!dia) return false;
    const diaISO = dia.toISOString().split('T')[0];
    return this.nuevosDias.some(fecha => fecha.startsWith(diaISO));
  }

  cargarDiasEspecialesDesdeMongo() {
    this.calendarioTrabajadorService
      .obtenerCalendarioTrabajador(this.trabajadorId, this.anioActual)
      .subscribe({
        next: (res) => {
          this.diasEspeciales = res?.diasEspeciales || [];
          this.generarDiasDelMes(); // 🔄 vuelve a pintar con los días correctos
        },
        error: (err) => {
          console.error('❌ Error al cargar calendario del trabajador:', err);
        }
      });
  }

}
