// Save codec: versioned sections + per-section CRC32, gzip container.
// Layout (inner, pre-gzip): 'CB1S' u16le version u16le section-count, then sections:
//   u8 id u16le sver u32le len <payload> u32le crc32(payload)
// Sections: 1 = header JSON, 2 = layers binary, 3 = meta JSON, 4 = entities binary (T-202).
// Unknown ids are skipped: older decoders load newer saves minus their new sections, and
// saves predating section 4 restore with empty buildings (repair note) — no version bump
// needed while every section stays independently skippable.
import { gunzipSync, gzipSync } from 'fflate';
import type { SaveEntities, SaveLayers, SaveMeta, SavePolicy, SavePower, SaveSource, SaveWater } from '../shared/types.js';
import { crc32Bytes } from '../shared/crc32.js';

export const SAVE_MAGIC = 'CB1S';
// Bumped 1 -> 2 for T-302 (spec §9 ask-first): v2 adds the policy section (per-zone tax rates).
// Legacy v1 saves carry no policy section and are migrated to the default 9/9/9 on load (repair note).
// Bumped 2 -> 3 for T-405 (spec §9 ask-first): v3 adds the power-line layer (layers sver 1 -> 2)
// plus the power section (plant sites).
// Bumped 3 -> 4 for T-406 (spec §9 ask-first): v4 adds the water section (tower sites).
// Legacy pre-v4 saves carry no water section and resolve to an empty tower set (repair note). Pre-v3 saves load with an empty grid → inactive →
// self-powered, so old cities keep growing (legacy-guard, repair note).
export const SAVE_VERSION = 4;
export const SECTION_HEADER = 1;
export const SECTION_LAYERS = 2;
export const SECTION_META = 3;
export const SECTION_ENTITIES = 4;
export const SECTION_POLICY = 5;
export const SECTION_POWER = 6;
export const SECTION_WATER = 7;

/** Valid tax-rate range (docs/02 §4, T-302). Clamped on both encode and decode for safety. */
export const POLICY_TAX_MIN = 0;
export const POLICY_TAX_MAX = 20;
export const POLICY_TAX_DEFAULT = 9;

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
  /** Resolved policy; always non-null (defaults applied for pre-v2 / malformed saves). */
  policy: SavePolicy;
  /** Resolved power; always non-null (empty grid for pre-v3 / malformed saves). */
  power: SavePower;
  /** Resolved water; always non-null (empty tower set for pre-v4 / malformed saves). */
  water: SaveWater;
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

/** Clamp a stored tax rate to the docs/02 §4 / T-302 range. */
function clampTax(v: number): number {
  return Math.max(POLICY_TAX_MIN, Math.min(POLICY_TAX_MAX, Math.round(v)));
}

/** Policy payload (section 5, sver 1): three u8 tax rates r/c/i (clamped 0..20). */
function encodePolicy(policy: SavePolicy): Uint8Array {
  const payload = new Uint8Array(3);
  payload[0] = clampTax(policy.tax.r);
  payload[1] = clampTax(policy.tax.c);
  payload[2] = clampTax(policy.tax.i);
  return payload;
}

function parsePolicy(payload: Uint8Array): SavePolicy {
  if (payload.length < 3) throw new SaveError('CORRUPT', 'policy payload too short');
  return {
    tax: {
      r: clampTax(payload[0] as number),
      c: clampTax(payload[1] as number),
      i: clampTax(payload[2] as number),
    },
  };
}

function defaultPolicy(): SavePolicy {
  return { tax: { r: POLICY_TAX_DEFAULT, c: POLICY_TAX_DEFAULT, i: POLICY_TAX_DEFAULT } };
}

/**
 * Migration step: policy (tax rates) was introduced at save-version 2. Pre-v2 saves have no
 * section 5; malformed v2 saves may be missing it too. Either way we default to 9/9/9 and log a
 * repair note (per the validate→migrate→repair→verify pipeline in docs/02 §4). Extend this when
 * new policy fields land — each becomes an additive default so old saves keep loading.
 */
