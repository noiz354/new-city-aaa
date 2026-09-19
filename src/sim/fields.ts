// Fields (T-207, FR-S02 context): land value v0 + desirability inputs.
//   landValue = clamp( base[terrain] + waterHalo + forestHalo + parkHalo − pollutionStamp, 0..100 )
// Pipeline (world-and-terrain §4): local sources/sinks stamps → 2-pass separable 3×3 blur →
// cached f32 arrays, daily cadence (fields stage: after growth, before economy — frozen order §2).
// Sources: water "halo air", forest trees ("trees/parks" sinks, utilities-and-environment §3),
// I buildings (occupied, level-scaled emission, docs/02 table). Value drives landFit in growth
// scoring (docs/03 §3: R/C 0.5+value/200; I 1.2−value/150) — R/C seek high value, I cheap land.
//
// v0 scope cuts (ledger):
//   - Park plop PENDING: park-tiles are an injected engine seam here (parks DO raise value in
//     the math), but placing a park creates non-derivable persisted state = save-format change
//     = spec §9 ask-first. Player placement ships with that decision (see fields.test "park seam").
//   - Trees-as-sink effect currently rides the forest halo (equivalent sign); the dedicated
//     sinkPerTreeTile blending knob is reserved for the VS-4 environment field.
//   - Field arrays live here (module-owned SoA, same size²/f32 layout world-and-terrain §1
//     freezes); World file-ownership is not required for the layout/determinism contracts.
// Derived, never persisted: recomputed from world+buildings every daily pass and after load.
import { BUILDING_OCCUPIED, type Buildings } from './buildings.js';
import {
  TERRAIN_FOREST,
  TERRAIN_GRASS,
  TERRAIN_ROCK,
  TERRAIN_SAND,
  TERRAIN_WATER,
} from '../shared/types.js';
import { FIELD_TUNING } from './tuning/fields.js';
import type { World } from './world.js';

const BASE: Record<number, number> = {
  [TERRAIN_WATER]: FIELD_TUNING.base.water,
  [TERRAIN_GRASS]: FIELD_TUNING.base.grass,
  [TERRAIN_SAND]: FIELD_TUNING.base.sand,
  [TERRAIN_ROCK]: FIELD_TUNING.base.rock,
  [TERRAIN_FOREST]: FIELD_TUNING.base.forest,
};

export class Fields {
  readonly world: World;
  private readonly buildings: Buildings;
  private readonly parks: readonly number[];
  /** public for tests + overlay binding; treat as read-only outside this class. */
  readonly landValue: Float32Array;
  private readonly scratch: Float32Array;
  /** terrain + static halos (water/forest/parks), computed once; the only DYNAMIC source is
   *  I buildings, so the daily pass = copy static + I stamps + blur (perf gate measured this
   *  split: re-stamping static halos daily cost ~1.3ms/day on hamlet — now ~0.1ms). */
  private readonly staticBase: Float32Array;

  constructor(world: World, buildings: Buildings, parkTiles: readonly number[] = []) {
    this.world = world;
    this.buildings = buildings;
    this.parks = parkTiles;
    this.landValue = new Float32Array(world.size * world.size);
    this.scratch = new Float32Array(world.size * world.size);
    this.staticBase = new Float32Array(world.size * world.size);
    this.rebuildStatic();
  }

