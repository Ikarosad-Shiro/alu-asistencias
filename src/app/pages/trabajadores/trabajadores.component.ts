import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrabajadoresService, TrabajadorUI } from 'src/app/services/trabajadores.service';
import { SedeService } from 'src/app/services/sede.service';
import Swal from 'sweetalert2';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-trabajadores',
  templateUrl: './trabajadores.component.html',
  styleUrls: ['./trabajadores.component.css']
})
export class TrabajadoresComponent implements OnInit {
  // 🔄 Ahora usamos el tipo del service
  trabajadores: TrabajadorUI[] = [];
  trabajadoresFiltrados: TrabajadorUI[] = [];
  sedes: { id: number, nombre: string }[] = [];

  filtroNombre = '';
  filtroSede = '';
  rolUsuario = '';

  // 📌 Formulario (sin apellido)
  formAdd: {
    nombre: string;               // nombre completo
    sedePrincipal: number | null;
    esForaneo: boolean;
    sedesForaneas: number[];
    nuevoIngreso: boolean;
    fechaAlta: string | null;
    correo?: string;
    telefono?: string;
    telefonoEmergencia?: string;
    direccion?: string;
    puesto?: string;
  } = {
    nombre: '',
    sedePrincipal: null,
    esForaneo: false,
    sedesForaneas: [],
    nuevoIngreso: false,
    fechaAlta: null,
    correo: '',
    telefono: '',
    telefonoEmergencia: '',
    direccion: '',
    puesto: ''
  };

  errorForm = '';

  // 📌 Modales
  mostrarModalContrasena = false;
  mostrarModalMensaje = false;
  contrasena = '';
  mensajeModal = '';
  tipoMensajeModal: 'exito' | 'error' | 'advertencia' = 'exito';

  estadoFiltro: string = 'todos';
  valorOriginal: { [id: string]: string } = {};

  // Selector de foráneas (sin límite)
  showSelectorForaneas = false;
  searchForanea = '';
  filteredSedesForaneas: { id: number, nombre: string }[] = [];
  maxForaneas = Number.POSITIVE_INFINITY;
  maxForaneasLabel = '∞';

  constructor(
    private router: Router,
    private trabajadoresService: TrabajadoresService,
    private sedeService: SedeService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.rolUsuario = localStorage.getItem('rol') || '';
    if (!this.rolUsuario) {
      this.router.navigate(['/login']);
      return;
    }
    this.obtenerSedes();
    this.obtenerTrabajadores();
  }

