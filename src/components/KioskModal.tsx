import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { User, CheckCircle2, Clock, X } from 'lucide-react';
import { Student, AttendanceStatus } from '../types';

interface KioskModalProps {
  student: Student;
  status: AttendanceStatus;
  timeFormatted: string;
  onClose: () => void;
}

export const KioskModal: React.FC<KioskModalProps> = ({
  student,
  status,
  timeFormatted,
  onClose
}) => {
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    // Si llegó puntual, lanzamos una lluvia elegante de confeti
    if (status === 'Presente') {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#3b82f6', '#ffffff']
      });
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onClose, status]);

  const isLate = status === 'Tarde';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md rounded-2xl bg-slate-900 border-4 ${
          isLate ? 'border-amber-500' : 'border-emerald-500'
        } p-6 text-center text-white shadow-2xl transition-all scale-100`}
      >
        {/* Botón cerrar manual */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 bg-slate-800 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Foto o Icono del Estudiante */}
        <div
          className={`mx-auto mb-4 w-28 h-28 overflow-hidden rounded-full border-4 ${
            isLate ? 'border-amber-400' : 'border-emerald-400'
          } shadow-lg bg-slate-800 flex items-center justify-center`}
        >
          {student.foto && student.foto.trim() !== '' ? (
            <img
              src={student.foto}
              alt={student.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-16 h-16 text-slate-400" />
          )}
        </div>

        {/* Nombre del Estudiante */}
        <h2 className="text-xl font-extrabold uppercase text-white tracking-tight mb-1">
          {student.name}
        </h2>

        {/* Grado y Sección */}
        <p className="text-sm font-semibold text-slate-300 mb-4">
          {student.grade}° de Secundaria — Sección &quot;{student.section}&quot;
        </p>

        {/* Badge de Estado */}
        <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full font-black text-lg shadow-md mb-3"
          style={{
            backgroundColor: isLate ? '#f59e0b' : '#10b981',
            color: isLate ? '#000000' : '#ffffff'
          }}
        >
          {isLate ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>{isLate ? '¡INGRESO TARDE!' : '¡PRESENTE!'}</span>
        </div>

        {/* Hora registrada */}
        <div className="text-slate-300 text-xs font-mono font-medium mb-5">
          Hora de ingreso: <strong className="text-white text-sm">{timeFormatted}</strong> • DNI: {student.dni}
        </div>

        {/* Barra y contador para siguiente estudiante */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-1000 ${
              isLate ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${(secondsLeft / 3) * 100}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-400">
          Listo para el siguiente estudiante en <span className="font-bold text-white">{secondsLeft}s</span>...
        </p>
      </div>
    </div>
  );
};
