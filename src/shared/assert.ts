export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`assert: ${message}`);
}

/** Unwrap after an explicit bounds check (satisfies noUncheckedIndexedAccess). */
export function unwrap<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(`unwrap: ${message}`);
  return value;
}
