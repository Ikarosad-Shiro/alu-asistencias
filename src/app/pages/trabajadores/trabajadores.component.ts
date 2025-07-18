import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import Swal from 'sweetalert2';
import { ChangeDetectorRef } from '@angular/core';

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

  // Guardamos el estado anterior antes de cambiar
  valorOriginal: { [id: string]: string } = {};

  constructor(
    private router: Router,
    private trabajadoresService: TrabajadoresService,
    private sedeService: SedeService,
    private cdRef: ChangeDetectorRef // ← aquí
  ) {}

  ngOnInit() {
    this.rolUsuario = localStorage.getItem('rol') || '';
    if (!this.rolUsuario) {
      console.warn('⚠️ Rol de usuario no encontrado. Redirigiendo a login...');
      this.router.navigate(['/login']);
      return;
    }
    this.obtenerSedes();
    this.obtenerTrabajadores();
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

  guardarValorOriginal(trabajador: any) {
    this.valorOriginal[trabajador._id] = trabajador.sincronizado ? 'Sincronizado' : 'Pendiente';
  }

  cambiarSincronizacion(trabajador: any, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const nuevoEstado = selectElement.value;
    const sincronizadoNuevo = nuevoEstado === 'Sincronizado';

    const advertencia = sincronizadoNuevo
      ? '⚠️ Al marcarlo como "Sincronizado", el sistema del checador lo ignorará y no lo registrará automáticamente.'
      : '⚠️ Si lo marcas como "Pendiente", se eliminará la huella del checador en la siguiente sincronización automática.';

    Swal.fire({
      title: '¿Estás seguro?',
      text: advertencia,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then((res: any) => {
      if (!res.isConfirmed) {
        // ❌ Restaurar valor anterior visualmente
        selectElement.value = this.valorOriginal[trabajador._id];
        return;
      }

      Swal.fire({
        title: '🔒 Ingresa tu contraseña',
        input: 'password',
        inputPlaceholder: 'Contraseña',
        inputAttributes: {
          autocapitalize: 'off',
          autocorrect: 'off'
        },
        showCancelButton: true,
        confirmButtonText: 'Confirmar'
      }).then((confirmacion: any) => {
        if (confirmacion.isConfirmed && confirmacion.value) {
          const contraseña = confirmacion.value;

          this.trabajadoresService.verificarContraseña(contraseña).subscribe(valido => {
            if (valido) {
              this.trabajadoresService.actualizarSincronizacion(trabajador._id!, sincronizadoNuevo).subscribe(
                () => {
                  trabajador.sincronizado = sincronizadoNuevo;
                  Swal.fire('✅ Éxito', 'Estado de sincronización actualizado.', 'success');
                },
                err => {
                  console.error('Error al actualizar sincronización', err);
                  Swal.fire('❌ Error', 'No se pudo actualizar el estado.', 'error');
                }
              );
            } else {
              Swal.fire('❌ Contraseña incorrecta', 'La contraseña no es válida.', 'error');
            }
          });
        } else {
          // ❌ Cancelado al ingresar contraseña
          selectElement.value = this.valorOriginal[trabajador._id];
        }
      });
    });
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