  private rebuildStatic(): void {
    const w = this.world;
    const size = w.size;
    const S = this.staticBase;
    for (let i = 0; i < size * size; i++) {
      const t = w.terrain[i] as number;
      let v = BASE[t] ?? FIELD_TUNING.base.grass;
      if (t === TERRAIN_FOREST) v += FIELD_TUNING.forestHalo.weight; // trees on their own tile
      S[i] = v;
    }
    const T = FIELD_TUNING;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = w.terrain[w.idx(x, y)] as number;
        if (t === TERRAIN_WATER) this.stampInto(S, x, y, T.waterHalo.radius, T.waterHalo.weight, 1);
        else if (t === TERRAIN_FOREST) this.stampInto(S, x, y, T.forestHalo.radius, T.forestHalo.weight, 1);
      }
    }
    for (const p of this.parks) this.stampInto(S, p % size, Math.floor(p / size), T.parkHalo.radius, T.parkHalo.weight, 1);
  }

  valueAt(x: number, y: number): number {
    return this.landValue[this.world.idx(x, y)] as number;
  }

  /** landFit multiplier per docs/03 §3 (0.5+value/200 for R/C; 1.2−value/150 for I). */
  landFit(zone: number, x: number, y: number): number {
    const v = this.valueAt(x, y);
    const F = FIELD_TUNING.landFit;
    if (zone === 3) return Math.max(0, F.iBase - v * F.iSlope);
    return F.rcBase + v * F.rcSlope; // R, C and every other: high-value seekers
  }

  private lastPollSig = -1;
  private staticsDirty = true;

  /** After load: terrain identity may change (same arrays, restored bytes) → rebuild statics. */
  invalidateStatic(): void {
    this.rebuildStatic();
    this.staticsDirty = true;
  }

  /** cheap signature of dynamic sources (occupied I set); skips blur on quiet days (identical
   *  output by construction: stamps are a pure function of this set — determinism guard R-01). */
  private pollutionSig(): number {
    // count×65536 XOR Σ(id+1): (id can be 0; id-only sums collide with the empty set —
    // that exact bug skipped recompute for the first factory, caught by the plume tests)
    let count = 0;
    let sum = 0;
    this.buildings.forEachLive((b) => {
      if (b.zone === 3 && b.state === BUILDING_OCCUPIED) {
        count++;
        sum += b.id + 1;
      }
    });
    return count * 65536 + (sum & 65535);
  }

  /** Daily fields stage: static base + dynamic I pollution stamps → 2-pass 3×3 blur → clamp.
   *  Behaviour is identical to a full-from-scratch recompute (static parts are terrain-exact).
   *  Early-skip: with unchanged dynamic sources + intact statics the cached field IS the
   *  recompute result — this is what keeps dayP95 inside the committed budget. */
  recompute(): void {
    const sig = this.pollutionSig();
    if (!this.staticsDirty && sig === this.lastPollSig) return;
    this.lastPollSig = sig;
    this.staticsDirty = false;
    const w = this.world;
    const T = FIELD_TUNING;
    const S = this.scratch;
    const out = this.landValue;
    S.set(this.staticBase);
    this.buildings.forEachLive((b) => {
      if (b.zone !== 3 || b.state !== BUILDING_OCCUPIED) return;
      this.stampInto(S, b.x, b.y, T.pollutionRadius, T.pollutionPerLevel[b.level] ?? 0, -1);
    });
    // 2-pass separable 3×3 blur (horizontal + vertical), one daily cycle.
    this.blurAxis(S, out, true);
    this.blurAxis(out, S, false);
    out.set(S);
    // Water pins at 0; everything clamps to the canonical band.
    const size = w.size;
    for (let i = 0; i < size * size; i++) {
      const t = w.terrain[i] as number;
      out[i] = t === TERRAIN_WATER ? 0 : Math.max(T.clampMin, Math.min(T.clampMax, S[i] as number));
    }
  }

  private stampInto(arr: Float32Array, cx: number, cy: number, radius: number, weight: number, sign: 1 | -1): void {
    const w = this.world;
    for (let dy = -radius; dy <= radius; dy++) {
      const maxDx = radius - Math.abs(dy);
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        if (!w.inBounds(cx + dx, cy + dy)) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        const i = w.idx(cx + dx, cy + dy);
        arr[i] = (arr[i] as number) + sign * weight * (1 - d / radius);
      }
    }
  }

  private blurAxis(srcx: Float32Array, dstx: Float32Array, horizontal: boolean): void {
    const size = this.world.size;
    for (let a = 0; a < size; a++) {
      for (let b = 0; b < size; b++) {
        const i0 = horizontal ? this.world.idx(b, Math.max(0, a - 1)) : this.world.idx(Math.max(0, a - 1), b);
        const i1 = horizontal ? this.world.idx(b, a) : this.world.idx(a, b);
        const i2 = horizontal
          ? this.world.idx(b, Math.min(size - 1, a + 1))
          : this.world.idx(Math.min(size - 1, a + 1), b);
        dstx[i1] = ((srcx[i0] as number) + (srcx[i1] as number) + (srcx[i2] as number)) / 3;
      }
    }
  }
}
