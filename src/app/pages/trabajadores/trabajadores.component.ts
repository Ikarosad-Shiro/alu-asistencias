import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';

interface Trabajador {
  _id?: string;
  nombre: string;
  sede: number;
  sincronizado: boolean;
}

@Component({
  selector: 'app-trabajadores',
  templateUrl: './trabajadores.component.html',
  styleUrls: ['./trabajadores.component.css']
})
export class TrabajadoresComponent implements OnInit {

  displayedColumns: string[] = ['nombre', 'sede', 'sincronizado', 'acciones'];
  trabajadores: Trabajador[] = [];
  trabajadoresFiltrados: Trabajador[] = [];
  filtroNombre: string = '';
  filtroSede: string = '';
  sedeKeys: (string | number)[] = [];
  rolUsuario: string = '';

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
      sidebar.classList.toggle('active'); // 🔥 Abre/cierra el sidebar
      overlay.classList.toggle('active'); // 🔥 Muestra/oculta el fondo oscuro
    }
  }

  // 📌 Modales y mensajes personalizados
  mostrarModalContrasena: boolean = false;
  mostrarModalEliminar: boolean = false;
  mostrarModalMensaje: boolean = false;
  contrasena: string = '';
  nombreTrabajador: string = '';
  sedeTrabajador: string = '';
  trabajadorAEliminar: string = '';
  mensajeModal: string = '';
  tipoMensajeModal: 'exito' | 'error' | 'advertencia' = 'exito';

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
    private router: Router,
    private trabajadoresService: TrabajadoresService
  ) {}

  ngOnInit() {
    this.sedeKeys = Object.keys(this.sedeNombres).map(Number);
    this.obtenerTrabajadores();
    this.rolUsuario = localStorage.getItem('rol') || '';
  }

  mostrarMensaje(mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.mensajeModal = mensaje;
    this.tipoMensajeModal = tipo;
    this.mostrarModalMensaje = true;
  }

  cerrarModalMensaje() {
    this.mostrarModalMensaje = false;
  }

  obtenerTrabajadores() {
    this.trabajadoresService.obtenerTrabajadores().subscribe(
      (data) => {
        this.trabajadores = data;
        this.filtrarTrabajadores();
      },
      (error) => {
        console.error('Error al obtener trabajadores', error);
      }
    );
  }

  filtrarTrabajadores() {
    this.trabajadoresFiltrados = this.trabajadores.filter(trabajador => {
      const coincideNombre = this.filtroNombre
        ? trabajador.nombre.toLowerCase().includes(this.filtroNombre.toLowerCase())
        : true;
      const coincideSede = this.filtroSede
        ? trabajador.sede.toString() === this.filtroSede
        : true;
      return coincideNombre && coincideSede;
    });
  }

  abrirModalAgregar(nombre: string, sede: string) {
    if (!nombre || !sede) {
      this.mostrarMensaje('Debes ingresar un nombre y seleccionar una sede.', 'advertencia');
      return;
    }
    this.nombreTrabajador = nombre;
    this.sedeTrabajador = sede;
    this.mostrarModalContrasena = true;
  }

  cerrarModalContrasena() {
    this.mostrarModalContrasena = false;
    this.contrasena = '';
  }

  confirmarAgregarTrabajador() {
    if (!this.contrasena) {
      this.mostrarMensaje('Debes ingresar una contraseña.', 'advertencia');
      return;
    }

    this.trabajadoresService.verificarContraseña(this.contrasena).subscribe(
      (valido) => {
        if (valido) {
          this.agregarTrabajador(this.nombreTrabajador, this.sedeTrabajador);
          this.cerrarModalContrasena();
        } else {
          this.mostrarMensaje('⚠️ Contraseña incorrecta. Inténtalo de nuevo.', 'advertencia');
        }
      },
      (error) => {
        console.error('Error al verificar contraseña', error);
        this.mostrarMensaje('❌ Hubo un error al verificar la contraseña.', 'error');
      }
    );
  }

  agregarTrabajador(nombre: string, sede: string) {
    const sedeNumero = Number(sede);
    const nuevoTrabajador: Trabajador = { nombre, sede: sedeNumero, sincronizado: false };

    this.trabajadoresService.agregarTrabajador(nuevoTrabajador).subscribe(
      () => {
        this.mostrarMensaje('Trabajador agregado correctamente.', 'exito');
        this.obtenerTrabajadores();
      },
      (error) => {
        console.error('Error al agregar trabajador', error);
        this.mostrarMensaje('❌ Error al agregar trabajador.', 'error');
      }
    );
  }

  abrirModalEliminar(id: string) {
    this.trabajadorAEliminar = id;
    this.mostrarModalEliminar = true;
  }

  confirmarEliminarTrabajador() {
    if (!this.contrasena) {
      this.mostrarMensaje('Debes ingresar una contraseña.', 'advertencia');
      return;
    }

    this.trabajadoresService.verificarContraseña(this.contrasena).subscribe(
      (valido) => {
        if (valido) {
          this.trabajadoresService.eliminarTrabajador(this.trabajadorAEliminar).subscribe(
            () => {
              this.mostrarMensaje('Trabajador eliminado correctamente.', 'exito');
              this.cerrarModalEliminar();
              this.obtenerTrabajadores();
            },
            (error) => {
              console.error('Error al eliminar trabajador', error);
              this.mostrarMensaje('❌ Error al eliminar el trabajador.', 'error');
            }
          );
        } else {
          this.mostrarMensaje('⚠️ Contraseña incorrecta. Inténtalo de nuevo.', 'error');
        }
      },
      (error) => {
        console.error('Error al verificar contraseña', error);
        this.mostrarMensaje('❌ Hubo un error al verificar la contraseña.', 'error');
      }
    );
  }

  cerrarModalEliminar() {
    this.mostrarModalEliminar = false;
    this.contrasena = '';
  }

  verTrabajador(trabajadorId: string) {
    this.router.navigate(['/trabajadores', trabajadorId]);
  }

  actualizarTabla() {
    this.obtenerTrabajadores();
  }

  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
