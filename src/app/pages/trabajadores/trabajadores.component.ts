import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';

interface Trabajador {
  _id?: string;
  nombre: string;
  sede: number;
  sincronizado: boolean;
  estado?: 'activo' | 'inactivo'; // ← ❗️opcional
}

@Component({
  selector: 'app-trabajadores',
  templateUrl: './trabajadores.component.html',
  styleUrls: ['./trabajadores.component.css']
})
export class TrabajadoresComponent implements OnInit {
  trabajadores: Trabajador[] = [];
  trabajadoresFiltrados: Trabajador[] = [];
  sedes: { id: number, nombre: string }[] = [];

  filtroNombre: string = '';
  filtroSede: string = '';
  rolUsuario: string = '';

  // 📌 Modales
  mostrarModalContrasena: boolean = false;
  mostrarModalMensaje: boolean = false;
  contrasena: string = '';
  nombreTrabajador: string = '';
  sedeTrabajador: string = '';
  mensajeModal: string = '';
  tipoMensajeModal: 'exito' | 'error' | 'advertencia' = 'exito';

  estadoFiltro: string = 'todos'; // ✅ Aquí sí va

  constructor(
    private router: Router,
    private trabajadoresService: TrabajadoresService,
    private sedeService: SedeService
  ) {}

  ngOnInit() {
    this.obtenerSedes();
    this.obtenerTrabajadores();
    this.rolUsuario = localStorage.getItem('rol') || '';
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    }
  }

  obtenerSedes() {
    this.sedeService.obtenerSedes().subscribe({
      next: (res) => this.sedes = res,
      error: (err) => console.error('❌ Error al obtener sedes:', err)
    });
  }

  obtenerNombreSede(id: number): string {
    const sede = this.sedes.find(s => s.id === id);
    return sede ? sede.nombre : 'Desconocida';
  }

  obtenerTrabajadores() {
    this.trabajadoresService.obtenerTrabajadores().subscribe(
      (data: Trabajador[]) => {
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
        ? trabajador.sede === Number(this.filtroSede)
        : true;

      const coincideEstado = this.estadoFiltro === 'todos'
        ? true
        : trabajador.estado === this.estadoFiltro;

      return coincideNombre && coincideSede && coincideEstado;
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
    const nuevoTrabajador: Trabajador = { nombre, sede: sedeNumero, sincronizado: false, estado: 'activo' };

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

  cerrarModalMensaje() {
    this.mostrarModalMensaje = false;
  }

  mostrarMensaje(mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.mensajeModal = mensaje;
    this.tipoMensajeModal = tipo;
    this.mostrarModalMensaje = true;
  }
}
