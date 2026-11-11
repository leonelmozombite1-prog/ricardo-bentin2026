/**
 * Utilidades para manejo de horario en formato 12 Horas (AM / PM)
 */

export function formatToAMPM(timeStr?: string): string {
  if (!timeStr || timeStr.trim() === '' || timeStr === '--:--' || timeStr === '00:00:00') {
    return '--:--';
  }

  const clean = timeStr.trim().toUpperCase();

  // Si ya tiene AM o PM
  if (clean.includes('AM') || clean.includes('PM')) {
    return clean;
  }

  // Si viene en formato HH:MM o HH:MM:SS
  const parts = clean.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const mins = parts[1].padStart(2, '0');

    if (isNaN(hours)) return timeStr;

    const meridiem = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) {
      hours -= 12;
    } else if (hours === 0) {
      hours = 12;
    }

    return `${String(hours).padStart(2, '0')}:${mins} ${meridiem}`;
  }

  return timeStr;
}

export function getCurrentTimeAMPM(): { formatted: string; raw24: string; totalMinutes: number } {
  const now = new Date();
  const hours24 = now.getHours();
  const mins = now.getMinutes();
  const secs = now.getSeconds();

  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  const formatted = `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridiem}`;
  const raw24 = `${String(hours24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const totalMinutes = hours24 * 60 + mins;

  return { formatted, raw24, totalMinutes };
}

export function parseLimitTimeToMinutes(limitStr: string): number {
  if (!limitStr) return 8 * 60; // 08:00 AM default

  const clean = limitStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');

  const numbersOnly = clean.replace(/[^0-9:]/g, '');
  const parts = numbersOnly.split(':');
  let hours = parseInt(parts[0] || '8', 10);
  const mins = parseInt(parts[1] || '0', 10);

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return hours * 60 + mins;
}
