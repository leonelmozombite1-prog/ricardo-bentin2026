import readXlsxFile from 'read-excel-file/browser';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedStudentRow {
  dni: string;
  name: string;
  grade?: string;
  section?: string;
}

export interface FileParseResult {
  fileName: string;
  fileType: 'Excel' | 'Word' | 'PDF';
  students: ParsedStudentRow[];
  warnings: string[];
}

const GRADE_MAP: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(1|1°|1º|1RO|1ER|PRIMERO|PRIMER)\b/i, value: '1' },
  { pattern: /\b(2|2°|2º|2DO|SEGUNDO)\b/i, value: '2' },
  { pattern: /\b(3|3°|3º|3RO|3ER|TERCERO|TERCER)\b/i, value: '3' },
  { pattern: /\b(4|4°|4º|4TO|CUARTO)\b/i, value: '4' },
  { pattern: /\b(5|5°|5º|5TO|QUINTO)\b/i, value: '5' }
];

export function normalizeGrade(raw?: string | number | null): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = String(raw).trim().toUpperCase();
  if (!text) return undefined;

  if (/^[1-5]$/.test(text)) return text;

  for (const item of GRADE_MAP) {
    if (item.pattern.test(text)) {
      return item.value;
    }
  }

  const compactMatch = text.match(/^([1-5])\s*[°º]?\s*[A-F]$/i);
  if (compactMatch) return compactMatch[1];

  return undefined;
}

