import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';


@Component({
  selector: 'app-detalle-trabajador',
  templateUrl: './detalle-trabajador.component.html',
  styleUrls: ['./detalle-trabajador.component.css']

})
export class DetalleTrabajadorComponent implements OnInit {
  trabajador: any = {};               // Propiedad para los datos del trabajador
  trabajadorOriginal: any;
  editando: boolean = false;          // Modo edición
  rolUsuario: string = '';            // Rol del usuario
  sedeKeys: number[] = [];            // Lista de sedes
  modoEdicion: boolean = false;       // Modo edición activado o no
  activarEdicion() {
    this.modoEdicion = true;
  }
  cancelarEdicion() {
    this.modoEdicion = false;
    // Restauramos los datos originales
    this.trabajador = JSON.parse(JSON.stringify(this.trabajadorOriginal));
  }

  // Mapear IDs de sedes a nombres
  sedeNombres: { [key: number]: string } = {
    1: "Administración V.C",
    2: "Chalco",
    3: "Ixtapaluca",
    4: "Los Reyes",
    5: "Ecatepec",
    6: "Cedis",
    7: "Puebla",
    8: "Tlaxcala",
    9: "Atlixco",
    10: "Yautepec"
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trabajadoresService: TrabajadoresService
  ) {}

  ngOnInit(): void {
    this.sedeKeys = Object.keys(this.sedeNombres).map(Number);
    this.rolUsuario = localStorage.getItem('rol') || '';
    const trabajadorId = this.route.snapshot.paramMap.get('id');
    if (trabajadorId) {
        this.trabajadoresService.obtenerTrabajador(trabajadorId).subscribe(
            (data: any) => {
                this.trabajador = data;
                // 🟢 Obtener asistencias del trabajador
                this.trabajadoresService.obtenerAsistencias(trabajadorId).subscribe(
                    (asistencias: any[]) => {
                        this.trabajador.asistencias = asistencias;  // Guardar asistencias
                    },
                    (error: any) => console.error('❌ Error al obtener asistencias:', error)
                );
            },
            (error: any) => console.error('❌ Error al obtener trabajador:', error)
        );
    }
}


  // Cambiar a modo edición
  toggleEditar() {
    if (this.rolUsuario !== 'Revisor') {   // Solo si no es revisor
      this.modoEdicion = !this.modoEdicion;
    }
  }

  // Actualizar los datos del trabajador
  actualizarTrabajador() {
    if (this.rolUsuario === 'Revisor') {  // Si es revisor, no permite actualizar
      alert('No tienes permiso para editar esta información.');
      return;
    }
    const trabajadorId = this.trabajador._id || '';
    this.trabajadoresService.actualizarTrabajador(trabajadorId, this.trabajador).subscribe(
      (data: any) => {
        console.log('Trabajador actualizado:', data);
        this.trabajador = data;
        this.modoEdicion = false;
        this.mostrarMensaje('Trabajador actualizado correctamente.', 'exito');
      },
      (error: any) => {
        console.error('Error al actualizar el trabajador', error);
        this.mostrarMensaje('❌ Error al actualizar el trabajador.', 'error');
      }
    );
  }

  // Mostrar mensajes personalizados
  mostrarMensaje(mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    alert(mensaje);  // Puedes reemplazarlo con el modal personalizado si quieres
  }

  // Regresar a la lista de trabajadores
  regresar() {
    this.router.navigate(['/trabajadores']);
  }

  // Cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
