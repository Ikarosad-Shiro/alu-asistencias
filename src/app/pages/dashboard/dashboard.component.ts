// dashboard.component.ts

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsistenciaService } from 'src/app/services/asistencia.service';
import Swal from 'sweetalert2';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { DateTime } from 'luxon';
import { firstValueFrom } from 'rxjs';


interface ResumenHoras {
  nombre: string;
  horasAyer: number;
  horasSemana: number;
}


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})


export class DashboardComponent implements OnInit {

  usuarioNombre: string = 'Usuario';
  usuarioRol: string = '';


  // ======================================================
  // 👷 ASISTENCIAS DE HOY
  // ======================================================

  trabajadoresHoy: any[] = [];

  columnas: string[] = [
    'nombre',
    'hora',
    'sede',
    'acciones'
  ];


  sedes: {
    id: number,
    nombre: string
  }[] = [];


  filtroSede: string = '';

  trabajadoresOriginal: any[] = [];


  // ======================================================
  // 📊 ESTADÍSTICAS
  // ======================================================

  topHoras: {
    nombre: string,
    horas: number
  }[] = [];


  topTarde: {
    nombre: string,
    hora: string
  }[] = [];


  // ======================================================
  // 🚫 PERSONAS QUE AÚN NO HAN LLEGADO
  // ======================================================

  trabajadoresQueNoHanLlegado: any[] = [];

  trabajadoresQueNoHanLlegadoFiltrados: any[] = [];

  filtroSedeFaltantes: string = '';


  // ======================================================
  // 🆕 NUEVO INGRESO - AUTO CIERRE
  // ======================================================

  private readonly ZONE =
    'America/Mexico_City';

  private readonly NI_CHECK_KEY =
    'niCheckLastRun';

  private readonly NI_CHECK_COOLDOWN_HOURS =
    12;

  private niRunning = false;


  // ======================================================
  // 📊 GRÁFICA CIRCULAR
  // ======================================================

  chartLabels: string[] = [
    'Asistieron',
    'Ausentes'
  ];


  chartData: any = {

    labels: [
      'Asistieron',
      'Ausentes'
    ],

    datasets: [
      {
        data: [0, 0],

        backgroundColor: [
          '#4caf50',
          '#f44336'
        ]
      }
    ]
  };


  chartOptions: any = {

    plugins: {

      legend: {

        labels: {
          color: 'black'
        }
      }
    }
  };


  graficaAsistencia: {
    asistencia: number,
    ausencia: number
  } = {
    asistencia: 0,
    ausencia: 0
  };


  chartType: string =
    'doughnut';


  // -1 = Todas las sedes
  indiceSedeGrafica: number = -1;


  get nombreSedeSeleccionada(): string {

    const hoy = DateTime
      .now()
      .setZone('America/Mexico_City')
      .setLocale('es');


    const fecha =
      hoy.toFormat(
        'cccc dd LLLL yyyy'
      );


    const nombreSede =
      this.indiceSedeGrafica === -1

        ? 'Todas las sedes'

        : this.sedes[
            this.indiceSedeGrafica
          ]?.nombre || '';


    return `${nombreSede} - ${fecha}`;
  }


  currentMonth: Date =
    new Date();


  mostrarTabla: boolean =
    false;


  // ======================================================
  // CONSTRUCTOR
  // ======================================================

  constructor(

    private router:
      Router,

    private asistenciaService:
      AsistenciaService,

    private sedeService:
      SedeService,

    private trabajadorService:
      TrabajadoresService

  ) {

    console.log(
      '📌 Constructor ejecutado.'
    );


    this.obtenerUsuario();


    // Escuchar cambios de localStorage
    window.addEventListener(
      'storage',
      () => {

        console.log(
          '🔄 Cambio detectado en localStorage.'
        );

        this.obtenerUsuario();
      }
    );
  }


  // ======================================================
  // INICIO
  // ======================================================

  ngOnInit(): void {

    console.log(
      '📌 ngOnInit ejecutado.'
    );


    setTimeout(() => {

      this.obtenerUsuario();

      this.cargarAsistenciasHoy();

      this.obtenerSedes();

      this.cargarTrabajadoresQueNoHanLlegado();

      this
        .autoCerrarNuevoIngresoDesdeDashboard()
        .catch(() => {});

    }, 500);
  }


