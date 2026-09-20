// World: tile grid layers + deterministic terrain generation + mutation API.
// Units: 1 tile = 8 m. Heights stored 0..1, rendered as (h - waterLevel) * HEIGHT_M.
import {
  CHUNK,
  DIRTY_ALL,
  DIRTY_ROADS,
  DIRTY_ZONES,
  TERRAIN_FOREST,
  TERRAIN_GRASS,
  TERRAIN_ROCK,
  TERRAIN_SAND,
  TERRAIN_WATER,
  TILE_M,
  type SaveLayers,
  type ZoneId,
} from '../shared/types.js';
import { assert } from '../shared/assert.js';

export const HEIGHT_M = 24;
export const WATER_LEVEL = 0.32;
/** Max |dh| per tile for construction. Measured (128^2, seeds 1-3): default max 0.025, hills max 0.047. */
export const SLOPE_BUILD_MAX = 0.035;
export const ROCK_SLOPE = 0.04;


export type TerrainPreset = 'plains' | 'default' | 'river' | 'bay' | 'hills';

export interface WorldOptions {
  size?: number;
  seed?: number;
  preset?: TerrainPreset;
}

export interface WorldCounts {
  roads: number;
  zonesR: number;
  zonesC: number;
  zonesI: number;
  /** T-405: dedicated power-line tiles (cross-country conductors; roads conduct for free). */
  lines: number;
}

