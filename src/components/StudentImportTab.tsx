import React, { useMemo, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Upload,
  FileSpreadsheet,
  FileText,
  FileType,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Download,
  ShieldAlert,
  Users,
  Database
} from 'lucide-react';
import { CalendarException, SchoolConfig, Student, Teacher } from '../types';
import { FileParseResult, parseStudentsFile } from '../utils/studentFileParser';
import { exportDatabaseSQL, exportFullBackupJSON } from '../utils/export';

interface BackupPayload {
  students?: Student[];
  teachers?: Teacher[];
  config?: SchoolConfig;
  exceptions?: CalendarException[];
}

interface StudentImportTabProps {
  existingStudents: Student[];
  teachers: Teacher[];
  config: SchoolConfig;
  exceptions: CalendarException[];
  onApplyStudents: (updatedStudents: Student[], summaryMessage: string) => void;
  onRestoreBackup: (data: BackupPayload, summaryMessage: string) => void;
}

type UpdateMode = 'merge' | 'replace';

export const StudentImportTab: React.FC<StudentImportTabProps> = ({
  existingStudents,
  teachers,
  config,
  exceptions,
  onApplyStudents,
  onRestoreBackup
}) => {
  // Bloqueo por contraseña de actualización ("lidia")
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [authPassword, setAuthPassword] = useState<string>('');
  const [showAuthPassword, setShowAuthPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // Estado de carga y análisis de archivo
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>('');
  const [parseResult, setParseResult] = useState<FileParseResult | null>(null);
  const [updateMode, setUpdateMode] = useState<UpdateMode>('merge');
  const [defaultGrade, setDefaultGrade] = useState<string>('1');
  const [defaultSection, setDefaultSection] = useState<string>('A');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (authPassword.trim() === 'lidia') {
      setIsUnlocked(true);
      setAuthPassword('');
    } else {
      setAuthError('Contraseña incorrecta. Acceso denegado para actualizar estudiantes.');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setAuthPassword('');
    setAuthError('');
    setParseResult(null);
    setParseError('');
    setSuccessMsg('');
  };

  const existingByDni = useMemo(() => {
    const map = new Map<string, Student>();
    existingStudents.forEach((s) => map.set(s.dni, s));
    return map;
  }, [existingStudents]);

  const handleFile = async (file: File) => {
    setParseError('');
    setSuccessMsg('');
    setParseResult(null);
    setIsParsing(true);

    try {
      const result = await parseStudentsFile(file);
      if (result.students.length === 0) {
        setParseError(
          'No se detectaron estudiantes con DNI válido (8 dígitos) y nombre en el archivo. Verifica que el documento contenga columnas o líneas con DNI y Apellidos y Nombres.'
        );
      } else {
        setParseResult(result);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al leer el archivo. Verifica que no esté dañado o protegido con contraseña.';
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const summary = useMemo(() => {
    if (!parseResult) return null;
    let newCount = 0;
    let updateCount = 0;
    let missingAulaCount = 0;

    parseResult.students.forEach((row) => {
      const existing = existingByDni.get(row.dni);
      if (existing) {
        updateCount++;
      } else {
        newCount++;
        if (!row.grade || !row.section) {
          missingAulaCount++;
        }
      }
    });

    return {
      total: parseResult.students.length,
      newCount,
      updateCount,
      missingAulaCount
    };
  }, [parseResult, existingByDni]);

  const filteredPreview = useMemo(() => {
    if (!parseResult) return [];
    const q = previewSearch.trim().toLowerCase();
    if (!q) return parseResult.students;
    return parseResult.students.filter(
      (s) => s.dni.includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [parseResult, previewSearch]);

  const handleDownloadTemplate = () => {
    const csv =
      '\uFEFFDNI;Apellidos y Nombres;Grado;Sección\n' +
      '78494458;ACHING VELA ALEXANDER MICHAEL;1;A\n' +
      '78487279;CESPEDES VENTURA ROLAND JAIR;1;A\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_estudiantes_bentin.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmUpdate = () => {
    if (!isUnlocked || !parseResult || parseResult.students.length === 0) return;

    const importedDnis = new Set<string>();
    const mergedMap = new Map<string, Student>();

    if (updateMode === 'merge') {
      existingStudents.forEach((st) => {
        mergedMap.set(st.dni, st);
      });
    }

    let updatedCount = 0;
    let createdCount = 0;

    parseResult.students.forEach((row) => {
      importedDnis.add(row.dni);
      const prev = existingByDni.get(row.dni);
      if (prev) {
        updatedCount++;
        mergedMap.set(row.dni, {
          ...prev,
          name: row.name,
          grade: row.grade || prev.grade || defaultGrade,
          section: row.section || prev.section || defaultSection
        });
      } else {
        createdCount++;
        mergedMap.set(row.dni, {
          dni: row.dni,
          name: row.name,
          grade: row.grade || defaultGrade,
          section: row.section || defaultSection,
          foto: '',
          attendances: 0,
          tardies: 0,
          absences: 0,
          history: []
        });
      }
    });

    const finalList = Array.from(mergedMap.values()).sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.name.localeCompare(b.name);
    });

    const message =
      updateMode === 'merge'
        ? `Padrón actualizado desde ${parseResult.fileType}: ${updatedCount} actualizados y ${createdCount} nuevos estudiantes agregados (Total: ${finalList.length}).`
        : `Padrón reemplazado desde ${parseResult.fileType}: ${finalList.length} estudiantes cargados (${updatedCount} conservaron su historial y fotos).`;

    onApplyStudents(finalList, message);
    setSuccessMsg(message);
    setParseResult(null);
  };

  // Pantalla de bloqueo por contraseña
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg animate-in fade-in duration-200">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0b1c3d] dark:bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center mb-3 text-amber-400 shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-cinzel text-lg font-extrabold text-[#0b1c3d] dark:text-white">
            Acceso Protegido
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
            Ingrese la contraseña autorizada para subir archivos Excel, Word o PDF y actualizar el padrón de estudiantes.
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{authError}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Contraseña de Actualización
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showAuthPassword ? 'text' : 'password'}
                name="actualizacion_clave"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Ingrese la contraseña"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                className="w-full pl-10 pr-11 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowAuthPassword(!showAuthPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={showAuthPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#C99A20] hover:bg-[#b08419] text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>Desbloquear Actualización</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cabecera del módulo desbloqueado */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-cinzel text-base sm:text-lg font-bold text-[#0b1c3d] dark:text-amber-400">
              Actualizar Padrón de Estudiantes
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase flex items-center gap-1">
              <Unlock className="w-3 h-3" /> Autorizado
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sube una nómina en formato <strong>Excel (.xlsx, .xls, .csv)</strong>, <strong>Word (.docx)</strong> o <strong>PDF (.pdf)</strong> para actualizar los datos de los estudiantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span>Plantilla Excel (CSV)</span>
          </button>
          <button
            type="button"
            onClick={handleLock}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Zona de subida de archivos */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-amber-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.docx,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-500">
          {isParsing ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
        </div>

        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {isParsing ? 'Analizando documento...' : 'Arrastra tu archivo aquí o selecciónalo'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 max-w-lg mx-auto">
          Compatible con listas y nóminas en Excel, Word o PDF que contengan DNI (8 dígitos), Apellidos y Nombres, Grado y Sección.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel (.xlsx, .xls, .csv)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-600" /> Word (.docx)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
            <FileType className="w-3.5 h-3.5 text-rose-600" /> PDF (.pdf)
          </span>
        </div>

        <button
          type="button"
          disabled={isParsing}
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2.5 bg-[#0b1c3d] hover:bg-[#142e61] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-md cursor-pointer disabled:opacity-60"
        >
          {isParsing ? 'Procesando archivo...' : 'Seleccionar Archivo (Excel, Word o PDF)'}
        </button>

        {parseError && (
          <div className="mt-5 max-w-xl mx-auto p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* Vista previa de datos detectados */}
      {parseResult && summary && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>Vista Previa: {parseResult.fileName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                  {parseResult.fileType}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Revisa los estudiantes detectados antes de aplicar la actualización al sistema.
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirmUpdate}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar y Actualizar Estudiantes</span>
            </button>
          </div>

          {/* Métricas de resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Detectados en Archivo
              </span>
              <div className="text-xl font-extrabold text-[#0b1c3d] dark:text-white mt-0.5">
                {summary.total}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                Se Actualizarán (Ya existen)
              </span>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {summary.updateCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
              <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">
                Nuevos Estudiantes
              </span>
              <div className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {summary.newCount}
              </div>
            </div>
          </div>

          {/* Opciones de actualización */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Modo de Actualización
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setUpdateMode('merge')}
                  className={`flex-1 p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                    updateMode === 'merge'
                      ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white font-bold'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div>Combinar y Actualizar</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Actualiza existentes, agrega nuevos y conserva los demás.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateMode('replace')}
                  className={`flex-1 p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                    updateMode === 'replace'
                      ? 'border-rose-500 bg-rose-500/10 text-slate-900 dark:text-white font-bold'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div>Reemplazar Padrón</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Deja solo los alumnos del archivo (mantiene fotos/asistencias).
                  </div>
                </button>
              </div>
            </div>

            {summary.missingAulaCount > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    {summary.missingAulaCount} nuevos sin grado/sección detectado (asignar por defecto):
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={defaultGrade}
                    onChange={(e) => setDefaultGrade(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="1">1° Secundaria</option>
                    <option value="2">2° Secundaria</option>
                    <option value="3">3° Secundaria</option>
                    <option value="4">4° Secundaria</option>
                    <option value="5">5° Secundaria</option>
                  </select>
                  <select
                    value={defaultSection}
                    onChange={(e) => setDefaultSection(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="A">Sección A</option>
                    <option value="B">Sección B</option>
                    <option value="C">Sección C</option>
                    <option value="D">Sección D</option>
                    <option value="E">Sección E</option>
                    <option value="Única">Única</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Buscador en vista previa */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              placeholder="Buscar en vista previa por DNI o nombre..."
              className="w-full text-xs bg-transparent border-none outline-none text-slate-900 dark:text-white"
            />
          </div>

          {/* Tabla de vista previa */}
          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0b1c3d] text-white uppercase text-[11px] sticky top-0">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">Acción</th>
                  <th className="p-2.5">DNI</th>
                  <th className="p-2.5">Apellidos y Nombres</th>
                  <th className="p-2.5">Grado</th>
                  <th className="p-2.5">Sección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPreview.slice(0, 300).map((row, idx) => {
                  const existing = existingByDni.get(row.dni);
                  const resolvedGrade = row.grade || existing?.grade || defaultGrade;
                  const resolvedSection = row.section || existing?.section || defaultSection;
                  return (
                    <tr key={row.dni} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-2.5 text-center text-slate-500 font-bold">{idx + 1}</td>
                      <td className="p-2.5">
                        {existing ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                            Actualizar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                            Nuevo
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {row.dni}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                        {row.name}
                      </td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300">{resolvedGrade}°</td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300">&quot;{resolvedSection}&quot;</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPreview.length > 300 && (
              <div className="p-2.5 text-center text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                Mostrando primeros 300 de {filteredPreview.length} estudiantes detectados. Al confirmar se procesarán todos.
              </div>
            )}
          </div>
        </div>
      )}
      {/* Sección exclusiva de Mantenimiento: Base de Datos y Copia de Seguridad */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-cinzel text-xs sm:text-sm uppercase font-extrabold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span>COPIA DE SEGURIDAD Y BASE DE DATOS</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Descarga la base de datos SQL actualizada ({existingStudents.length} alumnos, docentes, configuración y asistencias) lista para subir a tu servidor, o gestiona respaldos JSON.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() =>
              exportFullBackupJSON({
                config,
                students: existingStudents,
                teachers,
                exceptions
              })
            }
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-4 h-4 text-amber-600" />
            <span>📤 Exportar Respaldo</span>
          </button>

          <button
            type="button"
            onClick={() => exportDatabaseSQL(existingStudents, teachers, config, exceptions)}
            className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300 dark:border-amber-700/50 shadow-xs"
          >
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>💾 Descargar database.sql</span>
          </button>

          <label className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700">
            <Upload className="w-4 h-4 text-amber-600" />
            <span>📥 Importar Respaldo</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setParseError('');
                setSuccessMsg('');
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const parsed = JSON.parse(event.target?.result as string) as BackupPayload;
                    if (
                      !parsed ||
                      typeof parsed !== 'object' ||
                      (!Array.isArray(parsed.students) &&
                        !Array.isArray(parsed.teachers) &&
                        !parsed.config &&
                        !Array.isArray(parsed.exceptions))
                    ) {
                      setParseError('El archivo JSON no contiene un respaldo válido del sistema.');
                      return;
                    }
                    const msg = '¡Copia de seguridad importada y restaurada con éxito!';
                    onRestoreBackup(parsed, msg);
                    setSuccessMsg(msg);
                  } catch {
                    setParseError('Error al leer el archivo JSON de respaldo.');
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