  // ======================================================
  // 🧹 AUTO CIERRE NUEVO INGRESO
  // ======================================================

  private async autoCerrarNuevoIngresoDesdeDashboard(
    force = false
  ): Promise<void> {

    try {

      if (!this.esAdmin()) {
        return;
      }


      const lastRunIso =
        localStorage.getItem(
          this.NI_CHECK_KEY
        );


      if (
        !force &&
        lastRunIso
      ) {

        const last =
          DateTime.fromISO(
            lastRunIso
          );


        if (
          DateTime
            .now()
            .diff(
              last,
              'hours'
            )
            .hours <
          this.NI_CHECK_COOLDOWN_HOURS
        ) {

          return;
        }
      }


      if (this.niRunning) {
        return;
      }


      this.niRunning = true;


      const out =
        await firstValueFrom(

          this.trabajadorService
            .cerrarNuevoIngresoMasivo(
              false,
              true
            )
        );


      localStorage.setItem(
        this.NI_CHECK_KEY,
        DateTime.now().toISO() || ''
      );


      this.niRunning = false;


      if (
        out?.cerrados > 0
      ) {

        Swal.fire(
          'Nuevo ingreso actualizado',
          `Se cerró en ${out.cerrados} trabajador(es).`,
          'success'
        );

      } else {

        console.log(
          'NI: sin cambios',
          out
        );
      }


    } catch (e) {

      this.niRunning = false;

      console.warn(
        'NI sweep error:',
        e
      );
    }
  }


  // ======================================================
  // 👤 USUARIO ACTUAL
  // ======================================================

  obtenerUsuario() {

    const usuario =
      JSON.parse(
        localStorage.getItem(
          'usuario'
        ) || '{}'
      );


    if (usuario.nombre) {

      this.usuarioNombre =
        usuario.nombre;
    }


    if (usuario.rol) {

      this.usuarioRol =
        usuario.rol;
    }


    console.log(
      '✅ Usuario actualizado:',
      usuario
    );
  }


  // ======================================================
  // MOSTRAR / OCULTAR TABLA
  // ======================================================

  toggleTablaAsistencia() {

    this.mostrarTabla =
      !this.mostrarTabla;
  }


  // ======================================================
  // 📍 SEDES
  // ======================================================

  obtenerSedes() {

    this.sedeService
      .obtenerSedes()
      .subscribe({

        next: (res) => {

          this.sedes = res;
        },


        error: (err) => {

          console.error(
            '❌ Error al obtener sedes:',
            err
          );
        }

      });
  }


  obtenerNombreSede(
    id: number
  ): string {

    const sede =
      this.sedes.find(
        s => s.id === id
      );


    return sede
      ? sede.nombre
      : 'Sin sede';
  }


  // ======================================================
  // 👁️ VER DETALLE TRABAJADOR
  // ======================================================

  verDetalle(
    trabajador: any
  ) {

    if (trabajador._id) {

      this.router.navigate([
        '/trabajadores',
        trabajador._id
      ]);

    } else {

      Swal.fire(
        'No se pudo redirigir',
        'ID del trabajador no encontrado.',
        'warning'
      );
    }
  }


  // ======================================================
  // ✅ TRABAJADORES QUE LLEGARON HOY
  // ======================================================

  cargarAsistenciasHoy() {

    this.asistenciaService
      .obtenerAsistenciasDeHoy()
      .subscribe((data) => {

        // Copia sin filtrar
        this.trabajadoresOriginal =
          data;


        // Mostrar todos inicialmente
        this.trabajadoresHoy =
          data;


        console.log(
          '✅ Asistencias de hoy:',
          this.trabajadoresHoy
        );


        this.calcularTopEstadisticas();
      });
  }


  // ======================================================
  // FILTRO POR SEDE - LOS QUE LLEGARON
  // ======================================================

  filtrarPorSede() {

    if (!this.filtroSede) {

      this.trabajadoresHoy =
        this.trabajadoresOriginal;

    } else {

      const nombreSede =
        this.obtenerNombreSede(
          Number(
            this.filtroSede
          )
        );


      this.trabajadoresHoy =
        this.trabajadoresOriginal.filter(
          t =>
            t.sede === nombreSede
        );
    }
  }


