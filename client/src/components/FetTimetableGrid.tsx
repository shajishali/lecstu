import { fetGridDisplayLines } from '@utils/fetGridDisplay';
import type { TimetableGridSnapshot } from '../types/timetableGrid';

const BLOCK_COLORS = [
  '#e0e7ff',
  '#d1fae5',
  '#fef3c7',
  '#fce7f3',
  '#cffafe',
  '#ede9fe',
  '#ffedd5',
];

function blockColor(index: number): string {
  return BLOCK_COLORS[index % BLOCK_COLORS.length];
}

interface Props {
  grid: TimetableGridSnapshot;
  className?: string;
}

/** Renders a stored FET table exactly as in Excel (raw lines, Online label, merged rows). */
export default function FetTimetableGrid({ grid, className = '' }: Props) {
  return (
    <div className={`fet-grid-root overflow-auto ${className}`}>
      <div className="fet-grid-title mb-3 text-center text-lg font-bold text-slate-800">
        {grid.tableTitle}
        {grid.pathwayCode && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({grid.programCode} {grid.studyYear} {grid.pathwayCode})
          </span>
        )}
      </div>
      <table className="fet-grid-table w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="fet-grid-time-head sticky left-0 z-10 border border-slate-300 bg-slate-100 px-2 py-2 text-right font-semibold text-slate-700">
              Time
            </th>
            {grid.dayColumns.map((d) => (
              <th
                key={d.day}
                className="border border-slate-300 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-700"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.timeRows.map((time, ti) => (
            <tr key={`${time.start}-${ti}`}>
              <td className="fet-grid-time sticky left-0 z-[5] border border-slate-200 bg-white px-2 py-1.5 text-right font-medium text-slate-600 whitespace-nowrap">
                {time.label}
              </td>
              {grid.dayColumns.map((d, di) => {
                const cell = grid.cells[ti]?.[di];
                if (!cell || cell.mergeContinue) return null;
                const color = cell.isEmpty || cell.isBreak ? undefined : blockColor(ti * 7 + di);
                return (
                  <td
                    key={d.day}
                    rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                    className="border border-slate-200 align-top p-0"
                    style={color ? { backgroundColor: color } : undefined}
                  >
                    {cell.isBreak ? (
                      <div className="px-2 py-2 text-center font-semibold text-slate-400">-X-</div>
                    ) : cell.isEmpty ? (
                      <div className="px-2 py-2 text-center text-slate-300">---</div>
                    ) : (
                      <div className="px-2 py-1.5 leading-snug text-slate-900">
                        {fetGridDisplayLines(cell.displayLines?.length ? cell.displayLines : cell.lines).map((line, li) => (
                          <div key={li} className={li === 0 ? 'font-semibold' : ''}>
                            {line}
                          </div>
                        ))}
                        {cell.isOnline && (
                          <div className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                            Online
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
