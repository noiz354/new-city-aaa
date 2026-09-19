// CRC-32 (IEEE) + FNV-1a helpers. Used for save integrity and sim state hashing.
const TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE[n] = c >>> 0;
}

export function crc32Bytes(data: Uint8Array, prev = 0): number {
  let c = (prev ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) c = (TABLE[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function fnv1aBytes(data: Uint8Array, prev = 0x811c9dc5): number {
  let h = prev >>> 0;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i] as number;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const encoder = new TextEncoder();
export function fnv1aString(s: string, prev?: number): number {
  return fnv1aBytes(encoder.encode(s), prev);
}