  // ======================================================
  // 🚫 TRABAJADORES QUE AÚN NO HAN LLEGADO HOY
  // ======================================================

  cargarTrabajadoresQueNoHanLlegado() {

    this.trabajadorService
      .obtenerTrabajadores()
      .subscribe({

        next: (
          todosTrabajadores: any[]
        ) => {


          this.asistenciaService
            .obtenerAsistenciasDeHoy()
            .subscribe({

              next: (
                trabajadoresHoy: any[]
              ) => {


                const idsLlegaronHoy =
                  trabajadoresHoy.map(
                    t =>
                      t._id
                        ?.toString()
                  );


                // ==================================================
                // 🔙 VERSIÓN ANTERIOR - RESPALDO
                // Incluía trabajadores activos e inactivos
                // ==================================================

                /*
                const trabajadoresSinAsistencia =
                  todosTrabajadores

                    .filter(
                      trabajador => {

                        return !idsLlegaronHoy.includes(
                          trabajador._id?.toString()
                        );
                      }
                    )

                    .map(
                      trabajador => {

                        const sede =
                          this.sedes.find(
                            s =>
                              s.id ===
                              trabajador.sede
                          );


                        return {

                          ...trabajador,

                          nombreSede:
                            sede
                              ? sede.nombre
                              : '—'
                        };
                      }
                    );
                */


                // ==================================================
                // ✅ VERSIÓN NUEVA
                //
                // Solo trabajadores ACTIVOS
                // que todavía no han llegado.
                // ==================================================

                const trabajadoresSinAsistencia =
                  todosTrabajadores

                    .filter(
                      trabajador => {


                        const estado =
                          String(
                            trabajador.estado ||
                            ''
                          )
                            .trim()
                            .toLowerCase();


                        // Si está explícitamente
                        // marcado como inactivo,
                        // no debe contar como ausente.
                        const estaActivo =
                          estado !==
                          'inactivo';


                        const yaLlego =
                          idsLlegaronHoy.includes(
                            trabajador._id
                              ?.toString()
                          );


                        return (
                          estaActivo &&
                          !yaLlego
                        );
                      }
                    )


                    .map(
                      trabajador => {


                        // Compatible con:
                        //
                        // sedePrincipal
                        // y
                        // sede legacy

                        const sedeId =
                          Number(

                            trabajador
                              .sedePrincipal ??

                            trabajador
                              .sede
                          );


                        const sede =
                          this.sedes.find(
                            s =>
                              s.id ===
                              sedeId
                          );


                        return {

                          ...trabajador,


                          nombreSede:
                            sede
                              ? sede.nombre
                              : '—'
                        };
                      }
                    );


                this.trabajadoresQueNoHanLlegado =
                  trabajadoresSinAsistencia;


                this.trabajadoresQueNoHanLlegadoFiltrados = [
                  ...this
                    .trabajadoresQueNoHanLlegado
                ];


                this
                  .filtrarPorSedeFaltantes();


                // ==================================================
                // 📊 GRÁFICA
                //
                // Los inactivos ya NO cuentan
                // como ausentes.
                // ==================================================

                this.graficaAsistencia = {

                  asistencia:
                    this
                      .trabajadoresHoy
                      .length,

                  ausencia:
                    this
                      .trabajadoresQueNoHanLlegado
                      .length
                };


                this.actualizarGraficaAsistencia();
              },


              error: (
                error
              ) => {

                console.error(
                  '❌ Error al obtener asistencias de hoy:',
                  error
                );
              }

            });
        },


        error: (
          error
        ) => {

          console.error(
            '❌ Error al obtener todos los trabajadores:',
            error
          );
        }

      });
  }


  // ======================================================
  // 📍 FILTRAR FALTANTES POR SEDE
  // ======================================================

  filtrarPorSedeFaltantes() {

    if (
      !this.filtroSedeFaltantes
    ) {

      this.trabajadoresQueNoHanLlegadoFiltrados = [
        ...this
          .trabajadoresQueNoHanLlegado
      ];


    } else {


      const sedeId =
        Number(
          this.filtroSedeFaltantes
        );


      this.trabajadoresQueNoHanLlegadoFiltrados =
        this.trabajadoresQueNoHanLlegado
          .filter(
            trabajador => {


              const trabajadorSedeId =
                Number(

                  trabajador
                    .sedePrincipal ??

                  trabajador
                    .sede
                );


              return (
                trabajadorSedeId ===
                sedeId
              );
            }
          );
    }
  }


