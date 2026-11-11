import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Server,
  Database,
  ShieldCheck,
  CheckCircle2,
  FolderArchive
} from 'lucide-react';

interface HostingFilesModalProps {
  onClose: () => void;
}

export const HostingFilesModal: React.FC<HostingFilesModalProps> = ({ onClose }) => {
  const [activeFile, setActiveFile] = useState<string>('database.sql');
  const [copied, setCopied] = useState<boolean>(false);

  const fileList = [
    {
      id: 'database.sql',
      name: 'database.sql',
      label: '1. Base de Datos (SQL)',
      desc: 'Tablas completas (estudiantes, asistencias, profesores, usuarios, excepciones, config)',
      path: '/php_hosting/database.sql'
    },
    {
      id: 'conexion.php',
      name: 'conexion.php',
      label: '2. conexion.php',
      desc: 'Conexión MySQL con codificación UTF-8 y zona horaria de Perú',
      path: '/php_hosting/conexion.php'
    },
    {
      id: 'api.php',
      name: 'api.php',
      label: '3. api.php (Corregido)',
      desc: 'Incluye edit_profesor, upload_student_foto, estadísticas y control de feriados',
      path: '/php_hosting/api.php'
    },
    {
      id: 'reporte_pdf.php',
      name: 'reporte_pdf.php',
      label: '4. reporte_pdf.php (Corregido)',
      desc: 'Corrección de columna "nombre", validación de sesión y diseño de impresión A4',
      path: '/php_hosting/reporte_pdf.php'
    },
    {
      id: 'login.php',
      name: 'login.php',
      label: '5. login.php',
      desc: 'Autenticación segura con soporte para bcrypt y auto-migración de hashes',
      path: '/php_hosting/login.php'
    },
    {
      id: 'auth.php',
      name: 'auth.php',
      label: '6. auth.php',
      desc: 'Manejador de sesiones seguras y protección de endpoints',
      path: '/php_hosting/auth.php'
    },
    {
      id: 'login.html',
      name: 'login.html',
      label: '7. login.html',
      desc: 'Pantalla de acceso con fondo institucional y validaciones',
      path: '/php_hosting/login.html'
    }
  ];

  const handleCopyCode = async () => {
    try {
      const res = await fetch(`/php_hosting/${activeFile}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('No se pudo copiar automáticamente.');
    }
  };

  const handleDownloadFile = (fileName: string) => {
    const link = document.createElement('a');
    link.href = `/php_hosting/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-[#0b1c3d] text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg font-bold tracking-wide text-white">
                Paquete de Archivos Corregidos para Hosting / cPanel / XAMPP
              </h2>
              <p className="text-xs text-slate-300">
                Todo listo para subir a tu servidor web sin errores de base de datos ni llamadas rotas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de Correcciones Realizadas */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Arreglos críticos solucionados en tus archivos originales:
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 list-disc pl-5 opacity-90">
            <li><strong>reporte_pdf.php:</strong> Se corrigió el error SQL fatal de columnas inexistentes (<code className="text-[11px] bg-emerald-100 dark:bg-emerald-900 px-1 rounded">nombres, apellidos</code> cambiadas por <code className="text-[11px] bg-emerald-100 dark:bg-emerald-900 px-1 rounded">nombre</code>).</li>
            <li><strong>reporte_pdf.php:</strong> Se sincronizó la sesión (<code className="text-[11px] bg-emerald-100 dark:bg-emerald-900 px-1 rounded">user_id</code> en vez de <code className="text-[11px] bg-emerald-100 dark:bg-emerald-900 px-1 rounded">admin_logged</code> que te devolvía al login).</li>
            <li><strong>api.php:</strong> Se añadió la acción <code className="text-[11px] bg-emerald-100 dark:bg-emerald-900 px-1 rounded">edit_profesor</code> que tu JavaScript llamaba pero no existía en el backend.</li>
            <li><strong>Fotos de Estudiantes:</strong> Se añadió <code className="text-[11px] bg-emerald-100 dark:bg-emerald-900 px-1 rounded">upload_student_foto</code> para guardar fotos en la base de datos MySQL (ya no se pierden al recargar).</li>
            <li><strong>database.sql:</strong> Script limpio con creación de tablas, índices de unicidad, usuario admin inicial y datos de muestra.</li>
          </ul>
        </div>

        {/* Body con split de archivos */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
          {/* Columna Izquierda: Lista de Archivos */}
          <div className="p-3 border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 block mb-1">
              Archivos Listos para Descarga
            </span>
            {fileList.map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveFile(f.id)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-start gap-2.5 ${
                  activeFile === f.id
                    ? 'bg-white dark:bg-slate-800 border-amber-500 shadow-sm'
                    : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    f.id.endsWith('.sql')
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : f.id.endsWith('.php')
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {f.id.endsWith('.sql') ? (
                    <Database className="w-4 h-4" />
                  ) : f.id.endsWith('.php') ? (
                    <FileCode className="w-4 h-4" />
                  ) : (
                    <Server className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {f.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Columna Derecha: Vista previa y Guía de Instalación */}
          <div className="col-span-2 flex flex-col p-5 overflow-y-auto bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  Archivo seleccionado:
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {activeFile}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={() => handleDownloadFile(activeFile)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#0b1c3d] hover:bg-[#152e63] text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar {activeFile}
                </button>
              </div>
            </div>

            {/* Pasos para desplegar en hosting */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Guía Rápida para Subir a cPanel o XAMPP
              </div>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  <strong>Crear la Base de Datos:</strong> En phpMyAdmin o en el asistente &quot;Bases de datos MySQL&quot; de tu cPanel, crea una base llamada <code className="bg-amber-100 dark:bg-amber-950 px-1 rounded font-mono">colegio_asistencia</code>.
                </li>
                <li>
                  <strong>Importar database.sql:</strong> Abre la pestaña <em>Importar</em> en phpMyAdmin y sube el archivo <code className="font-bold">database.sql</code>. Se crearán todas las tablas y el usuario administrador inicial (<code className="font-mono">admin</code> / clave: <code className="font-mono">admin123</code>).
                </li>
                <li>
                  <strong>Configurar conexion.php:</strong> En tu Administrador de Archivos de cPanel, abre <code className="font-mono">conexion.php</code> y coloca el nombre de tu usuario MySQL y tu contraseña creada.
                </li>
                <li>
                  <strong>Subir los Archivos Web:</strong> Sube <code className="font-mono">api.php</code>, <code className="font-mono">auth.php</code>, <code className="font-mono">login.php</code>, <code className="font-mono">reporte_pdf.php</code>, <code className="font-mono">login.html</code>, <code className="font-mono">index.html</code> y crea una carpeta vacía llamada <code className="font-mono">uploads/</code> con permisos de escritura (755).
                </li>
                <li>
                  <strong>Listo:</strong> Ingresa a <code className="font-mono">tudominio.com/login.html</code> y ya podrás registrar asistencias, escanear carnets y generar reportes oficiales!
                </li>
              </ol>
            </div>

            {/* Descargar todo el paquete */}
            <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Archivos ubicados en <code className="font-mono text-[11px]">/public/php_hosting/</code>
              </span>
              <div className="flex gap-2">
                {fileList.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleDownloadFile(f.id)}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 underline cursor-pointer"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
