import { useEffect, useState } from 'react';
import {
  useStudentEnrollmentOptions,
  useEnrollmentFields,
  resolveEnrollmentGroupId,
  isY1BatchEnrollmentReady,
} from '@hooks/useStudentEnrollmentOptions';

const selectClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-slate-100';

type Props = {
  initialProgram?: string;
  initialYear?: string;
  initialPathway?: string;
  initialGroupId?: string;
  onSubmit: (data: {
    programCode: string;
    studyYear: string;
    pathwayCode?: string;
    groupId?: string;
    batchYearLabel?: string;
  }) => void;
  submitting?: boolean;
  submitLabel?: string;
  initialBatchYearLabel?: string;
};

function parseGroupName(name: string): {
  program: string;
  year: string;
  pathway: string;
  batch: string;
} {
  const yFirst = name.match(/^Y([1-4])[-\s]+([A-Z]{2,3})(?:[-\s]+([A-Z0-9]+))?/i);
  if (yFirst) {
    const year = `Y${yFirst[1]}`.toUpperCase();
    const program = yFirst[2].toUpperCase() === 'BST' ? 'BS' : yFirst[2].toUpperCase();
    const suffix = yFirst[3]?.toUpperCase() ?? '';
    const batch = suffix.match(/^\d{2}$/) ? `20${suffix}` : suffix.match(/^20\d{2}$/) ? suffix : '';
    return {
      program,
      year,
      pathway: ['Y3', 'Y4'].includes(year) ? suffix : '',
      batch,
    };
  }

  const parts = name.split('-');
  if (parts.length >= 2 && parts[1]?.match(/^Y[1-4]$/i)) {
    const year = parts[1].toUpperCase();
    const suffix = parts.length >= 3 ? parts.slice(2).join('-') : '';
    const batch = suffix.match(/^\d{2}$/) ? `20${suffix}` : suffix.match(/^20\d{2}$/) ? suffix : '';
    return {
      program: parts[0],
      year,
      pathway: ['Y3', 'Y4'].includes(year) ? suffix : '',
      batch: !['Y3', 'Y4'].includes(year) ? batch : '',
    };
  }
  return { program: '', year: '', pathway: '', batch: '' };
}

