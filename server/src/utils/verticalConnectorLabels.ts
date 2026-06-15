/** Shared label logic for stairs/lift nodes paired across floors. */

export function normalizeVerticalConnectorLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, '&')
    .replace(/\b(staircase|stairs|stair|lift|elevator)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isVerticalConnectorType(type: string | undefined | null): boolean {
  return type === 'STAIRS' || type === 'LIFT';
}

/** Identity key for the same physical shaft / lift bank across floors. */
export function verticalConnectorKey(
  type: string | undefined | null,
  label: string | undefined | null
): string | null {
  if (!isVerticalConnectorType(type)) return null;
  return `${type}:${normalizeVerticalConnectorLabel(label || '')}`;
}

export function connectorDisplayName(
  type: string | undefined | null,
  label: string | undefined | null
): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  return type === 'LIFT' ? 'the lift' : 'the stairs';
}
