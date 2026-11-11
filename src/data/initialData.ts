import { Student, Teacher, SchoolConfig, CalendarException } from '../types';

export const INITIAL_CONFIG: SchoolConfig = {
  nombre_colegio: 'Colegio Ricardo Bentín 64935',
  hora_limite: '08:00 AM',
  total_dias: 24,
  logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJaEC9lZWlZ-oCP8mZfecwDroVpB2O_hR9Vs8RGTRN0w&s=10'
};

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 't-1',
    dni: '10482910',
    nombre_completo: 'Prof. Roberto Silva Vargas',
    especialidad: 'Matemática y Geometría',
    foto: '/assets/aistudio/imagen_login_ed8138ec.jpg'
  },
  {
    id: 't-2',
    dni: '20938471',
    nombre_completo: 'Lic. Carmen Rosa Medina Cruz',
    especialidad: 'Comunicación y Lengua Española',
    foto: ''
  },
  {
    id: 't-3',
    dni: '30491822',
    nombre_completo: 'Mg. Juan Carlos Rios Peña',
    especialidad: 'Ciencia, Tecnología y Ambiente',
    foto: ''
  },
  {
    id: 't-4',
    dni: '40582911',
    nombre_completo: 'Lic. Patricia Vega Morales',
    especialidad: 'Ciencias Sociales e Historia del Perú',
    foto: ''
  },
  {
    id: 't-5',
    dni: '50192834',
    nombre_completo: 'Prof. Leoncio Salazar Huamán',
    especialidad: 'Educación Física y Deportes',
    foto: ''
  },
  {
    id: 't-6',
    dni: '60392819',
    nombre_completo: 'Lic. Marleny Tuesta Cárdenas',
    especialidad: 'Inglés y Tutoría Escolar',
    foto: ''
  }
];

import { REAL_STUDENTS_LIST } from './realStudents';

export const INITIAL_STUDENTS: Student[] = REAL_STUDENTS_LIST.map((st) => ({
  dni: st.dni,
  name: st.name,
  grade: st.grade,
  section: st.section,
  attendances: 0,
  tardies: 0,
  absences: 0,
  lastDate: undefined,
  lastTime: undefined,
  foto: '',
  history: []
}));

export const INITIAL_EXCEPTIONS: CalendarException[] = [
  { date: '2026-05-01', tipo: 'feriado', motivo: 'Día del Trabajo' },
  { date: '2026-06-07', tipo: 'feriado', motivo: 'Día de la Bandera' },
  { date: '2026-07-28', tipo: 'feriado', motivo: 'Fiestas Patrias' },
  { date: '2026-07-29', tipo: 'feriado', motivo: 'Fiestas Patrias' },
  { date: '2026-08-30', tipo: 'feriado', motivo: 'Santa Rosa de Lima' },
  { date: '2026-10-08', tipo: 'feriado', motivo: 'Combate de Angamos' },
  { date: '2026-11-01', tipo: 'feriado', motivo: 'Día de Todos los Santos' }
];