/** Deterministic 2D lattice hash -> [0, 1). */
function hash2(seed: number, ix: number, iy: number): number {
  let h = Math.imul(ix, 0x8da6b343) ^ Math.imul(iy, 0xd8163841) ^ Math.imul(seed, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise over the lattice hash. */
function valueNoise(seed: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(seed, ix, iy);
  const b = hash2(seed, ix + 1, iy);
  const c = hash2(seed, ix, iy + 1);
  const d = hash2(seed, ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export class World {
  readonly size: number;
  /** World seed. Mutable: saves restore it on load (identity comes from the save). */
  seed: number;
  readonly preset: TerrainPreset;
  readonly waterLevel = WATER_LEVEL;

  terrain: Uint8Array;
  height: Float32Array;
  zone: Uint8Array;
  road: Uint8Array;
  roadMask: Uint8Array;
  /** T-405: player-laid power lines (persisted layer; conduct power, no other effect). */
  powerLine: Uint8Array;
  building: Int32Array; // tile → buildingId (-1=none); written EXCLUSIVELY by sim/buildings.ts (T-201)
  chunkDirty: Uint8Array;
  counts: WorldCounts = { roads: 0, zonesR: 0, zonesC: 0, zonesI: 0, lines: 0 };

  constructor(opts: WorldOptions = {}) {
    this.size = opts.size ?? 256;
    this.seed = (opts.seed ?? 1) >>> 0;
    this.preset = opts.preset ?? 'plains';
    assert(this.size % CHUNK === 0, `size must be a multiple of ${CHUNK}`);
    const n = this.size * this.size;
    this.terrain = new Uint8Array(n);
    this.height = new Float32Array(n);
    this.zone = new Uint8Array(n);
    this.road = new Uint8Array(n);
    this.roadMask = new Uint8Array(n);
    this.powerLine = new Uint8Array(n);
    this.building = new Int32Array(n).fill(-1);
    const nc = this.size / CHUNK;
    this.chunkDirty = new Uint8Array(nc * nc).fill(DIRTY_ALL);
    this.generate();
  }

  get mapMeters(): number {
    return this.size * TILE_M;
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  chunkIndexFor(x: number, y: number): number {
    return Math.floor(y / CHUNK) * (this.size / CHUNK) + Math.floor(x / CHUNK);
  }

  markDirty(x: number, y: number, flags: number): void {
    const i = this.chunkIndexFor(x, y);
    const cur = this.chunkDirty[i] as number;
    this.chunkDirty[i] = cur | flags;
  }

  // ---- coordinate mapping (map centered on origin) ----
  tileCenterWorld(x: number, y: number): { x: number; z: number } {
    const half = this.mapMeters / 2;
    return { x: (x + 0.5) * TILE_M - half, z: (y + 0.5) * TILE_M - half };
  }

  /** Bilinear ground height in meters at world (x, z). */
  groundHeightAt(wx: number, wz: number): number {
    const half = this.mapMeters / 2;
    const fx = (wx + half) / TILE_M - 0.5;
    const fz = (wz + half) / TILE_M - 0.5;
    const x0 = Math.max(0, Math.min(this.size - 2, Math.floor(fx)));
    const z0 = Math.max(0, Math.min(this.size - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - x0));
    const tz = Math.max(0, Math.min(1, fz - z0));
    const h = (x: number, y: number): number => this.height[this.idx(x, y)] as number;
    const top = h(x0, z0) + (h(x0 + 1, z0) - h(x0, z0)) * tx;
    const bot = h(x0, z0 + 1) + (h(x0 + 1, z0 + 1) - h(x0, z0 + 1)) * tx;
    return (top + (bot - top) * tz - this.waterLevel) * HEIGHT_M;
  }

  // ---- generation ----
  private generate(): void {
    const { size, seed, preset } = this;
    if (preset === 'plains') {
      this.height.fill(0.5);
      this.terrain.fill(TERRAIN_GRASS);
      return;
    }
    const amp = preset === 'hills' ? 0.42 : 0.22;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let h =
          0.5 +
          (valueNoise(seed, x * 0.021 + 7.3, y * 0.021 + 3.1) - 0.5) * 2 * amp +
          (valueNoise(seed ^ 0x5bd1e995, x * 0.083 + 1.7, y * 0.083 + 9.2) - 0.5) * 2 * amp * 0.3;
        if (preset === 'river') {
          const cx = size / 2 + Math.sin(y * 0.045) * size * 0.08;
          const t = Math.abs(x - cx) / 5;
          if (t < 1) h = Math.min(h, WATER_LEVEL - 0.1 * (1 - t) - 0.01);
        } else if (preset === 'bay') {
          const r = Math.sqrt(x * x + y * y) / (size * 0.35);
          if (r < 1) h = Math.min(h, WATER_LEVEL - 0.14 * (1 - r) - 0.01);
        }
        this.height[this.idx(x, y)] = Math.max(0, Math.min(1, h));
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = this.idx(x, y);
        const h = this.height[i] as number;
        let t: number;
        if (h < WATER_LEVEL) t = TERRAIN_WATER;
        else if (h < WATER_LEVEL + 0.035) t = TERRAIN_SAND;
        else if (this.slopeAt(x, y) > ROCK_SLOPE) t = TERRAIN_ROCK;
        else if (valueNoise(seed ^ 0x27d4eb2d, x * 0.05 + 11, y * 0.05 + 5) > 0.68) t = TERRAIN_FOREST;
        else t = TERRAIN_GRASS;
        this.terrain[i] = t;
      }
    }
  }

  /** Max |height delta| to 4-neighbors (0 at map edge). */
  slopeAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    const h = this.height[this.idx(x, y)] as number;
    let s = 0;
    if (x > 0) s = Math.max(s, Math.abs(h - (this.height[this.idx(x - 1, y)] as number)));
    if (x < this.size - 1) s = Math.max(s, Math.abs(h - (this.height[this.idx(x + 1, y)] as number)));
    if (y > 0) s = Math.max(s, Math.abs(h - (this.height[this.idx(x, y - 1)] as number)));
    if (y < this.size - 1) s = Math.max(s, Math.abs(h - (this.height[this.idx(x, y + 1)] as number)));
    return s;
  }

  buildBlockReason(x: number, y: number): string | null {
    if (!this.inBounds(x, y)) return 'Out of bounds';
    const i = this.idx(x, y);
    if ((this.terrain[i] as number) === TERRAIN_WATER) return 'Water blocks construction';
    if (this.slopeAt(x, y) > SLOPE_BUILD_MAX) return 'Too steep';
    return null;
  }

  // ---- mutations (called by commands only) ----
  setRoad(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if ((this.road[i] as number) === 1) return true;
    const z = this.zone[i] as number;
    if (z !== 0) {
      this.zone[i] = 0;
      this.bumpZoneCount(z as ZoneId, -1);
      this.markDirty(x, y, DIRTY_ZONES);
    }
    this.road[i] = 1;
    this.counts.roads++;
    this.refreshMasksAround(x, y);
    this.markDirty(x, y, DIRTY_ROADS);
    return true;
  }

  clearRoad(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if ((this.road[i] as number) === 0) return false;
    this.road[i] = 0;
    this.counts.roads--;
    this.refreshMasksAround(x, y);
    this.markDirty(x, y, DIRTY_ROADS);
    return true;
  }

  setZone(x: number, y: number, z: 1 | 2 | 3): boolean {    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if ((this.road[i] as number) === 1) return false;
    const prev = this.zone[i] as number;
    if (prev === z) return true;
    if (prev !== 0) this.bumpZoneCount(prev as ZoneId, -1);
    this.zone[i] = z;
    this.bumpZoneCount(z, 1);
    this.markDirty(x, y, DIRTY_ZONES);
    return true;
  }

  /** T-405: remove zone paint without billing (plant placement clears its lot like roads do). */
  clearZone(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    const prev = this.zone[i] as number;
    if (prev === 0) return false;
    this.bumpZoneCount(prev as ZoneId, -1);
    this.zone[i] = 0;
    this.markDirty(x, y, DIRTY_ZONES);
    return true;
  }

  /** Bulldoze one tile. Returns billed cost class: 'road' | 'zone' | 'none'. */
  clearTile(x: number, y: number): 'road' | 'zone' | 'none' {
    if (!this.inBounds(x, y)) return 'none';
    const i = this.idx(x, y);
    if ((this.road[i] as number) === 1) {
      this.clearRoad(x, y);
      return 'road';
    }
    if ((this.zone[i] as number) !== 0) {
      this.bumpZoneCount((this.zone[i] as number) as ZoneId, -1);
      this.zone[i] = 0;
      this.markDirty(x, y, DIRTY_ZONES);
      return 'zone';
    }
    // T-405: power lines clear free (unbilled) alongside whatever else was here.
    if ((this.powerLine[i] as number) === 1) this.clearPowerLine(x, y);
    return 'none';
  }

  /** T-405: lay a power-line conductor (independent layer — coexists with road/zone). */
  setPowerLine(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if ((this.powerLine[i] as number) === 1) return true;
    this.powerLine[i] = 1;
    this.counts.lines++;
    this.markDirty(x, y, DIRTY_ZONES); // no dedicated flag: lines ride the zone refresh
    return true;
  }

  clearPowerLine(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if ((this.powerLine[i] as number) === 0) return false;
    this.powerLine[i] = 0;
    this.counts.lines--;
    this.markDirty(x, y, DIRTY_ZONES);
    return true;
  }

  private bumpZoneCount(z: ZoneId, delta: number): void {
    if (z === 1) this.counts.zonesR += delta;
    else if (z === 2) this.counts.zonesC += delta;
    else if (z === 3) this.counts.zonesI += delta;
  }

  private recomputeMask(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    if ((this.road[i] as number) !== 1) {
      this.roadMask[i] = 0; // invariant: mask != 0 implies a road on the tile
      return;
    }
    let m = 0;
    if (x < this.size - 1 && (this.road[this.idx(x + 1, y)] as number) === 1) m |= 1; // E
    if (x > 0 && (this.road[this.idx(x - 1, y)] as number) === 1) m |= 2; // W
    if (y < this.size - 1 && (this.road[this.idx(x, y + 1)] as number) === 1) m |= 4; // S
    if (y > 0 && (this.road[this.idx(x, y - 1)] as number) === 1) m |= 8; // N
    this.roadMask[this.idx(x, y)] = m;
  }

  private refreshMasksAround(x: number, y: number): void {
    this.recomputeMask(x, y);
    this.recomputeMask(x + 1, y);
    this.recomputeMask(x - 1, y);
    this.recomputeMask(x, y + 1);
    this.recomputeMask(x, y - 1);
  }

  // ---- serialization ----
  toLayers(): SaveLayers {
    return {
      terrain: this.terrain.slice(),
      height: new Uint8Array(this.height.buffer.slice(0)),
      zone: this.zone.slice(),
      road: this.road.slice(),
      powerLine: this.powerLine.slice(),
    };
  }

  loadLayers(layers: SaveLayers, seed?: number): void {
    if (seed !== undefined) this.seed = seed >>> 0;
    const n = this.size * this.size;
    assert(layers.terrain.length === n, 'terrain layer size mismatch');
    assert(layers.height.length === n * 4, 'height layer size mismatch');
    assert(layers.zone.length === n, 'zone layer size mismatch');
    assert(layers.road.length === n, 'road layer size mismatch');
    assert(layers.powerLine.length === n, 'power-line layer size mismatch');
    this.terrain.set(layers.terrain);
    this.height.set(new Float32Array(layers.height.buffer.slice(0)));
    this.zone.set(layers.zone);
    this.road.set(layers.road);
    this.powerLine.set(layers.powerLine);
    // rebuild derived state (masks + counts) rather than trusting them
    this.counts = { roads: 0, zonesR: 0, zonesC: 0, zonesI: 0, lines: 0 };
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.idx(x, y);
        if ((this.road[i] as number) === 1) this.counts.roads++;
        if ((this.powerLine[i] as number) === 1) this.counts.lines++;
        const z = this.zone[i] as number;
        if (z >= 1 && z <= 3) this.bumpZoneCount(z as ZoneId, 1);
        else this.zone[i] = 0;
      }
    }
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.recomputeMask(x, y);
    this.building.fill(-1);
    this.chunkDirty.fill(DIRTY_ALL);
  }

  /** Canonical byte views for hashing (order fixed; excludes derived masks). */
  hashParts(): Uint8Array[] {
    return [this.terrain, new Uint8Array(this.height.buffer), this.zone, this.road, this.powerLine];
  }
}
