export interface HorariosModel {
}
// 📌 Modelos para manejo de horarios y jornadas

export interface JornadaBase {
  ini: string;           // Hora de inicio en formato HH:mm
  fin: string;           // Hora de fin en formato HH:mm
  overnight?: boolean;   // Si la jornada cruza medianoche
}

export interface ReglaHorario {
  dow: number;           // Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
  jornadas: JornadaBase[];
}

export interface HorarioBase {
  desde: Date | string;  // Fecha desde la que aplica el horario base
  reglas: ReglaHorario[];
  meta?: {               // Datos adicionales (puede ampliarse)
    version?: number;
  };
}

export interface ExcepcionHorario {
  _id?: string;          // ID opcional (si viene de la BD)
  fecha: string;         // Fecha en formato YYYY-MM-DD
  tipo:                  // Tipo de excepción
    | 'asistencia'
    | 'descanso'
    | 'media_jornada'
    | 'festivo'
    | 'evento'
    | 'suspension'
    | 'personalizado';
  descripcion?: string;  // Descripción opcional
  horaEntrada?: string;  // Hora de entrada (HH:mm) si aplica
  horaSalida?: string;   // Hora de salida (HH:mm) si aplica
}

export interface ExcepcionRango {
  _id?: string;
  desde: string;           // "YYYY-MM-DD"
  hasta: string;           // "YYYY-MM-DD"
  dows: number[];          // [0..6], vacío = todos los días
  jornadas: {              // mismas propiedades que JornadaBase
    ini: string;           // "HH:mm"
    fin: string;           // "HH:mm"
    overnight?: boolean;
  }[];
  descripcion?: string;
}
