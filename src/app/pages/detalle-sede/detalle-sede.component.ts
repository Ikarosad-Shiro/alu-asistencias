import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service'; // agrega esto si aún no está
import { CalendarioService } from 'src/app/services/calendario.service';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

import { DateTime } from 'luxon';
import { AsistenciaService } from 'src/app/services/asistencia.service'; // Asegúrate de tenerlo

interface PdfTableNode {
  table: {
    headerRows: number;
    widths: any[];
    body: any[][];
    dontBreakRows: boolean;
  };
  layout: PdfTableLayout;
  margin: number[];
  pageBreak?: 'before' | 'after' | 'both';
}

interface PdfTableLayout {
  fillColor?: (rowIndex: number, node: any, columnIndex: number) => string | null;
  hLineWidth: (i: number, node: any) => number;
  vLineWidth: (i: number, node: any) => number;
  hLineColor: (i: number, node: any) => string;
  paddingTop: (i: number, node: any) => number;
  paddingBottom: (i: number, node: any) => number;
  paddingLeft: (i: number, node: any) => number;
  paddingRight: (i: number, node: any) => number;
}

// ✅ Forma correcta de asignar las fuentes
(pdfMake as any).vfs = pdfFonts.vfs;

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
  trabajadoresProcesados: any[] = [];
  fechasRango: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sedeService: SedeService,
    private trabajadoresService: TrabajadoresService,
    private calendarioService: CalendarioService,
    private authService: AuthService,
    private http: HttpClient,
    private userService: UserService, // ← ✅ AGREGA ESTA LÍNEA
    private asistenciaService: AsistenciaService // ✅ ← AGREGA ESTO
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

  generarPdfPorSede(): void {
    // Interfaces locales para tipado fuerte
    interface PdfTableNode {
      table: {
        headerRows: number;
        widths: any[];
        body: any[][];
        dontBreakRows: boolean;
      };
      layout: {
        hLineWidth: (i: number, node: any) => number;
        vLineWidth: (i: number, node: any) => number;
        hLineColor: (i: number, node: any) => string;
        paddingTop: (i: number, node: any) => number;
        paddingBottom: (i: number, node: any) => number;
        paddingLeft: (i: number, node: any) => number;
        paddingRight: (i: number, node: any) => number;
      };
      margin: number[];
      pageBreak?: 'before' | 'after' | 'both';
    }

    interface PdfDocDefinition {
      pageOrientation: string;
      content: any[];
      styles: any;
      defaultStyle: any;
      footer?: (currentPage: number, pageCount: number) => any;
      pageSize?: any;
    }

    Swal.fire({
      title: '📅 Selecciona el rango de fechas',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="fecha-inicio" style="width: 60px; font-weight: bold; text-align: right;">Inicio:</label>
            <input type="date" id="fecha-inicio" class="swal2-input" style="width: 180px; margin: 0;" />
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="fecha-fin" style="width: 60px; font-weight: bold; text-align: right;">Fin:</label>
            <input type="date" id="fecha-fin" class="swal2-input" style="width: 180px; margin: 0;" />
          </div>
          <div style="margin-top: 15px; text-align: left;">
            <label style="font-weight: bold;">Modo de reporte:</label><br/>
            <input type="radio" name="modo" id="modo-uno" checked onclick="document.getElementById('formato-carta').disabled = true; document.getElementById('formato-oficio').disabled = true;" />
            <label for="modo-uno">Una sola hoja (ajustar tamaño)</label><br/>
            <input type="radio" name="modo" id="modo-dividido" onclick="document.getElementById('formato-carta').disabled = false; document.getElementById('formato-oficio').disabled = false;" />
            <label for="modo-dividido">Dividir por hojas:</label><br/>
            <div style="margin-left: 20px;">
              <input type="radio" name="formato" id="formato-carta" checked disabled />
              <label for="formato-carta">📄 Carta (6 días)</label><br/>
              <input type="radio" name="formato" id="formato-oficio" disabled />
              <label for="formato-oficio">📄 Oficio (10 días)</label>
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'Generar PDF',
      showCancelButton: true,
      preConfirm: () => {
        const inicio = (document.getElementById('fecha-inicio') as HTMLInputElement).value;
        const fin = (document.getElementById('fecha-fin') as HTMLInputElement).value;
        const modoUno = (document.getElementById('modo-uno') as HTMLInputElement).checked;
        const formatoCarta = (document.getElementById('formato-carta') as HTMLInputElement).checked;

        if (!inicio || !fin) {
          Swal.showValidationMessage('❌ Debes seleccionar ambas fechas');
          return;
        }

        if (inicio > fin) {
          Swal.showValidationMessage('❌ La fecha de inicio no puede ser mayor que la de fin');
          return;
        }

        return {
          inicio,
          fin,
          modo: modoUno ? 'una' : 'dividido',
          formato: formatoCarta ? 'carta' : 'oficio'
        };
      }
    }).then((result) => {
      if (!result.isConfirmed) return;

      const { inicio, fin, modo, formato } = result.value;

      this.asistenciaService.obtenerUnificadoPorSede(this.sede.id, inicio, fin).subscribe({
        next: (res: any) => {
          const trabajadores = res.trabajadores as any[];
          if (!trabajadores?.length) {
            Swal.fire('⚠️ Sin datos', 'No se encontraron asistencias en ese rango.', 'info');
            return;
          }

          const fechas = Object.keys(trabajadores[0].datosPorDia);

          // 🔍 Marcar explícitamente los días vacíos como Faltas
          fechas.forEach((fecha) => {
            trabajadores.forEach((trabajador) => {
              if (!trabajador.datosPorDia[fecha]) {
                trabajador.datosPorDia[fecha] = { estado: 'Falta' };
              }
            });
          });

          const chunkSize = formato === 'carta' ? 6 : 10;
          const tablas: PdfTableNode[] = [];

          // Función optimizada para determinar el color basado en estado y horas
          const obtenerColorPorEstado = (estado: string = '', entrada: string = '', salida: string = ''): string => {
            const coloresPorEstado: { [key: string]: string } = {
              'Asistencia Completa': '#a3e635',
              'Asistencia Manual': '#4ade80', // ✅ Asegúrate de incluir este
              'Salida Automática': '#34d399',
              'Pendiente': '#facc15',
              'Falta': '#f87171',
              'Vacaciones': '#60a5fa',
              'Vacaciones Pagadas': '#3b82f6',
              'Permiso': '#fbbf24',
              'Permiso con Goce': '#fb923c',
              'Incapacidad': '#f472b6',
              'Descanso': '#c084fc',
              'Festivo': '#a78bfa',
              'Puente': '#94a3b8',
              'Evento': '#67e8f9',
              'Capacitación': '#5eead4',
              'Media Jornada': '#fde047',
              'Suspensión': '#fb7185'
            };

            // 1. Prioridad a estados explícitos
            if (estado && estado !== '—') {
              const estadoNormalizado = estado
                .replace(/[^\w\sáéíóúÁÉÍÓÚ]/g, '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

              for (const [key, color] of Object.entries(coloresPorEstado)) {
                const keyNormalizado = key
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '');
                if (estadoNormalizado.includes(keyNormalizado)) {
                  return color;
                }
              }
            }

            // 2. Si no hay estado pero hay horas, es Asistencia Completa
            if ((entrada && entrada !== '—' && salida && salida !== '—')) {
              return coloresPorEstado['Asistencia Completa'];
            }

            return ''; // Sin color por defecto
          };

          const crearTabla = (subFechas: string[], trabajadores: any[]): PdfTableNode => {
            const body: any[][] = [];

            // Encabezado 1 con fechas duplicadas (Entrada / Salida)
            const header1 = ['Nombre del trabajador', ...subFechas.flatMap(f => [f, ''])];
            body.push(
              header1.map(text => ({
                text,
                style: 'tableHeader',
                fillColor: '#343a40',
                color: '#ffffff'
              }))
            );

            // Encabezado 2 fijo: Entrada / Salida por cada fecha
            const header2 = [''].concat(subFechas.flatMap(() => ['Entrada', 'Salida']));
            body.push(
              header2.map(text => ({
                text,
                style: 'tableHeader',
                fillColor: '#495057',
                color: '#ffffff'
              }))
            );

            trabajadores.forEach((t: any) => {
              const nombre = [t.nombre, t.apellido].filter(Boolean).join(' ');
              const fila: any[] = [{
                text: nombre,
                style: 'nombreTrabajador',
                fillColor: ''
              }];

              const hoy = DateTime.now().toFormat('yyyy-MM-dd');

              subFechas.forEach((fecha: string) => {
                const datos = t.datosPorDia[fecha] || {};
                let entrada = datos?.entrada || '—';
                let salida = datos?.salida || '—';
                let estado = datos?.estado || '';

                const entradaVacia = !entrada || entrada === '—';
                const salidaVacia = !salida || salida === '—';
                const estadoVacio = !estado || estado === '—';

                // 💥 Asistencia manual desde calendario del trabajador
                const esAsistenciaManual = estado?.trim().toLowerCase() === 'asistencia' && datos?.horaEntrada && datos?.horaSalida;

                if (fecha > hoy) {
                  entrada = '';
                  salida = '';
                  estado = '';
                } else if (esAsistenciaManual) {
                  estado = 'Asistencia Manual';
                  entrada = datos.horaEntrada;
                  salida = datos.horaSalida;
                } else {
                  const sinDatos = entradaVacia && salidaVacia && estadoVacio;
                  if (sinDatos) {
                    estado = 'Falta';
                  } else if (!estado && datos?.entrada && datos?.salida) {
                    estado = 'Asistencia Completa';
                  }
                }

                const color = obtenerColorPorEstado(estado, entrada, salida);

                fila.push({
                  text: entrada,
                  style: 'celdaTexto',
                  fillColor: color || undefined,
                  estadoReal: estado // ✅ se guarda para colorear correctamente
                });
                fila.push({
                  text: salida,
                  style: 'celdaTexto',
                  fillColor: color || undefined,
                  estadoReal: estado
                });
              });

              body.push(fila);
            });

            return {
              table: {
                headerRows: 2,
                widths: ['auto', ...Array(subFechas.length * 2).fill('auto')],
                body,
                dontBreakRows: true
              },
              layout: {
                fillColor: (rowIndex: number, node: any, columnIndex: number): string | null => {
                  if (rowIndex < 2 || columnIndex === 0) return null;

                  const celda = node.table.body[rowIndex][columnIndex];
                  const estado = celda?.estadoReal || celda?.text || '';

                  if (celda?.fillColor) return null;
                  if (estado.trim() === '—' || estado.trim() === '') return null;

                  return obtenerColorPorEstado(estado);
                },
                hLineWidth: (i: number) => (i === 0 || i === 1 || i === body.length) ? 1 : 0,
                vLineWidth: () => 0,
                hLineColor: () => '#999999',
                paddingTop: () => 4,
                paddingBottom: () => 4,
                paddingLeft: () => 4,
                paddingRight: () => 4
              } as any,
              margin: [0, 0, 0, 10]
            };
          };

          const docDefinition: PdfDocDefinition = {
            pageOrientation: 'landscape',
            content: [
              {
                text: `Reporte de Asistencias por Sede`,
                style: 'header',
                margin: [0, 0, 0, 5]
              },
              {
                text: `📍 ${this.sede.nombre} (ID: ${this.sede.id})`,
                style: 'subheader',
                margin: [0, 0, 0, 2]
              },
              {
                text: `📅 Periodo: ${inicio} al ${fin}\n\n`,
                style: 'subheader',
                margin: [0, 0, 0, 10]
              }
            ],
            styles: {
              header: {
                fontSize: 18,
                bold: true,
                alignment: 'center',
                color: '#343a40'
              },
              subheader: {
                fontSize: 12,
                alignment: 'center',
                color: '#6c757d'
              },
              tableHeader: {
                bold: true,
                fontSize: 10,
                color: 'white',
                alignment: 'center'
              },
              nombreTrabajador: {
                bold: true,
                fontSize: 10,
                color: '#212529'
              },
              celdaTexto: {
                fontSize: 9,
                alignment: 'center',
                color: '#212529'
              }
            },
            defaultStyle: {
              font: 'Roboto',
              lineHeight: 1.2
            },
            footer: (currentPage: number, pageCount: number) => {
              return {
                text: `Página ${currentPage} de ${pageCount}`,
                alignment: 'center',
                fontSize: 9,
                margin: [0, 10, 0, 0],
                color: '#6c757d'
              };
            }
          };

          if (modo === 'una') {
            const tabla = crearTabla(fechas, trabajadores);
            docDefinition.content.push(tabla);

            // 💡 Cada día tiene 2 columnas, y cada columna ocupa aprox. 50px. Sumamos también unos 100px para margen y nombre
            const anchoCalculado = Math.max(595, 100 + (fechas.length * 2 * 50));

            docDefinition.pageSize = {
              width: anchoCalculado,
              height: 842 // Altura estándar (A4 vertical) o 595 si quisieras horizontal, pero landscape ya rota la hoja
            };
          }else {
            for (let i = 0; i < fechas.length; i += chunkSize) {
              const subFechas = fechas.slice(i, i + chunkSize);
              const tabla = crearTabla(subFechas, trabajadores);
              const tablaConSalto: PdfTableNode = {
                ...tabla,
                ...(i > 0 && { pageBreak: 'before' })
              };
              docDefinition.content.push(tablaConSalto);
            }
            docDefinition.pageSize = formato === 'carta' ? 'LETTER' : 'LEGAL';
          }

          pdfMake.createPdf(docDefinition).open();
        },
        error: (err: any) => {
          console.error('❌ Error al generar PDF de sede:', err);
          Swal.fire('Error', 'No se pudo generar el reporte de PDF por sede.', 'error');
        }
      });
    });
  }

  generarPdfPorSedeProcesado(): void {
    const fechas = this.fechasRango;
    const trabajadores = this.trabajadoresProcesados;

    // 💡 Asegurarse de que todos los días del rango estén presentes para todos los trabajadores
    fechas.forEach((fecha) => {
      trabajadores.forEach((trabajador) => {
        if (!trabajador.datosPorDia[fecha]) {
          trabajador.datosPorDia[fecha] = {}; // Día vacío = posible falta
        }
      });
    });

    const obtenerColorPorEstado = (estado: string = ''): string => {
      const coloresPorEstado: { [key: string]: string } = {
        'Asistencia Completa': '#a3e635',
        'Asistencia Manual': '#4ade80',
        'Salida Automática': '#34d399',
        'Pendiente': '#facc15',
        'Falta': '#f87171',
        'Vacaciones': '#60a5fa',
        'Vacaciones Pagadas': '#3b82f6',
        'Permiso': '#fbbf24',
        'Permiso con Goce': '#fb923c',
        'Incapacidad': '#f472b6',
        'Descanso': '#c084fc',
        'Festivo': '#a78bfa',
        'Puente': '#94a3b8',
        'Evento': '#67e8f9',
        'Capacitación': '#5eead4',
        'Media Jornada': '#fde047',
        'Suspensión': '#fb7185'
      };

      const estadoNormalizado = estado
        .replace(/[^\w\sáéíóúÁÉÍÓÚ]/g, '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const [key, color] of Object.entries(coloresPorEstado)) {
        const keyNormalizado = key
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (estadoNormalizado.includes(keyNormalizado)) {
          return color;
        }
      }

      return '';
    };

    // Construcción del cuerpo de la tabla
    const header1 = ['Nombre del trabajador', ...fechas];
    const header2 = ['Estado'].concat(fechas.map(() => ''));
    const body: any[][] = [header1, header2];

    // Recorremos cada trabajador para construir las filas
    trabajadores.forEach((trabajador: any) => {
      const fila: any[] = [{
        text: [trabajador.nombre, trabajador.apellido].filter(Boolean).join(' '),
        style: 'nombreTrabajador'
      }];

      // Añadimos el estado para cada fecha
      fechas.forEach((fecha: string) => {
        const dia = trabajador.datosPorDia[fecha];
        let estado = dia?.estado || '❌ Falta';

        // Detectar "falta" real si no hay entrada, salida ni evento
        const noHayNada = !dia?.entrada && !dia?.salida && !dia?.estado;
        if (noHayNada) estado = 'Falta';

        // Si no hay estado pero hay horas, considerar "Asistencia Completa"
        if ((!dia?.estado || dia.estado === '') && dia?.entrada && dia?.salida) {
          estado = 'Asistencia Completa';
        }

        const color = obtenerColorPorEstado(estado);
        fila.push({
          text: estado,
          fillColor: color || undefined,
          style: 'celdaTexto'
        });
      });

      body.push(fila);
    });

    const tabla = {
      table: {
        headerRows: 2,
        widths: ['auto', ...Array(fechas.length).fill('auto')],
        body,
        dontBreakRows: true
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1 || i === body.length) ? 1 : 0,
        vLineWidth: () => 0,
        hLineColor: () => '#999999',
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 4,
        paddingRight: () => 4
      },
      margin: [0, 0, 0, 10]
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: [
        {
          text: '📋 Reporte de Estados por Sede',
          style: 'header',
          margin: [0, 0, 0, 5]
        },
        {
          text: `📍 ${this.sede.nombre} (ID: ${this.sede.id})`,
          style: 'subheader',
          margin: [0, 0, 0, 2]
        },
        {
          text: `📅 Periodo: ${this.fechasRango[0]} al ${this.fechasRango[this.fechasRango.length - 1]}\n\n`,
          style: 'subheader',
          margin: [0, 0, 0, 10]
        },
        tabla
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          color: '#343a40'
        },
        subheader: {
          fontSize: 12,
          alignment: 'center',
          color: '#6c757d'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          alignment: 'center'
        },
        nombreTrabajador: {
          bold: true,
          fontSize: 10,
          color: '#212529'
        },
        celdaTexto: {
          fontSize: 9,
          alignment: 'center',
          color: '#212529'
        }
      },
      defaultStyle: {
        font: 'Roboto',
        lineHeight: 1.2
      },
      footer: (currentPage: number, pageCount: number) => {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 9,
          margin: [0, 10, 0, 0],
          color: '#6c757d'
        };
      }
    };

    pdfMake.createPdf(docDefinition).open();
  }
}
