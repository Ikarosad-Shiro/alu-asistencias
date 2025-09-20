import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsistenciaService } from 'src/app/services/asistencia.service';
import Swal from 'sweetalert2';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';
import { DateTime } from 'luxon'; // asegúrate de tener esto arriba si usas Luxon
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

  trabajadoresHoy: any[] = []; // 🆕 Asistencias del día actual
  columnas: string[] = ['nombre', 'hora', 'sede', 'acciones']; // Columnas para la tabla

  sedes: { id: number, nombre: string }[] = [];
  filtroSede: string = '';
  trabajadoresOriginal: any[] = [];

  //para el analisis de quienes llegan mas tarde jaja
  topHoras: { nombre: string, horas: number }[] = [];
  topTarde: { nombre: string, hora: string }[] = [];

  //para la tabla de los que aun no llegan
  trabajadoresQueNoHanLlegado: any[] = [];
  trabajadoresQueNoHanLlegadoFiltrados: any[] = []; // 👈 esta línea faltaba
  filtroSedeFaltantes: string = '';

  // 🆕 Nuevo Ingreso (auto-cierre) - config
  private readonly ZONE = 'America/Mexico_City';
  private readonly NI_CHECK_KEY = 'niCheckLastRun';
  private readonly NI_CHECK_COOLDOWN_HOURS = 12;
  private niRunning = false;

  //grafico circular
  chartLabels: string[] = ['Asistieron', 'Ausentes'];
  chartData: any = {
    labels: ['Asistieron', 'Ausentes'],
    datasets: [
      {
        data: [0, 0],
        backgroundColor: ['#4caf50', '#f44336'] // verde, rojo (opcional)
      }
    ]
  };
  chartOptions: any = {
    plugins: {
      legend: {
        labels: {
          color: 'black' // 👈 Aquí defines el color del texto de la leyenda
        }
      }
    }
  };
  graficaAsistencia: { asistencia: number, ausencia: number } = { asistencia: 0, ausencia: 0 };

  chartType: string = 'doughnut';

  indiceSedeGrafica: number = -1; // -1 representa "Todas las sedes"

  get nombreSedeSeleccionada(): string {
    const hoy = DateTime.now().setZone('America/Mexico_City').setLocale('es');
    const fecha = hoy.toFormat("cccc dd LLLL yyyy"); // ejemplo: 01 julio 2025

    const nombreSede = this.indiceSedeGrafica === -1
      ? 'Todas las sedes'
      : this.sedes[this.indiceSedeGrafica]?.nombre || '';

    return `${nombreSede} - ${fecha}`;
  }

  currentMonth: Date = new Date();

  mostrarTabla: boolean = false;

  constructor(
    private router: Router,
    private asistenciaService: AsistenciaService,
    private sedeService: SedeService,
    private trabajadorService: TrabajadoresService,
  ) {
    console.log("📌 Constructor ejecutado.");
    this.obtenerUsuario(); // Intentar obtener usuario al inicio

    // **Escuchar cambios en localStorage (cuando el usuario inicia sesión)**
    window.addEventListener('storage', () => {
      console.log("🔄 Cambio detectado en localStorage.");
      this.obtenerUsuario(); // Vuelve a obtener los datos
    });
  }

  ngOnInit(): void {
    console.log("📌 ngOnInit ejecutado.");
    // **Asegurar que los datos se actualicen después de la carga inicial**
    setTimeout(() => {
      this.obtenerUsuario();
      this.cargarAsistenciasHoy();
      this.obtenerSedes();
      this.cargarTrabajadoresQueNoHanLlegado();
      this.autoCerrarNuevoIngresoDesdeDashboard().catch(() => {});
    }, 500);
  }

  // 🧹 Auto-cierre de "nuevoIngreso"
  private async autoCerrarNuevoIngresoDesdeDashboard(force = false): Promise<void> {
    try {
      if (!this.esAdmin()) return;

      const lastRunIso = localStorage.getItem(this.NI_CHECK_KEY);
      if (!force && lastRunIso) {
        const last = DateTime.fromISO(lastRunIso);
        if (DateTime.now().diff(last, 'hours').hours < this.NI_CHECK_COOLDOWN_HOURS) return;
      }
      if (this.niRunning) return;
      this.niRunning = true;

      const out = await firstValueFrom(
        this.trabajadorService.cerrarNuevoIngresoMasivo(false, true) // dryRun=false
      );

      localStorage.setItem(this.NI_CHECK_KEY, DateTime.now().toISO());
      this.niRunning = false;

      // feedback rápido
      if (out?.cerrados > 0) {
        Swal.fire('Nuevo ingreso actualizado', `Se cerró en ${out.cerrados} trabajador(es).`, 'success');
      } else {
        // silencioso si no hubo cambios
        console.log('NI: sin cambios', out);
      }
    } catch (e) {
      this.niRunning = false;
      console.warn('NI sweep error:', e);
    }
  }

  // 📌 **Obtener usuario desde localStorage**
  obtenerUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuario.nombre) {
      this.usuarioNombre = usuario.nombre;
    }
    if (usuario.rol) {
      this.usuarioRol = usuario.rol;
    }

    console.log("✅ Usuario actualizado:", usuario);
  }

  toggleTablaAsistencia(){
    this.mostrarTabla = !this.mostrarTabla
  }

  obtenerSedes() {
    this.sedeService.obtenerSedes().subscribe({
      next: (res) => this.sedes = res,
      error: (err) => console.error('❌ Error al obtener sedes:', err)
    });
  }

  obtenerNombreSede(id: number): string {
    const sede = this.sedes.find(s => s.id === id);
    return sede ? sede.nombre : 'Sin sede';
  }

  verDetalle(trabajador: any) {
    if (trabajador._id) {
      this.router.navigate(['/trabajadores', trabajador._id]);
    } else {
      Swal.fire('No se pudo redirigir', 'ID del trabajador no encontrado.', 'warning');
    }
  }

