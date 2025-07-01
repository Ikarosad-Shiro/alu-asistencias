import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AsistenciaService } from 'src/app/services/asistencia.service';
import Swal from 'sweetalert2';
import { SedeService } from 'src/app/services/sede.service';
import { TrabajadoresService } from 'src/app/services/trabajadores.service';

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

  mostrarTabla: boolean = false;

  constructor(
    private router: Router,
    private asistenciaService: AsistenciaService,
    private sedeService: SedeService,
    private trabajadorService: TrabajadoresService // 👈 agrégalo aquí
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

    }, 500);
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
