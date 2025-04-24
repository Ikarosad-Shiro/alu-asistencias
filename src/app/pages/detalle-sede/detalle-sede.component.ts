import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service'; // agrega esto si aún no está
import { CalendarioService } from 'src/app/services/calendario.service';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-detalle-sede',
  templateUrl: './detalle-sede.component.html',
  styleUrls: ['./detalle-sede.component.css']
})
export class DetalleSedeComponent implements OnInit {
  sede: any = {};
  trabajadores: any[] = [];
  eventos: any[] = [];
  todasLasSedes: any[] = [];
  anioActual: number = new Date().getFullYear();
  sidebarAbierto: boolean = false;
  codigoVerificacion: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sedeService: SedeService,
    private trabajadoresService: TrabajadoresService,
    private calendarioService: CalendarioService,
    private authService: AuthService,
    private http: HttpClient,
    private userService: UserService // ← ✅ AGREGA ESTA LÍNEA
  ) {}

  ngOnInit(): void {
    const idSede = this.route.snapshot.paramMap.get('id');
    if (idSede) {
      const sedeId = parseInt(idSede);
      this.obtenerSede(sedeId);
      this.obtenerTrabajadores(sedeId);
      this.obtenerEventos(sedeId, this.anioActual);
      this.obtenerTodasLasSedes();
    }
  }

  obtenerSede(id: number): void {
    this.sedeService.obtenerSedePorId(id).subscribe({
      next: (res) => this.sede = res,
      error: (err) => console.error('❌ Error al obtener sede', err)
    });
  }

  obtenerTodasLasSedes(): void {
    this.sedeService.obtenerSedes().subscribe({
      next: (data) => this.todasLasSedes = data,
      error: (err) => console.error('❌ Error al cargar todas las sedes', err)
    });
  }

  obtenerTrabajadores(idSede: number): void {
    this.trabajadoresService.obtenerTrabajadores().subscribe({
      next: (data) => {
        this.trabajadores = data.filter(t => t.sede === idSede);
      },
      error: (err) => console.error('❌ Error al obtener trabajadores', err)
    });
  }

  obtenerEventos(idSede: number, anio: number): void {
    this.calendarioService.obtenerPorSedeYAnio(idSede, anio).subscribe({
      next: (res) => this.eventos = res?.diasEspeciales || [],
      error: (err) => console.error('❌ Error al obtener eventos del calendario', err)
    });
  }

  eliminarSede(): void {
    if (!this.esDios()) return;

    const enProceso = this.sede.estado === 'eliminacion_pendiente';

    Swal.fire({
      title: enProceso ? '¿Cancelar eliminación?' : '¿Estás seguro?',
      text: enProceso
        ? 'Esto cancelará la eliminación pendiente de esta sede.'
        : 'Esta acción eliminará la sede. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: enProceso ? 'Sí, cancelar' : 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    }).then(confirm => {
      if (!confirm.isConfirmed) return;

      if (enProceso) {
        this.sedeService.cancelarEliminacionSede(this.sede.id).subscribe({
          next: () => {
            Swal.fire('✅ Eliminación cancelada', 'La sede ha sido restaurada.', 'success');
            this.obtenerSede(this.sede.id);
          },
          error: () => {
            Swal.fire('❌ Error', 'No se pudo cancelar la eliminación.', 'error');
          }
        });
      } else {
        Swal.fire({
          title: 'Confirmación necesaria',
          input: 'text',
          inputLabel: `Escribe exactamente: "Estoy seguro de eliminar la sede ${this.sede.nombre}"`,
          inputPlaceholder: `Estoy seguro de eliminar la sede ${this.sede.nombre}`,
          showCancelButton: true,
          preConfirm: (valor) => {
            if (valor !== `Estoy seguro de eliminar la sede ${this.sede.nombre}`) {
              Swal.showValidationMessage('❌ Texto incorrecto. Debes escribirlo exactamente igual.');
            }
            return valor;
          }
        }).then(confirmText => {
          if (!confirmText.isConfirmed) return;

          Swal.fire({
            title: 'Verificación final',
            text: 'Esto marcará la sede para eliminación. Ingresa tu contraseña para confirmar.',
            input: 'password',
            inputLabel: 'Contraseña',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            preConfirm: (contraseña) => {
              return this.userService.verificarContraseña(contraseña).toPromise()
                .then((res) => {
                  if (!res.valido) {
                    Swal.showValidationMessage('❌ Contraseña incorrecta');
                    return false;
                  }
                  return true;
                })
                .catch(() => {
                  Swal.showValidationMessage('❌ Error al verificar la contraseña');
                  return false;
                });
            }
          }).then(passwordStep => {
            if (!passwordStep.isConfirmed || !passwordStep.value) return;

            const codigo = Math.floor(10000 + Math.random() * 90000).toString();
            this.codigoVerificacion = codigo;

            const email = this.authService.obtenerDatosDesdeToken()?.email;
            if (!email) {
              Swal.fire('❌ Error', 'No se pudo obtener el correo del usuario.', 'error');
              return;
            }

            this.authService.enviarCodigoEliminacionSede(email, codigo).subscribe({
              next: () => {
                Swal.fire({
                  title: 'Código enviado',
                  text: 'Se envió un código de verificación a tu correo. Ingrésalo para finalizar la acción.',
                  input: 'text',
                  inputLabel: 'Código de 5 dígitos',
                  inputPlaceholder: 'Ej: 12345',
                  showCancelButton: true,
                  confirmButtonText: 'Verificar',
                  preConfirm: (codigoIngresado) => {
                    if (codigoIngresado !== this.codigoVerificacion) {
                      Swal.showValidationMessage('❌ Código incorrecto.');
                      return false;
                    }
                    return true;
                  }
                }).then(codeConfirm => {
                  if (!codeConfirm.isConfirmed || !codeConfirm.value) return;

                  this.sedeService.marcarEliminacionSede(this.sede.id).subscribe({
                    next: () => {
                      Swal.fire('✅ Proceso iniciado', 'La sede ha sido marcada para eliminación.', 'success');
                      this.obtenerSede(this.sede.id);
                    },
                    error: () => {
                      Swal.fire('❌ Error', 'No se pudo iniciar el proceso de eliminación.', 'error');
                    }
                  });
                });
              },
              error: (err) => {
                console.error('❌ Error al enviar el código:', err);
                Swal.fire('❌ Error', 'No se pudo enviar el código de verificación.', 'error');
              }
            });
          });
        });
      }
    });
  }

  cancelarEliminacionSede(): void {
    Swal.fire({
      title: '¿Cancelar eliminación?',
      text: 'Esto restaurará la sede y detendrá el proceso de eliminación.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar eliminación',
      cancelButtonText: 'No'
    }).then(result => {
      if (result.isConfirmed) {
        this.sedeService.cancelarEliminacionSede(this.sede.id).subscribe({
          next: (res) => {
            Swal.fire('✅ Cancelado', 'La eliminación de la sede ha sido cancelada.', 'success');
            this.obtenerSede(this.sede.id); // Refrescamos los datos
          },
          error: (err) => {
            console.error('❌ Error al cancelar eliminación:', err);
            Swal.fire('Error', 'No se pudo cancelar la eliminación.', 'error');
          }
        });
      }
    });
  }

  guardarEventoDesdeCalendario(evento: any): void {
    if (this.esSoloRevisor()) return;
    const data = {
      año: this.anioActual,
      sede: evento.sede,
      fecha: evento.fecha,
      tipo: evento.tipo,
      descripcion: evento.descripcion
    };
    const servicio = evento.editar
      ? this.calendarioService.editarDia(data)
      : this.calendarioService.agregarDia(data);
    servicio.subscribe({
      next: () => this.obtenerEventos(this.sede.id, this.anioActual),
      error: (err) => console.error('❌ Error al guardar evento desde detalle-sede:', err)
    });
  }

  eliminarEventoDesdeCalendario(evento: any): void {
    if (this.esSoloRevisor()) return;
    const data = {
      año: this.anioActual,
      sede: evento.sede,
      fecha: evento.fecha,
      contraseña: evento.contraseña
    };
    this.calendarioService.eliminarDia(data).subscribe({
      next: () => this.obtenerEventos(this.sede.id, this.anioActual),
      error: (err) => console.error('❌ Error al eliminar evento desde detalle-sede:', err)
    });
  }

  guardarCambios(): void {
    if (this.esSoloRevisor()) return;
    this.sedeService.actualizarSede(this.sede.id, {
      direccion: this.sede.direccion,
      zona: this.sede.zona,
      responsable: this.sede.responsable
    }).subscribe({
      next: () => {
        Swal.fire('✅ Cambios guardados', 'La sede ha sido actualizada', 'success');
      },
      error: (err) => {
        console.error('❌ Error al guardar cambios', err);
        Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
      }
    });
  }

  busquedaTrabajador: string = '';
  trabajadoresFiltrados(): any[] {
    if (!this.busquedaTrabajador) return this.trabajadores;
    const filtro = this.busquedaTrabajador.toLowerCase();
    return this.trabajadores.filter(t =>
      (t.nombre?.toLowerCase().includes(filtro) || t.apellido?.toLowerCase().includes(filtro))
    );
  }

  verDetalleTrabajador(id: string): void {
    this.router.navigate(['/trabajadores', id]);
  }

  toggleSidebar(): void {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  get rolUsuario(): string {
    const usuario = this.authService.obtenerDatosDesdeToken();
    return usuario?.rol || '';
  }

  esDios(): boolean {
    return this.rolUsuario === 'Dios';
  }

  esAdmin(): boolean {
    return this.rolUsuario === 'Administrador';
  }

  esSoloRevisor(): boolean {
    return this.rolUsuario === 'Revisor';
  }
}
