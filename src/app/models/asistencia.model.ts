// 📌 Representa cada entrada o salida
export interface RegistroDetalle {
  tipo: 'Entrada' | 'Salida';
  fechaHora: string; // o Date si ya lo conviertes
  sincronizado?: boolean;
}

// 📌 Documento en la colección "asistencias"
export interface Asistencia {
  fecha: string; // YYYY-MM-DD
  trabajador: string | number;
  sede: number;
  estado: string;
  detalle: RegistroDetalle[];
}

// 📌 Evento en el calendario sede o trabajador
export interface EventoEspecial {
  fecha: string; // YYYY-MM-DD
  tipo: string;  // Descanso, Vacaciones, Falta, etc.
}
