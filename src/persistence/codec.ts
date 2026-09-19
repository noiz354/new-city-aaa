// Save codec: versioned sections + per-section CRC32, gzip container.
// Layout (inner, pre-gzip): 'CB1S' u16le version u16le section-count, then sections:
//   u8 id u16le sver u32le len <payload> u32le crc32(payload)
// Sections: 1 = header JSON, 2 = layers binary, 3 = meta JSON, 4 = entities binary (T-202).
// Unknown ids are skipped: older decoders load newer saves minus their new sections, and
// saves predating section 4 restore with empty buildings (repair note) — no version bump
// needed while every section stays independently skippable.
import { gunzipSync, gzipSync } from 'fflate';
import type { SaveEntities, SaveLayers, SaveMeta, SaveSource } from '../shared/types.js';
import { crc32Bytes } from '../shared/crc32.js';

export const SAVE_MAGIC = 'CB1S';
export const SAVE_VERSION = 1;
export const SECTION_HEADER = 1;
export const SECTION_LAYERS = 2;
export const SECTION_META = 3;
export const SECTION_ENTITIES = 4;

export type SaveErrorCode = 'NOT_A_SAVE' | 'UNSUPPORTED_VERSION' | 'CORRUPT' | 'IO';

export class SaveError extends Error {
  readonly code: SaveErrorCode;
  constructor(code: SaveErrorCode, message: string) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

export interface SaveHeader {
  game: string;
  saveVersion: number;
  createdAt: string;
  worldSize: number;
  worldSeed: number;
  tick: number;
  balance: number;
}

export interface DecodedSave {
  header: SaveHeader;
  layers: SaveLayers;
  meta: SaveMeta;
  /** Building store; null on saves predating section 4 (restore as empty). */
  entities: SaveEntities | null;
  repairs: string[];
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function writeSection(id: number, sver: number, payload: Uint8Array): Uint8Array {
  const head = new Uint8Array(1 + 2 + 4);
  const dv = new DataView(head.buffer);
  head[0] = id;
  dv.setUint16(1, sver, true);
  dv.setUint32(3, payload.length, true);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32Bytes(payload), true);
  return concat([head, payload, crc]);
}

/**
 * Entity payload (section 4, sver 1): u32 slotCount; per slot u8 state, and for live slots
 * (state!=0) additionally u16 x, u16 y, u8 zone, u8 level, u16 occupants, u32 stateSinceTick.
 */
function encodeEntities(entities: SaveEntities): Uint8Array {
  const slots = entities.slots;
  let live = 0;
  for (const s of slots) if (s.state !== 0) live++;
  const payload = new Uint8Array(4 + slots.length + live * 12);
  const dv = new DataView(payload.buffer);
  dv.setUint32(0, slots.length, true);
  let o = 4;
  for (const s of slots) {
    payload[o] = s.state;
    o += 1;
    if (s.state === 0) continue;
    dv.setUint16(o, s.x, true);
    dv.setUint16(o + 2, s.y, true);
    payload[o + 4] = s.zone;
    payload[o + 5] = s.level;
    dv.setUint16(o + 6, s.occupants, true);
    dv.setUint32(o + 8, s.stateSinceTick, true);
    o += 12;
  }
  return payload;
}

function parseEntities(payload: Uint8Array): SaveEntities {
  if (payload.length < 4) throw new SaveError('CORRUPT', 'entities payload too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const slotCount = dv.getUint32(0, true);
  if (slotCount > (1 << 20)) throw new SaveError('CORRUPT', `implausible building count ${slotCount}`);
  const slots: SaveEntities['slots'] = [];
  let o = 4;
  for (let id = 0; id < slotCount; id++) {
    if (o >= payload.length) throw new SaveError('CORRUPT', 'entities payload truncated');
    const state = payload[o] as number;
    o += 1;
    if (state === 0) {
      slots.push({ state: 0, x: 0, y: 0, zone: 0, level: 0, occupants: 0, stateSinceTick: 0 });
      continue;
    }
    if (state > 3) throw new SaveError('CORRUPT', `entity ${id}: bad state ${state}`);
    if (o + 12 > payload.length) throw new SaveError('CORRUPT', 'entities payload truncated');
    slots.push({
      state,
      x: dv.getUint16(o, true),
      y: dv.getUint16(o + 2, true),
      zone: payload[o + 4] as number,
      level: payload[o + 5] as number,
      occupants: dv.getUint16(o + 6, true),
      stateSinceTick: dv.getUint32(o + 8, true),
    });
    o += 12;
  }
  if (o !== payload.length) throw new SaveError('CORRUPT', 'entities payload has trailing bytes');
  return { slots };
}

export function encodeSave(sim: SaveSource): Uint8Array {
  const snap = sim.snapshot();
  const header: SaveHeader = {
    game: 'city-builder-aaa',
    saveVersion: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    worldSize: snap.size,
    worldSeed: snap.seed,
    tick: snap.tick,
    balance: snap.balance,
  };
  const meta = sim.getSaveMeta();
  const layers = sim.getSaveLayers();
  const n = snap.size * snap.size;

  const lh = new Uint8Array(2 + 4 * 4);
  const ldv = new DataView(lh.buffer);
  ldv.setUint16(0, snap.size, true);
  ldv.setUint32(2, n, true);
  ldv.setUint32(6, n * 4, true);
  ldv.setUint32(10, n, true);
  ldv.setUint32(14, n, true);
  const layersPayload = concat([lh, layers.terrain, layers.height, layers.zone, layers.road]);

  const inner = concat([
    textEncoder.encode(SAVE_MAGIC),
    (() => {
      const h = new Uint8Array(4);
      const dv = new DataView(h.buffer);
      dv.setUint16(0, SAVE_VERSION, true);
      dv.setUint16(2, 4, true);
      return h;
    })(),
    writeSection(SECTION_HEADER, 1, textEncoder.encode(JSON.stringify(header))),
    writeSection(SECTION_LAYERS, 1, layersPayload),
    writeSection(SECTION_META, 1, textEncoder.encode(JSON.stringify(meta))),
    writeSection(SECTION_ENTITIES, 1, encodeEntities(sim.getSaveEntities())),
  ]);
  return gzipSync(inner, { level: 6 });
}

export function decodeSave(bytes: Uint8Array): DecodedSave {
  let inner: Uint8Array;
  try {
    inner = gunzipSync(bytes);
  } catch {
    throw new SaveError('NOT_A_SAVE', 'bytes are not a gzip save file');
  }
  if (inner.length < 8 || textDecoder.decode(inner.subarray(0, 4)) !== SAVE_MAGIC) {
    throw new SaveError('NOT_A_SAVE', 'missing save magic');
  }
  const dv = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
  const version = dv.getUint16(4, true);
  if (version > SAVE_VERSION) {
    throw new SaveError('UNSUPPORTED_VERSION', `save version ${version} > supported ${SAVE_VERSION}`);
  }
  if (version < 1) throw new SaveError('UNSUPPORTED_VERSION', `save version ${version} predates support`);
  const sectionCount = dv.getUint16(6, true);
  if (sectionCount > 64) throw new SaveError('CORRUPT', 'implausible section count');

  const repairs: string[] = [];
  let header: SaveHeader | null = null;
  let layers: SaveLayers | null = null;
  let meta: SaveMeta | null = null;
  let entities: SaveEntities | null = null;
  let off = 8;
  for (let s = 0; s < sectionCount; s++) {
    if (off + 7 > inner.length) throw new SaveError('CORRUPT', `section ${s}: truncated header`);
    const id = inner[off] as number;
    const len = dv.getUint32(off + 3, true);
    const payloadStart = off + 7;
    const payloadEnd = payloadStart + len;
    if (payloadEnd + 4 > inner.length) throw new SaveError('CORRUPT', `section ${id}: truncated payload`);
    const payload = inner.subarray(payloadStart, payloadEnd);
    const want = dv.getUint32(payloadEnd, true);
    const got = crc32Bytes(payload);
    if (want !== got) throw new SaveError('CORRUPT', `section ${id}: CRC mismatch`);
    if (id === SECTION_HEADER) {
      header = JSON.parse(textDecoder.decode(payload)) as SaveHeader;
    } else if (id === SECTION_LAYERS) {
      layers = parseLayers(payload);
    } else if (id === SECTION_META) {
      meta = JSON.parse(textDecoder.decode(payload)) as SaveMeta;
    } else if (id === SECTION_ENTITIES) {
      entities = parseEntities(payload);
    } else {
      repairs.push(`skipped unknown section id ${id} (forward compatibility)`);
    }
    off = payloadEnd + 4;
  }
  if (!header) throw new SaveError('CORRUPT', 'missing header section');
  if (!layers) throw new SaveError('CORRUPT', 'missing layers section');
  if (!meta) throw new SaveError('CORRUPT', 'missing meta section');
  if (entities === null) repairs.push('no entity section (pre-T-202 save): buildings restore empty');
  return { header, layers, meta, entities, repairs };
}

function parseLayers(payload: Uint8Array): SaveLayers {
  if (payload.length < 18) throw new SaveError('CORRUPT', 'layers payload too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const size = dv.getUint16(0, true);
  if (size <= 0 || size % 16 !== 0 || size > 1024) throw new SaveError('CORRUPT', `implausible world size ${size}`);
  const n = size * size;
  const lens = [dv.getUint32(2, true), dv.getUint32(6, true), dv.getUint32(10, true), dv.getUint32(14, true)];
  if (lens[0] !== n || lens[1] !== n * 4 || lens[2] !== n || lens[3] !== n) {
    throw new SaveError('CORRUPT', 'layers length table mismatch');
  }
  let off = 18;
  const take = (len: number): Uint8Array => {
    if (off + len > payload.length) throw new SaveError('CORRUPT', 'layers payload truncated');
    const slice = payload.slice(off, off + len);
    off += len;
    return slice;
  };
  return { terrain: take(n), height: take(n * 4), zone: take(n), road: take(n) };
}
