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

  // Cargar la lista de usuarios
  cargarUsuarios() {
    this.userService.obtenerUsuarios().subscribe(
      (data) => {
        console.log("🔄 Usuarios actualizados desde el backend:", data); // 👈 Agrega esto
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

// 📌 Cambiar el rol de un usuario
cambiarRol(usuario: any) {
  const userRole = this.getUserRole();

  // 🚫 Restricciones de seguridad
  if (usuario.rol === 'Dios') {
    Swal.fire('🚫 Acción no permitida', 'No puedes cambiar el rol de "Dios".', 'error');
    return;
  }

  if (userRole === 'Administrador' && usuario.rol === 'Administrador') {
    Swal.fire('🚫 Acción no permitida', 'No puedes cambiar el rol de otro Administrador.', 'error');
    return;
  }

  if (userRole === 'Revisor') {
    Swal.fire('🚫 Acción no permitida', 'No tienes permisos para cambiar roles.', 'error');
    return;
  }

  // 🔥 **Forzar la asignación del nuevo rol**
  let nuevoRol = usuario.rol === 'Revisor' ? 'Administrador' : 'Revisor';

  // 🚀 **FORZAR EL CAMBIO ANTES DE ENVIAR**
  usuario.rol = nuevoRol;

  // 📌 **Depuración: Verificar valores antes de enviar**
  console.log("🎯 Valor actual de usuario.rol:", usuario.rol);
  console.log("🎯 Nuevo rol calculado antes de enviar:", nuevoRol);

  // 🔒 **Confirmación con contraseña**
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

      // 📌 **Llamar a la API para actualizar el rol**
      this.userService.actualizarUsuario(usuario._id, { rol: nuevoRol, contraseña }).subscribe(
        () => {
          Swal.fire('✅ Rol actualizado', `El usuario ahora es ${nuevoRol}`, 'success');
          this.cargarUsuarios(); // 🔄 Recargar la lista de usuarios
        },
        (error) => {
          console.error('❌ Error al actualizar el rol:', error);
          Swal.fire('Error', error.error?.message || 'No se pudo actualizar el rol.', 'error');
        }
      );
    }
  });
}

  // Confirmar desactivar o activar un usuario
  confirmarDesactivar(usuario: any) {
    if (usuario.rol === 'Dios') {
      Swal.fire('🚫 Acción no permitida', 'No puedes desactivar al usuario "Dios".', 'error');
      return;
    }

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
        const contraseña = result.value; // Obtener la contraseña ingresada
        this.userService.verificarContraseña(contraseña).subscribe(
          (response) => {
            if (response?.valido) {
              this.toggleEstado(usuario, contraseña); // Cambiar el estado del usuario
            } else {
              Swal.fire('❌ Contraseña incorrecta', 'No puedes realizar esta acción.', 'error');
            }
          },
          (error) => {
            console.error('❌ Error al verificar contraseña:', error);
            Swal.fire('⚠️ Error', 'No se pudo verificar la contraseña.', 'error');
          }
        );
      }
    });
  }

  // Cambiar el estado de un usuario (activo/inactivo)
  toggleEstado(usuario: any, contraseña: string) {
    const nuevoEstado = !usuario.activo;

    // Incluir la contraseña en el cuerpo de la solicitud
    const body = {
      activo: nuevoEstado,
      contraseña: contraseña,
    };

    this.userService.actualizarUsuario(usuario._id, body).subscribe(
      () => {
        Swal.fire('✅ Estado cambiado', `El usuario está ahora ${nuevoEstado ? 'Activo' : 'Inactivo'}`, 'success');
        this.cargarUsuarios(); // Recargar la lista de usuarios
      },
      (error) => {
        console.error('❌ Error al cambiar el estado:', error);
        Swal.fire('Error', 'No se pudo cambiar el estado del usuario.', 'error');
      }
    );
  }

  // Confirmar la eliminación de un usuario
  confirmarEliminar(usuario: any) {
    if (usuario.rol === 'Dios') {
      Swal.fire('🚫 Acción no permitida', 'No puedes eliminar al usuario "Dios".', 'error');
      return;
    }

    Swal.fire({
      title: '🔒 Ingresa tu contraseña para confirmar',
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
              // Evitar que un Administrador elimine a otro Administrador
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
            console.error('❌ Error en verificación de contraseña:', error);
            Swal.fire('⚠️ Error', 'No se pudo verificar la contraseña.', 'error');
          }
        );
      }
    });
  }

  // Eliminar un usuario
  eliminarUsuario(userId: string, contraseña: string) {
    this.userService.eliminarUsuario(userId, contraseña).subscribe(
      () => {
        Swal.fire('✅ Usuario eliminado', 'El usuario ha sido eliminado correctamente.', 'success');
        this.cargarUsuarios(); // Recargar la lista de usuarios
      },
      (error) => {
        console.error('❌ Error al eliminar usuario:', error);
        Swal.fire('⚠️ Error', error.error?.message || 'Hubo un problema al eliminar el usuario.', 'error');
      }
    );
  }

  // Cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
