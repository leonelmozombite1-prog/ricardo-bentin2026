import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Student } from '../types';
import { Camera, User, Download } from 'lucide-react';

interface CarnetCardProps {
  student: Student;
  schoolName: string;
  logoUrl: string;
  onUploadPhoto: (dni: string) => void;
}

export const CarnetCard: React.FC<CarnetCardProps> = ({
  student,
  schoolName,
  logoUrl,
  onUploadPhoto
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    // Generar código QR para el DNI del estudiante
    QRCode.toDataURL(student.dni, {
      width: 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generando QR:', err));
  }, [student.dni]);

  const handleDownloadCard = () => {
    // Generar captura básica o imprimir individual
    window.print();
  };

  return (
    <div className="carnet-credencial-card flex flex-row relative select-none">
      {/* Botón flotante para descargar / imprimir carnet individual (no visible en print) */}
      <button
        onClick={handleDownloadCard}
        title="Imprimir carnet"
        className="no-print absolute top-2 right-2 p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-full transition cursor-pointer z-10"
      >
        <Download className="w-3.5 h-3.5" />
      </button>

      {/* Lado Izquierdo: Azul Marino Institucional con Foto y Logo */}
      <div className="w-[45%] bg-[#0b1c3d] p-3 flex flex-col justify-between border-r-2 border-[#1e3a6e] relative">
        {/* Recuadro de Foto del Estudiante */}
        <div
          onClick={() => onUploadPhoto(student.dni)}
          title="Haz clic para subir o cambiar la fotografía"
          className="w-24 h-28 mx-auto bg-slate-800 rounded border-2 border-white/90 overflow-hidden relative group cursor-pointer shadow-md flex items-center justify-center"
        >
          {student.foto && student.foto.trim() !== '' ? (
            <img
              src={student.foto}
              alt={student.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-700">
              <User className="w-10 h-10 mb-1 opacity-70" />
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Foto</span>
            </div>
          )}

          {/* Overlay hover para subir foto (no se imprime) */}
          <div className="no-print absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold text-center px-1">
            <Camera className="w-5 h-5 mb-1" />
            <span>Subir Foto</span>
          </div>
        </div>

        {/* Pie del lado izquierdo: Insignia y Nombre del Colegio */}
        <div className="flex items-center gap-1.5 mt-2">
          <img
            src={logoUrl}
            alt="Logo"
            className="w-7 h-7 object-contain bg-white rounded-full p-0.5 border border-amber-400 shrink-0"
          />
          <div className="text-[9px] leading-tight font-bold text-amber-200">
            <div className="uppercase tracking-tight truncate max-w-[90px]">{schoolName}</div>
            <span className="text-[8px] font-medium text-slate-300 tracking-wider">CREDENCIAL 2026</span>
          </div>
        </div>
      </div>

      {/* Lado Derecho: Fondo Blanco con Datos del Estudiante y Código QR */}
      <div className="w-[55%] bg-white text-slate-900 p-3 flex flex-col justify-between items-center text-center">
        {/* Encabezado pequeño institucional */}
        <div className="w-full border-b border-slate-200 pb-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-[#0b1c3d]">
            Estudiante Oficial
          </span>
        </div>

        {/* Nombre Completo del Estudiante */}
        <div className="w-full px-1">
          <h3 className="text-[11px] font-extrabold uppercase leading-tight text-slate-900 line-clamp-2">
            {student.name}
          </h3>
          <div className="mt-1 text-[10px] font-bold text-amber-700">
            {student.grade}° SECUNDARIA &quot;{student.section}&quot;
          </div>
          <div className="text-[10px] font-mono font-bold text-slate-600">
            DNI: {student.dni}
          </div>
        </div>

        {/* Contenedor del Código QR */}
        <div className="w-20 h-20 bg-white p-1 rounded border border-slate-300 shadow-inner flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ${student.dni}`} className="w-full h-full object-contain" />
          ) : (
            <div className="text-[9px] text-slate-400">Generando...</div>
          )}
        </div>
      </div>
    </div>
  );
};