export function normalizeSection(raw?: string | number | null): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  let text = String(raw)
    .trim()
    .replace(/["'“”]/g, '')
    .replace(/SECCI[ÓO]N\s*:?\s*/gi, '')
    .replace(/SEC\.?\s*:?\s*/gi, '')
    .trim()
    .toUpperCase();

  if (!text) return undefined;
  if (text === 'UNICA' || text === 'ÚNICA') return 'Única';
  if (/^[A-F]$/.test(text)) return text;

  const singleMatch = text.match(/\b([A-F])\b/);
  if (singleMatch) return singleMatch[1];

  return undefined;
}

function extractClassroomHint(text: string): { grade?: string; section?: string } {
  const clean = text.replace(/["'“”]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return {};

  // Patrones como: "1° A", "PRIMERO B", "3ro - C", "GRADO: 2° SECCIÓN: A", "1A"
  const compact = clean.match(/\b([1-5])\s*[°º]?\s*[-–]?\s*([A-F])\b/i);
  if (compact) {
    return {
      grade: compact[1],
      section: compact[2].toUpperCase()
    };
  }

  const wordAndSection = clean.match(
    /\b(PRIMERO|PRIMER|SEGUNDO|TERCERO|TERCER|CUARTO|QUINTO|[1-5](?:°|º|RO|DO|TO|ER)?(?:\s+DE\s+SECUNDARIA)?)\s*(?:[-–,:/]|\s+SECCI[ÓO]N)?\s*(?:["']?([A-F]|ÚNICA|UNICA)["']?)\b/i
  );
  if (wordAndSection) {
    return {
      grade: normalizeGrade(wordAndSection[1]),
      section: normalizeSection(wordAndSection[2])
    };
  }

  const gradeOnly = clean.match(/(?:GRADO|AÑO)\s*:?\s*([1-5](?:°|º)?|PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO)/i);
  const sectionOnly = clean.match(/(?:SECCI[ÓO]N|SEC\.?)\s*:?\s*([A-F]|ÚNICA|UNICA)\b/i);

  return {
    grade: gradeOnly ? normalizeGrade(gradeOnly[1]) : undefined,
    section: sectionOnly ? normalizeSection(sectionOnly[1]) : undefined
  };
}

function cleanDniCell(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  // Evitar fechas o teléfonos largos; buscar exactamente 7 u 8 dígitos (en Perú DNI tiene 8 dígitos, a veces Excel quita el cero inicial)
  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length === 8) return digitsOnly;
  if (digitsOnly.length === 7) return `0${digitsOnly}`;
  return null;
}

function cleanStudentName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[,.\-;\s]+|[,.\-;\s]+$/g, '')
    .trim()
    .toUpperCase();
}

function isHeaderNoiseName(name: string): boolean {
  const upper = name.toUpperCase();
  return (
    upper === 'APELLIDOS Y NOMBRES' ||
    upper === 'NOMBRES Y APELLIDOS' ||
    upper === 'NOMBRE COMPLETO' ||
    upper === 'ESTUDIANTE' ||
    upper === 'ALUMNO' ||
    upper === 'NOMBRE' ||
    upper === 'APELLIDOS' ||
    upper === 'NOMBRES'
  );
}

interface ColumnMapping {
  dniIdx: number;
  fullNameIdx: number;
  paternoIdx: number;
  maternoIdx: number;
  nombresIdx: number;
  gradeIdx: number;
  sectionIdx: number;
  aulaIdx: number;
}

function detectHeaderMapping(row: string[]): ColumnMapping | null {
  const normalized = row.map((cell) =>
    cell
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

  let dniIdx = -1;
  let fullNameIdx = -1;
  let paternoIdx = -1;
  let maternoIdx = -1;
  let nombresIdx = -1;
  let gradeIdx = -1;
  let sectionIdx = -1;
  let aulaIdx = -1;

  normalized.forEach((col, idx) => {
    if (!col) return;
    if (dniIdx === -1 && (col === 'dni' || col.includes('dni') || col.includes('nro doc') || col.includes('n° doc') || col.includes('documento'))) {
      dniIdx = idx;
    } else if (paternoIdx === -1 && (col.includes('paterno') || col === 'ap paterno' || col === 'ap. paterno')) {
      paternoIdx = idx;
    } else if (maternoIdx === -1 && (col.includes('materno') || col === 'ap materno' || col === 'ap. materno')) {
      maternoIdx = idx;
    } else if (
      fullNameIdx === -1 &&
      (col.includes('apellidos y nombres') ||
        col.includes('nombres y apellidos') ||
        col.includes('nombre completo') ||
        col === 'estudiante' ||
        col === 'alumno' ||
        col === 'nombre')
    ) {
      fullNameIdx = idx;
    } else if (nombresIdx === -1 && (col === 'nombres' || col === 'apellidos')) {
      nombresIdx = idx;
    } else if (gradeIdx === -1 && (col === 'grado' || col.includes('grado') || col === 'grade' || col === 'ano')) {
      gradeIdx = idx;
    } else if (sectionIdx === -1 && (col === 'seccion' || col.includes('seccion') || col === 'section' || col === 'sec')) {
      sectionIdx = idx;
    } else if (aulaIdx === -1 && (col === 'aula' || col.includes('aula') || col.includes('grado y seccion'))) {
      aulaIdx = idx;
    }
  });

  const hasNameCol = fullNameIdx !== -1 || paternoIdx !== -1 || nombresIdx !== -1;
  if (dniIdx !== -1 || (hasNameCol && (gradeIdx !== -1 || sectionIdx !== -1 || aulaIdx !== -1))) {
    return {
      dniIdx,
      fullNameIdx,
      paternoIdx,
      maternoIdx,
      nombresIdx,
      gradeIdx,
      sectionIdx,
      aulaIdx
    };
  }
  return null;
}

function parseLineFallback(
  lineText: string,
  contextGrade?: string,
  contextSection?: string
): ParsedStudentRow | null {
  const trimmed = lineText.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;

  const dniMatch = trimmed.match(/\b(\d{8})\b/);
  if (!dniMatch) return null;

  const dni = dniMatch[1];
  const beforeDni = trimmed.slice(0, dniMatch.index).trim();
  const afterDni = trimmed.slice((dniMatch.index || 0) + 8).trim();

  // Quitar posible número de orden al inicio ("1.", "12)", "12 ")
  const cleanedBefore = beforeDni.replace(/^\d{1,3}\s*[.)-]\s*|\b\d{1,3}\s+/, '').trim();

  // Buscar aula al final (ej: 1° "A", PRIMERO A, 2 B)
  let grade = contextGrade;
  let section = contextSection;
  let candidateName = afterDni;

  const aulaMatch = afterDni.match(
    /(?:([1-5](?:°|º|RO|DO|TO|ER)?|PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO)\s*["']?\s*([A-F]|ÚNICA|UNICA)\s*["']?)/i
  );

  if (aulaMatch) {
    grade = normalizeGrade(aulaMatch[1]) || grade;
    section = normalizeSection(aulaMatch[2]) || section;
    const idx = aulaMatch.index ?? afterDni.length;
    const beforeAula = afterDni.slice(0, idx).trim();
    if (beforeAula.length >= 3) {
      candidateName = beforeAula;
    }
  } else {
    // Quitar estados de asistencia si el PDF viene de "Parte Oficial"
    candidateName = afterDni
      .replace(/\b(PRESENTE|TARDE|AUSENTE|SIN REGISTRO)\b.*$/i, '')
      .replace(/\b\d{1,2}:\d{2}(?:\s*[AP]M)?\b.*$/i, '')
      .trim();
  }

  // Si el nombre estaba antes del DNI (ej. "PEREZ JUAN 78494458 1 A")
  if (candidateName.replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').length < 3 && cleanedBefore.replace(/[^A-ZÁÉÍÓÚÑ]/gi, '').length >= 4) {
    candidateName = cleanedBefore;
  }

  // Limpiar separadores como ";" o "|" o tabs
  candidateName = cleanStudentName(candidateName.replace(/[;|]/g, ' '));
  if (candidateName.length < 3 || isHeaderNoiseName(candidateName)) return null;
  if (!/[A-ZÁÉÍÓÚÑ]{2,}/i.test(candidateName)) return null;

  return {
    dni,
    name: candidateName,
    grade,
    section
  };
}

function extractStudentsFromRows(
  rows: string[][],
  initialGrade?: string,
  initialSection?: string
): ParsedStudentRow[] {
  const results: ParsedStudentRow[] = [];
  let contextGrade = initialGrade;
  let contextSection = initialSection;
  let mapping: ColumnMapping | null = null;

  for (const rawRow of rows) {
    const row = rawRow.map((c) => String(c ?? '').trim());
    const nonEmpty = row.filter(Boolean);
    if (nonEmpty.length === 0) continue;

    const joined = nonEmpty.join(' ');

    // Detectar si esta fila es un encabezado de columnas
    const detected = detectHeaderMapping(row);
    if (detected) {
      mapping = detected;
      continue;
    }

    // Actualizar contexto de grado/sección si la fila parece título de sección
    if (nonEmpty.length <= 3 && !/\b\d{8}\b/.test(joined)) {
      const hint = extractClassroomHint(joined);
      if (hint.grade) contextGrade = hint.grade;
      if (hint.section) contextSection = hint.section;
    }

    if (mapping && mapping.dniIdx !== -1) {
      const dni = cleanDniCell(row[mapping.dniIdx]);
      if (dni) {
        let name = '';
        if (mapping.fullNameIdx !== -1 && row[mapping.fullNameIdx]) {
          name = row[mapping.fullNameIdx];
        } else {
          const parts = [
            mapping.paternoIdx !== -1 ? row[mapping.paternoIdx] : '',
            mapping.maternoIdx !== -1 ? row[mapping.maternoIdx] : '',
            mapping.nombresIdx !== -1 ? row[mapping.nombresIdx] : ''
          ].filter(Boolean);
          name = parts.join(' ');
        }

        const cleanedName = cleanStudentName(name);
        if (cleanedName.length >= 3 && !isHeaderNoiseName(cleanedName)) {
          let grade = mapping.gradeIdx !== -1 ? normalizeGrade(row[mapping.gradeIdx]) : undefined;
          let section = mapping.sectionIdx !== -1 ? normalizeSection(row[mapping.sectionIdx]) : undefined;

          if ((!grade || !section) && mapping.aulaIdx !== -1 && row[mapping.aulaIdx]) {
            const aulaHint = extractClassroomHint(row[mapping.aulaIdx]);
            grade = grade || aulaHint.grade;
            section = section || aulaHint.section;
          }

          results.push({
            dni,
            name: cleanedName,
            grade: grade || contextGrade,
            section: section || contextSection
          });
          continue;
        }
      }
    }

    // Respaldo: buscar fila por patrón de DNI en el texto de la fila
    const fallback = parseLineFallback(joined, contextGrade, contextSection);
    if (fallback) {
      results.push(fallback);
    }
  }

  return results;
}

function parseDelimitedText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || '';
  const semiCount = (firstNonEmpty.match(/;/g) || []).length;
  const commaCount = (firstNonEmpty.match(/,/g) || []).length;
  const tabCount = (firstNonEmpty.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount >= commaCount && semiCount >= tabCount && semiCount > 0) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function deduplicateStudents(list: ParsedStudentRow[]): ParsedStudentRow[] {
  const map = new Map<string, ParsedStudentRow>();
  for (const st of list) {
    const existing = map.get(st.dni);
    if (!existing) {
      map.set(st.dni, st);
    } else {
      map.set(st.dni, {
        dni: st.dni,
        name: st.name || existing.name,
        grade: st.grade || existing.grade,
        section: st.section || existing.section
      });
    }
  }
  return Array.from(map.values());
}

async function parseExcelFile(file: File): Promise<FileParseResult> {
  const lower = file.name.toLowerCase();
  const warnings: string[] = [];
  let allStudents: ParsedStudentRow[] = [];

  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    let text = await file.text();
    if (text.includes('\uFFFD')) {
      const buf = await file.arrayBuffer();
      text = new TextDecoder('windows-1252').decode(buf);
    }
    const rows = parseDelimitedText(text);
    allStudents = extractStudentsFromRows(rows);
  } else if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Detectar formato binario OLE2 antiguo (.xls clásico)
    const isOle2 =
      bytes.length >= 4 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0;

    if (isOle2) {
      throw new Error(
        'El archivo .xls está en formato binario antiguo de Excel 97-2003. Guárdalo en Excel como Libro de Excel (.xlsx), CSV, Word (.docx) o PDF e inténtalo de nuevo.'
      );
    }

    // Muchos reportes de SIAGIE .xls son tablas HTML o XML Spreadsheet 2003
    const text = new TextDecoder('utf-8').decode(bytes);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));

    if (tables.length > 0) {
      tables.forEach((table) => {
        const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('th, td')).map((cell) => (cell.textContent || '').trim())
        );
        allStudents.push(...extractStudentsFromRows(rows));
      });
    } else {
      const xmlDoc = parser.parseFromString(text, 'application/xml');
      const xmlRows = Array.from(xmlDoc.getElementsByTagName('Row')).map((rowEl) =>
        Array.from(rowEl.getElementsByTagName('Cell')).map((c) => (c.textContent || '').trim())
      );
      allStudents.push(...extractStudentsFromRows(xmlRows));
    }
  } else {
    const sheets = await readXlsxFile(file);
    for (const sheet of sheets) {
      const sheetHint = extractClassroomHint(sheet.sheet || '');
      const rows = sheet.data.map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined) return '';
          if (cell instanceof Date) return cell.toLocaleDateString('es-PE');
          return String(cell).trim();
        })
      );
      allStudents.push(...extractStudentsFromRows(rows, sheetHint.grade, sheetHint.section));
    }
  }

  return {
    fileName: file.name,
    fileType: 'Excel',
    students: deduplicateStudents(allStudents),
    warnings
  };
}

