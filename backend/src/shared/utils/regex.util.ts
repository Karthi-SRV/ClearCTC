export const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(s: string): string {
  if (!s) return '';
  return s.replace(ESCAPE_REGEX, '\\$&');
}
