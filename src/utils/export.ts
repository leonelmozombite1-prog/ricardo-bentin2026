import { CalendarException, SchoolConfig, Student, Teacher } from '../types';

export function exportStudentsToCSV(students: Student[], schoolName: string, aulaFilter?: string) {
  let csvContent = '\uFEFF'; // BOM para que Excel en español reconozca tildes y caracteres especiales
  csvContent += `COLEGIO:;${schoolName}\n`;
  csvContent += `FECHA DE REPORTE:;${new Date().toLocaleDateString('es-PE')}\n`;
  if (aulaFilter) {
    csvContent += `AULA / SECCIÓN:;${aulaFilter}\n`;
  }
  csvContent += `\n`;
  csvContent += 'DNI;Apellidos y Nombres;Grado;Sección;Asistencias;Tardanzas;Faltas;Último Registro\n';

  students.forEach((s) => {
    const cleanName = (s.name || '').replace(/;/g, ' ');
    const lastReg = s.lastDate ? `${s.lastDate} ${s.lastTime || ''}`.trim() : 'Sin registro';
    csvContent += `${s.dni};"${cleanName}";${s.grade};"${s.section}";${s.attendances};${s.tardies};${s.absences};"${lastReg}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = aulaFilter
    ? `Asistencia_${aulaFilter.replace(/[\s"]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    : `Asistencia_General_${new Date().toISOString().split('T')[0]}.csv`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFullBackupJSON(data: unknown) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `respaldo_asistencia_bentin_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeSql(value?: string | null): string {
  if (!value) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\r?\n/g, ' ');
}

function toMySqlTime(timeStr?: string): string {
  if (!timeStr || timeStr.trim() === '' || timeStr === '--:--') {
    return '00:00:00';
  }
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const nums = clean.replace(/[^0-9:]/g, '');
  const parts = nums.split(':');
  if (parts.length < 2) return '00:00:00';

  let hours = parseInt(parts[0] || '0', 10);
  const mins = parseInt(parts[1] || '0', 10);
  const secs = parseInt(parts[2] || '0', 10);

  if (isNaN(hours) || isNaN(mins)) return '00:00:00';

  if (isPM && hours < 12) hours += 12;
  else if (isAM && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(isNaN(secs) ? 0 : secs).padStart(2, '0')}`;
}

export function exportDatabaseSQL(
  students: Student[],
  teachers: Teacher[],
  configOrSchoolName: SchoolConfig | string,
  exceptions: CalendarException[] = []
) {
  const schoolConfig: SchoolConfig =
    typeof configOrSchoolName === 'string'
      ? {
          nombre_colegio: configOrSchoolName,
          hora_limite: '08:00 AM',
          total_dias: 1,
          logo_url: ''
        }
      : configOrSchoolName;

  const schoolName = schoolConfig.nombre_colegio;
  const attendanceRows: Array<{
    dni: string;
    date: string;
    time: string;
    status: string;
    justification: string;
  }> = [];

  students.forEach((s) => {
    (s.history || []).forEach((h) => {
      if (h.date) {
        attendanceRows.push({
          dni: s.dni,
          date: h.date,
          time: toMySqlTime(h.time),
          status: h.status || 'Presente',
          justification: h.justification || ''
        });
      }
    });
  });

  let sql = `-- ==============================================================\n`;
  sql += `-- BASE DE DATOS COMPLETA: colegio_asistencia\n`;
  sql += `-- Sistema Oficial de Control de Asistencia y Carnets QR\n`;
  sql += `-- Institución: ${schoolName}\n`;
  sql += `-- Fecha de Exportación: ${new Date().toISOString()}\n`;
  sql += `-- Total Alumnos: ${students.length} | Docentes: ${teachers.length} | Asistencias: ${attendanceRows.length}\n`;
  sql += `-- Compatible con MySQL 5.7+, MariaDB y servidores PHP / cPanel / XAMPP\n`;
  sql += `-- ==============================================================\n\n`;
  sql += `CREATE DATABASE IF NOT EXISTS \`colegio_asistencia\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`;
  sql += `USE \`colegio_asistencia\`;\n`;
  sql += `SET NAMES utf8mb4;\n\n`;

  sql += `-- 1. Tabla de Usuarios Administradores\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`usuarios\` (\n`;
  sql += `  \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n`;
  sql += `  \`usuario\` VARCHAR(50) NOT NULL UNIQUE,\n`;
  sql += `  \`clave\` VARCHAR(255) NOT NULL,\n`;
  sql += `  \`nombre_completo\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `-- 2. Tabla de Configuración Institucional\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`configuracion\` (\n`;
  sql += `  \`id\` INT PRIMARY KEY,\n`;
  sql += `  \`nombre_colegio\` VARCHAR(150) NOT NULL DEFAULT '${escapeSql(schoolName)}',\n`;
  sql += `  \`hora_limite\` TIME NOT NULL DEFAULT '08:00:00',\n`;
  sql += `  \`total_dias\` INT NOT NULL DEFAULT 1,\n`;
  sql += `  \`logo_url\` TEXT NULL\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `-- 3. Tabla de Estudiantes Matriculados (${students.length} estudiantes)\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`estudiantes\` (\n`;
  sql += `  \`dni\` VARCHAR(25) PRIMARY KEY,\n`;
  sql += `  \`nombre\` VARCHAR(150) NOT NULL,\n`;
  sql += `  \`grado\` VARCHAR(20) NOT NULL,\n`;
  sql += `  \`seccion\` VARCHAR(10) NOT NULL,\n`;
  sql += `  \`foto\` LONGTEXT NULL,\n`;
  sql += `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `-- 4. Tabla de Asistencias Diarias\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`asistencias\` (\n`;
  sql += `  \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n`;
  sql += `  \`estudiante_dni\` VARCHAR(25) NOT NULL,\n`;
  sql += `  \`fecha\` DATE NOT NULL,\n`;
  sql += `  \`hora\` TIME NOT NULL,\n`;
  sql += `  \`estado\` ENUM('Presente', 'Tarde', 'Ausente') NOT NULL DEFAULT 'Presente',\n`;
  sql += `  \`justificacion\` TEXT NULL,\n`;
  sql += `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  UNIQUE KEY \`uk_estudiante_fecha\` (\`estudiante_dni\`, \`fecha\`),\n`;
  sql += `  CONSTRAINT \`fk_asistencias_estudiante\` FOREIGN KEY (\`estudiante_dni\`)\n`;
  sql += `    REFERENCES \`estudiantes\` (\`dni\`) ON DELETE CASCADE ON UPDATE CASCADE\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `-- 5. Tabla de Docentes\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`profesores\` (\n`;
  sql += `  \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n`;
  sql += `  \`dni\` VARCHAR(15) NOT NULL UNIQUE,\n`;
  sql += `  \`nombre_completo\` VARCHAR(120) NOT NULL,\n`;
  sql += `  \`especialidad\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`foto\` LONGTEXT NULL,\n`;
  sql += `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `-- 6. Tabla de Feriados y Excepciones\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`calendario_excepciones\` (\n`;
  sql += `  \`fecha\` DATE PRIMARY KEY,\n`;
  sql += `  \`tipo\` ENUM('feriado', 'sin_clases') NOT NULL,\n`;
  sql += `  \`motivo\` VARCHAR(255) NULL\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `INSERT INTO \`usuarios\` (\`id\`, \`usuario\`, \`clave\`, \`nombre_completo\`) VALUES (1, 'admin', '64935', 'Administrador General') ON DUPLICATE KEY UPDATE \`clave\` = VALUES(\`clave\`), \`nombre_completo\` = VALUES(\`nombre_completo\`);\n`;
  sql += `INSERT INTO \`configuracion\` (\`id\`, \`nombre_colegio\`, \`hora_limite\`, \`total_dias\`, \`logo_url\`) VALUES (1, '${escapeSql(schoolName)}', '${toMySqlTime(schoolConfig.hora_limite)}', ${Number(schoolConfig.total_dias) || 1}, '${escapeSql(schoolConfig.logo_url)}') ON DUPLICATE KEY UPDATE \`nombre_colegio\` = VALUES(\`nombre_colegio\`), \`hora_limite\` = VALUES(\`hora_limite\`), \`total_dias\` = VALUES(\`total_dias\`), \`logo_url\` = VALUES(\`logo_url\`);\n\n`;

  if (teachers.length > 0) {
    sql += `-- Inserción de Docentes (${teachers.length})\n`;
    sql += `INSERT INTO \`profesores\` (\`dni\`, \`nombre_completo\`, \`especialidad\`, \`foto\`) VALUES\n`;
    sql += teachers
      .map(
        (t) =>
          `('${escapeSql(t.dni)}', '${escapeSql(t.nombre_completo)}', '${escapeSql(t.especialidad)}', '${escapeSql(t.foto)}')`
      )
      .join(',\n');
    sql += `\nON DUPLICATE KEY UPDATE \`nombre_completo\` = VALUES(\`nombre_completo\`), \`especialidad\` = VALUES(\`especialidad\`), \`foto\` = VALUES(\`foto\`);\n\n`;
  }

  if (exceptions.length > 0) {
    const validExceptions = exceptions.filter((e) => e.tipo === 'feriado' || e.tipo === 'sin_clases');
    if (validExceptions.length > 0) {
      sql += `-- Inserción de Feriados y Excepciones (${validExceptions.length})\n`;
      sql += `INSERT INTO \`calendario_excepciones\` (\`fecha\`, \`tipo\`, \`motivo\`) VALUES\n`;
      sql += validExceptions
        .map((e) => `('${escapeSql(e.date)}', '${escapeSql(e.tipo)}', '${escapeSql(e.motivo)}')`)
        .join(',\n');
      sql += `\nON DUPLICATE KEY UPDATE \`tipo\` = VALUES(\`tipo\`), \`motivo\` = VALUES(\`motivo\`);\n\n`;
    }
  }

  if (students.length > 0) {
    sql += `-- Inserción de los ${students.length} Estudiantes Matriculados\n`;
    const chunkSize = 200;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      sql += `INSERT INTO \`estudiantes\` (\`dni\`, \`nombre\`, \`grado\`, \`seccion\`, \`foto\`) VALUES\n`;
      sql += chunk
        .map(
          (s) =>
            `('${escapeSql(s.dni)}', '${escapeSql(s.name)}', '${escapeSql(s.grade)}', '${escapeSql(s.section)}', ${
              s.foto ? `'${escapeSql(s.foto)}'` : 'NULL'
            })`
        )
        .join(',\n');
      sql += `\nON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`grado\` = VALUES(\`grado\`), \`seccion\` = VALUES(\`seccion\`), \`foto\` = COALESCE(VALUES(\`foto\`), \`foto\`);\n\n`;
    }
  }

  if (attendanceRows.length > 0) {
    sql += `-- Inserción de Asistencias Registradas (${attendanceRows.length})\n`;
    const chunkSize = 250;
    for (let i = 0; i < attendanceRows.length; i += chunkSize) {
      const chunk = attendanceRows.slice(i, i + chunkSize);
      sql += `INSERT INTO \`asistencias\` (\`estudiante_dni\`, \`fecha\`, \`hora\`, \`estado\`, \`justificacion\`) VALUES\n`;
      sql += chunk
        .map(
          (a) =>
            `('${escapeSql(a.dni)}', '${escapeSql(a.date)}', '${escapeSql(a.time)}', '${escapeSql(a.status)}', ${
              a.justification ? `'${escapeSql(a.justification)}'` : 'NULL'
            })`
        )
        .join(',\n');
      sql += `\nON DUPLICATE KEY UPDATE \`hora\` = VALUES(\`hora\`), \`estado\` = VALUES(\`estado\`), \`justificacion\` = VALUES(\`justificacion\`);\n\n`;
    }
  }

  const blob = new Blob([sql], { type: 'application/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'database.sql');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
