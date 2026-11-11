/**
 * Tipos de datos para el Sistema de Asistencia Escolar
 * Colegio Ricardo Bentín 64935
 */

export type AttendanceStatus = 'Presente' | 'Tarde' | 'Ausente';

export interface AttendanceRecord {
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM:SS or HH:MM
  status: AttendanceStatus;
  justification?: string;
}

export interface Student {
  dni: string;
  name: string;
  grade: string;         // '1', '2', '3', '4', '5'
  section: string;       // 'A', 'B', 'C', 'D', 'Única'
  foto?: string;         // Data URL or image path
  attendances: number;
  tardies: number;
  absences: number;
  lastDate?: string;
  lastTime?: string;
  history: AttendanceRecord[];
}

export interface Teacher {
  id: string;
  dni: string;
  nombre_completo: string;
  especialidad: string;
  foto?: string;
}

export interface SchoolConfig {
  nombre_colegio: string;
  hora_limite: string;   // '08:00'
  total_dias: number;
  logo_url: string;
}

export type DayExceptionType = 'normal' | 'feriado' | 'sin_clases';

export interface CalendarException {
  date: string;          // YYYY-MM-DD
  tipo: DayExceptionType;
  motivo?: string;
}

export interface UserSession {
  isLogged: boolean;
  username: string;
  fullname: string;
}
