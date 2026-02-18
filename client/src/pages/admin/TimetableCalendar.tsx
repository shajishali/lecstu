interface Entry {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; capacity: number };
  group: { id: string; name: string; batchYear: number };
}

interface Props {
  entries: Entry[];
  onEdit: (e: Entry) => void;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
  SATURDAY: 'Sat', SUNDAY: 'Sun',
};

const HOURS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 7; // 07:00 to 18:00
  return `${String(h).padStart(2, '0')}:00`;
});

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#f97316',
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function TimetableCalendar({ entries, onEdit }: Props) {
  const courseColorMap = new Map<string, string>();
  let colorIdx = 0;
  entries.forEach((e) => {
    if (!courseColorMap.has(e.course.id)) {
      courseColorMap.set(e.course.id, COLORS[colorIdx % COLORS.length]);
      colorIdx++;
    }
  });

  const startMinute = timeToMinutes('07:00');
  const totalMinutes = 12 * 60; // 07:00–19:00

  return (
    <div className="tt-calendar">
      <div className="cal-grid">
        <div className="cal-header-cell cal-time-col" />
        {DAYS.map((d) => (
          <div key={d} className="cal-header-cell">{DAY_SHORT[d]}</div>
        ))}

        {HOURS.map((hour) => (
          <div key={hour} className="cal-row" style={{ gridColumn: '1 / -1', display: 'contents' }}>
            <div className="cal-time-label">{hour}</div>
            {DAYS.map((d) => (
              <div key={`${hour}-${d}`} className="cal-cell" />
            ))}
          </div>
        ))}

        {entries
          .filter((e) => DAYS.includes(e.dayOfWeek))
          .map((e) => {
            const dayIndex = DAYS.indexOf(e.dayOfWeek);
            const top = ((timeToMinutes(e.startTime) - startMinute) / totalMinutes) * 100;
            const height = ((timeToMinutes(e.endTime) - timeToMinutes(e.startTime)) / totalMinutes) * 100;
            const color = courseColorMap.get(e.course.id) || '#3b82f6';

            return (
              <div
                key={e.id}
                className="cal-event"
                style={{
                  gridColumn: dayIndex + 2,
                  top: `${top}%`,
                  height: `${height}%`,
                  backgroundColor: color + '20',
                  borderLeft: `3px solid ${color}`,
                  color,
                }}
                onClick={() => onEdit(e)}
                title={`${e.course.code} — ${e.lecturer.firstName} ${e.lecturer.lastName}\n${e.hall.name} | ${e.group.name}\n${e.startTime}–${e.endTime}`}
              >
                <span className="cal-event-code">{e.course.code}</span>
                <span className="cal-event-detail">{e.hall.name}</span>
                <span className="cal-event-time">{e.startTime}–{e.endTime}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
