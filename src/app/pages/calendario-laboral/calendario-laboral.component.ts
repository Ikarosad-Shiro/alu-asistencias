import { Component, OnInit } from '@angular/core';
import { CalendarioService } from 'src/app/services/calendario.service';
import { AuthService } from 'src/app/services/auth.service';
import { SedeService } from 'src/app/services/sede.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-calendario-laboral',
  templateUrl: './calendario-laboral.component.html',
  styleUrls: ['./calendario-laboral.component.css']
})
export class CalendarioLaboralComponent implements OnInit {
  sedes: { id: number, nombre: string, seleccionada?: boolean }[] = [];
  sedeSeleccionada: number | null = null;
  sedeSeleccionadaNombre: string = '';
  anioSeleccionado: number = new Date().getFullYear();
  diasEspeciales: any[] = [];
  sidebarAbierto: boolean = false;
  usuarioNombre: string = '';
  usuarioRol: string = '';
  busquedaRealizada: boolean = false;

  // ====== Asistente de Domingo (estado) ======
  asistenteDomingoActivo: boolean = false;
  rangoDomingoInicio: string = '';
  rangoDomingoFin: string = '';

  aplicarDomingoMasSedes: boolean = false;
  sedesExtrasAsistente: { id: number; nombre: string; seleccionada: boolean }[] = [];

  previewAsistente: {
    totalDomingos: number;
    aCrear: number;
    conEvento: number;
    sedesProcesadas: number;
    // detalle opcional si luego quieres mostrar lista
    detalle?: Array<{ sede: number; fecha: Date; motivo: 'crear' | 'ocupado' }>;
  } | null = null;

  constructor(
    private calendarioService: CalendarioService,
    private authService: AuthService,
    private sedeService: SedeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.obtenerUsuario();
    this.obtenerSedes();
    this.initRangoDomingoPorAnio();
  }

  obtenerUsuario() {
    const usuario = this.authService.obtenerDatosDesdeToken();
    this.usuarioNombre = usuario?.nombre || 'Usuario';
    this.usuarioRol = usuario?.rol || '';
  }

  obtenerSedes() {
    this.sedeService.obtenerSedes().subscribe({
      next: (res: any) => {
        this.sedes = res.map((s: any) => ({
          ...s,
          seleccionada: false
        }));
      },
      error: (err: any) => {
        console.error('Error al obtener sedes:', err);
      }
    });
  }

  onSedeChange() {
    const sede = this.sedes.find(s => s.id === this.sedeSeleccionada);
    this.sedeSeleccionadaNombre = sede ? sede.nombre : '';
    this.consultarCalendario();
  }

  initRangoDomingoPorAnio(): void {
    const y = this.anioSeleccionado;
    this.rangoDomingoInicio = `${y}-01-01`;
    this.rangoDomingoFin    = `${y}-12-31`;
  }

  onAnioChange(): void {
    this.initRangoDomingoPorAnio();
    this.limpiarPreviewAsistente();
  }