async function parseWordFile(file: File): Promise<FileParseResult> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
    throw new Error(
      'El formato binario antiguo .doc no es compatible. Guárdalo en Word como Documento de Word (.docx) o PDF e inténtalo nuevamente.'
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    mammoth.extractRawText({ arrayBuffer })
  ]);

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlResult.value, 'text/html');

  const collected: ParsedStudentRow[] = [];
  let contextGrade: string | undefined;
  let contextSection: string | undefined;

  const elements = Array.from(doc.body.children);
  for (const el of elements) {
    if (el.tagName === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('th, td')).map((cell) => (cell.textContent || '').trim())
      );
      collected.push(...extractStudentsFromRows(rows, contextGrade, contextSection));
    } else {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      const hint = extractClassroomHint(txt);
      if (hint.grade) contextGrade = hint.grade;
      if (hint.section) contextSection = hint.section;
    }
  }

  // Si no hubo tablas o no se extrajeron alumnos, analizar líneas de texto plano
  if (collected.length === 0 && textResult.value) {
    const lines = textResult.value.split(/\r?\n/);
    let lineGrade: string | undefined;
    let lineSection: string | undefined;
    for (const line of lines) {
      if (!/\b\d{8}\b/.test(line)) {
        const hint = extractClassroomHint(line);
        if (hint.grade) lineGrade = hint.grade;
        if (hint.section) lineSection = hint.section;
      }
      const parsed = parseLineFallback(line, lineGrade, lineSection);
      if (parsed) collected.push(parsed);
    }
  }

  return {
    fileName: file.name,
    fileType: 'Word',
    students: deduplicateStudents(collected),
    warnings: []
  };
}

