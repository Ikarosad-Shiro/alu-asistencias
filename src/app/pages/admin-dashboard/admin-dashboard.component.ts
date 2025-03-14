import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SweetAlertResult } from 'sweetalert2'; // Importa el tipo correcto

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  usuarios: any[] = [];

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.userService.obtenerUsuarios().subscribe(
      (data) => {
        this.usuarios = data;
      },
      (error) => {
        console.error('❌ Error al obtener usuarios:', error);
        Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error');
      }
    );
  }

  cambiarRol(usuario: any) {
    if (usuario.rol === 'Dios') {
      Swal.fire('🚫 Acción no permitida', 'No puedes cambiar el rol de "Dios".', 'error');
      return;
    }

    Swal.fire({
      title: '🔒 Ingresa tu contraseña para confirmar el cambio de rol',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      inputAttributes: { autocapitalize: 'off', type: 'password' },
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar'
    }).then((result: SweetAlertResult<string>) => {
      if (result.isConfirmed && result.value) {
        const contraseña = result.value; // Obtener la contraseña ingresada

        const body = {
          rol: usuario.rol, // 🔥 ENVIAMOS EL ROL QUE SE SELECCIONÓ EN EL `select`
          contraseña: contraseña  // 🔥 Enviamos la contraseña
        };

        console.log("Enviando datos al backend:", body); // 📌 DEBUG

        this.userService.actualizarUsuario(usuario._id, body).subscribe(
          (response) => {
            console.log("✅ Respuesta del backend:", response); // 📌 DEBUG
            Swal.fire('✅ Rol actualizado', `El usuario ahora es ${usuario.rol}`, 'success');
            this.cargarUsuarios(); // 🔥 RECARGAMOS LISTA PARA REFLEJAR EL CAMBIO
          },
          (error) => {
            console.error('❌ Error al actualizar el rol:', error);
            Swal.fire('Error', error.error?.message || 'No se pudo actualizar el rol.', 'error');
          }
        );
      }
    });
  }

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
      cancelButtonText: 'Cancelar'
    }).then((result: SweetAlertResult<string>) => {
      if (result.isConfirmed && result.value) {
        const contraseña = result.value; // Obtener la contraseña ingresada
        this.userService.verificarContraseña(contraseña).subscribe(
          (response) => {
            if (response?.valido) {  // ✅ Usar el campo "valido" del backend
              this.toggleEstado(usuario, contraseña); // Pasar la contraseña
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

  toggleEstado(usuario: any, contraseña: string) {
    const nuevoEstado = !usuario.activo;

    // Incluir la contraseña en el cuerpo de la solicitud
    const body = {
      activo: nuevoEstado,
      contraseña: contraseña // Asegúrate de incluir la contraseña
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
      cancelButtonText: 'Cancelar'
    }).then((result: SweetAlertResult<string>) => {
      if (result.isConfirmed && result.value) {
        const contraseña = result.value; // Obtener la contraseña ingresada
        this.userService.verificarContraseña(contraseña).subscribe(
          (response) => {
            if (response?.valido) { // ✅ Usar el campo "valido" del backend
              this.eliminarUsuario(usuario._id, contraseña); // 🔥 Enviar contraseña aquí
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

  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