    // ── Utils de fecha ─────────────────────────────────────────────────────────────
  private parseDate(d: string): Date {
    // 'YYYY-MM-DD' → Date local a medianoche
    return new Date(`${d}T00:00:00`);
  }
  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }
  private getDomingosEnRango(inicio: Date, fin: Date): Date[] {
    const out: Date[] = [];
    const cur = new Date(inicio);
    // avanza hasta el primer domingo
    while (cur.getDay() !== 0) cur.setDate(cur.getDate() + 1);
    while (cur <= fin) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return out;
  }

  // ── Estado UI asistente ───────────────────────────────────────────────────────
  limpiarPreviewAsistente(): void {
    this.previewAsistente = null;
  }
  onToggleAplicarDomingoMasSedes(): void {
    if (!this.aplicarDomingoMasSedes) {
      this.sedesExtrasAsistente = [];
      return;
    }
    // clona sedes excepto la actualmente seleccionada
    this.sedesExtrasAsistente = (this.sedes || [])
      .filter(s => s.id !== this.sedeSeleccionada)
      .map(s => ({ id: s.id, nombre: s.nombre, seleccionada: false }));
  }

  // ── Carga calendarios por sede ────────────────────────────────────────────────
  private async fetchCalendarioSedeAnio(sedeId: number, anio: number): Promise<any[]> {
    return await new Promise((resolve) => {
      this.calendarioService.obtenerPorSedeYAnio(sedeId, anio).subscribe({
        next: (res: any) => resolve(Array.isArray(res?.diasEspeciales) ? res.diasEspeciales.map((e: any) => ({
          ...e,
          fecha: new Date(e.fecha?.$date ?? e.fecha)
        })) : []),
        error: () => resolve([])
      });
    });
  }

  // ── Vista previa ──────────────────────────────────────────────────────────────
  async simularAsistenteDomingo(): Promise<void> {
    try {
      if (!this.esAdmin() || !this.asistenteDomingoActivo) return;

      if (!this.sedeSeleccionada) {
        Swal.fire('Selecciona una sede', 'Primero elige la sede base.', 'info');
        return;
      }
      if (!this.rangoDomingoInicio || !this.rangoDomingoFin) {
        Swal.fire('Rango requerido', 'Indica fecha inicio y fin.', 'warning');
        return;
      }

      const ini = this.parseDate(this.rangoDomingoInicio);
      const fin = this.parseDate(this.rangoDomingoFin);

      // (simple) En esta primera versión nos quedamos dentro del año elegido
      if (ini.getFullYear() !== this.anioSeleccionado || fin.getFullYear() !== this.anioSeleccionado) {
        Swal.fire('Año no coincide', 'Usa un rango dentro del año seleccionado en el filtro.', 'info');
        return;
      }

      const domingos = this.getDomingosEnRango(ini, fin);
      if (!domingos.length) {
        Swal.fire('Sin domingos', 'No hay domingos en el rango elegido.', 'info');
        return;
      }

      // Sedes a procesar
      const sedeIds: number[] = [this.sedeSeleccionada];
      if (this.aplicarDomingoMasSedes) {
        sedeIds.push(...this.sedesExtrasAsistente.filter(s => s.seleccionada).map(s => s.id));
      }

      // Traemos calendarios existentes por sede
      const porSedeEventos: Record<number, any[]> = {};
      for (const sid of sedeIds) {
        porSedeEventos[sid] = await this.fetchCalendarioSedeAnio(sid, this.anioSeleccionado);
      }

      // Contadores
      let aCrear = 0, conEvento = 0;
      const detalle: Array<{ sede: number; fecha: Date; motivo: 'crear' | 'ocupado' }> = [];

      for (const sid of sedeIds) {
        const lista = porSedeEventos[sid] || [];
        for (const d of domingos) {
          const ya = lista.some(e => e?.fecha && this.isSameDay(new Date(e.fecha), d));
          if (ya) {
            conEvento++;
            detalle.push({ sede: sid, fecha: d, motivo: 'ocupado' });
          } else {
            aCrear++;
            detalle.push({ sede: sid, fecha: d, motivo: 'crear' });
          }
        }
      }

      this.previewAsistente = {
        totalDomingos: domingos.length * sedeIds.length,
        aCrear,
        conEvento,
        sedesProcesadas: sedeIds.length,
        detalle
      };

      Swal.fire('Vista previa lista',
        `Domingos en rango: ${domingos.length * sedeIds.length}\n` +
        `A crear: ${aCrear}\n` +
        `Ya ocupados: ${conEvento}\n` +
        `Sedes: ${sedeIds.length}`,
        'success');
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo generar la vista previa.', 'error');
    }
  }

  // ── Aplicar ──────────────────────────────────────────────────────────────────
  private async aplicarBatchCrearDescansos(items: Array<{ sede: number; fecha: Date }>, año: number): Promise<void> {
    // Procesa en lotes para no saturar el backend
    const batch = 12;
    for (let i = 0; i < items.length; i += batch) {
      const slice = items.slice(i, i + batch);
      await Promise.all(
        slice.map(it => new Promise<void>((resolve) => {
          this.calendarioService.agregarDia({
            año,
            sede: it.sede,
            fecha: it.fecha,
            tipo: 'descanso',
            descripcion: 'Asistente de Domingo'
          }).subscribe({ next: () => resolve(), error: () => resolve() });
        }))
      );
    }
  }

  async aplicarAsistenteDomingo(): Promise<void> {
    try {
      if (!this.previewAsistente) {
        Swal.fire('Primero la vista previa', 'Genera la vista previa antes de aplicar.', 'info');
        return;
      }
      if (this.previewAsistente.aCrear === 0) {
        Swal.fire('Nada que crear', 'Todos los domingos ya tienen evento.', 'info');
        return;
      }

      const confirmar = await Swal.fire({
        title: '¿Aplicar Asistente de Domingo?',
        text: `Se crearán ${this.previewAsistente.aCrear} días "Descanso". No se tocarán días ya configurados.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, aplicar',
        cancelButtonText: 'Cancelar'
      });

      if (!confirmar.isConfirmed) return;

      // Construye la lista a crear desde el detalle de preview
      const crear = (this.previewAsistente.detalle || [])
        .filter(d => d.motivo === 'crear')
        .map(d => ({ sede: d.sede, fecha: d.fecha }));

      await this.aplicarBatchCrearDescansos(crear, this.anioSeleccionado);

      Swal.fire('Listo', 'Se aplicaron los domingos como "Descanso".', 'success');

      // refresca la sede actual
      this.consultarCalendario();
      // limpia preview
      this.previewAsistente = null;
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudieron aplicar los cambios.', 'error');
    }
  }

  consultarCalendario() {
    if (!this.sedeSeleccionada || !this.anioSeleccionado) return;

    const sede = this.sedes.find(s => s.id === this.sedeSeleccionada);
    this.sedeSeleccionadaNombre = sede ? sede.nombre : '';

    this.calendarioService.obtenerPorSedeYAnio(this.sedeSeleccionada, this.anioSeleccionado).subscribe({
      next: (res: any) => {
        this.diasEspeciales = Array.isArray(res?.diasEspeciales)
          ? res.diasEspeciales.map((e: any) => ({
              ...e,
              fecha: new Date(e.fecha?.$date ?? e.fecha),
              sedes: res.sedes
            }))
          : [];

        // ✅ Muy importante
        this.busquedaRealizada = false;
        setTimeout(() => this.busquedaRealizada = true, 10);
      },
      error: (err: any) => {
        console.error('Error al consultar calendario:', err);
        this.diasEspeciales = [];
        this.busquedaRealizada = false;
        setTimeout(() => this.busquedaRealizada = true, 10);
      }
    });
  }

  onEventoGuardado(evento: any) {
  const eventoCompleto = {
    ...evento,
    año: this.anioSeleccionado,
    ...(evento.tipo === 'media jornada' ? {
      horaInicio: evento.horaInicio,
      horaFin: evento.horaFin
    } : {})
  };

    if (evento.editar) {
      // Llamamos al servicio de edición
      this.calendarioService.editarDia(eventoCompleto).subscribe({
        next: () => {
          this.consultarCalendario();
        },
        error: (err: any) => {
          console.error('❌ Error al editar día especial:', err.error?.message || err.message || err);
          Swal.fire('Error', err.error?.message || 'No se pudo editar el día', 'error');
        }
      });
    } else {
      // Llamamos al servicio de agregar
      this.calendarioService.agregarDia(eventoCompleto).subscribe({
        next: () => {
          this.consultarCalendario();
        },
        error: (err: any) => {
          console.error('❌ Error al guardar día especial:', err.error?.message || err.message || err);
          Swal.fire('Error', err.error?.message || 'No se pudo guardar el día', 'error');
        }
      });
    }
  }

  onEventoEliminado(evento: any) {
    console.log('📥 Evento recibido para eliminar:', evento);

    const { contraseña, ...datosEvento } = evento;

    this.authService.verificarPassword(contraseña).subscribe({
      next: (resp: any) => {
        if (resp.valido) {
          console.log('🔐 Contraseña verificada, eliminando...');

          this.calendarioService.eliminarDia(datosEvento).subscribe({
            next: () => {
              Swal.fire('✅ Eliminado', 'El día fue eliminado correctamente.', 'success');
              this.consultarCalendario();
            },
            error: (err) => {
              console.error('❌ Error al eliminar día:', err);
              Swal.fire('Error', err.error?.message || 'No se pudo eliminar el día', 'error');
            }
          });
        } else {
          Swal.fire('Contraseña incorrecta', 'Verifica tu contraseña', 'error');
        }
      },
      error: (err) => {
        console.error('❌ Error verificando contraseña:', err);
        Swal.fire('Contraseña incorrecta', 'Verifica tu contraseña', 'error');
      }
    });
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  esAdmin(): boolean {
    return this.usuarioRol === 'Administrador' || this.usuarioRol === 'Dios';
  }

  toggleSidebar() {
    this.sidebarAbierto = !this.sidebarAbierto;
  }
}
