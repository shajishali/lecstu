/** Resolve named export when dynamic import() nests exports under `default` (tsx/esm). */
export function getModuleExport<T>(mod: Record<string, unknown>, name: string): T {
  const named = mod[name];
  if (named !== undefined) return named as T;
  const nested = mod.default as Record<string, unknown> | undefined;
  if (nested && nested[name] !== undefined) return nested[name] as T;
  throw new Error(`Export "${name}" not found in module`);
}