export default function StudentEnrollmentForm({
  initialProgram = '',
  initialYear = '',
  initialPathway = '',
  initialGroupId = '',
  onSubmit,
  submitting = false,
  submitLabel = 'Update enrollment',
  initialBatchYearLabel = '',
}: Props) {
  const { programs, loading } = useStudentEnrollmentOptions();
  const [programCode, setProgramCode] = useState(initialProgram);
  const [studyYear, setStudyYear] = useState(initialYear);
  const [pathwayCode, setPathwayCode] = useState(initialPathway);
  const [batchYearLabel, setBatchYearLabel] = useState(initialBatchYearLabel);
  const [groupId, setGroupId] = useState(initialGroupId);

  const { yearOptions, needsPathway, pathwayOptions, batchYearOptions, groupOptions } = useEnrollmentFields(
    programs,
    programCode,
    studyYear,
    pathwayCode,
    batchYearLabel,
  );
  const resolvedGroupId = resolveEnrollmentGroupId(groupId, groupOptions);
  const resolvedGroup =
    groupOptions.find(
      (group) =>
        group.id === resolvedGroupId &&
        (!batchYearLabel || group.batchYearLabel === batchYearLabel),
    ) ?? groupOptions.find((group) => group.id === resolvedGroupId);
  const needsBatchYear = studyYear === 'Y1' && batchYearOptions.length > 0;
  const displayedClassBatch =
    studyYear === 'Y1' && programCode && batchYearLabel
      ? `Y1-${programCode}-${batchYearLabel.slice(-2)}`
      : resolvedGroup?.name ?? '';
  const showClassBatch = Boolean(
    programCode &&
      studyYear &&
      groupOptions.length > 0 &&
      (!needsBatchYear || batchYearLabel),
  );
  const y1BatchEnrollmentReady = isY1BatchEnrollmentReady(
    studyYear,
    programCode,
    batchYearLabel,
    batchYearOptions.length,
  );
  const missingRequiredClassBatch = showClassBatch && !resolvedGroupId && !y1BatchEnrollmentReady;
  const missingRequiredBatchYear = Boolean(programCode && needsBatchYear && !batchYearLabel);

  useEffect(() => {
    setProgramCode(initialProgram);
    setStudyYear(initialYear);
    setPathwayCode(initialPathway);
    setBatchYearLabel(initialBatchYearLabel);
    setGroupId(initialGroupId);
  }, [initialProgram, initialYear, initialPathway, initialGroupId, initialBatchYearLabel]);

  useEffect(() => {
    if (!initialGroupId) return;
    const selectedGroup = programs
      .flatMap((program) => program.groups)
      .find((group) => group.id === initialGroupId);
    if (selectedGroup?.batchYearLabel) {
      if (!batchYearLabel) setBatchYearLabel(selectedGroup.batchYearLabel);
      return;
    }
    if (initialYear === 'Y1' && initialGroupId) {
      const parsedBatch = parseGroupName(selectedGroup?.name ?? '').batch;
      if (parsedBatch && !batchYearLabel) setBatchYearLabel(parsedBatch);
    }
  }, [batchYearLabel, initialGroupId, initialYear, programs]);

  useEffect(() => {
    if (studyYear !== 'Y1') {
      if (batchYearLabel) setBatchYearLabel('');
      return;
    }
    if (batchYearLabel && batchYearOptions.includes(batchYearLabel)) return;
    setBatchYearLabel(batchYearOptions.length === 1 ? batchYearOptions[0] : '');
  }, [batchYearLabel, batchYearOptions, studyYear]);

  useEffect(() => {
    if (!programCode || !studyYear) return;
    if (studyYear === 'Y1' && batchYearOptions.length > 0 && !batchYearLabel) {
      setGroupId('');
      return;
    }
    const resolved = resolveEnrollmentGroupId(groupId, groupOptions);
    if (resolved !== groupId) setGroupId(resolved);
  }, [batchYearLabel, batchYearOptions.length, groupId, groupOptions, programCode, studyYear]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchingGroup =
      groupOptions.find(
        (group) =>
          group.id === resolvedGroupId &&
          (!batchYearLabel || !group.batchYearLabel || group.batchYearLabel === batchYearLabel),
      ) ?? groupOptions.find((group) => group.id === resolvedGroupId);
    onSubmit({
      programCode,
      studyYear,
      pathwayCode: needsPathway ? pathwayCode : undefined,
      groupId: matchingGroup?.id || undefined,
      batchYearLabel: batchYearLabel || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-700">
        Update each academic year when you advance (e.g. Y2 to Y3 and choose your pathway).
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
            setBatchYearLabel('');
            setGroupId('');
          }}
          required
          disabled={loading}
          className={selectClass}
        >
          <option value="">- Select -</option>
          {programs.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} - {p.name}
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
            setBatchYearLabel('');
            setGroupId('');
          }}
          required
          disabled={!programCode}
          className={selectClass}
        >
          <option value="">- Select -</option>
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
            onChange={(e) => {
              setPathwayCode(e.target.value);
              setGroupId('');
            }}
            required
            className={selectClass}
          >
            <option value="">- Select -</option>
            {pathwayOptions.map((pw) => (
              <option key={pw.code} value={pw.code}>
                {pw.code} - {pw.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {programCode && studyYear === 'Y1' && batchYearOptions.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">Batch year</span>
          <select
            data-testid="enroll-batch-year"
            value={batchYearLabel}
            onChange={(e) => {
              setBatchYearLabel(e.target.value);
              setGroupId('');
            }}
            required
            className={selectClass}
          >
            <option value="">- Select batch year -</option>
            {batchYearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      )}
      {showClassBatch && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">Class batch</span>
          <input
            data-testid="enroll-group"
            value={displayedClassBatch}
            readOnly
            required
            className={selectClass}
          />
        </label>
      )}
      <button
        type="submit"
        disabled={submitting || loading || missingRequiredBatchYear || missingRequiredClassBatch}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)]"
      >
        {submitting ? 'Updating...' : submitLabel}
      </button>
    </form>
  );
}

export { parseGroupName };