interface PdfTextToken {
  str: string;
  x: number;
  y: number;
}

async function parsePdfFile(file: File): Promise<FileParseResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const allRows: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const tokens: PdfTextToken[] = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        const transform = item.transform;
        tokens.push({
          str: item.str.trim(),
          x: transform[4],
          y: transform[5]
        });
      }
    }

    // Ordenar arriba hacia abajo (Y descendente) y luego izquierda a derecha (X ascendente)
    tokens.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 4) return b.y - a.y;
      return a.x - b.x;
    });

    const groupedLines: PdfTextToken[][] = [];
    for (const tok of tokens) {
      const lastLine = groupedLines[groupedLines.length - 1];
      if (!lastLine || Math.abs(lastLine[0].y - tok.y) > 4) {
        groupedLines.push([tok]);
      } else {
        lastLine.push(tok);
      }
    }

    for (const lineTokens of groupedLines) {
      lineTokens.sort((a, b) => a.x - b.x);
      // Reconstruir celdas separadas por brechas horizontales significativas (>14pt) o texto completo
      const cells: string[] = [];
      let currentCell = '';
      let prevEndX = -Infinity;

      for (const tok of lineTokens) {
        if (prevEndX !== -Infinity && tok.x - prevEndX > 14) {
          cells.push(currentCell.trim());
          currentCell = tok.str;
        } else {
          currentCell = currentCell ? `${currentCell} ${tok.str}` : tok.str;
        }
        prevEndX = tok.x + tok.str.length * 4.5;
      }
      if (currentCell.trim()) {
        cells.push(currentCell.trim());
      }
      if (cells.length > 0) {
        allRows.push(cells);
      }
    }
  }

  const extracted = extractStudentsFromRows(allRows);

  return {
    fileName: file.name,
    fileType: 'PDF',
    students: deduplicateStudents(extracted),
    warnings: []
  };
}

export async function parseStudentsFile(file: File): Promise<FileParseResult> {
  const lower = file.name.toLowerCase();

  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv')
  ) {
    return parseExcelFile(file);
  }

  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return parseWordFile(file);
  }

  if (lower.endsWith('.pdf')) {
    return parsePdfFile(file);
  }

  throw new Error(
    'Formato no compatible. Sube un archivo Excel (.xlsx, .xls, .csv), Word (.docx) o PDF (.pdf).'
  );
}