  // ======================================================
  // 🕒 TOP PERSONAS QUE LLEGARON MÁS TARDE
  // ======================================================

  calcularTopEstadisticas() {

    this.topTarde = [
      ...this.trabajadoresHoy
    ]

      .filter(
        t => t.hora
      )

      .sort(
        (a, b) =>
          a.hora.localeCompare(
            b.hora
          )
      )

      .reverse()

      .slice(
        0,
        5
      );


    this.topHoras = [
      ...this.trabajadoresHoy
    ]

      .map(
        t => ({

          nombre:
            t.nombre,

          horas:
            Math.floor(
              Math.random() *
              5 +
              4
            )
        })
      )

      .sort(
        (a, b) =>
          b.horas -
          a.horas
      )

      .slice(
        0,
        3
      );
  }


  // ======================================================
  // 📊 ACTUALIZAR GRÁFICA
  // ======================================================

  actualizarGraficaAsistencia() {

    let asistencia =
      this.trabajadoresHoy;


    let ausencia =
      this.trabajadoresQueNoHanLlegado;


    if (
      this.indiceSedeGrafica !== -1
    ) {

      const sedeNombre =
        this.sedes[
          this.indiceSedeGrafica
        ]?.nombre;


      asistencia =
        asistencia.filter(
          t =>
            t.sede ===
            sedeNombre
        );


      ausencia =
        ausencia.filter(
          t =>
            t.nombreSede ===
            sedeNombre
        );
    }


    this.chartData = {

      labels: [
        'Asistieron',
        'Ausentes'
      ],


      datasets: [
        {

          data: [
            asistencia.length,
            ausencia.length
          ],


          backgroundColor: [
            '#3e95cd',
            '#ff6384'
          ],


          borderWidth: 1
        }
      ]
    };
  }


  // ======================================================
  // ⬅ SEDE ANTERIOR
  // ======================================================

  cambiarSedeAnterior() {

    if (
      this.indiceSedeGrafica === -1
    ) {

      this.indiceSedeGrafica =
        this.sedes.length - 1;


    } else if (
      this.indiceSedeGrafica > 0
    ) {

      this.indiceSedeGrafica--;


    } else {

      this.indiceSedeGrafica =
        -1;
    }


    this.actualizarGraficaAsistencia();
  }


  // ======================================================
  // ➡ SEDE SIGUIENTE
  // ======================================================

  cambiarSedeSiguiente() {

    if (
      this.indiceSedeGrafica === -1
    ) {

      this.indiceSedeGrafica =
        0;


    } else if (
      this.indiceSedeGrafica <
      this.sedes.length - 1
    ) {

      this.indiceSedeGrafica++;


    } else {

      this.indiceSedeGrafica =
        -1;
    }


    this.actualizarGraficaAsistencia();
  }


  // ======================================================
  // 📱 SIDEBAR
  // ======================================================

  toggleSidebar() {

    const sidebar =
      document.querySelector(
        '.sidebar'
      );


    const overlay =
      document.querySelector(
        '.sidebar-overlay'
      );


    if (
      sidebar &&
      overlay
    ) {

      sidebar
        .classList
        .toggle(
          'active'
        );


      overlay
        .classList
        .toggle(
          'active'
        );
    }
  }


  // ======================================================
  // 🔐 ADMIN / DIOS
  // ======================================================

  esAdmin(): boolean {

    console.log(
      '🛠️ Verificando rol en esAdmin():',
      this.usuarioRol
    );


    return (
      this.usuarioRol ===
        'Administrador' ||

      this.usuarioRol ===
        'Dios'
    );
  }


  // ======================================================
  // 👥 VER USUARIOS
  // ======================================================

  verUsuarios() {

    this.router.navigate([
      '/admin-dashboard'
    ]);
  }


  // ======================================================
  // 🚪 CERRAR SESIÓN
  // ======================================================

  cerrarSesion() {

    localStorage.clear();

    this.router.navigate([
      '/login'
    ]);
  }

}