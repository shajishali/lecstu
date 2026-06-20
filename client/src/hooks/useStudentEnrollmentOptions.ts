import { useEffect, useMemo, useState } from 'react';
import api from '@services/api';
import type { RegisterOptionsProgram } from '../types/auth';

const YEARS_WITH_PATHWAY = ['Y3', 'Y4'];

export function useStudentEnrollmentOptions() {
  const [programs, setPrograms] = useState<RegisterOptionsProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ success: boolean; data: { programs: RegisterOptionsProgram[] } }>(
        '/auth/register-options',
      )
      .then((res) => setPrograms(res.data.data.programs))
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  return { programs, loading, yearsWithPathway: YEARS_WITH_PATHWAY };
}

export function useEnrollmentFields(
  programs: RegisterOptionsProgram[],
  programCode: string,
  studyYear: string,
  _pathwayCode: string,
) {
  const selectedProgram = useMemo(
    () => programs.find((p) => p.code === programCode),
    [programs, programCode],
  );

  const yearOptions = selectedProgram?.years ?? [];

  const needsPathway = useMemo(() => {
    if (!selectedProgram || !YEARS_WITH_PATHWAY.includes(studyYear)) return false;
    return selectedProgram.pathways.length > 0;
  }, [selectedProgram, studyYear]);

  const pathwayOptions = selectedProgram?.pathways ?? [];

  return { selectedProgram, yearOptions, needsPathway, pathwayOptions };
}
