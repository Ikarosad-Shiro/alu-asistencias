// ======================================================
// REGISTRO INDIVIDUAL DE ASISTENCIA
// ======================================================

/**
 * Representa una marca individual del checador.
 *
 * Compatible con:
 * - detalle[] del formato anterior
 * - registros[] del formato nuevo
 */
export interface RegistroDetalle {

  /**
   * En información antigua puede ser:
   *
   * Entrada
   * Salida
   * Entrada Manual
   * Salida Manual
   * Asistencia
   * Salida Automática
   *
   * En el formato nuevo también puede
   * venir como Registro o no venir.
   */
  tipo?: string;

  /**
   * Fecha y hora de la marca.
   */
  fechaHora: string;

  /**
   * ID del trabajador si viene incluido
   * dentro del registro.
   */
  trabajador?: string | number;

  /**
   * Sede donde ocurrió realmente la marca.
   */
  sede?: number | null;

  /**
   * Indica si la marca ya fue sincronizada.
   */
  sincronizado?: boolean;

  /**
   * Para compatibilidad con información anterior.
   */
  salida_automatica?: boolean;
}


// ======================================================
// DOCUMENTO DE ASISTENCIA
// ======================================================

/**
 * Documento de la colección "asistencias".
 *
 * Compatible con el formato anterior
 * y con el nuevo formato generado por Python.
 */
export interface Asistencia {

  /**
   * ID de MongoDB.
   */
  _id?: string;

  /**
   * Fecha del documento.
   *
   * YYYY-MM-DD
   */
  fecha: string;

  /**
   * ID del trabajador.
   *
   * Puede ser _id de Mongo o id_checador
   * dependiendo del documento.
   */
  trabajador: string | number;

  /**
   * Sede a la que pertenece el documento.
   */
  sede: number;

  /**
   * Estado de la asistencia.
   *
   * Puede no venir calculado en documentos nuevos.
   */
  estado?: string;


  // ====================================================
  // FORMATO ANTERIOR
  // ====================================================

  /**
   * Formato anterior:
   *
   * detalle: [
   *   {
   *     tipo: "Entrada",
   *     fechaHora: "..."
   *   },
   *   {
   *     tipo: "Salida",
   *     fechaHora: "..."
   *   }
   * ]
   */
  detalle?: RegistroDetalle[];


  // ====================================================
  // FORMATO NUEVO
  // ====================================================

  /**
   * Todas las marcas crudas del checador.
   */
  registros?: RegistroDetalle[];

  /**
   * Primera marca del documento.
   */
  primerRegistro?: RegistroDetalle | null;

  /**
   * Última marca del documento.
   */
  ultimoRegistro?: RegistroDetalle | null;

  /**
   * Cantidad total de marcas.
   */
  totalRegistros?: number;


  // ====================================================
  // CAMPOS CALCULADOS MULTISEDE
  // ====================================================

  /**
   * Sede de la primera marca global.
   */
  sedeEntrada?: number | null;

  /**
   * Sede de la última marca global.
   */
  sedeSalida?: number | null;

  /**
   * Sedes donde tuvo registros durante el día.
   */
  sedesPresentes?: number[];
}


// ======================================================
// EVENTOS ESPECIALES
// ======================================================

/**
 * Eventos pertenecientes al calendario
 * de una sede o de un trabajador.
 */
export interface EventoEspecial {

  /**
   * YYYY-MM-DD
   */
  fecha: string;

  /**
   * Ejemplos:
   *
   * Descanso
   * Vacaciones
   * Permiso
   * Incapacidad
   * Falta
   * Festivo
   * Puente
   * Media Jornada
   * Capacitación
   * Evento
   * Suspensión
   * Asistencia
   */
  tipo: string;

  /**
   * Descripción opcional.
   */
  descripcion?: string;

  /**
   * Horario para eventos especiales.
   */
  horaInicio?: string;
  horaFin?: string;

  /**
   * Horarios para asistencia manual.
   */
  horaEntrada?: string;
  horaSalida?: string;
}