  // =========================
  // Sidebar (móviles)
  // =========================
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    }
  }

  // =========================
  // Cargas iniciales
  // =========================
  obtenerSedes() {
    this.sedeService.obtenerSedes().subscribe({
      next: (res) => { this.sedes = res; this.applyFilterForaneas(); },
      error: (err) => console.error('❌ Error al obtener sedes:', err)
    });
  }

  obtenerTrabajadores() {
    this.trabajadoresService.obtenerTrabajadores().subscribe({
      next: (data) => {
        this.trabajadores = data;          // data: TrabajadorUI[]
        this.filtrarTrabajadores();
      },
      error: (error) => console.error('Error al obtener trabajadores', error)
    });
  }

  // =========================
  // Helpers UI
  // =========================
  obtenerNombreSede(id: number | null): string {
    if (id == null) return '—';
    const sede = this.sedes.find(s => s.id === id);
    return sede ? sede.nombre : 'Desconocida';
  }

  filtrarTrabajadores() {
    this.trabajadoresFiltrados = this.trabajadores.filter(trabajador => {
      const coincideNombre = this.filtroNombre
        ? (trabajador.nombre || '').toLowerCase().includes(this.filtroNombre.toLowerCase())
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

  // =========================
  // Formulario (alta)
  // =========================
  onPrincipalChange() {
    if (this.formAdd.sedePrincipal != null) {
      this.formAdd.sedesForaneas = this.formAdd.sedesForaneas.filter(
        id => id !== this.formAdd.sedePrincipal
      );
    }
  }

  onToggleForaneo() {
    if (!this.formAdd.esForaneo) this.formAdd.sedesForaneas = [];
  }

  onForaneasChange() {
    const principal = this.formAdd.sedePrincipal;
    const set = new Set(this.formAdd.sedesForaneas.filter(id => id !== principal));
    this.formAdd.sedesForaneas = Array.from(set);
  }

  onNuevoIngresoChange() {
    if (this.formAdd.nuevoIngreso && !this.formAdd.fechaAlta) {
      this.formAdd.fechaAlta = new Date().toISOString().split('T')[0];
    }
  }

  removerForanea(id: number) {
    this.formAdd.sedesForaneas = this.formAdd.sedesForaneas.filter(x => +x !== +id);
  }

  private validarFormularioAlta(): string | null {
    if (!this.formAdd.nombre || this.formAdd.nombre.trim().length < 2) {
      return 'El nombre es obligatorio.';
    }
    if (this.formAdd.sedePrincipal == null) {
      return 'Debes seleccionar una sede principal.';
    }
    if (this.formAdd.esForaneo && this.formAdd.sedesForaneas.includes(this.formAdd.sedePrincipal)) {
      return 'La sede principal no puede estar en las foráneas.';
    }
    if (this.formAdd.nuevoIngreso && !this.formAdd.fechaAlta) {
      return 'Debes seleccionar la fecha de alta.';
    }
    return null;
  }

  resetFormAdd() {
    this.formAdd = {
      nombre: '',
      sedePrincipal: null,
      esForaneo: false,
      sedesForaneas: [],
      nuevoIngreso: false,
      fechaAlta: null,
      correo: '',
      telefono: '',
      telefonoEmergencia: '',
      direccion: '',
      puesto: ''
    };
    this.errorForm = '';
  }

  abrirModalAgregar() {
    const error = this.validarFormularioAlta();
    if (error) { this.errorForm = error; this.mostrarMensaje(error, 'advertencia'); return; }
    this.errorForm = '';

    const principalNombre = this.obtenerNombreSede(this.formAdd.sedePrincipal!);
    const foraneasNombres = (this.formAdd.esForaneo && this.formAdd.sedesForaneas.length)
      ? this.formAdd.sedesForaneas.map(id => this.obtenerNombreSede(+id)).join(', ')
      : 'Ninguna';

    Swal.fire({
      title: 'Confirmar alta',
      html: `
        <div style="text-align:left">
          <b>Nombre:</b> ${this.formAdd.nombre}<br>
          <b>Sede principal:</b> ${principalNombre}<br>
          <b>Foráneas:</b> ${foraneasNombres}<br>
          <b>Nuevo ingreso:</b> ${this.formAdd.nuevoIngreso ? 'Sí' : 'No'}
          ${this.formAdd.nuevoIngreso && this.formAdd.fechaAlta ? ` (${this.formAdd.fechaAlta})` : ''}<br>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Continuar'
    }).then(res => { if (res.isConfirmed) this.mostrarModalContrasena = true; });
  }

  cerrarModalContrasena() {
    this.mostrarModalContrasena = false;
    this.contrasena = '';
  }

  confirmarAgregarTrabajador() {
    if (!this.contrasena) { this.mostrarMensaje('Debes ingresar una contraseña.', 'advertencia'); return; }

    this.trabajadoresService.verificarContraseña(this.contrasena).subscribe({
      next: (valido) => {
        if (valido) { this.agregarTrabajador(); this.cerrarModalContrasena(); }
        else this.mostrarMensaje('⚠️ Contraseña incorrecta. Inténtalo de nuevo.', 'advertencia');
      },
      error: () => this.mostrarMensaje('❌ Hubo un error al verificar la contraseña.', 'error')
    });
  }

  agregarTrabajador() {
    const sedePrincipal = this.formAdd.sedePrincipal!;
    const sedesForaneas = this.formAdd.esForaneo ? this.formAdd.sedesForaneas : [];

    // Mandamos payload en formato UI; el service lo normaliza a API
    const payload: Partial<TrabajadorUI> = {
      nombre: this.formAdd.nombre,
      sede: sedePrincipal,               // compat con back actual
      sedePrincipal,
      sedesForaneas,
      nuevoIngreso: !!this.formAdd.nuevoIngreso,
      fechaAlta: this.formAdd.nuevoIngreso ? this.formAdd.fechaAlta : null,
      estado: 'activo',
      sincronizado: false,
      correo: this.formAdd.correo || undefined,
      telefono: this.formAdd.telefono || undefined,
      telefonoEmergencia: this.formAdd.telefonoEmergencia || undefined,
      direccion: this.formAdd.direccion || undefined,
      puesto: this.formAdd.puesto || undefined
    };

    this.trabajadoresService.agregarTrabajador(payload).subscribe({
      next: () => { this.mostrarMensaje('Trabajador agregado correctamente.', 'exito'); this.obtenerTrabajadores(); this.resetFormAdd(); },
      error: () => this.mostrarMensaje('❌ Error al agregar trabajador.', 'error')
    });
  }

  // =========================
  // Selector de foráneas (panel)
  // =========================
  openSelectorForaneas() { this.applyFilterForaneas(); this.showSelectorForaneas = true; }
  closeSelectorForaneas() { this.showSelectorForaneas = false; this.searchForanea = ''; this.applyFilterForaneas(); }
  applyFilterForaneas() {
    const q = (this.searchForanea || '').toLowerCase();
    this.filteredSedesForaneas = this.sedes
      .filter(s => s.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  isForaneaSelected(id: number) { return this.formAdd.sedesForaneas.includes(id); }
  toggleForanea(id: number, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    if (id === this.formAdd.sedePrincipal) return;
    if (checked) {
      if (!this.formAdd.sedesForaneas.includes(id)) this.formAdd.sedesForaneas.push(id);
    } else {
      this.formAdd.sedesForaneas = this.formAdd.sedesForaneas.filter(x => x !== id);
    }
  }
  selectAllFiltered() {
    for (const s of this.filteredSedesForaneas) {
      if (s.id !== this.formAdd.sedePrincipal && !this.formAdd.sedesForaneas.includes(s.id)) {
        this.formAdd.sedesForaneas.push(s.id);
      }
    }
  }
  clearAllForaneas() { this.formAdd.sedesForaneas = []; }

  // =========================
  // Tabla: acciones
  // =========================
  verTrabajador(trabajadorId: string) { this.router.navigate(['/trabajadores', trabajadorId]); }

  guardarValorOriginal(trabajador: TrabajadorUI) {
    if (!trabajador?._id) return;
    this.valorOriginal[trabajador._id] = trabajador.sincronizado ? 'Sincronizado' : 'Pendiente';
  }

  cambiarSincronizacion(trabajador: TrabajadorUI, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const sincronizadoNuevo = selectElement.value === 'Sincronizado';

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
        if (trabajador._id) selectElement.value = this.valorOriginal[trabajador._id];
        return;
      }

      Swal.fire({
        title: '🔒 Ingresa tu contraseña',
        input: 'password',
        inputPlaceholder: 'Contraseña',
        inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Confirmar'
      }).then((confirmacion: any) => {
        if (confirmacion.isConfirmed && confirmacion.value) {
          this.trabajadoresService.verificarContraseña(confirmacion.value).subscribe(valido => {
            if (valido) {
              this.trabajadoresService.actualizarSincronizacion(trabajador._id!, sincronizadoNuevo).subscribe(
                () => {
                  trabajador.sincronizado = sincronizadoNuevo;
                  Swal.fire('✅ Éxito', 'Estado de sincronización actualizado.', 'success');
                },
                () => Swal.fire('❌ Error', 'No se pudo actualizar el estado.', 'error')
              );
            } else {
              Swal.fire('❌ Contraseña incorrecta', 'La contraseña no es válida.', 'error');
            }
          });
        } else {
          if (trabajador._id) selectElement.value = this.valorOriginal[trabajador._id];
        }
      });
    });
  }

  actualizarTabla() { this.obtenerTrabajadores(); }

  // =========================
  // Sesión y modales de mensaje
  // =========================
  cerrarSesion() { localStorage.clear(); this.router.navigate(['/login']); }
  cerrarModalMensaje() { this.mostrarModalMensaje = false; }
  mostrarMensaje(mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.mensajeModal = mensaje; this.tipoMensajeModal = tipo; this.mostrarModalMensaje = true;
  }
}
