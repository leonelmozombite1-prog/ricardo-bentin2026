import { Student } from '../types';

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

export function exportDatabaseSQL(students: Student[], teachers: { dni: string; nombre_completo: string; especialidad: string }[], schoolName: string) {
  let sql = `-- ==============================================================\n`;
  sql += `-- BASE DE DATOS COMPLETA: colegio_asistencia\n`;
  sql += `-- Sistema Oficial de Control de Asistencia y Carnets QR\n`;
  sql += `-- Institución: ${schoolName}\n`;
  sql += `-- Fecha de Exportación: ${new Date().toISOString()}\n`;
  sql += `-- Total Alumnos: ${students.length} | Docentes: ${teachers.length}\n`;
  sql += `-- Compatible con MySQL 5.7+, MariaDB y servidores PHP / cPanel / XAMPP\n`;
  sql += `-- ==============================================================\n\n`;
  sql += `CREATE DATABASE IF NOT EXISTS \`colegio_asistencia\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`;
  sql += `USE \`colegio_asistencia\`;\n\n`;
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
  sql += `  \`nombre_colegio\` VARCHAR(150) NOT NULL DEFAULT '${schoolName.replace(/'/g, "''")}',\n`;
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
  sql += `  \`foto\` TEXT NULL,\n`;
  sql += `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
  sql += `-- 6. Tabla de Feriados y Excepciones\n`;
  sql += `CREATE TABLE IF NOT EXISTS \`calendario_excepciones\` (\n`;
  sql += `  \`fecha\` DATE PRIMARY KEY,\n`;
  sql += `  \`tipo\` ENUM('feriado', 'sin_clases') NOT NULL,\n`;
  sql += `  \`motivo\` VARCHAR(255) NULL\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
  sql += `INSERT INTO \`usuarios\` (\`id\`, \`usuario\`, \`clave\`, \`nombre_completo\`) VALUES (1, 'admin', '63935', 'Administrador General') ON DUPLICATE KEY UPDATE \`usuario\` = \`usuario\`;\n`;
  sql += `INSERT INTO \`configuracion\` (\`id\`, \`nombre_colegio\`, \`hora_limite\`, \`total_dias\`) VALUES (1, '${schoolName.replace(/'/g, "''")}', '08:00:00', 1) ON DUPLICATE KEY UPDATE \`id\` = \`id\`;\n\n`;
  if (teachers.length > 0) {
    sql += `-- Inserción de Docentes\n`;
    sql += `INSERT INTO \`profesores\` (\`dni\`, \`nombre_completo\`, \`especialidad\`, \`foto\`) VALUES\n`;
    sql += teachers.map(t => `('${t.dni}', '${(t.nombre_completo || '').replace(/'/g, "''")}', '${(t.especialidad || '').replace(/'/g, "''")}', '')`).join(',\n');
    sql += `\nON DUPLICATE KEY UPDATE \`nombre_completo\` = VALUES(\`nombre_completo\`);\n\n`;
  }
  if (students.length > 0) {
    sql += `-- Inserción de los ${students.length} Estudiantes Matriculados\n`;
    sql += `INSERT INTO \`estudiantes\` (\`dni\`, \`nombre\`, \`grado\`, \`seccion\`) VALUES\n`;
    sql += students.map(s => `('${s.dni}', '${(s.name || '').replace(/'/g, "''")}', '${s.grade}', '${s.section}')`).join(',\n');
    sql += `\nON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`), \`grado\` = VALUES(\`grado\`), \`seccion\` = VALUES(\`seccion\`);\n`;
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
