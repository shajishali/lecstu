/**
 * Decodes HTML entities in text (e.g. &#39; → ', &quot; → ").
 * Used when translation APIs return escaped entities that would otherwise
 * display as literal "&#39;" instead of the intended character.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text?.trim()) return text;
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent || div.innerText || text;
}
