import { useEffect, useState } from 'react';
import { useStudentEnrollmentOptions, useEnrollmentFields } from '@hooks/useStudentEnrollmentOptions';

const selectClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-slate-100';

type Props = {
  initialProgram?: string;
  initialYear?: string;
  initialPathway?: string;
  onSubmit: (data: { programCode: string; studyYear: string; pathwayCode?: string }) => void;
  submitting?: boolean;
  submitLabel?: string;
};

/** Parse group name CS-Y3-AINT → program/year/pathway */
function parseGroupName(name: string): { program: string; year: string; pathway: string } {
  const parts = name.split('-');
  if (parts.length >= 2 && parts[1]?.match(/^Y[1-4]$/i)) {
    return {
      program: parts[0],
      year: parts[1].toUpperCase(),
      pathway: parts.length >= 3 ? parts.slice(2).join('-') : '',
    };
  }
  return { program: '', year: '', pathway: '' };
}

export default function StudentEnrollmentForm({
  initialProgram = '',
  initialYear = '',
  initialPathway = '',
  onSubmit,
  submitting = false,
  submitLabel = 'Update enrollment',
}: Props) {
  const { programs, loading } = useStudentEnrollmentOptions();
  const [programCode, setProgramCode] = useState(initialProgram);
  const [studyYear, setStudyYear] = useState(initialYear);
  const [pathwayCode, setPathwayCode] = useState(initialPathway);

  const { yearOptions, needsPathway, pathwayOptions } = useEnrollmentFields(
    programs,
    programCode,
    studyYear,
    pathwayCode,
  );

  useEffect(() => {
    setProgramCode(initialProgram);
    setStudyYear(initialYear);
    setPathwayCode(initialPathway);
  }, [initialProgram, initialYear, initialPathway]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      programCode,
      studyYear,
      pathwayCode: needsPathway ? pathwayCode : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-700">
        Update each academic year when you advance (e.g. Y2 → Y3 and choose your pathway).
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-700">Degree program</span>
        <select
          data-testid="enroll-program"
          value={programCode}
          onChange={(e) => {
            setProgramCode(e.target.value);
            setStudyYear('');
            setPathwayCode('');
          }}
          required
          disabled={loading}
          className={selectClass}
        >
          <option value="">— Select —</option>
          {programs.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-700">Study year</span>
        <select
          data-testid="enroll-year"
          value={studyYear}
          onChange={(e) => {
            setStudyYear(e.target.value);
            if (!['Y3', 'Y4'].includes(e.target.value)) setPathwayCode('');
          }}
          required
          disabled={!programCode}
          className={selectClass}
        >
          <option value="">— Select —</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {needsPathway && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">Pathway (Y3 / Y4)</span>
          <select
            data-testid="enroll-pathway"
            value={pathwayCode}
            onChange={(e) => setPathwayCode(e.target.value)}
            required
            className={selectClass}
          >
            <option value="">— Select —</option>
            {pathwayOptions.map((pw) => (
              <option key={pw.code} value={pw.code}>
                {pw.code} — {pw.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={submitting || loading}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)]"
      >
        {submitting ? 'Updating…' : submitLabel}
      </button>
    </form>
  );
}

export { parseGroupName };