function resolvePolicy(version: number, parsed: SavePolicy | null, repairs: string[]): SavePolicy {
  if (parsed) return parsed;
  repairs.push(
    version < 2
      ? 'pre-v2 save (no policy section): tax rates defaulted to 9/9/9'
      : 'missing policy section: tax rates defaulted to 9/9/9',
  );
  return defaultPolicy();
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

  // Layers sver 2 (v3 save-format): five u32 lengths + power-line bytes. Pre-v3 decoders
  // reject the version bump before reaching here, so no backward-parse concern.
  const lh = new Uint8Array(2 + 5 * 4);
  const ldv = new DataView(lh.buffer);
  ldv.setUint16(0, snap.size, true);
  ldv.setUint32(2, n, true);
  ldv.setUint32(6, n * 4, true);
  ldv.setUint32(10, n, true);
  ldv.setUint32(14, n, true);
  ldv.setUint32(18, n, true);
  const layersPayload = concat([lh, layers.terrain, layers.height, layers.zone, layers.road, layers.powerLine]);

  const inner = concat([
    textEncoder.encode(SAVE_MAGIC),
    (() => {
      const h = new Uint8Array(4);
      const dv = new DataView(h.buffer);
      dv.setUint16(0, SAVE_VERSION, true);
      dv.setUint16(2, 7, true);
      return h;
    })(),
    writeSection(SECTION_HEADER, 1, textEncoder.encode(JSON.stringify(header))),
    writeSection(SECTION_LAYERS, 2, layersPayload),
    writeSection(SECTION_META, 1, textEncoder.encode(JSON.stringify(meta))),
    writeSection(SECTION_ENTITIES, 1, encodeEntities(sim.getSaveEntities())),
    writeSection(SECTION_POLICY, 1, encodePolicy(sim.getSavePolicy())),
    writeSection(SECTION_POWER, 1, encodePower(sim.getSavePower())),
    writeSection(SECTION_WATER, 1, encodeWater(sim.getSaveWater())),
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
  let policy: SavePolicy | null = null;
  let power: SavePower | null = null;
  let water: SaveWater | null = null;
  let off = 8;
  for (let s = 0; s < sectionCount; s++) {
    if (off + 7 > inner.length) throw new SaveError('CORRUPT', `section ${s}: truncated header`);
    const id = inner[off] as number;
    const sver = dv.getUint16(off + 1, true);
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
      layers = parseLayers(payload, sver);
    } else if (id === SECTION_META) {
      meta = JSON.parse(textDecoder.decode(payload)) as SaveMeta;
    } else if (id === SECTION_ENTITIES) {
      entities = parseEntities(payload);
    } else if (id === SECTION_POLICY) {
      policy = parsePolicy(payload);
    } else if (id === SECTION_POWER) {
      power = parsePower(payload);
    } else if (id === SECTION_WATER) {
      water = parseWater(payload);
    } else {
      repairs.push(`skipped unknown section id ${id} (forward compatibility)`);
    }
    off = payloadEnd + 4;
  }
  if (!header) throw new SaveError('CORRUPT', 'missing header section');
  if (!layers) throw new SaveError('CORRUPT', 'missing layers section');
  if (!meta) throw new SaveError('CORRUPT', 'missing meta section');
  if (entities === null) repairs.push('no entity section (pre-T-202 save): buildings restore empty');
  const resolvedPolicy = resolvePolicy(version, policy, repairs);
  const resolvedPower = resolvePower(version, power, repairs);
  const resolvedWater = resolveWater(version, water, repairs);
  return { header, layers, meta, entities, policy: resolvedPolicy, power: resolvedPower, water: resolvedWater, repairs };
}

function parseLayers(payload: Uint8Array, sver: number): SaveLayers {
  if (payload.length < 18) throw new SaveError('CORRUPT', 'layers payload too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const size = dv.getUint16(0, true);
  if (size <= 0 || size % 16 !== 0 || size > 1024) throw new SaveError('CORRUPT', `implausible world size ${size}`);
  const n = size * size;
  const lens = [dv.getUint32(2, true), dv.getUint32(6, true), dv.getUint32(10, true), dv.getUint32(14, true)];
  if (lens[0] !== n || lens[1] !== n * 4 || lens[2] !== n || lens[3] !== n) {
    throw new SaveError('CORRUPT', 'layers length table mismatch');
  }
  // Svers: v3 appends a 5th length + the power-line layer (header grows 18 → 22 bytes).
  let off = 18;
  if (sver >= 2) {
    if (payload.length < 22) throw new SaveError('CORRUPT', 'layers payload too short');
    if (dv.getUint32(18, true) !== n) throw new SaveError('CORRUPT', 'layers length table mismatch');
    off = 22;
  }
  const take = (len: number): Uint8Array => {
    if (off + len > payload.length) throw new SaveError('CORRUPT', 'layers payload truncated');
    const slice = payload.slice(off, off + len);
    off += len;
    return slice;
  };
  const terrain = take(n);
  const height = take(n * 4);
  const zone = take(n);
  const road = take(n);
  // Layers sver 2 (v3 save-format) appends the power-line layer; sver 1 payloads end here and
  // restore with an empty line layer (legacy-guard: pre-v3 grids are plant-less too, so the
  // grid stays inactive and old cities run self-powered).
  let powerLine: Uint8Array;
  if (sver >= 2) {
    powerLine = take(n);
  } else {
    powerLine = new Uint8Array(n);
  }
  return { terrain, height, zone, road, powerLine };
}

/** Power payload (section 6, sver 1): u32 plantCount; per plant u16 x, u16 y. */
function encodePower(power: SavePower): Uint8Array {
  const payload = new Uint8Array(4 + power.plants.length * 4);
  const dv = new DataView(payload.buffer);
  dv.setUint32(0, power.plants.length, true);
  let o = 4;
  for (const p of power.plants) {
    dv.setUint16(o, p.x, true);
    dv.setUint16(o + 2, p.y, true);
    o += 4;
  }
  return payload;
}

function parsePower(payload: Uint8Array): SavePower {
  if (payload.length < 4) throw new SaveError('CORRUPT', 'power payload too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const count = dv.getUint32(0, true);
  if (count > (1 << 20)) throw new SaveError('CORRUPT', `implausible plant count ${count}`);
  if (payload.length < 4 + count * 4) throw new SaveError('CORRUPT', 'power payload truncated');
  const plants: SavePower['plants'] = [];
  let o = 4;
  for (let k = 0; k < count; k++) {
    plants.push({ x: dv.getUint16(o, true), y: dv.getUint16(o + 2, true) });
    o += 4;
  }
  return { plants };
}

/**
 * Migration step: plants + power lines landed at save-version 3. Pre-v3 saves have neither;
 * the grid resolves empty → inactive → self-powered (spec §9 legacy-guard: no format touch
 * may strand an old city in the dark). A v3 save missing the section is repaired the same way.
 */
function resolvePower(version: number, parsed: SavePower | null, repairs: string[]): SavePower {
  if (parsed) return parsed;
  repairs.push(
    version < 3
      ? 'pre-v3 save (no power section): grid inactive, buildings self-powered'
      : 'missing power section: grid inactive, buildings self-powered',
  );
  return { plants: [] };
}

/** Water payload (section 7, sver 1): u32 towerCount; per tower u16 x, u16 y. */
function encodeWater(water: SaveWater): Uint8Array {
  const payload = new Uint8Array(4 + water.towers.length * 4);
  const dv = new DataView(payload.buffer);
  dv.setUint32(0, water.towers.length, true);
  let o = 4;
  for (const t of water.towers) {
    dv.setUint16(o, t.x, true);
    dv.setUint16(o + 2, t.y, true);
    o += 4;
  }
  return payload;
}

function parseWater(payload: Uint8Array): SaveWater {
  if (payload.length < 4) throw new SaveError('CORRUPT', 'water payload too short');
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const count = dv.getUint32(0, true);
  if (count > (1 << 20)) throw new SaveError('CORRUPT', `implausible tower count ${count}`);
  if (payload.length < 4 + count * 4) throw new SaveError('CORRUPT', 'water payload truncated');
  const towers: SaveWater['towers'] = [];
  let o = 4;
  for (let k = 0; k < count; k++) {
    towers.push({ x: dv.getUint16(o, true), y: dv.getUint16(o + 2, true) });
    o += 4;
  }
  return { towers };
}

/**
 * Migration step: towers landed at save-version 4. Pre-v4 saves have none; the grid resolves
 * empty and stays inactive while no tower exists (spec §9 legacy-guard: no tower anywhere
 * means water was never a constraint, so old cities keep growing). A v4 save missing the
 * section is repaired the same way.
 */
function resolveWater(version: number, parsed: SaveWater | null, repairs: string[]): SaveWater {
  if (parsed) return parsed;
  repairs.push(
    version < 4
      ? 'pre-v4 save (no water section): no towers, water constraint inactive'
      : 'missing water section: no towers, water constraint inactive',
  );
  return { towers: [] };
}
