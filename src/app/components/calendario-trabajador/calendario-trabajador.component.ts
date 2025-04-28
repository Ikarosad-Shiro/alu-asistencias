import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CalendarioTrabajadorService } from 'src/app/services/calendario-trabajador.service';

interface DiaEspecial {
  fecha: Date | string;
  tipo: string;
  removiendo?: boolean; // 🔥 Para animar al eliminar
}

@Component({
  selector: 'app-calendario-trabajador',
  templateUrl: './calendario-trabajador.component.html',
  styleUrls: ['./calendario-trabajador.component.css']
})
export class CalendarioTrabajadorComponent implements OnInit {
  @Input() trabajador: any = {}; // Recibimos el trabajador completo
  @Output() eventoGuardado = new EventEmitter<any>();
  @Output() eventoEliminado = new EventEmitter<any>();

  diasEspeciales: DiaEspecial[] = [];
  anioActual: number = new Date().getFullYear();
  mensajeTemporal: string = '';
  mostrarMensaje: boolean = false;

  constructor(private calendarioTrabajadorService: CalendarioTrabajadorService) {}

  ngOnInit(): void {
    if (this.trabajador && this.trabajador._id) {
      this.cargarCalendario();
    }
  }

  cargarCalendario() {
    this.calendarioTrabajadorService.obtenerCalendarioTrabajador(this.trabajador._id, this.anioActual).subscribe(
      (data: any) => {
        if (data && data.diasEspeciales) {
          this.diasEspeciales = data.diasEspeciales.map((dia: any) => ({
            fecha: new Date(dia.fecha),
            tipo: dia.tipo,
            removiendo: false
          }));
        } else {
          this.diasEspeciales = [];
        }
      },
      (error: any) => {
        console.error('❌ Error al cargar calendario del trabajador:', error.message || error);
        this.diasEspeciales = [];
      }
    );
  }

  agregarDiaEspecial(tipo: string, fecha: Date | null) {
    if (!fecha) {
      alert('⚠️ Por favor selecciona una fecha válida.');
      return;
    }

    const nuevoDia: DiaEspecial = {
      tipo,
      fecha: fecha.toISOString(),
      removiendo: false
    };

    this.diasEspeciales.push(nuevoDia);
    this.guardarCambios();
    this.eventoGuardado.emit(nuevoDia);
  }

  eliminarDia(index: number) {
    if (index < 0 || index >= this.diasEspeciales.length) return;

    this.diasEspeciales[index].removiendo = true;

    setTimeout(() => {
      const eliminado = this.diasEspeciales.splice(index, 1)[0];

      this.calendarioTrabajadorService.eliminarDiaEspecial(this.trabajador._id, this.anioActual, this.diasEspeciales).subscribe(
        (data: any) => {
          console.log('✅ Día eliminado correctamente');
          this.mostrarMensajeTemporal('🗑️ Día eliminado correctamente.');
          this.eventoEliminado.emit(eliminado);
        },
        (error: any) => {
          console.error('❌ Error al eliminar día:', error.message || error);
        }
      );

    }, 300); // Tiempo para que termine la animación
  }

  guardarCambios() {
    const payload = {
      trabajador: this.trabajador._id,
      anio: this.anioActual,
      diasEspeciales: this.diasEspeciales.map(dia => ({
        fecha: typeof dia.fecha === 'string' ? dia.fecha : dia.fecha.toISOString(),
        tipo: dia.tipo
      }))
    };

    this.calendarioTrabajadorService.guardarCalendarioTrabajador(payload).subscribe(
      (data: any) => {
        console.log('✅ Cambios guardados correctamente');
        this.mostrarMensajeTemporal('✅ Día guardado exitosamente.');
      },
      (error: any) => {
        console.error('❌ Error al guardar cambios:', error.message || error);
      }
    );
  }

  mostrarMensajeTemporal(texto: string) {
    this.mensajeTemporal = texto;
    this.mostrarMensaje = true;

    setTimeout(() => {
      this.mostrarMensaje = false;
    }, 2500); // 2.5 segundos
  }


}
