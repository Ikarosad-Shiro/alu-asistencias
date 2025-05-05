import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CalendarioTrabajadorService } from 'src/app/services/calendario-trabajador.service';
import { MatDialog } from '@angular/material/dialog';
import { ModalDiaEspecialComponent } from '../modal-dia-especial/modal-dia-especial.component';
import Swal from 'sweetalert2';

interface DiaEspecial {
  fecha: string;
  tipo: string;
  horaEntrada?: string;
  horaSalida?: string;
}

@Component({
  selector: 'app-calendario-trabajador-visual',
  templateUrl: './calendario-trabajador-visual.component.html',
  styleUrls: ['./calendario-trabajador-visual.component.css']
})
export class CalendarioTrabajadorVisualComponent implements OnInit {
  @Input() trabajadorId!: string; // 🔥 Necesario para saber de qué trabajador guardar
  @Input() diasEspeciales: DiaEspecial[] = [];
  @Input() rolUsuario: string = 'Revisor'; // 👀 Por defecto como Revisor para prevenir errores
  @Output() eventosActualizados = new EventEmitter<DiaEspecial[]>();

  anioActual: number = new Date().getFullYear();
  mesActual: number = new Date().getMonth();
  diasDelMes: (Date | null)[] = [];

  seleccionTipo: string = 'Permiso';
  esRango: boolean = false;
  fechaInicio!: string;
  fechaFin!: string;

  nuevosDias: string[] = [];
  horaEntrada: string = '';
  horaSalida: string = '';


  constructor(
    private calendarioTrabajadorService: CalendarioTrabajadorService,
    private dialog: MatDialog
  ) {}

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
    if (this.rolUsuario === 'Revisor') {
      Swal.fire({
        icon: 'info',
        title: 'Acción no permitida',
        text: 'No tienes permiso para agregar días. Solo puedes visualizar el calendario.',
        confirmButtonColor: '#6a1275'
      });
      return;
    }

    if (!this.fechaInicio) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha no válida',
        text: 'Por favor selecciona una fecha válida.',
        confirmButtonColor: '#f0ad4e'
      });
      return;
    }

    const nuevosDias: DiaEspecial[] = [];

    if (this.esRango) {
      if (!this.fechaFin) {
        Swal.fire({
          icon: 'warning',
          title: 'Rango incompleto',
          text: 'Selecciona una fecha de fin para el rango.',
          confirmButtonColor: '#f0ad4e'
        });
        return;
      }

      if (this.seleccionTipo === 'Asistencia') {
        Swal.fire({
          icon: 'warning',
          title: 'No permitido',
          text: 'La asistencia no puede aplicarse como rango. Usa días individuales.',
          confirmButtonColor: '#f0ad4e'
        });
        return;
      }

      const inicio = new Date(this.fechaInicio);
      const fin = new Date(this.fechaFin);

      for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        const fechaISO = new Date(d).toISOString().split('T')[0];
        const yaExiste = this.diasEspeciales.some(e => e.fecha.startsWith(fechaISO));
        if (yaExiste) {
          Swal.fire({
            icon: 'error',
            title: 'Día duplicado',
            text: `Ya existe un evento especial el ${fechaISO}. Por favor edítalo o elimínalo primero.`,
            confirmButtonColor: '#d33'
          });
          return;
        }

        nuevosDias.push({
          fecha: new Date(fechaISO).toISOString(),
          tipo: this.seleccionTipo
        });
      }

    } else {
      const fechaISO = new Date(this.fechaInicio).toISOString().split('T')[0];

      const yaExiste = this.diasEspeciales.some(e => e.fecha.startsWith(fechaISO));
      if (yaExiste) {
        Swal.fire({
          icon: 'error',
          title: 'Día duplicado',
          text: 'Ya existe un evento especial en esta fecha. Por favor edita o elimina el existente.',
          confirmButtonColor: '#d33'
        });
        return;
      }

      const nuevoDia: DiaEspecial = {
        fecha: new Date(this.fechaInicio).toISOString(),
        tipo: this.seleccionTipo
      };

      if (this.seleccionTipo === 'Asistencia') {
        if (!this.horaEntrada || !this.horaSalida) {
          Swal.fire({
            icon: 'warning',
            title: 'Faltan horarios',
            text: 'Por favor ingresa hora de entrada y salida.',
            confirmButtonColor: '#f0ad4e'
          });
          return;
        }
        nuevoDia.horaEntrada = this.horaEntrada;
        nuevoDia.horaSalida = this.horaSalida;
      }

      nuevosDias.push(nuevoDia);
    }

    const todosLosDias = [...this.diasEspeciales, ...nuevosDias];

    const payload = {
      trabajador: this.trabajadorId,
      anio: this.anioActual,
      diasEspeciales: todosLosDias
    };

    this.calendarioTrabajadorService.guardarCalendarioTrabajador(payload).subscribe({
      next: () => {
        this.diasEspeciales = todosLosDias;
        this.eventosActualizados.emit(this.diasEspeciales); // ✅ Emitimos los nuevos eventos
        this.generarDiasDelMes();
        this.horaEntrada = '';
        this.horaSalida = '';
        this.fechaInicio = '';
        this.fechaFin = '';
        Swal.fire({
          icon: 'success',
          title: '¡Día(s) guardado(s)!',
          text: 'Los días se han registrado correctamente.',
          confirmButtonColor: '#6a1275'
        });
      },
      error: (err) => {
        console.error('❌ Error al guardar día(s):', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar',
          text: 'Ocurrió un problema al guardar. Intenta de nuevo.',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

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

  getTooltip(dia: Date | null): string {
    if (!dia) return '';
    const diaISO = dia.toISOString().split('T')[0];
    const evento = this.diasEspeciales.find(e => e.fecha.startsWith(diaISO));
    if (!evento) return '';

    if (evento.tipo === 'Asistencia' && evento.horaEntrada && evento.horaSalida) {
      return `Asistencia: ${evento.horaEntrada} - ${evento.horaSalida}`;
    }

    return evento.tipo;
  }

  abrirModalEditar(dia: Date) {
    if (this.rolUsuario === 'Revisor') return;

    const evento = this.esDiaEspecial(dia);
    if (!evento) return;

    const dialogRef = this.dialog.open(ModalDiaEspecialComponent, {
      width: '400px',
      data: {
        fecha: evento.fecha,
        tipo: evento.tipo,
        horaEntrada: evento.horaEntrada || '',
        horaSalida: evento.horaSalida || ''
      }
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      const diaISO = new Date(evento.fecha).toISOString().split('T')[0];

      if (resultado.accion === 'eliminar') {
        this.diasEspeciales = this.diasEspeciales.filter(d => !d.fecha.startsWith(diaISO));
      }

      if (resultado.accion === 'guardar') {
        const index = this.diasEspeciales.findIndex(d => d.fecha.startsWith(diaISO));
        if (index !== -1) {
          this.diasEspeciales[index] = resultado.data;
        }
      }

      const payload = {
        trabajador: this.trabajadorId,
        anio: this.anioActual,
        diasEspeciales: this.diasEspeciales
      };

      this.calendarioTrabajadorService.guardarCalendarioTrabajador(payload).subscribe({
        next: () => {
          this.generarDiasDelMes();
          this.eventosActualizados.emit(this.diasEspeciales); // ✅ Emitimos también al editar/eliminar
        },
        error: (err) => {
          console.error('❌ Error al actualizar desde el modal:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el calendario.',
            confirmButtonColor: '#d33'
          });
        }
      });
    });
  }

}