//tabgla de trabajdores que llegaron el dia hoy
  cargarAsistenciasHoy() {
    this.asistenciaService.obtenerAsistenciasDeHoy().subscribe((data) => {
      this.trabajadoresOriginal = data; // <-- Guardamos copia sin filtrar
      this.trabajadoresHoy = data;      // <-- Mostramos todos al inicio
      console.log("✅ Asistencias de hoy:", this.trabajadoresHoy);
      this.calcularTopEstadisticas(); // 👈 Aquí
    });
  }

  filtrarPorSede() {
    if (!this.filtroSede) {
      this.trabajadoresHoy = this.trabajadoresOriginal;
    } else {
      const nombreSede = this.obtenerNombreSede(Number(this.filtroSede));
      this.trabajadoresHoy = this.trabajadoresOriginal.filter(t => t.sede === nombreSede);
    }
  }

//tabla de trabajdores que no han llegado el dia de hoy
  cargarTrabajadoresQueNoHanLlegado() {
    this.trabajadorService.obtenerTrabajadores().subscribe({
      next: (todosTrabajadores: any[]) => {
        this.asistenciaService.obtenerAsistenciasDeHoy().subscribe({
          next: (trabajadoresHoy: any[]) => {
            const idsLlegaronHoy = trabajadoresHoy.map(t => t._id?.toString());

            // 🧠 Agrega el nombre de la sede a cada trabajador
            const trabajadoresSinAsistencia = todosTrabajadores.filter(trabajador => {
              return !idsLlegaronHoy.includes(trabajador._id?.toString());
            }).map(trabajador => {
              const sede = this.sedes.find(s => s.id === trabajador.sede);
              return {
                ...trabajador,
                nombreSede: sede ? sede.nombre : '—'
              };
            });

            this.trabajadoresQueNoHanLlegado = trabajadoresSinAsistencia;
            this.trabajadoresQueNoHanLlegadoFiltrados = [...this.trabajadoresQueNoHanLlegado];

            this.filtrarPorSedeFaltantes();

            // 📊 Contador para la gráfica circular
            this.graficaAsistencia = {
              asistencia: this.trabajadoresHoy.length,
              ausencia: this.trabajadoresQueNoHanLlegado.length
            };
            this.actualizarGraficaAsistencia(); // 👈 ESTA LÍNEA
          },
          error: (error) => {
            console.error("❌ Error al obtener asistencias de hoy:", error);
          }
        });
      },
      error: (error) => {
        console.error("❌ Error al obtener todos los trabajadores:", error);
      }
    });
  }

  filtrarPorSedeFaltantes() {
    if (!this.filtroSedeFaltantes) {
      this.trabajadoresQueNoHanLlegadoFiltrados = [...this.trabajadoresQueNoHanLlegado];
    } else {
      const sedeId = Number(this.filtroSedeFaltantes); // 👈 asegura que sea número
      this.trabajadoresQueNoHanLlegadoFiltrados = this.trabajadoresQueNoHanLlegado.filter(t =>
        t.sede === sedeId
      );
    }
  }

  //tabla del top 5 personas que han llegado mas tarde el dia actual
  calcularTopEstadisticas() {
    this.topTarde = [...this.trabajadoresHoy]
      .filter(t => t.hora)
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .reverse()
      .slice(0, 5);

    this.topHoras = [...this.trabajadoresHoy]
      .map(t => ({
        nombre: t.nombre,
        horas: Math.floor(Math.random() * 5 + 4)
      }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 3);
  }

  //Grafico circular
  actualizarGraficaAsistencia() {
    let asistencia = this.trabajadoresHoy;
    let ausencia = this.trabajadoresQueNoHanLlegado;

    if (this.indiceSedeGrafica !== -1) {
      const sedeNombre = this.sedes[this.indiceSedeGrafica]?.nombre;
      asistencia = asistencia.filter(t => t.sede === sedeNombre);
      ausencia = ausencia.filter(t => t.nombreSede === sedeNombre);
    }

    this.chartData = {
      labels: ['Asistieron', 'Ausentes'],
      datasets: [{
        data: [asistencia.length, ausencia.length],
        backgroundColor: ['#3e95cd', '#ff6384'],
        borderWidth: 1
      }]
    };
  }

  cambiarSedeAnterior() {
    if (this.indiceSedeGrafica === -1) {
      this.indiceSedeGrafica = this.sedes.length - 1;
    } else if (this.indiceSedeGrafica > 0) {
      this.indiceSedeGrafica--;
    } else {
      this.indiceSedeGrafica = -1; // Volver a "Todas"
    }
    this.actualizarGraficaAsistencia();
  }

  cambiarSedeSiguiente() {
    if (this.indiceSedeGrafica === -1) {
      this.indiceSedeGrafica = 0;
    } else if (this.indiceSedeGrafica < this.sedes.length - 1) {
      this.indiceSedeGrafica++;
    } else {
      this.indiceSedeGrafica = -1; // Volver a "Todas"
    }
    this.actualizarGraficaAsistencia();
  }

  // 📌 Función para mostrar/ocultar la sidebar en móviles
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
      }
  }
  // 📌 Función para verificar si es administrador o Dios
  esAdmin(): boolean {
    console.log("🛠️ Verificando rol en esAdmin():", this.usuarioRol);
    return this.usuarioRol === 'Administrador' || this.usuarioRol === 'Dios';
  }

  // 📌 Redirigir al `AdminDashboard`
  verUsuarios() {
    this.router.navigate(['/admin-dashboard']);
  }

  // 📌 Función para cerrar sesión
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
