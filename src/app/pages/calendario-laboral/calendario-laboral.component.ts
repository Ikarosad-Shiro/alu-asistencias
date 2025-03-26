import { Component, OnInit } from '@angular/core';
import { CalendarioService } from 'src/app/services/calendario.service';

@Component({
  selector: 'app-calendario-laboral',
  templateUrl: './calendario-laboral.component.html',
})
export class CalendarioLaboralComponent implements OnInit {
  sedes = [
    { id: 1, nombre: 'Administración V.C' },
    { id: 2, nombre: 'Chalco' },
    { id: 3, nombre: 'Ixtapaluca' },
    { id: 4, nombre: 'Los Reyes' },
    { id: 5, nombre: 'Ecatepec' },
    { id: 6, nombre: 'Cedis' },
    { id: 7, nombre: 'Puebla' },
    { id: 8, nombre: 'Tlaxcala' },
    { id: 9, nombre: 'Atlixco' },
    { id: 10, nombre: 'Yautepec' }
  ];

  sedeSeleccionada: number | null = null;
  anioSeleccionado: number = new Date().getFullYear();
  diasEspeciales: any[] = [];
  columnas: string[] = ['fecha', 'tipo', 'descripcion'];

  constructor(private calendarioService: CalendarioService) {}

  ngOnInit(): void {}

  consultarCalendario(): void {
    if (!this.sedeSeleccionada || !this.anioSeleccionado) return;

    this.calendarioService.obtenerPorSedeYAnio(this.sedeSeleccionada, this.anioSeleccionado)
      .subscribe({
        next: (res: any) => {
          this.diasEspeciales = res.diasEspeciales || [];
        },
        error: (err: any) => {
          console.error('Error al obtener calendario:', err);
          this.diasEspeciales = [];
        }
      });
  }
}
