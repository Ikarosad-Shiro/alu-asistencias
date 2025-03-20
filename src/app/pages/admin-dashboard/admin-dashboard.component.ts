import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SweetAlertResult } from 'sweetalert2';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  usuarios: any[] = [];

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  // Cargar la lista de usuarios desde el backend
  cargarUsuarios() {
    this.userService.obtenerUsuarios().subscribe(
      (data) => {
        console.log("🔄 Usuarios actualizados desde el backend:", data);
        this.usuarios = data;
      },
      (error) => {
        console.error('❌ Error al obtener usuarios:', error);
        Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error');
      }
    );
  }

  // Obtener el rol del usuario autenticado desde el token
  getUserRole(): string | null {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])); // Decodificar el token
        return payload.rol || null;
      } catch (error) {
        console.error('❌ Error al obtener el rol del usuario:', error);
        return null;
      }
    }
    return null;
  }

// 📌 Cambiar el rol de un usuario con restricciones y contraseña
cambiarRol(usuario: any, event: Event) {
  const userRole = this.getUserRole();
  const nuevoRol = (event.target as HTMLSelectElement).value;
  const rolActual = usuario.rol;

  if (rolActual === nuevoRol) {
    Swal.fire('ℹ️ Sin cambios', `El usuario ya tiene el rol ${nuevoRol}.`, 'info');
    return;
  }

  // 🔴 Aplicar restricciones según el rol del usuario autenticado
  if (userRole === 'Administrador') {
    if (rolActual === 'Administrador' || nuevoRol === 'Dios') {
      Swal.fire('🚫 Acción no permitida', 'No puedes cambiar el rol de otro Administrador ni ascender a alguien a Dios.', 'error');
      return;
    }
  } else if (userRole === 'Revisor') {
    Swal.fire('🚫 Acción no permitida', 'No tienes permisos para cambiar roles.', 'error');
    return;
  }

  // 🔒 Pedir contraseña antes de aplicar cambios
  Swal.fire({
    title: '🔒 Ingresa tu contraseña para confirmar el cambio de rol',
    input: 'password',
    inputPlaceholder: 'Contraseña',
    inputAttributes: { autocapitalize: 'off', type: 'password' },
    showCancelButton: true,
    confirmButtonText: 'Confirmar',
    cancelButtonText: 'Cancelar',
  }).then((result: SweetAlertResult<string>) => {
    if (result.isConfirmed && result.value) {
      const contraseña = result.value;

      // 📌 **Asegurar que enviamos correctamente el rol y la contraseña**
      const datos = { rol: nuevoRol, contraseña };

      console.log("📤 Enviando solicitud PUT con:", datos); // 👀 DEBUG

      this.userService.actualizarUsuario(usuario._id, datos).subscribe(
        () => {
          Swal.fire('✅ Rol actualizado', `El usuario ahora es ${nuevoRol}`, 'success');
          this.cargarUsuarios();
        },
        (error) => {
          Swal.fire('❌ Error', error.error?.message || 'No se pudo actualizar el rol.', 'error');
        }
      );
    } else {
      usuario.rol = rolActual; // Restaurar el rol si se cancela
    }
  });
}

  // 📌 Confirmar activar/desactivar usuario con restricciones y contraseña
  confirmarDesactivar(usuario: any) {
    const userRole = this.getUserRole();

    if (usuario.rol === 'Dios') {
      Swal.fire('🚫 Acción no permitida', 'No puedes desactivar al usuario "Dios".', 'error');
      return;
    }

    if (userRole === 'Administrador' && usuario.rol === 'Administrador') {
      Swal.fire('🚫 Acción no permitida', 'No puedes desactivar a otro Administrador.', 'error');
      return;
    }

    // 🔒 Solicitar contraseña antes de activar/desactivar
    Swal.fire({
      title: '🔒 Ingresa tu contraseña',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: { autocapitalize: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result: SweetAlertResult<string>) => {
      if (result.isConfirmed && result.value) {
        const contraseña = result.value;

        const nuevoEstado = !usuario.activo;
        const datos = { activo: nuevoEstado, contraseña };

        this.userService.actualizarUsuario(usuario._id, datos).subscribe(
          () => {
            Swal.fire('✅ Estado cambiado', `El usuario está ahora ${nuevoEstado ? 'Activo' : 'Inactivo'}`, 'success');
            this.cargarUsuarios();
          },
          (error) => {
            Swal.fire('❌ Error', error.error?.message || 'No se pudo cambiar el estado.', 'error');
          }
        );
      }
    });
  }

  // 📌 Confirmar eliminación de usuario con contraseña
  confirmarEliminar(usuario: any) {
    if (usuario.rol === 'Dios') {
      Swal.fire('🚫 Acción no permitida', 'No puedes eliminar al usuario "Dios".', 'error');
      return;
    }

    Swal.fire({
      title: '🔒 Ingresa tu contraseña para confirmar la eliminación',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: { autocapitalize: 'off', type: 'password' },
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result: SweetAlertResult<string>) => {
      if (result.isConfirmed && result.value) {
        const contraseña = result.value;

        this.userService.verificarContraseña(contraseña).subscribe(
          (response) => {
            if (response?.valido) {
              const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
              if (usuarioActual.rol === 'Administrador' && usuario.rol === 'Administrador') {
                Swal.fire('🚫 Acción no permitida', 'No puedes eliminar a otro Administrador.', 'error');
                return;
              }

              this.eliminarUsuario(usuario._id, contraseña);
            } else {
              Swal.fire('❌ Contraseña incorrecta', 'No puedes realizar esta acción.', 'error');
            }
          },
          (error) => {
            Swal.fire('⚠️ Error', 'No se pudo verificar la contraseña.', 'error');
          }
        );
      }
    });
  }

  // 📌 Eliminar un usuario
  eliminarUsuario(userId: string, contraseña: string) {
    this.userService.eliminarUsuario(userId, contraseña).subscribe(
      () => {
        Swal.fire('✅ Usuario eliminado', 'El usuario ha sido eliminado correctamente.', 'success');
        this.cargarUsuarios();
      },
      (error) => {
        Swal.fire('⚠️ Error', error.error?.message || 'Hubo un problema al eliminar el usuario.', 'error');
      }
    );
  }

  // 📌 Cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
