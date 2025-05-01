import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import Swal from 'sweetalert2';

export interface DiaEspecialData {
  fecha: string;
  tipo: string;
  horaEntrada?: string;
  horaSalida?: string;
}

@Component({
  selector: 'app-modal-dia-especial',
  templateUrl: './modal-dia-especial.component.html',
  styleUrls: ['./modal-dia-especial.component.css']
})
export class ModalDiaEspecialComponent {
  tiposDisponibles = [
    'Permiso',
    'Vacaciones',
    'Vacaciones Pagadas',
    'Falta',
    'Incapacidad',
    'Permiso con Goce de Sueldo',
    'Asistencia'
  ];

  constructor(
    public dialogRef: MatDialogRef<ModalDiaEspecialComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DiaEspecialData
  ) {}

  cancelar(): void {
    this.dialogRef.close();
  }

  guardar(): void {
    this.dialogRef.close({ accion: 'guardar', data: this.data });
  }

  eliminar(): void {
    Swal.fire({
      title: '¿Eliminar este día?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.dialogRef.close({ accion: 'eliminar', data: this.data });
      }
    });
  }
}
