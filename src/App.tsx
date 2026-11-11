/**
 * Sistema Integral de Control de Asistencia Escolar
 * Colegio Ricardo Bentín 64935
 * Frontend React + Tailwind + QR + Kiosco + Credenciales + Carpetas por Aulas
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  INITIAL_CONFIG,
  INITIAL_STUDENTS,
  INITIAL_TEACHERS,
  INITIAL_EXCEPTIONS
} from './data/initialData';
import {
  Student,
  Teacher,
  SchoolConfig,
  CalendarException,
  AttendanceStatus,
  AttendanceRecord
} from './types';
import { playSuccessChime, playWarningChime } from './utils/audio';
import { exportStudentsToCSV, exportFullBackupJSON, exportDatabaseSQL } from './utils/export';
import { formatToAMPM, getCurrentTimeAMPM, parseLimitTimeToMinutes } from './utils/time';
import { CarnetCard } from './components/CarnetCard';
import { KioskModal } from './components/KioskModal';
import { ScannerModal } from './components/ScannerModal';
import { LoginView } from './components/LoginView';
import { ConfirmModal } from './components/ConfirmModal';
import {
  QrCode,
  Users,
  Calendar as CalendarIcon,
  GraduationCap,
  Settings,
  Moon,
  Sun,
  Printer,
  FileSpreadsheet,
  Download,
  Upload,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Folder,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Camera,
  PrinterIcon,
  X,
  FileText,
  LogOut,
  User as UserIcon
} from 'lucide-react';

export default function App() {
  // -------------------------------------------------------------
  // ESTADO GENERAL CON PERSISTENCIA EN LOCALSTORAGE
  // -------------------------------------------------------------
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('bentin_students_v6');
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });

  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const saved = localStorage.getItem('bentin_teachers_v5');
    return saved ? JSON.parse(saved) : INITIAL_TEACHERS;
  });

  const [config, setConfig] = useState<SchoolConfig>(() => {
    const saved = localStorage.getItem('bentin_config_v5');
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });

  const [exceptions, setExceptions] = useState<CalendarException[]>(() => {
    const saved = localStorage.getItem('bentin_exceptions_v5');
    return saved ? JSON.parse(saved) : INITIAL_EXCEPTIONS;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('bentin_dark_mode') === 'true';
  });

  // Sesión de Usuario (Login con usuario: admin / clave: 63935)
  const [session, setSession] = useState<{ isLogged: boolean; username: string; fullname: string }>(() => {
    const saved = localStorage.getItem('bentin_session_user');
    return saved ? JSON.parse(saved) : { isLogged: false, username: '', fullname: '' };
  });

  // Modal de Confirmación Institucional (Reemplazo seguro de window.confirm para iframe)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Pestañas activas: 'asistencia' | 'estudiantes' | 'carnets' | 'profesores' | 'calendario' | 'reportes'
  // NOTA: "Archivos Hosting" ha sido removido de la interfaz por instrucción del usuario.
  const [activeTab, setActiveTab] = useState<string>('asistencia');

  // Input de DNI manual
  const [dniInput, setDniInput] = useState<string>('');
  const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'success' | 'danger' | 'warning' } | null>(null);

  // Modo Kiosco Modal
  const [kioskData, setKioskData] = useState<{
    student: Student;
    status: AttendanceStatus;
    timeFormatted: string;
  } | null>(null);

  // Modales Institucionales
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherPhotoPreview, setTeacherPhotoPreview] = useState<string>('');
  const [fullImagePreview, setFullImagePreview] = useState<string | null>(null);

  // Modal de Subir Foto a Estudiante
  const [photoTargetDni, setPhotoTargetDni] = useState<string | null>(null);

  // Modal de Carpeta / Aula seleccionada en ESTUDIANTES
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [classroomSearch, setClassroomSearch] = useState<string>('');

  // Modal de Carpeta / Aula seleccionada en CARNETS QR
  const [selectedCarnetAula, setSelectedCarnetAula] = useState<string | null>(null);

  // Modal de Historial de Asistencia de un alumno
  const [historyTargetStudent, setHistoryTargetStudent] = useState<Student | null>(null);

  // Modales dedicados para EDITAR y JUSTIFICAR registro de asistencia
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<{
    dni: string;
    studentName: string;
    date: string;
    time: string;
    status: AttendanceStatus;
  } | null>(null);

  const [justifyingAttendanceRecord, setJustifyingAttendanceRecord] = useState<{
    dni: string;
    studentName: string;
    date: string;
    currentMotive: string;
  } | null>(null);

  // Modal de Edición de Estudiante
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingStudentPhoto, setEditingStudentPhoto] = useState<string>('');
  const editStudentPhotoInputRef = useRef<HTMLInputElement>(null);

  // Modal de Detalle por Estado (Presente, Tarde, Ausente)
  const [detailModalStatus, setDetailModalStatus] = useState<AttendanceStatus | null>(null);
  const [detailFilterGrade, setDetailFilterGrade] = useState<string>('all');
  const [detailFilterSection, setDetailFilterSection] = useState<string>('all');

  // Calendario
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const [selectedDayDetail, setSelectedDayDetail] = useState<string | null>(null);

  // Reporte Oficial Fecha y Filtros
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportFilterGrade, setReportFilterGrade] = useState<string>('all');
  const [reportFilterSection, setReportFilterSection] = useState<string>('all');

  // Referencias para archivos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentPhotoInputRef = useRef<HTMLInputElement>(null);
  const teacherPhotoFileInputRef = useRef<HTMLInputElement>(null);
  const teacherCardPhotoInputRef = useRef<HTMLInputElement>(null);
  const [teacherCardTargetId, setTeacherCardTargetId] = useState<string | null>(null);

  // Sincronizar tema oscuro con clase 'dark' de Tailwind y documentElement
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('bentin_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('bentin_dark_mode', 'false');
    }
  }, [isDarkMode]);

  // Guardar en localStorage ante cualquier cambio
  useEffect(() => {
    localStorage.setItem('bentin_students_v6', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('bentin_teachers_v5', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('bentin_config_v5', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('bentin_exceptions_v5', JSON.stringify(exceptions));
  }, [exceptions]);

  // -------------------------------------------------------------
  // VALIDACIÓN DE DÍAS HÁBILES: EXCLUIR SÁBADOS Y DOMINGOS
  // -------------------------------------------------------------
  const isWeekendDay = (dateToCheck: Date = new Date()): boolean => {
    const day = dateToCheck.getDay();
    return day === 0 || day === 6; // 0 = Domingo, 6 = Sábado
  };

  // -------------------------------------------------------------
  // ESTADÍSTICAS DEL DÍA DE HOY
  // -------------------------------------------------------------
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const stats = useMemo(() => {
    let presents = 0;
    let tardies = 0;
    let absents = 0;

    students.forEach((s) => {
      const reg = s.history?.find((h) => h.date === todayStr);
      if (reg) {
        if (reg.status === 'Presente') presents++;
        else if (reg.status === 'Tarde') tardies++;
        else if (reg.status === 'Ausente') absents++;
      }
    });

    return {
      total: students.length,
      presents,
      tardies,
      absents
    };
  }, [students, todayStr]);

  // -------------------------------------------------------------
  // FUNCIÓN PARA PROCESAR INGRESO DE ASISTENCIA (QR O MANUAL)
  // -------------------------------------------------------------
  const processAttendance = (dniToScan: string) => {
    const cleanDni = dniToScan.trim();
    if (!cleanDni) return;

    // Validación 1: Sábados y domingos no hay clases escolares
    if (isWeekendDay()) {
      playWarningChime();
      setAlertInfo({
        message: 'Hoy es fin de semana (sábado o domingo). En los colegios solo se dictan clases de lunes a viernes.',
        type: 'warning'
      });
      return;
    }

    // Validación 2: Verificar si hoy es feriado o sin clases
    const exceptionToday = exceptions.find((e) => e.date === todayStr);
    if (exceptionToday && exceptionToday.tipo !== 'normal') {
      const label = exceptionToday.tipo === 'feriado' ? 'FERIADO' : 'DÍA SIN CLASES';
      playWarningChime();
      setAlertInfo({
        message: `Hoy está marcado como ${label} (${exceptionToday.motivo || 'No lectivo'}). No se registran asistencias.`,
        type: 'warning'
      });
      return;
    }

    const studentIndex = students.findIndex((s) => s.dni === cleanDni);
    if (studentIndex === -1) {
      playWarningChime();
      setAlertInfo({
        message: `DNI "${cleanDni}" no está registrado en el padrón de estudiantes.`,
        type: 'danger'
      });
      return;
    }

    const student = students[studentIndex];

    // Verificar si ya registró asistencia hoy
    const existingIndex = student.history?.findIndex((h) => h.date === todayStr);
    if (existingIndex !== undefined && existingIndex !== -1) {
      const existing = student.history[existingIndex];
      playWarningChime();
      setAlertInfo({
        message: `${student.name} ya registró ingreso hoy a las ${formatToAMPM(existing.time)} (${existing.status}).`,
        type: 'warning'
      });
      return;
    }

    // Calcular estado: ¿Presente o Tarde? (Comparación considerando formato AM / PM)
    const timeData = getCurrentTimeAMPM();
    const limitMinutes = parseLimitTimeToMinutes(config.hora_limite);
    const status: AttendanceStatus = timeData.totalMinutes > limitMinutes ? 'Tarde' : 'Presente';

    const newRecord: AttendanceRecord = {
      date: todayStr,
      time: timeData.formatted,
      status
    };

    const updatedStudent: Student = {
      ...student,
      attendances: status === 'Presente' ? student.attendances + 1 : student.attendances,
      tardies: status === 'Tarde' ? student.tardies + 1 : student.tardies,
      lastDate: todayStr,
      lastTime: timeData.formatted,
      history: [newRecord, ...(student.history || [])]
    };

    const updatedList = [...students];
    updatedList[studentIndex] = updatedStudent;
    setStudents(updatedList);

    // Audio y Kiosco
    playSuccessChime();
    setKioskData({
      student: updatedStudent,
      status,
      timeFormatted: timeData.formatted
    });

    setAlertInfo({
      message: `¡Asistencia registrada para ${student.name}! (${status} a las ${timeData.formatted})`,
      type: 'success'
    });
    setDniInput('');
  };

  // Iniciar nuevo día lectivo
  const handleNextDay = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Iniciar Nuevo Día Lectivo',
      message: '¿Desea iniciar un nuevo día lectivo? Esto incrementará el total de días acumulados de lunes a viernes.',
      confirmText: 'Sí, nuevo día',
      confirmColor: 'primary',
      onConfirm: () => {
        setConfig((prev) => ({ ...prev, total_dias: prev.total_dias + 1 }));
        setAlertInfo({
          message: '¡Nuevo día lectivo iniciado! El contador de días lectivos se incrementó.',
          type: 'success'
        });
        setConfirmDialog(null);
      }
    });
  };

  // Marcar restantes como ausentes (Bloqueado sábados y domingos)
  const handleMarkAllAbsent = () => {
    if (isWeekendDay()) {
      setAlertInfo({
        message: 'Hoy es fin de semana (sábado/domingo). Los colegios solo enseñan de lunes a viernes, por lo que no se marcan ausencias en fines de semana.',
        type: 'warning'
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Marcar Ausencias del Día',
      message: '¿Desea marcar como Ausentes a todos los estudiantes que no hayan registrado ingreso hoy?',
      confirmText: 'Sí, marcar ausentes',
      confirmColor: 'warning',
      onConfirm: () => {
        let markedCount = 0;
        const updated = students.map((s) => {
          const hasToday = s.history?.some((h) => h.date === todayStr);
          if (!hasToday) {
            markedCount++;
            return {
              ...s,
              absences: s.absences + 1,
              history: [
                { date: todayStr, time: '--:--', status: 'Ausente' as AttendanceStatus },
                ...(s.history || [])
              ]
            };
          }
          return s;
        });

        setStudents(updated);
        setAlertInfo({
          message: `Se registraron ${markedCount} ausencias correspondientes al día de hoy.`,
          type: 'warning'
        });
        setConfirmDialog(null);
      }
    });
  };

  // Editar días acumulados
  const handleEditTotalDays = () => {
    setShowConfigModal(true);
  };

  // Editar hora límite de puntualidad con selector AM/PM
  const handleEditTimeLimit = () => {
    setShowConfigModal(true);
  };

  // -------------------------------------------------------------
  // GESTIÓN DE ESTUDIANTES: AGRUPACIÓN POR AULAS
  // -------------------------------------------------------------
  const canonicalOrder = [
    'PRIMERO "A"', 'PRIMERO "B"', 'PRIMERO "C"',
    'SEGUNDO "A"', 'SEGUNDO "B"', 'SEGUNDO "C"', 'SEGUNDO "D"',
    'TERCERO "A"', 'TERCERO "B"', 'TERCERO "C"', 'TERCERO "D"', 'TERCERO "E"',
    'CUARTO "A"', 'CUARTO "B"', 'CUARTO "C"',
    'QUINTO "A"', 'QUINTO "B"', 'QUINTO "C"'
  ];

  const mapGradeToText: { [key: string]: string } = {
    '1': 'PRIMERO', '1°': 'PRIMERO', 'PRIMERO': 'PRIMERO',
    '2': 'SEGUNDO', '2°': 'SEGUNDO', 'SEGUNDO': 'SEGUNDO',
    '3': 'TERCERO', '3°': 'TERCERO', 'TERCERO': 'TERCERO',
    '4': 'CUARTO', '4°': 'CUARTO', 'CUARTO': 'CUARTO',
    '5': 'QUINTO', '5°': 'QUINTO', 'QUINTO': 'QUINTO'
  };

  const classrooms = useMemo(() => {
    const map: { [key: string]: Student[] } = {};

    canonicalOrder.forEach((key) => {
      map[key] = [];
    });

    students.forEach((s) => {
      const rawGrade = String(s.grade || '1').trim();
      const gradeText = mapGradeToText[rawGrade] || `${rawGrade}°`;
      const sectionText = String(s.section || 'A').trim().toUpperCase();
      const key = `${gradeText} "${sectionText}"`;

      if (!map[key]) map[key] = [];
      map[key].push(s);
    });

    const keys = Object.keys(map).sort((a, b) => {
      const idxA = canonicalOrder.indexOf(a);
      const idxB = canonicalOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return keys.map((key) => {
      const isGold = key.startsWith('PRIMERO') || key.startsWith('SEGUNDO');
      return {
        name: key,
        students: map[key],
        colorAccent: isGold ? '#f59e0b' : '#38bdf8'
      };
    });
  }, [students]);

  // Subir foto a estudiante
  const handleSaveStudentPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTargetDni) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setStudents((prev) =>
        prev.map((s) => (s.dni === photoTargetDni ? { ...s, foto: base64 } : s))
      );
      setPhotoTargetDni(null);
      setAlertInfo({
        message: 'Fotografía del carnet actualizada correctamente.',
        type: 'success'
      });
    };
    reader.readAsDataURL(file);
  };

  // Eliminar estudiante
  const handleDeleteStudent = (dni: string) => {
    const st = students.find((s) => s.dni === dni);
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Estudiante',
      message: `¿Está seguro de eliminar al estudiante ${st?.name || 'seleccionado'} (DNI ${dni}) del padrón oficial? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
      confirmColor: 'danger',
      onConfirm: () => {
        setStudents((prev) => prev.filter((s) => s.dni !== dni));
        setAlertInfo({ message: `Estudiante ${st?.name || dni} eliminado del padrón.`, type: 'danger' });
        setConfirmDialog(null);
      }
    });
  };

  // -------------------------------------------------------------
  // OPERACIONES DE HISTORIAL: EDITAR, JUSTIFICAR Y BORRAR
  // -------------------------------------------------------------
  const handleSaveEditedRecord = (
    dni: string,
    originalDate: string,
    newStatus: AttendanceStatus,
    newTime: string
  ) => {
    const timeFormatted = formatToAMPM(newTime);

    setStudents((prev) =>
      prev.map((s) => {
        if (s.dni !== dni) return s;
        const newHist = (s.history || []).map((h) =>
          h.date === originalDate ? { ...h, status: newStatus, time: timeFormatted } : h
        );

        const presents = newHist.filter((h) => h.status === 'Presente').length;
        const tardies = newHist.filter((h) => h.status === 'Tarde').length;
        const absences = newHist.filter((h) => h.status === 'Ausente').length;

        const updatedStudent: Student = {
          ...s,
          attendances: presents,
          tardies,
          absences,
          history: newHist
        };

        if (historyTargetStudent?.dni === dni) {
          setHistoryTargetStudent(updatedStudent);
        }
        return updatedStudent;
      })
    );

    setEditingAttendanceRecord(null);
    setAlertInfo({ message: 'Registro de asistencia actualizado correctamente.', type: 'success' });
  };

  const handleSaveJustification = (dni: string, date: string, motive: string) => {
    const cleanMotive = motive.trim();

    setStudents((prev) =>
      prev.map((s) => {
        if (s.dni !== dni) return s;
        const newHist = (s.history || []).map((h) =>
          h.date === date ? { ...h, justification: cleanMotive } : h
        );

        const updatedStudent: Student = { ...s, history: newHist };
        if (historyTargetStudent?.dni === dni) {
          setHistoryTargetStudent(updatedStudent);
        }
        return updatedStudent;
      })
    );

    setJustifyingAttendanceRecord(null);
    setAlertInfo({ message: 'Justificación guardada correctamente.', type: 'success' });
  };

  const handleDeleteAttendanceRecord = (dni: string, date: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Registro de Asistencia',
      message: `¿Está seguro de eliminar el registro de asistencia del día ${date} para este estudiante? Los totales de asistencia se recalcularán automáticamente.`,
      confirmText: 'Sí, borrar registro',
      confirmColor: 'danger',
      onConfirm: () => {
        setStudents((prev) =>
          prev.map((s) => {
            if (s.dni !== dni) return s;
            const newHist = (s.history || []).filter((h) => h.date !== date);
            const presents = newHist.filter((h) => h.status === 'Presente').length;
            const tardies = newHist.filter((h) => h.status === 'Tarde').length;
            const absences = newHist.filter((h) => h.status === 'Ausente').length;

            const updatedStudent: Student = {
              ...s,
              attendances: presents,
              tardies,
              absences,
              history: newHist
            };
            if (historyTargetStudent?.dni === dni) {
              setHistoryTargetStudent(updatedStudent);
            }
            return updatedStudent;
          })
        );
        setAlertInfo({ message: 'Registro de asistencia eliminado.', type: 'danger' });
        setConfirmDialog(null);
      }
    });
  };

  // -------------------------------------------------------------
  // GESTIÓN DE PROFESORES: EDICIÓN, ELIMINACIÓN Y CAMBIO DE FOTO
  // -------------------------------------------------------------
  const handleTeacherPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTeacherPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  // Cambio directo de foto desde la tarjeta del profesor
  const handleDirectTeacherCardPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teacherCardTargetId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacherCardTargetId ? { ...t, foto: base64 } : t))
      );
      setTeacherCardTargetId(null);
      setAlertInfo({ message: 'Fotografía del docente actualizada.', type: 'success' });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteTeacher = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Docente',
      message: `¿Está seguro de eliminar al docente ${name}? Esta acción quitará al docente del directorio institucional.`,
      confirmText: 'Sí, eliminar docente',
      confirmColor: 'danger',
      onConfirm: () => {
        setTeachers((prev) => prev.filter((t) => t.id !== id));
        setAlertInfo({ message: `Docente ${name} eliminado del directorio.`, type: 'danger' });
        setConfirmDialog(null);
      }
    });
  };

  // -------------------------------------------------------------
  // CALENDARIO ESCOLAR (EXCLUYENDO SÁBADOS Y DOMINGOS)
  // -------------------------------------------------------------
  const calendarMonthData = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const mondayOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < mondayOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;

      const dateObj = new Date(year, month, d);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      const ex = exceptions.find((e) => e.date === dateStr);
      days.push({
        dayNumber: d,
        dateStr,
        isWeekend,
        type: ex ? ex.tipo : isWeekend ? 'sin_clases' : 'normal',
        motivo: ex?.motivo || (isWeekend ? 'Fin de semana' : '')
      });
    }

    return {
      title: `${monthNames[month]} ${year}`,
      days
    };
  }, [currentCalendarDate, exceptions]);

  // Alumnos del aula actualmente seleccionada para carnets
  const carnetAulaStudents = useMemo(() => {
    if (!selectedCarnetAula) return [];
    return students.filter((s) => {
      const rawGrade = String(s.grade || '1').trim();
      const gradeText = mapGradeToText[rawGrade] || `${rawGrade}°`;
      const sectionText = String(s.section || 'A').trim().toUpperCase();
      const key = `${gradeText} "${sectionText}"`;
      return key === selectedCarnetAula;
    });
  }, [students, selectedCarnetAula]);

  // Si no ha iniciado sesión, mostrar pantalla de inicio de sesión institucional
  if (!session.isLogged) {
    return (
      <LoginView
        onLoginSuccess={(userData) => {
          const fullSession = { isLogged: true, ...userData };
          setSession(fullSession);
          localStorage.setItem('bentin_session_user', JSON.stringify(fullSession));
          setAlertInfo({ message: `¡Bienvenido(a), ${userData.fullname}!`, type: 'success' });
        }}
        logoUrl={config.logo_url}
        schoolName={config.nombre_colegio}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* =========================================================
          ENCABEZADO INSTITUCIONAL (SIN "ARCHIVOS HOSTING")
         ========================================================= */}
      <header className="no-print bg-gradient-to-r from-[#081a35] via-[#0b1c3d] to-[#142850] text-white shadow-lg border-b-4 border-amber-500 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Logo y Nombre del Colegio */}
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 bg-white rounded-full p-1 border-2 border-amber-400 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={config.logo_url}
                alt="Insignia Colegio Ricardo Bentín"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-cinzel text-lg sm:text-xl font-extrabold tracking-wide text-white leading-tight">
                {config.nombre_colegio}
              </h1>
              <p className="text-xs text-amber-300 font-semibold tracking-wider uppercase">
                Sistema Oficial de Control de Asistencia y Carnets QR
              </p>
            </div>
          </div>

          {/* Acciones del Encabezado: Configuración y Modo Oscuro / Claro */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-lg border border-white/20 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Configuración</span>
            </button>

            {/* Alternar Modo Oscuro / Claro */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-lg border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-blue-300" />
                  <span>Modo Oscuro</span>
                </>
              )}
            </button>

            {/* Usuario y Cerrar Sesión */}
            <div className="flex items-center gap-1.5 pl-1 sm:border-l sm:border-white/20 sm:pl-2">
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10">
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>{session.username}</span>
              </span>
              <button
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Cerrar Sesión',
                    message: '¿Está seguro de que desea salir del sistema de control de asistencia?',
                    confirmText: 'Sí, cerrar sesión',
                    confirmColor: 'primary',
                    onConfirm: () => {
                      setSession({ isLogged: false, username: '', fullname: '' });
                      localStorage.removeItem('bentin_session_user');
                      setConfirmDialog(null);
                    }
                  });
                }}
                title="Cerrar Sesión"
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 font-bold text-xs rounded-lg border border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================
          CONTENIDO PRINCIPAL
         ========================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner de Notificación */}
        {alertInfo && (
          <div
            className={`no-print p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
              alertInfo.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : alertInfo.type === 'danger'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {alertInfo.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span>{alertInfo.message}</span>
            </div>
            <button
              onClick={() => setAlertInfo(null)}
              className="text-xs underline hover:opacity-75 cursor-pointer ml-3"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* =========================================================
            TARJETAS DE MÉTRICAS (ESTADÍSTICAS)
           ========================================================= */}
        <section className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center">
            <span className="text-xs uppercase font-extrabold text-slate-500 dark:text-slate-400 tracking-wider">
              TOTAL
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0b1c3d] dark:text-white mt-1">
              {stats.total}
            </div>
          </div>

          <div
            onClick={() => setDetailModalStatus('Presente')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:border-emerald-500 hover:shadow-md transition group"
          >
            <span className="text-xs uppercase font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center justify-center gap-1">
              <span>PRESENTES</span>
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.presents}
            </div>
          </div>

          <div
            onClick={() => setDetailModalStatus('Tarde')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:border-amber-500 hover:shadow-md transition group"
          >
            <span className="text-xs uppercase font-extrabold text-amber-600 dark:text-amber-400 tracking-wider flex items-center justify-center gap-1">
              <span>TARDANZAS</span>
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {stats.tardies}
            </div>
          </div>

          <div
            onClick={() => setDetailModalStatus('Ausente')}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center cursor-pointer hover:border-rose-500 hover:shadow-md transition group"
          >
            <span className="text-xs uppercase font-extrabold text-rose-600 dark:text-rose-400 tracking-wider flex items-center justify-center gap-1">
              <span>AUSENTES</span>
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {stats.absents}
            </div>
          </div>
        </section>

        {/* =========================================================
            BARRA DE PESTAÑAS (TABS) - SIN "ARCHIVOS HOSTING"
           ========================================================= */}
        <nav className="no-print flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2">
          {[
            { id: 'asistencia', label: 'Escanear', icon: QrCode },
            { id: 'estudiantes', label: 'Estudiantes', icon: Users },
            { id: 'carnets', label: 'Carnets QR', icon: GraduationCap },
            { id: 'profesores', label: 'Profesorado', icon: Users },
            { id: 'calendario', label: '📅 Calendario', icon: CalendarIcon },
            { id: 'reportes', label: 'Parte Oficial', icon: Printer }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#0b1c3d] text-white shadow-sm dark:bg-amber-500 dark:text-slate-950 border-b-2 border-amber-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* =========================================================
            PESTAÑA 1: ASISTENCIA (ESCÁNER QR + MANUAL + AM/PM)
           ========================================================= */}
        {activeTab === 'asistencia' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
            {/* Lado Izquierdo: Escáner con Cámara */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h2 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-500" />
                Escanear con Cámara
              </h2>
              <ScannerModal onScanDni={processAttendance} />
            </div>

            {/* Lado Derecho: Ingreso Manual y Controles de Jornada */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <h2 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  Ingreso Manual por DNI
                </h2>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    processAttendance(dniInput);
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      DNI del Estudiante (8 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={dniInput}
                      onChange={(e) => setDniInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Ingrese 8 dígitos"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-base tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#C99A20] hover:bg-[#b08419] text-white font-bold text-sm rounded-xl transition shadow-md cursor-pointer"
                  >
                    Registrar Asistencia
                  </button>
                </form>
              </div>

              {/* Controles de Jornada Escolar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
                <h3 className="font-cinzel text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">
                  Jornada Escolar (Lunes a Viernes)
                </h3>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Días Acumulados:</span>
                    <strong className="text-sm font-extrabold text-[#0b1c3d] dark:text-white">
                      {config.total_dias}
                    </strong>
                  </div>
                  <button
                    onClick={handleEditTotalDays}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    ✏️ Editar Días
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Límite Puntualidad:</span>
                    <strong className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                      {formatToAMPM(config.hora_limite)}
                    </strong>
                  </div>
                  <button
                    onClick={handleEditTimeLimit}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    ✏️ Editar Hora (AM / PM)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={handleNextDay}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Iniciar Nuevo Día Lectivo
                  </button>
                  <button
                    onClick={handleMarkAllAbsent}
                    className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    ⚠️ Marcar Ausentes Restantes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            PESTAÑA 2: GESTIÓN DE ESTUDIANTES
           ========================================================= */}
        {activeTab === 'estudiantes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
            {/* Columna Izquierda: REGISTRAR ALUMNO + COPIA DE SEGURIDAD */}
            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <h3 className="font-cinzel text-xs uppercase font-extrabold tracking-wider text-amber-600 dark:text-amber-400 mb-4">
                  REGISTRAR ALUMNO
                </h3>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const dni = (form.elements.namedItem('dni') as HTMLInputElement).value.trim();
                    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
                    const grade = (form.elements.namedItem('grade') as HTMLSelectElement).value;
                    const section = (form.elements.namedItem('section') as HTMLSelectElement).value;

                    if (students.some((s) => s.dni === dni)) {
                      alert('El DNI ingresado ya existe en el sistema.');
                      return;
                    }

                    const newSt: Student = {
                      dni,
                      name: name.toUpperCase(),
                      grade,
                      section,
                      attendances: 0,
                      tardies: 0,
                      absences: 0,
                      history: []
                    };

                    setStudents((prev) => [...prev, newSt]);
                    form.reset();
                    setAlertInfo({ message: `Estudiante ${name} registrado con éxito.`, type: 'success' });
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      DNI
                    </label>
                    <input
                      name="dni"
                      required
                      maxLength={8}
                      pattern="[0-9]{8}"
                      placeholder="Ej. 71234567"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      name="name"
                      required
                      placeholder="Apellidos y Nombres"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Grado
                      </label>
                      <select
                        name="grade"
                        required
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="1">1° Sec.</option>
                        <option value="2">2° Sec.</option>
                        <option value="3">3° Sec.</option>
                        <option value="4">4° Sec.</option>
                        <option value="5">5° Sec.</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Sección
                      </label>
                      <select
                        name="section"
                        required
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                        <option value="Única">Única</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#C99A20] hover:bg-[#b08419] text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer mt-2"
                  >
                    Guardar Estudiante
                  </button>
                </form>
              </div>

              {/* Card 2: COPIA DE SEGURIDAD */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <h3 className="font-cinzel text-xs uppercase font-extrabold tracking-wider text-amber-600 dark:text-amber-400">
                  COPIA DE SEGURIDAD
                </h3>

                <button
                  onClick={() => exportFullBackupJSON({ config, students, teachers, exceptions })}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <Download className="w-4 h-4 text-amber-600" />
                  <span>📤 Exportar Respaldo</span>
                </button>

                <button
                  onClick={() => exportDatabaseSQL(students, teachers, config.nombre_colegio)}
                  className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300 dark:border-amber-700/50 shadow-xs"
                >
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>💾 Descargar database.sql</span>
                </button>

                <label className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>📥 Importar Respaldo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const parsed = JSON.parse(event.target?.result as string);
                          if (parsed.students && Array.isArray(parsed.students)) {
                            setStudents(parsed.students);
                          }
                          if (parsed.teachers) setTeachers(parsed.teachers);
                          if (parsed.config) setConfig(parsed.config);
                          alert('¡Copia de seguridad importada con éxito!');
                        } catch {
                          alert('Error al leer el archivo JSON.');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Columna Derecha: REPORTE GENERAL + GRID DE CARPETAS DE AULAS */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Reporte General
                </h3>
                <button
                  onClick={() => exportStudentsToCSV(students, config.nombre_colegio)}
                  className="px-4 py-1.5 bg-[#C99A20] hover:bg-[#b08419] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  📥 EXCEL
                </button>
              </div>

              {/* Grid 2 Columnas de Carpetas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {classrooms.map((cls) => (
                  <div
                    key={cls.name}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 shadow-sm hover:shadow transition relative flex items-center justify-between overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 w-1.5 h-full"
                      style={{ backgroundColor: cls.colorAccent }}
                    />

                    <div className="pl-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">📁</span>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {cls.name}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 pl-6">
                        {cls.students.length} estudiantes
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedClassroom(cls.name);
                        setClassroomSearch('');
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0 border border-slate-200 dark:border-slate-600"
                    >
                      Ver lista →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            PESTAÑA 3: CARNETS QR (GRID DE CARPETAS)
           ========================================================= */}
        {activeTab === 'carnets' && (
          <div className="space-y-6">
            <div className="no-print bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h2 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-white">
                  Carnets Institucionales con QR
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Haz clic en el recuadro de la foto de cualquier carnet para subir o cambiar la fotografía del estudiante.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                {classrooms.map((cls) => (
                  <div
                    key={`carnet-${cls.name}`}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 shadow-sm hover:shadow transition relative flex items-center justify-between overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 w-1.5 h-full"
                      style={{ backgroundColor: cls.colorAccent }}
                    />

                    <div className="pl-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">📁</span>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          Carnets de {cls.name}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 pl-6">
                        {cls.students.length} carnets disponibles
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedCarnetAula(cls.name)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0 border border-slate-200 dark:border-slate-600"
                    >
                      Ver →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="print-page-carnets hidden">
              {students.map((student) => (
                <CarnetCard
                  key={`all-${student.dni}`}
                  student={student}
                  schoolName={config.nombre_colegio}
                  logoUrl={config.logo_url}
                  onUploadPhoto={(dni) => {
                    setPhotoTargetDni(dni);
                    studentPhotoInputRef.current?.click();
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            PESTAÑA 4: DIRECTORIO DOCENTE (PROFESORADO)
           ========================================================= */}
        {activeTab === 'profesores' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-cinzel text-lg font-bold text-[#0b1c3d] dark:text-white">
                  Plana Docente y Auxiliares
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Directorio del personal docente y directivo de la institución educativa.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTeacher(null);
                  setTeacherPhotoPreview('');
                  setShowAddTeacherModal(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                Registrar Nuevo Profesor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {teachers.map((prof) => (
                <div
                  key={prof.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm text-center flex flex-col justify-between hover:shadow-md transition relative group"
                >
                  <div>
                    {/* Foto circular con botón para cambiar foto o zoom */}
                    <div className="relative w-28 h-28 mx-auto mb-3">
                      <div
                        onClick={() => prof.foto && setFullImagePreview(prof.foto)}
                        className={`w-full h-full rounded-full overflow-hidden border-3 border-amber-400 bg-slate-100 dark:bg-slate-800 shadow-md ${
                          prof.foto ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                        }`}
                      >
                        {prof.foto && prof.foto.trim() !== '' ? (
                          <img
                            src={prof.foto}
                            alt={prof.nombre_completo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Users className="w-12 h-12" />
                          </div>
                        )}
                      </div>

                      {/* Botón flotante para cambiar foto directamente */}
                      <button
                        onClick={() => {
                          setTeacherCardTargetId(prof.id);
                          teacherCardPhotoInputRef.current?.click();
                        }}
                        title="Cambiar fotografía del profesor"
                        className="absolute bottom-0 right-0 p-2 bg-[#0b1c3d] hover:bg-amber-500 text-white hover:text-slate-950 rounded-full border-2 border-white shadow-md transition cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                      {prof.nombre_completo}
                    </h3>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                      {prof.especialidad}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                      DNI: {prof.dni}
                    </p>
                  </div>

                  {/* Acciones: Editar y Eliminar */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setEditingTeacher(prof);
                        setTeacherPhotoPreview(prof.foto || '');
                        setShowAddTeacherModal(true);
                      }}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(prof.id, prof.nombre_completo)}
                      className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer flex items-center gap-1"
                      title="Eliminar docente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            PESTAÑA 5: CALENDARIO ESCOLAR (EXCLUYENDO SÁBADOS Y DOMINGOS)
           ========================================================= */}
        {activeTab === 'calendario' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() =>
                    setCurrentCalendarDate(
                      new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1)
                    )
                  }
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Mes Anterior
                </button>
                <h3 className="font-cinzel text-lg font-bold text-[#0b1c3d] dark:text-amber-400">
                  {calendarMonthData.title}
                </h3>
                <button
                  onClick={() =>
                    setCurrentCalendarDate(
                      new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1)
                    )
                  }
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                >
                  Mes Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2">
                <div>LUN</div>
                <div>MAR</div>
                <div>MIÉ</div>
                <div>JUE</div>
                <div>VIE</div>
                <div className="text-slate-400 dark:text-slate-600">SÁB</div>
                <div className="text-slate-400 dark:text-slate-600">DOM</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarMonthData.days.map((item, index) => {
                  if (!item) {
                    return <div key={`empty-${index}`} className="h-16 rounded-xl bg-slate-50/50 dark:bg-slate-900/20" />;
                  }

                  const isFeriado = item.type === 'feriado';
                  const isSinClases = item.type === 'sin_clases' && !item.isWeekend;
                  const isWeekend = item.isWeekend;
                  const isToday = item.dateStr === todayStr;

                  return (
                    <div
                      key={item.dateStr}
                      onClick={() => !isWeekend && setSelectedDayDetail(item.dateStr)}
                      className={`h-20 p-2 rounded-xl border text-left transition flex flex-col justify-between shadow-sm ${
                        isToday ? 'ring-2 ring-amber-500' : ''
                      } ${
                        isWeekend
                          ? 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                          : isFeriado
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 cursor-pointer hover:scale-[1.02]'
                          : isSinClases
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200 cursor-pointer hover:scale-[1.02]'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400 cursor-pointer hover:scale-[1.02]'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-xs">{item.dayNumber}</span>
                        {isWeekend && <span className="text-[9px] uppercase font-semibold">Fin de Semana</span>}
                        {isFeriado && <span className="text-[10px]">🔴 Feriado</span>}
                        {isSinClases && <span className="text-[10px]">🟡 Sin Clases</span>}
                      </div>

                      <div className="text-[10px] truncate opacity-75">
                        {item.motivo ? item.motivo : isWeekend ? 'Sin clases' : 'Día lectivo'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            PESTAÑA 6: PARTE DIARIO OFICIAL DE ASISTENCIA
           ========================================================= */}
        {activeTab === 'reportes' && (
          <div className="space-y-6">
            <div className="no-print bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Fecha del Parte</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Filtrar por Grado</label>
                  <select
                    value={reportFilterGrade}
                    onChange={(e) => setReportFilterGrade(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="all">Todos los Grados (1° a 5°)</option>
                    <option value="1">1° de Secundaria</option>
                    <option value="2">2° de Secundaria</option>
                    <option value="3">3° de Secundaria</option>
                    <option value="4">4° de Secundaria</option>
                    <option value="5">5° de Secundaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Sección</label>
                  <select
                    value={reportFilterSection}
                    onChange={(e) => setReportFilterSection(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="all">Todas las Secciones</option>
                    <option value="A">Sección A</option>
                    <option value="B">Sección B</option>
                    <option value="C">Sección C</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#0b1c3d] hover:bg-[#152e63] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                Imprimir / Guardar como PDF
              </button>
            </div>

            <div className="print-report-container bg-white text-slate-900 p-8 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto">
              <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                <h1 className="font-cinzel text-2xl font-black text-[#0b1c3d] tracking-wider uppercase">
                  {config.nombre_colegio}
                </h1>
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-600 mt-1">
                  Parte Diario Oficial de Asistencia Estudiantil
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fecha de Control: <strong>{reportDate}</strong> • Hora Límite de Puntualidad: {formatToAMPM(config.hora_limite)}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-[#0b1c3d] text-white uppercase text-[11px]">
                    <tr>
                      <th className="p-2 border border-slate-300 w-8 text-center">#</th>
                      <th className="p-2 border border-slate-300">DNI</th>
                      <th className="p-2 border border-slate-300">Apellidos y Nombres</th>
                      <th className="p-2 border border-slate-300">Aula</th>
                      <th className="p-2 border border-slate-300">Hora</th>
                      <th className="p-2 border border-slate-300">Estado</th>
                      <th className="p-2 border border-slate-300">Justificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((s) => {
                        const matchGrade = reportFilterGrade === 'all' || s.grade === reportFilterGrade;
                        const matchSection = reportFilterSection === 'all' || s.section.toUpperCase() === reportFilterSection.toUpperCase();
                        return matchGrade && matchSection;
                      })
                      .map((st, i) => {
                        const reg = st.history?.find((h) => h.date === reportDate);
                        const status = reg ? reg.status : 'Ausente';
                        const time = reg && reg.time && reg.time !== '00:00' ? formatToAMPM(reg.time) : '--:--';

                        return (
                          <tr key={st.dni} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-2 border border-slate-300 text-center font-bold text-slate-500">{i + 1}</td>
                            <td className="p-2 border border-slate-300 font-mono font-semibold">{st.dni}</td>
                            <td className="p-2 border border-slate-300 font-bold">{st.name}</td>
                            <td className="p-2 border border-slate-300">{st.grade}° &quot;{st.section}&quot;</td>
                            <td className="p-2 border border-slate-300 font-mono">{time}</td>
                            <td className="p-2 border border-slate-300 font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                                  status === 'Presente'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : status === 'Tarde'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="p-2 border border-slate-300 text-[11px] text-slate-600">
                              {reg?.justification || '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="mt-14 pt-6 grid grid-cols-2 text-center text-xs font-bold text-slate-800">
                <div className="flex flex-col items-center">
                  <div className="w-48 border-t border-slate-900 mb-1" />
                  <span>Dirección del Colegio</span>
                  <span className="text-[10px] text-slate-500 font-normal">I.E. Ricardo Bentín 64935</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-48 border-t border-slate-900 mb-1" />
                  <span>Control de Asistencia / Auxiliar</span>
                  <span className="text-[10px] text-slate-500 font-normal">Firma y Sello</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          MODALES DE CARPETAS DE AULAS Y CARNETS
         ========================================================= */}

      {/* MODAL 1: LISTA DE ESTUDIANTES DE UN AULA (CON DESCARGA INDIVIDUAL DE EXCEL) */}
      {selectedClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-[#0b1c3d] text-white flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-white">
                  Estudiantes de {selectedClassroom}
                </h3>
                <span className="text-xs text-amber-300">
                  Total en esta sección: {
                    students.filter((s) => {
                      const rawGrade = String(s.grade || '1').trim();
                      const gradeText = mapGradeToText[rawGrade] || `${rawGrade}°`;
                      const sectionText = String(s.section || 'A').trim().toUpperCase();
                      return `${gradeText} "${sectionText}"` === selectedClassroom;
                    }).length
                  } estudiantes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const aulaStudents = students.filter((s) => {
                      const rawGrade = String(s.grade || '1').trim();
                      const gradeText = mapGradeToText[rawGrade] || `${rawGrade}°`;
                      const sectionText = String(s.section || 'A').trim().toUpperCase();
                      return `${gradeText} "${sectionText}"` === selectedClassroom;
                    });
                    exportStudentsToCSV(aulaStudents, config.nombre_colegio, selectedClassroom);
                  }}
                  className="px-3.5 py-1.5 bg-[#C99A20] hover:bg-[#b08419] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  📥 Descargar Excel de esta aula
                </button>
                <button
                  onClick={() => setSelectedClassroom(null)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI en esta aula..."
                value={classroomSearch}
                onChange={(e) => setClassroomSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">DNI</th>
                    <th className="p-2.5">Estudiante</th>
                    <th className="p-2.5">Aula</th>
                    <th className="p-2.5">Pres. / Tar.</th>
                    <th className="p-2.5">Último Ingreso</th>
                    <th className="p-2.5">% Asist.</th>
                    <th className="p-2.5 text-center rounded-r-lg">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students
                    .filter((s) => {
                      const rawGrade = String(s.grade || '1').trim();
                      const gradeText = mapGradeToText[rawGrade] || `${rawGrade}°`;
                      const sectionText = String(s.section || 'A').trim().toUpperCase();
                      return `${gradeText} "${sectionText}"` === selectedClassroom;
                    })
                    .filter((s) => {
                      const q = classroomSearch.toLowerCase();
                      return s.name.toLowerCase().includes(q) || s.dni.includes(q);
                    })
                    .map((s) => {
                      const pct =
                        config.total_dias > 0
                          ? Math.round((s.attendances / config.total_dias) * 100)
                          : 0;
                      return (
                        <tr key={s.dni} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">{s.dni}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {s.foto ? (
                              <img src={s.foto} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                            ) : null}
                            <span>{s.name}</span>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">
                            {s.attendances} / {s.tardies}
                          </td>
                          <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                            {s.lastDate ? `${s.lastDate} ${formatToAMPM(s.lastTime)}` : 'Sin registro'}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pct >= 80
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pct >= 65
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {pct}%
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setPhotoTargetDni(s.dni);
                                  studentPhotoInputRef.current?.click();
                                }}
                                title="Subir / Cambiar Foto"
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setHistoryTargetStudent(s)}
                                title="Ver Historial"
                                className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold cursor-pointer"
                              >
                                Historial
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStudent(s);
                                  setEditingStudentPhoto(s.foto || '');
                                }}
                                title="Editar Estudiante"
                                className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(s.dni)}
                                title="Eliminar Estudiante"
                                className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-right">
              <button
                onClick={() => setSelectedClassroom(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CARNETS QR DE UN AULA ESPECÍFICA */}
      {selectedCarnetAula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-[#0b1c3d] text-white flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-white">
                  Carnets de {selectedCarnetAula}
                </h3>
                <span className="text-xs text-amber-300">
                  Total: {carnetAulaStudents.length} carnets disponibles
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#C99A20] hover:bg-[#b08419] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4" />
                  🖨️ Imprimir Esta Aula
                </button>
                <button
                  onClick={() => exportStudentsToCSV(carnetAulaStudents, config.nombre_colegio, selectedCarnetAula)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Descargar Excel
                </button>
                <button
                  onClick={() => setSelectedCarnetAula(null)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-100 dark:bg-slate-950/80 flex flex-wrap gap-4 justify-center">
              {carnetAulaStudents.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No hay estudiantes registrados en esta sección aún.
                </div>
              ) : (
                carnetAulaStudents.map((st) => (
                  <CarnetCard
                    key={`carnet-modal-${st.dni}`}
                    student={st}
                    schoolName={config.nombre_colegio}
                    logoUrl={config.logo_url}
                    onUploadPhoto={(dni) => {
                      setPhotoTargetDni(dni);
                      studentPhotoInputRef.current?.click();
                    }}
                  />
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-right">
              <button
                onClick={() => setSelectedCarnetAula(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: HISTORIAL DE ASISTENCIA (IDÉNTICO A LA FOTO 2 DEL USUARIO)
          CON FUNCIONES DE EDITAR, JUSTIFICAR Y BORRAR 100% OPERATIVAS
         ========================================================= */}
      {historyTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#0b1c3d] text-white rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Historial de Asistencias: {historyTargetStudent.name}
                </h3>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  DNI: {historyTargetStudent.dni} • {historyTargetStudent.grade}° &quot;{historyTargetStudent.section}&quot;
                </span>
              </div>
              <button
                onClick={() => setHistoryTargetStudent(null)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-900/90">
              {(!historyTargetStudent.history || historyTargetStudent.history.length === 0) ? (
                <p className="text-xs text-center text-slate-400 py-6">
                  No tiene registros de asistencia aún.
                </p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#081a35] text-slate-300 uppercase text-[11px] border-b border-slate-700">
                    <tr>
                      <th className="p-2.5">FECHA</th>
                      <th className="p-2.5">HORA (AM / PM)</th>
                      <th className="p-2.5">ESTADO</th>
                      <th className="p-2.5">JUSTIFICACIÓN</th>
                      <th className="p-2.5 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {historyTargetStudent.history.map((h, i) => (
                      <tr key={`${h.date}-${i}`} className="hover:bg-slate-800/60 transition">
                        <td className="p-2.5 font-mono font-bold text-slate-200">{h.date}</td>
                        <td className="p-2.5 font-mono text-slate-300">{formatToAMPM(h.time)}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.status === 'Presente'
                                ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                                : h.status === 'Tarde'
                                ? 'bg-amber-900/80 text-amber-300 border border-amber-700'
                                : 'bg-rose-900/80 text-rose-300 border border-rose-700'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-400 italic max-w-[130px] truncate">
                          {h.justification && h.justification.trim() !== '' ? h.justification : '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          {/* Botones exactos de la foto 2 del usuario: Editar, Justificar, Borrar */}
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() =>
                                setEditingAttendanceRecord({
                                  dni: historyTargetStudent.dni,
                                  studentName: historyTargetStudent.name,
                                  date: h.date,
                                  time: h.time,
                                  status: h.status
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-bold bg-[#fef3c7] hover:bg-[#fde68a] text-[#b45309] rounded transition shadow-sm cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                setJustifyingAttendanceRecord({
                                  dni: historyTargetStudent.dni,
                                  studentName: historyTargetStudent.name,
                                  date: h.date,
                                  currentMotive: h.justification || ''
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-bold bg-[#e0f2fe] hover:bg-[#bae6fd] text-[#0369a1] rounded transition shadow-sm cursor-pointer"
                            >
                              Justificar
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteAttendanceRecord(historyTargetStudent.dni, h.date)
                              }
                              className="px-2.5 py-1 text-[11px] font-bold bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] rounded transition shadow-sm cursor-pointer"
                            >
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 border-t border-slate-700 bg-[#081a35] text-right">
              <button
                onClick={() => setHistoryTargetStudent(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR ASISTENCIA (ESTADO Y HORA) */}
      {editingAttendanceRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Editar Registro de Asistencia
                </h3>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {editingAttendanceRecord.studentName} • Fecha: {editingAttendanceRecord.date}
                </span>
              </div>
              <button
                onClick={() => setEditingAttendanceRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const status = (form.elements.namedItem('status') as HTMLSelectElement).value as AttendanceStatus;
                const time = (form.elements.namedItem('time') as HTMLInputElement).value;
                const meridiem = (form.elements.namedItem('meridiem') as HTMLSelectElement).value;

                const finalTime = `${time} ${meridiem}`;
                handleSaveEditedRecord(
                  editingAttendanceRecord.dni,
                  editingAttendanceRecord.date,
                  status,
                  finalTime
                );
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nuevo Estado
                </label>
                <select
                  name="status"
                  defaultValue={editingAttendanceRecord.status}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                >
                  <option value="Presente">🟢 Presente (Puntual)</option>
                  <option value="Tarde">🟡 Tarde (Ingreso tardío)</option>
                  <option value="Ausente">🔴 Ausente (Inasistencia)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Hora de Registro
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    name="time"
                    type="time"
                    defaultValue={editingAttendanceRecord.time.replace(/[^0-9:]/g, '').slice(0, 5) || '07:45'}
                    required
                    className="col-span-2 text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <select
                    name="meridiem"
                    defaultValue={editingAttendanceRecord.time.includes('PM') ? 'PM' : 'AM'}
                    className="text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAttendanceRecord(null)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0b1c3d] hover:bg-[#152e63] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL JUSTIFICAR ASISTENCIA */}
      {justifyingAttendanceRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Justificar Asistencia / Falta
                </h3>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {justifyingAttendanceRecord.studentName} • Fecha: {justifyingAttendanceRecord.date}
                </span>
              </div>
              <button
                onClick={() => setJustifyingAttendanceRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const motive = (form.elements.namedItem('motive') as HTMLInputElement).value;
                handleSaveJustification(
                  justifyingAttendanceRecord.dni,
                  justifyingAttendanceRecord.date,
                  motive
                );
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de la Justificación
                </label>
                <input
                  name="motive"
                  defaultValue={justifyingAttendanceRecord.currentMotive}
                  required
                  placeholder="Ej. Cita médica en EsSalud con constancia"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Botones de motivos frecuentes */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Cita Médica',
                  'Permiso Familiar',
                  'Problema de Salud',
                  'Trámite Personal',
                  'Duelo Familiar'
                ].map((txt) => (
                  <button
                    type="button"
                    key={txt}
                    onClick={() => {
                      const input = document.querySelector('input[name="motive"]') as HTMLInputElement;
                      if (input) input.value = txt;
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    + {txt}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setJustifyingAttendanceRecord(null)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                >
                  Guardar Justificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kiosco (Celebración al registrar) */}
      {kioskData && (
        <KioskModal
          student={kioskData.student}
          status={kioskData.status}
          timeFormatted={kioskData.timeFormatted}
          onClose={() => setKioskData(null)}
        />
      )}

      {/* Modal Editar Estudiante */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6">
            <h3 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-white mb-4">
              Editar Datos del Estudiante
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const newDni = (form.elements.namedItem('dni') as HTMLInputElement).value.trim();
                const newName = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
                const newGrade = (form.elements.namedItem('grade') as HTMLSelectElement).value;
                const newSection = (form.elements.namedItem('section') as HTMLSelectElement).value;

                setStudents((prev) =>
                  prev.map((s) => {
                    if (s.dni !== editingStudent.dni) return s;
                    const updated: Student = {
                      ...s,
                      dni: newDni,
                      name: newName.toUpperCase(),
                      grade: newGrade,
                      section: newSection,
                      foto: editingStudentPhoto || s.foto
                    };
                    if (historyTargetStudent?.dni === editingStudent.dni) {
                      setHistoryTargetStudent(updated);
                    }
                    return updated;
                  })
                );
                setEditingStudent(null);
                setEditingStudentPhoto('');
                setAlertInfo({ message: 'Estudiante y fotografía actualizados correctamente.', type: 'success' });
              }}
              className="space-y-3"
            >
              {/* Vista previa y cambio de Fotografía del Estudiante */}
              <div className="text-center pb-1">
                <div className="w-20 h-20 mx-auto mb-2 rounded-2xl overflow-hidden border-2 border-amber-400 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-md">
                  {editingStudentPhoto ? (
                    <img src={editingStudentPhoto} alt="Estudiante" className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap className="w-10 h-10 text-slate-400" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => editStudentPhotoInputRef.current?.click()}
                  className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{editingStudentPhoto ? 'Cambiar Foto' : 'Subir Foto'}</span>
                </button>
                <input
                  ref={editStudentPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setEditingStudentPhoto(event.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  DNI / Código de Estudiante
                </label>
                <input
                  name="dni"
                  defaultValue={editingStudent.dni}
                  maxLength={25}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Apellidos y Nombres
                </label>
                <input
                  name="name"
                  defaultValue={editingStudent.name}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Grado
                  </label>
                  <select
                    name="grade"
                    defaultValue={editingStudent.grade}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="1">1° Sec.</option>
                    <option value="2">2° Sec.</option>
                    <option value="3">3° Sec.</option>
                    <option value="4">4° Sec.</option>
                    <option value="5">5° Sec.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sección
                  </label>
                  <select
                    name="section"
                    defaultValue={editingStudent.section}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="Única">Única</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0b1c3d] hover:bg-[#152e63] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Estados (Presentes, Tardanzas, Ausentes) */}
      {detailModalStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-[#0b1c3d] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">
                Lista de Estudiantes con Estado: {detailModalStatus.toUpperCase()}
              </h3>
              <button
                onClick={() => setDetailModalStatus(null)}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex gap-2">
              <select
                value={detailFilterGrade}
                onChange={(e) => setDetailFilterGrade(e.target.value)}
                className="flex-1 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="all">Todos los Grados</option>
                <option value="1">1°</option>
                <option value="2">2°</option>
                <option value="3">3°</option>
                <option value="4">4°</option>
                <option value="5">5°</option>
              </select>
              <select
                value={detailFilterSection}
                onChange={(e) => setDetailFilterSection(e.target.value)}
                className="flex-1 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="all">Todas las Secciones</option>
                <option value="A">Sección A</option>
                <option value="B">Sección B</option>
                <option value="C">Sección C</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="p-2">DNI</th>
                    <th className="p-2">Estudiante</th>
                    <th className="p-2">Aula</th>
                    <th className="p-2">Hora de Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students
                    .filter((s) => {
                      const matchGrade = detailFilterGrade === 'all' || s.grade === detailFilterGrade;
                      const matchSection = detailFilterSection === 'all' || s.section.toUpperCase() === detailFilterSection.toUpperCase();

                      const reg = s.history?.find((h) => h.date === todayStr);
                      let matchStatus = false;
                      if (detailModalStatus === 'Presente') matchStatus = reg?.status === 'Presente';
                      else if (detailModalStatus === 'Tarde') matchStatus = reg?.status === 'Tarde';
                      else if (detailModalStatus === 'Ausente') matchStatus = !reg || reg.status === 'Ausente';

                      return matchGrade && matchSection && matchStatus;
                    })
                    .map((s) => {
                      const reg = s.history?.find((h) => h.date === todayStr);
                      const time = reg && reg.time && reg.time !== '00:00' ? formatToAMPM(reg.time) : '--:--';
                      return (
                        <tr key={s.dni} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-mono font-semibold">{s.dni}</td>
                          <td className="p-2 font-bold">{s.name}</td>
                          <td className="p-2">{s.grade}° &quot;{s.section}&quot;</td>
                          <td className="p-2 font-mono">{time}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Día del Calendario */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-white">
                Día: {selectedDayDetail}
              </h3>
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Jornada
                </label>
                <select
                  value={
                    exceptions.find((e) => e.date === selectedDayDetail)?.tipo || 'normal'
                  }
                  onChange={(e) => {
                    const newType = e.target.value as 'normal' | 'feriado' | 'sin_clases';
                    if (newType === 'normal') {
                      setExceptions((prev) => prev.filter((item) => item.date !== selectedDayDetail));
                    } else {
                      const motivo = prompt('Motivo o nombre de la festividad (ej. Fiestas Patrias):', 'Feriado Escolar') || '';
                      setExceptions((prev) => [
                        ...prev.filter((item) => item.date !== selectedDayDetail),
                        { date: selectedDayDetail, tipo: newType, motivo }
                      ]);
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="normal">🟢 Día Lectivo Normal</option>
                  <option value="feriado">🔴 Feriado Nacional / Regional</option>
                  <option value="sin_clases">🟡 Suspensión de Clases</option>
                </select>
              </div>

              {(() => {
                let p = 0;
                let t = 0;
                let a = 0;
                students.forEach((s) => {
                  const reg = s.history?.find((h) => h.date === selectedDayDetail);
                  if (reg) {
                    if (reg.status === 'Presente') p++;
                    else if (reg.status === 'Tarde') t++;
                    else if (reg.status === 'Ausente') a++;
                  }
                });

                return (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Asistencias en esta fecha:
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-600 font-semibold">Presentes:</span>
                      <strong>{p}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-600 font-semibold">Tardanzas:</span>
                      <strong>{t}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-rose-600 font-semibold">Ausentes:</span>
                      <strong>{a}</strong>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => setSelectedDayDetail(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL REGISTRAR O EDITAR PROFESOR CON CAMBIO DE FOTO
         ========================================================= */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6">
            <h3 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-white mb-4">
              {editingTeacher ? 'Editar Docente' : 'Registrar Nuevo Docente'}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const dni = (form.elements.namedItem('dni') as HTMLInputElement).value.trim();
                const nombre = (form.elements.namedItem('nombre') as HTMLInputElement).value.trim();
                const especialidad = (form.elements.namedItem('especialidad') as HTMLInputElement).value.trim();

                if (editingTeacher) {
                  setTeachers((prev) =>
                    prev.map((t) =>
                      t.id === editingTeacher.id
                        ? {
                            ...t,
                            dni,
                            nombre_completo: nombre,
                            especialidad,
                            foto: teacherPhotoPreview || t.foto
                          }
                        : t
                    )
                  );
                } else {
                  const newT: Teacher = {
                    id: `t-${Date.now()}`,
                    dni,
                    nombre_completo: nombre,
                    especialidad,
                    foto: teacherPhotoPreview || ''
                  };
                  setTeachers((prev) => [...prev, newT]);
                }

                setShowAddTeacherModal(false);
                setEditingTeacher(null);
                setTeacherPhotoPreview('');
                setAlertInfo({ message: 'Docente guardado correctamente con su foto.', type: 'success' });
              }}
              className="space-y-3"
            >
              {/* Selector y vista previa de Fotografía del Profesor */}
              <div className="text-center pb-2">
                <div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden border-3 border-amber-400 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-md">
                  {teacherPhotoPreview ? (
                    <img src={teacherPhotoPreview} alt="Docente" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-10 h-10 text-slate-400" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => teacherPhotoFileInputRef.current?.click()}
                  className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{teacherPhotoPreview ? 'Cambiar Fotografía' : 'Subir Fotografía'}</span>
                </button>
                <input
                  ref={teacherPhotoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleTeacherPhotoChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  DNI (8 dígitos)
                </label>
                <input
                  name="dni"
                  defaultValue={editingTeacher?.dni || ''}
                  required
                  maxLength={8}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo
                </label>
                <input
                  name="nombre"
                  defaultValue={editingTeacher?.nombre_completo || ''}
                  required
                  placeholder="Prof. Juan Pérez"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Especialidad o Asignatura
                </label>
                <input
                  name="especialidad"
                  defaultValue={editingTeacher?.especialidad || ''}
                  required
                  placeholder="Matemática y Física"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTeacherModal(false);
                    setEditingTeacher(null);
                    setTeacherPhotoPreview('');
                  }}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0b1c3d] hover:bg-[#152e63] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configuración del Colegio */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6">
            <h3 className="font-cinzel text-base font-bold text-[#0b1c3d] dark:text-white mb-4">
              Configuración Institucional
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const nombre = (form.elements.namedItem('nombre') as HTMLInputElement).value.trim();
                const hora = (form.elements.namedItem('hora') as HTMLInputElement).value.trim();
                const meridiem = (form.elements.namedItem('meridiem') as HTMLSelectElement).value;
                const dias = parseInt((form.elements.namedItem('dias') as HTMLInputElement).value, 10);

                const finalHora = `${hora} ${meridiem}`;

                setConfig((prev) => ({
                  ...prev,
                  nombre_colegio: nombre,
                  hora_limite: finalHora,
                  total_dias: Math.max(1, dias)
                }));
                setShowConfigModal(false);
                setAlertInfo({ message: 'Configuración institucional guardada.', type: 'success' });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de la Institución
                </label>
                <input
                  name="nombre"
                  defaultValue={config.nombre_colegio}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Hora Límite de Puntualidad
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    name="hora"
                    type="time"
                    defaultValue={config.hora_limite.replace(/[^0-9:]/g, '').slice(0, 5) || '08:00'}
                    required
                    className="col-span-2 text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <select
                    name="meridiem"
                    defaultValue={config.hora_limite.includes('PM') ? 'PM' : 'AM'}
                    className="text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="AM">AM (Mañana)</option>
                    <option value="PM">PM (Tarde)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Total Días Lectivos Acumulados
                </label>
                <input
                  name="dias"
                  type="number"
                  min={1}
                  defaultValue={config.total_dias}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => exportDatabaseSQL(students, teachers, config.nombre_colegio)}
                  className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300 dark:border-amber-700/50"
                >
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>💾 Descargar database.sql ({students.length} alumnos)</span>
                </button>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0b1c3d] hover:bg-[#152e63] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Imagen Completa Zoom */}
      {fullImagePreview && (
        <div
          onClick={() => setFullImagePreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={fullImagePreview}
              alt="Vista ampliada"
              className="w-full h-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Input oculto para subir foto de estudiante */}
      <input
        ref={studentPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleSaveStudentPhoto}
        className="hidden"
      />

      {/* Input oculto para cambiar foto directamente desde la tarjeta del profesor */}
      <input
        ref={teacherCardPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleDirectTeacherCardPhoto}
        className="hidden"
      />

      {/* Modal de Confirmación Institucional */}
      {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          confirmColor={confirmDialog.confirmColor}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
