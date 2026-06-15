/** Same URL resolution as Locations & publish tab. Optional cacheKey busts browser cache after replace. */
export function floorPlanImageUrl(path: string, cacheKey?: string | number): string {
  let url = path;
  if (!path.startsWith('http')) {
    url = path.startsWith('/') ? `${window.location.origin}${path}` : path;
  }
  if (cacheKey == null) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(cacheKey))}`;
}
