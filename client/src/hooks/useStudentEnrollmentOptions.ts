import { useEffect, useMemo, useState } from 'react';
import api from '@services/api';
import type { RegisterOptionsProgram } from '../types/auth';

const YEARS_WITH_PATHWAY = ['Y3', 'Y4'];

export function resolveEnrollmentGroupId(
  groupId: string,
  groupOptions: { id: string }[],
): string {
  if (groupId && groupOptions.some((group) => group.id === groupId)) return groupId;
  const uniqueIds = [...new Set(groupOptions.map((group) => group.id))];
  if (uniqueIds.length === 1) return uniqueIds[0];
  return groupOptions.length === 1 ? groupOptions[0].id : '';
}

export function isY1BatchEnrollmentReady(
  studyYear: string,
  programCode: string,
  batchYearLabel: string,
  batchYearOptionsCount: number,
): boolean {
  return studyYear === 'Y1' && Boolean(programCode && batchYearLabel && batchYearOptionsCount > 0);
}

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
  pathwayCode: string,
  batchYearLabel = '',
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

  const groupOptions = useMemo(() => {
    const groups = selectedProgram?.groups ?? [];
    const hasY1BatchYearChoices =
      studyYear === 'Y1' &&
      groups.some((group) => group.studyYear === 'Y1' && !group.pathwayCode && group.batchYearLabel);
    const filtered = groups.filter((group) => {
      if (group.studyYear !== studyYear) return false;
      if (needsPathway) return group.pathwayCode === pathwayCode;
      if (group.pathwayCode) return false;
      if (hasY1BatchYearChoices) {
        if (!batchYearLabel) return false;
        return group.batchYearLabel === batchYearLabel;
      }
      return true;
    });
    if (studyYear === 'Y1' && batchYearLabel && filtered.length > 1) {
      const uniqueIds = [...new Set(filtered.map((group) => group.id))];
      if (uniqueIds.length === 1) return [filtered[0]];
    }
    return filtered;
  }, [batchYearLabel, needsPathway, pathwayCode, selectedProgram, studyYear]);

  const batchYearOptions = useMemo(() => {
    if (studyYear !== 'Y1') return [];
    const labels = new Set<string>();
    for (const group of selectedProgram?.groups ?? []) {
      if (group.studyYear === 'Y1' && !group.pathwayCode && group.batchYearLabel) {
        labels.add(group.batchYearLabel);
      }
    }
    return [...labels].sort((a, b) => b.localeCompare(a));
  }, [selectedProgram, studyYear]);

  return { selectedProgram, yearOptions, needsPathway, pathwayOptions, batchYearOptions, groupOptions };
}
