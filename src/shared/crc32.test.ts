import { describe, expect, it } from 'vitest';
import { crc32Bytes, fnv1aBytes, fnv1aString } from './crc32.js';

describe('crc32', () => {
  it('matches the IEEE test vector ("123456789" -> 0xCBF43926)', () => {
    const v = crc32Bytes(new TextEncoder().encode('123456789'));
    expect(v).toBe(0xcbf43926);
  });

  it('chains via prev', () => {
    const a = new TextEncoder().encode('hello ');
    const b = new TextEncoder().encode('world');
    const whole = new TextEncoder().encode('hello world');
    expect(crc32Bytes(b, crc32Bytes(a))).toBe(crc32Bytes(whole));
  });
});

describe('fnv1a', () => {
  it('is stable and distinguishes inputs', () => {
    expect(fnv1aString('citybound')).toBe(fnv1aString('citybound'));
    expect(fnv1aString('a')).not.toBe(fnv1aString('b'));
    expect(fnv1aBytes(new Uint8Array([1, 2, 3]))).toBe(fnv1aBytes(new Uint8Array([1, 2, 3])));
  });
});
