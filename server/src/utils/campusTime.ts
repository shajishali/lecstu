const CAMPUS_TIMEZONE = process.env.CAMPUS_TIMEZONE || 'Asia/Colombo';

const DAY_ORDER = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

interface CampusDateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  weekday: string;
}

function campusDateParts(date = new Date()): CampusDateParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAMPUS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'long',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    weekday: get('weekday').toUpperCase(),
  };
}

/** Campus-local time as HH:MM (matches timetable slot times). */
export function getCampusTimeStr(date = new Date()): string {
  const p = campusDateParts(date);
  return `${p.hour.padStart(2, '0')}:${p.minute.padStart(2, '0')}`;
}

export function getCampusDayOfWeek(date = new Date()): string {
  const weekday = campusDateParts(date).weekday;
  if (DAY_ORDER.includes(weekday)) return weekday;
  const jsDay = new Date(
    date.toLocaleString('en-US', { timeZone: CAMPUS_TIMEZONE }),
  ).getDay();
  return DAY_ORDER[jsDay];
}

export function getCampusDateIso(date = new Date()): string {
  const p = campusDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function getCampusTimezone(): string {
  return CAMPUS_TIMEZONE;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** True when campus-local time is inside [startTime, endTime). */
export function isTimeInSlot(nowTime: string, startTime: string, endTime: string): boolean {
  const now = parseTimeToMinutes(nowTime);
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return start <= now && now < end;
}
