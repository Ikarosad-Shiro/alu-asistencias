import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter
} from '@angular/core';

import { DateTime } from 'luxon';

import {
  Asistencia,
  EventoEspecial
} from 'src/app/models/asistencia.model';


@Component({
  selector: 'app-calendario-unificado',
  templateUrl: './calendario-unificado.component.html',
  styleUrls: ['./calendario-unificado.component.css']
})
export class CalendarioUnificadoComponent
  implements OnInit, OnChanges {

  @Input() asistencias: Asistencia[] = [];
  @Input() eventosSede: EventoEspecial[] = [];
  @Input() eventosTrabajador: EventoEspecial[] = [];

  @Output()
  mesCambiado =
    new EventEmitter<{
      inicio: Date;
      fin: Date;
    }>();


  // Zona horaria usada por el sistema
  private readonly ZONE =
    'America/Mexico_City';


  fechaActual: Date =
    new Date();

  diasDelMes: DiaCalendario[] = [];


  // =====================================================
  // CICLO DE VIDA
  // =====================================================

  ngOnInit(): void {
    this.generarDiasDelMes(
      this.fechaActual
    );
  }


  ngOnChanges(
    changes: SimpleChanges
  ): void {

    if (
      changes['asistencias'] ||
      changes['eventosSede'] ||
      changes['eventosTrabajador']
    ) {
      this.generarDiasDelMes(
        this.fechaActual
      );
    }
  }


  // =====================================================
  // HELPERS DE FECHA
  // =====================================================

  /**
   * Detecta si un ISO trae zona horaria.
   *
   * Ejemplos:
   *
   * 2026-08-13T08:00:00-06:00
   * 2026-08-13T14:00:00Z
   */
  private tieneZonaHoraria(
    value: string
  ): boolean {

    return (
      /([zZ]|[+-]\d{2}:?\d{2})$/
        .test(value.trim())
    );
  }


  /**
   * Convierte una fecha a DateTime
   * respetando America/Mexico_City.
   */
  private mxDateTime(
    value:
      string |
      Date |
      undefined |
      null
  ): DateTime | null {

    if (!value) {
      return null;
    }


    try {

      if (
        typeof value === 'string'
      ) {

        const clean =
          value.trim();


        // YYYY-MM-DD
        if (
          /^\d{4}-\d{2}-\d{2}$/
            .test(clean)
        ) {
          const dt =
            DateTime.fromISO(
              clean,
              {
                zone:
                  this.ZONE
              }
            );

          return dt.isValid
            ? dt
            : null;
        }


        // Fecha con zona horaria explícita
        if (
          this.tieneZonaHoraria(
            clean
          )
        ) {
          const dt =
            DateTime
              .fromISO(
                clean,
                {
                  setZone: true
                }
              )
              .setZone(
                this.ZONE
              );

          return dt.isValid
            ? dt
            : null;
        }


        // Fecha sin zona:
        // se interpreta directamente
        // como hora de CDMX
        const dt =
          DateTime.fromISO(
            clean,
            {
              zone:
                this.ZONE
            }
          );

        return dt.isValid
          ? dt
          : null;
      }


      const dt =
        DateTime
          .fromJSDate(
            value
          )
          .setZone(
            this.ZONE
          );

      return dt.isValid
        ? dt
        : null;

    } catch {

      return null;
    }
  }


  /**
   * Convierte cualquier fecha
   * a YYYY-MM-DD en CDMX.
   */
  private mxDay(
    value:
      string |
      Date |
      undefined |
      null
  ): string {

    if (!value) {
      return '';
    }


    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/
        .test(value)
    ) {
      return value;
    }


    const dt =
      this.mxDateTime(
        value
      );


    return (
      dt?.toISODate() ||
      ''
    );
  }


  /**
   * Convierte fecha/hora
   * a milisegundos para ordenar.
   */
  private mxMillis(
    value:
      string |
      Date |
      undefined |
      null
  ): number {

    const dt =
      this.mxDateTime(
        value
      );

    if (
      !dt ||
      !dt.isValid
    ) {
      return 0;
    }

    return dt.toMillis();
  }


  /**
   * Convierte una marca
   * al minuto del día.
   *
   * 08:30 = 510
   * 18:00 = 1080
   */
  private mxMinutoDelDia(
    value:
      string |
      Date |
      undefined |
      null
  ): number | null {

    const dt =
      this.mxDateTime(
        value
      );


    if (
      !dt ||
      !dt.isValid
    ) {
      return null;
    }


    return (
      dt.hour * 60 +
      dt.minute
    );
  }


  /**
   * Hora de salida general utilizada
   * por el calendario.
   *
   * L-V 18:00
   * Sábado 15:00
   * Domingo sin hora de cierre laboral.
   *
   * El backend sigue siendo quien
   * tiene la lógica definitiva de horarios.
   */
  private obtenerSalidaEsperadaMin(
    fechaStr: string
  ): number | null {

    const dt =
      DateTime.fromISO(
        fechaStr,
        {
          zone:
            this.ZONE
        }
      );


    if (!dt.isValid) {
      return null;
    }


    // Luxon:
    //
    // lunes = 1
    // sábado = 6
    // domingo = 7

    // Domingo
    if (
      dt.weekday === 7
    ) {
      return null;
    }


    // Sábado
    if (
      dt.weekday === 6
    ) {
      return (
        15 * 60
      );
    }


    // Lunes a viernes
    return (
      18 * 60
    );
  }


  /**
   * Normalización simple
   * para tipos de registro.
   */
  private normalizarTexto(
    value: any
  ): string {

    return String(
      value || ''
    )
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim();
  }


  // =====================================================
  // GENERAR GRILLA DEL CALENDARIO
  // =====================================================

  generarDiasDelMes(
    fechaBase: Date
  ): void {

    const anio =
      fechaBase.getFullYear();

    const mes =
      fechaBase.getMonth();


    const primerDia =
      new Date(
        anio,
        mes,
        1
      );


    const ultimoDia =
      new Date(
        anio,
        mes + 1,
        0
      );


    const dias:
      DiaCalendario[] = [];


    // ===================================================
    // ESPACIOS VACÍOS AL INICIO
    // ===================================================

    const diaSemanaPrimerDia =
      primerDia.getDay();


    for (
      let i = 0;
      i < diaSemanaPrimerDia;
      i++
    ) {
      dias.push({
        fecha: null,
        estado: null
      });
    }


    // ===================================================
    // DÍAS DEL MES
    // ===================================================

    for (
      let d = 1;
      d <= ultimoDia.getDate();
      d++
    ) {

      const fecha =
        new Date(
          anio,
          mes,
          d
        );


      const estado =
        this.obtenerEstadoDelDia(
          fecha
        );


      dias.push({
        fecha,
        estado
      });
    }


    // ===================================================
    // ESPACIOS VACÍOS AL FINAL
    // ===================================================

    const faltantes =
      (
        7 -
        (
          dias.length % 7
        )
      ) % 7;


    for (
      let i = 0;
      i < faltantes;
      i++
    ) {
      dias.push({
        fecha: null,
        estado: null
      });
    }


    this.diasDelMes =
      dias;
  }


  // =====================================================
  // ESTADO DEL DÍA
  //
  // MULTISEDE + NUEVO FORMATO PYTHON
  // =====================================================

  obtenerEstadoDelDia(
    fecha: Date
  ): string {

    const fechaStr =
      this.mxDay(
        fecha
      );


    const ahoraMX =
      DateTime
        .now()
        .setZone(
          this.ZONE
        );


    const hoyStr =
      ahoraMX.toISODate() ||
      '';


    // ===================================================
    // 1. EVENTO INDIVIDUAL DEL TRABAJADOR
    //
    // Tiene máxima prioridad
    // ===================================================

    const evtTrab =
      (
        this.eventosTrabajador ||
        []
      ).find(
        e =>
          this.mxDay(
            e.fecha as any
          ) === fechaStr
      );


    if (evtTrab) {

      const tipo =
        this.normalizarTexto(
          evtTrab.tipo
        );


      return (
        tipo === 'asistencia'
          ? 'Asistencia'
          : (
              evtTrab.tipo ||
              ''
            )
      );
    }


    // ===================================================
    // 2. ASISTENCIAS REALES
    // ===================================================

    /*
     * Formato nuevo:
     *
     * registros[]
     * primerRegistro
     * ultimoRegistro
     *
     *
     * Formato anterior:
     *
     * detalle[]
     */


    const marcasNuevas:
      any[] = [];


    const entradasLegacy:
      any[] = [];


    const salidasLegacy:
      any[] = [];


    const marcasUnicas =
      new Set<string>();


    let usoFormatoNuevo =
      false;


    // ===================================================
    // HELPER PARA AGREGAR MARCAS NUEVAS
    // ===================================================

    const agregarMarcaNueva =
      (
        registro: any,
        sedeFallback:
          any = null
      ) => {

        if (
          !registro?.fechaHora
        ) {
          return;
        }


        if (
          this.mxDay(
            registro.fechaHora
          ) !== fechaStr
        ) {
          return;
        }


        const sede =
          registro.sede ??
          sedeFallback ??
          null;


        const millis =
          this.mxMillis(
            registro.fechaHora
          );


        if (!millis) {
          return;
        }


        /*
         * Evitar duplicados:
         *
         * misma hora
         * misma sede
         */
        const clave =
          `${millis}|${String(
            sede ?? ''
          )}`;


        if (
          marcasUnicas.has(
            clave
          )
        ) {
          return;
        }


        marcasUnicas.add(
          clave
        );


        marcasNuevas.push({
          ...registro,
          sede
        });
      };


    // ===================================================
    // RECORRER TODOS LOS DOCUMENTOS
    // DE TODAS LAS SEDES
    // ===================================================

    for (
      const asistencia
      of this.asistencias || []
    ) {

      /*
       * Usamos any porque el modelo
       * Asistencia puede conservar todavía
       * solamente los campos antiguos.
       *
       * Después podemos actualizar
       * asistencia.model.ts.
       */
      const a: any =
        asistencia;


      const sedeDocumento =
        a.sede ??
        null;


      // ===============================================
      // NUEVO FORMATO PRINCIPAL
      //
      // registros[]
      // ===============================================

      if (
        Array.isArray(
          a.registros
        ) &&
        a.registros.length > 0
      ) {

        const registrosDia =
          a.registros.filter(
            (registro: any) =>
              this.mxDay(
                registro?.fechaHora
              ) === fechaStr
          );


        if (
          registrosDia.length > 0
        ) {

          usoFormatoNuevo =
            true;


          for (
            const registro
            of registrosDia
          ) {
            agregarMarcaNueva(
              registro,
              sedeDocumento
            );
          }


          /*
           * IMPORTANTE:
           *
           * Si existe registros[],
           * no procesamos otra vez
           * primerRegistro / ultimoRegistro
           * del mismo documento.
           */
          continue;
        }
      }


      // ===============================================
      // NUEVO FORMATO RESUMIDO
      //
      // primerRegistro
      // ultimoRegistro
      // totalRegistros
      // ===============================================

      if (
        this.mxDay(
          a.fecha
        ) === fechaStr &&
        a.primerRegistro?.fechaHora
      ) {

        usoFormatoNuevo =
          true;


        const cantidad =
          Math.max(
            Number(
              a.totalRegistros ||
              1
            ),
            1
          );


        agregarMarcaNueva(
          a.primerRegistro,
          sedeDocumento
        );


        /*
         * Si ese documento tiene
         * más de una marca,
         * agregamos también la última.
         */
        if (
          cantidad > 1 &&
          a.ultimoRegistro?.fechaHora
        ) {
          agregarMarcaNueva(
            a.ultimoRegistro,
            sedeDocumento
          );
        }


        continue;
      }


      // ===============================================
      // FORMATO ANTERIOR
      //
      // detalle[]
      // ===============================================

      if (
        Array.isArray(
          a.detalle
        )
      ) {

        for (
          const detalle
          of a.detalle
        ) {

          if (
            !detalle?.fechaHora
          ) {
            continue;
          }


          if (
            this.mxDay(
              detalle.fechaHora
            ) !== fechaStr
          ) {
            continue;
          }


          const tipo =
            this.normalizarTexto(
              detalle.tipo
            );


          const registro = {
            ...detalle,

            sede:
              detalle.sede ??
              sedeDocumento ??
              null
          };


          // Entradas antiguas
          if (
            tipo === 'entrada' ||
            tipo === 'asistencia' ||
            tipo === 'entrada manual'
          ) {

            entradasLegacy.push(
              registro
            );
          }


          // Salidas antiguas
          if (
            tipo.startsWith(
              'salida'
            )
          ) {

            salidasLegacy.push(
              registro
            );
          }
        }
      }
    }


    // ===================================================
    // FORMATO NUEVO
    //
    // UNIR TODAS LAS SEDES
    // ===================================================

    if (usoFormatoNuevo) {

      /*
       * Si existen datos viejos
       * mezclados con nuevos,
       * también los incluimos.
       */
      const todasLasMarcas =
        [
          ...marcasNuevas,
          ...entradasLegacy,
          ...salidasLegacy
        ];


      /*
       * Segunda protección contra duplicados.
       */
      const unicas:
        any[] = [];


      const clavesGlobales =
        new Set<string>();


      for (
        const registro
        of todasLasMarcas
      ) {

        const millis =
          this.mxMillis(
            registro.fechaHora
          );


        if (!millis) {
          continue;
        }


        const sede =
          registro.sede ??
          null;


        const clave =
          `${millis}|${String(
            sede ?? ''
          )}`;


        if (
          clavesGlobales.has(
            clave
          )
        ) {
          continue;
        }


        clavesGlobales.add(
          clave
        );


        unicas.push(
          registro
        );
      }


      // Orden global
      unicas.sort(
        (a, b) =>
          this.mxMillis(
            a.fechaHora
          ) -
          this.mxMillis(
            b.fechaHora
          )
      );


      // ===============================================
      // 2 O MÁS MARCAS
      //
      // Primera = Entrada
      // Última  = Salida
      // ===============================================

      if (
        unicas.length >= 2
      ) {

        return (
          'Asistencia Completa'
        );
      }


      // ===============================================
      // UNA SOLA MARCA
      // ===============================================

      if (
        unicas.length === 1
      ) {

        const marca =
          unicas[0];


        const minutoMarca =
          this.mxMinutoDelDia(
            marca.fechaHora
          );


        const salidaEsperadaMin =
          this.obtenerSalidaEsperadaMin(
            fechaStr
          );


        // =============================================
        // ÚNICA MARCA DESPUÉS DE LA HORA DE SALIDA
        //
        // Probable salida sin entrada
        // =============================================

        if (
          salidaEsperadaMin != null &&
          minutoMarca != null &&
          minutoMarca >=
            salidaEsperadaMin
        ) {

          return (
            'Registro incompleto'
          );
        }


        // =============================================
        // HOY
        // =============================================

        if (
          fechaStr === hoyStr
        ) {

          const ahoraMin =
            (
              ahoraMX.hour *
              60
            ) +
            ahoraMX.minute;


          /*
           * Todavía no termina
           * la jornada.
           */
          if (
            salidaEsperadaMin == null ||
            ahoraMin <
              salidaEsperadaMin
          ) {

            return (
              'Pendiente'
            );
          }


          /*
           * Ya terminó la jornada
           * y no apareció segunda marca.
           */
          return (
            'Salida Automática'
          );
        }


        // =============================================
        // DÍA PASADO
        // =============================================

        if (
          fechaStr <
          hoyStr
        ) {

          return (
            'Salida Automática'
          );
        }
      }
    }


    // ===================================================
    // FORMATO ANTIGUO detalle[]
    //
    // CONSERVAMOS LOS TIPOS ORIGINALES
    // ===================================================

    else {

      entradasLegacy.sort(
        (a, b) =>
          this.mxMillis(
            a.fechaHora
          ) -
          this.mxMillis(
            b.fechaHora
          )
      );


      salidasLegacy.sort(
        (a, b) =>
          this.mxMillis(
            a.fechaHora
          ) -
          this.mxMillis(
            b.fechaHora
          )
      );


      // Entrada + salida
      if (
        entradasLegacy.length > 0 &&
        salidasLegacy.length > 0
      ) {

        return (
          'Asistencia Completa'
        );
      }


      // Solo entrada
      if (
        entradasLegacy.length > 0 &&
        salidasLegacy.length === 0
      ) {

        const entrada =
          entradasLegacy[0];


        const minutoMarca =
          this.mxMinutoDelDia(
            entrada.fechaHora
          );


        const salidaEsperadaMin =
          this.obtenerSalidaEsperadaMin(
            fechaStr
          );


        /*
         * Protección para datos antiguos:
         *
         * una única marca tardía
         * puede representar salida sin entrada.
         */
        if (
          entradasLegacy.length === 1 &&
          salidaEsperadaMin != null &&
          minutoMarca != null &&
          minutoMarca >=
            salidaEsperadaMin
        ) {

          return (
            'Registro incompleto'
          );
        }


        if (
          fechaStr === hoyStr
        ) {

          const ahoraMin =
            (
              ahoraMX.hour *
              60
            ) +
            ahoraMX.minute;


          if (
            salidaEsperadaMin == null ||
            ahoraMin <
              salidaEsperadaMin
          ) {

            return (
              'Pendiente'
            );
          }


          return (
            'Salida Automática'
          );
        }


        if (
          fechaStr <
          hoyStr
        ) {

          return (
            'Salida Automática'
          );
        }
      }


      // Solo salida
      if (
        entradasLegacy.length === 0 &&
        salidasLegacy.length > 0
      ) {

        return (
          'Registro incompleto'
        );
      }
    }


    // ===================================================
    // 3. EVENTO DE SEDE
    // ===================================================

    const evtSede =
      (
        this.eventosSede ||
        []
      ).find(
        e =>
          this.mxDay(
            e.fecha as any
          ) === fechaStr
      );


    if (evtSede) {

      return (
        evtSede.tipo ||
        ''
      );
    }


    // ===================================================
    // 4. FECHA FUTURA
    // ===================================================

    if (
      fechaStr >
      hoyStr
    ) {

      return '';
    }


    // ===================================================
    // 5. SIN MARCAS
    // ===================================================

    return 'Falta';
  }


  // =====================================================
  // PRESENTACIÓN
  // =====================================================

  getClaseEstado(
    estado:
      string |
      null
  ): string {

    if (!estado) {
      return '';
    }


    return estado
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        / /g,
        '-'
      )
      .replace(
        /[^\w-]/g,
        ''
      );
  }


  getDescripcionEstado(
    estado:
      string |
      null
  ): string {

    const mapa:
      {
        [k: string]: string
      } = {

      'Asistencia Completa':
        'Entrada y salida registradas correctamente',

      'Salida Automática':
        'Entrada registrada, pero sin salida',

      'Pendiente':
        'Entrada registrada, pero sin salida (día en curso)',

      /*
       * Conservamos Incompleta
       * por compatibilidad con datos/vistas viejas.
       */
      'Incompleta':
        'Salida sin registro de entrada',

      'Registro incompleto':
        'Se registró una salida, pero no existe una entrada válida',

      'Falta':
        'No se registró ninguna entrada',

      'Vacaciones':
        'Vacaciones programadas',

      'Vacaciones Pagadas':
        'Vacaciones con goce',

      'Permiso':
        'Permiso personal',

      'Permiso con Goce':
        'Permiso con goce de sueldo',

      'Incapacidad':
        'Incapacidad médica',

      'Descanso':
        'Día libre programado',

      'Festivo':
        'Día festivo oficial',

      'Puente':
        'Día puente',

      'Media Jornada':
        'Medio día trabajado',

      'Capacitación':
        'Sesión de capacitación',

      'Evento':
        'Evento institucional',

      'Suspensión':
        'Actividad suspendida',

      'Asistencia':
        'Presente (marcada manualmente)'
    };


    return estado
      ? (
          mapa[estado] ||
          estado
        )
      : '';
  }


  getIconoEstado(
    estado:
      string |
      null
  ): string {

    const iconos:
      {
        [k: string]: string
      } = {

      'Asistencia Completa':
        '✅',

      'Salida Automática':
        '🕒',

      'Pendiente':
        '⏳',

      'Incompleta':
        '⚠️',

      'Registro incompleto':
        '⚠️',

      'Falta':
        '❌',

      'Vacaciones':
        '🏖️',

      'Vacaciones Pagadas':
        '💸',

      'Permiso':
        '📝',

      'Permiso con Goce':
        '🧾',

      'Incapacidad':
        '🏥',

      'Descanso':
        '🛌',

      'Festivo':
        '🎉',

      'Puente':
        '🌉',

      'Media Jornada':
        '🌓',

      'Capacitación':
        '📚',

      'Evento':
        '🎤',

      'Suspensión':
        '🚫',

      'Asistencia':
        '✔️'
    };


    return estado
      ? (
          iconos[estado] ||
          '📌'
        )
      : '';
  }


  // =====================================================
  // NAVEGACIÓN
  // =====================================================

  private emitirRangoMes(): void {

    const anio =
      this.fechaActual
        .getFullYear();

    const mes =
      this.fechaActual
        .getMonth();


    const inicio =
      new Date(
        anio,
        mes,
        1
      );


    const fin =
      new Date(
        anio,
        mes + 1,
        0,
        23,
        59,
        59,
        999
      );


    this.mesCambiado.emit({
      inicio,
      fin
    });
  }


  mesAnterior(): void {

    const f =
      new Date(
        this.fechaActual
      );


    f.setMonth(
      f.getMonth() - 1
    );


    this.fechaActual =
      f;


    this.emitirRangoMes();


    this.generarDiasDelMes(
      this.fechaActual
    );
  }


  mesSiguiente(): void {

    const f =
      new Date(
        this.fechaActual
      );


    f.setMonth(
      f.getMonth() + 1
    );


    this.fechaActual =
      f;


    this.emitirRangoMes();


    this.generarDiasDelMes(
      this.fechaActual
    );
  }
}


interface DiaCalendario {
  fecha:
    Date |
    null;

  estado:
    string |
    null;
}