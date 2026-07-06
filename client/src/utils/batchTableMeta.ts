/** Client-side mirror of server batch table labels (FCT group codes). */

export function formatBatchTableTitle(canonicalGroupName: string): string {
  const trimmed = canonicalGroupName.trim();
  const legacy = trimmed.match(/^Y([1-4])[-\s]+(CS|ET|CT|BS|BST)(?:[-\s]+(?:\d{2}|20\d{2}))?$/i);
  const canonical = legacy
    ? `${legacy[2].toUpperCase() === 'BST' ? 'BS' : legacy[2].toUpperCase()}-Y${legacy[1]}`
    : trimmed;

  const m = canonical.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
  if (!m) return trimmed;

  const prog = m[1].toUpperCase();
  const year = `Y${m[2]}`;
  const pathway = m[3]?.toUpperCase();

  if (prog === 'BS') return `${year} BST Group`;
  if (pathway && (year === 'Y3' || year === 'Y4')) return `${year} ${pathway}`;
  return `${year} ${prog}`;
}

export function suggestBatchTableTitle(groupName: string, currentTitle = ''): string {
  const trimmed = groupName.trim();
  if (!trimmed) return currentTitle;
  const suggested = formatBatchTableTitle(trimmed);
  if (!currentTitle || currentTitle === suggestBatchTableTitle(currentTitle)) {
    return suggested;
  }
  return currentTitle;
}
