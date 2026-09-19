import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuildingSlotData } from '../shared/types.js';
import { BuildingLayer } from './buildings.js';

// Flat-plains geometry double (structural; no sim import in view tests).
const geo = {
  tileCenterWorld: (x: number, y: number): { x: number; z: number } => ({ x: x * 8 + 4, z: y * 8 + 4 }),
  groundHeightAt: (): number => 4.32,
};

function posOf(mesh: THREE.InstancedMesh, index: number): { x: number; y: number; z: number } {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(index, m);
  return { x: m.elements[12] as number, y: m.elements[13] as number, z: m.elements[14] as number };
}

describe('BuildingLayer: instanced lifecycle projection (T-203)', () => {
  it('construction spawns into the scaffold mesh on the right tile', () => {
    const layer = new BuildingLayer(geo);
    layer.apply({ id: 0, x: 3, y: 4, state: 1 });
    expect(layer.counts()).toEqual({ construction: 1, house: 0, total: 1 });
    const p = posOf(layer.constructionMesh, 0);
    expect(p.x).toBeCloseTo(28, 5);
    expect(p.y).toBeCloseTo(4.32, 4); // float32 matrix storage
    expect(p.z).toBeCloseTo(36, 5);
    expect(layer.debugPlacement(0)).toEqual({ kind: 'construction', index: 0 });
  });

  it('occupied swaps the instance into the house mesh with the default color', () => {
    const layer = new BuildingLayer(geo);
    layer.apply({ id: 0, x: 3, y: 4, state: 1 });
    layer.apply({ id: 0, x: 3, y: 4, state: 2 });
    expect(layer.counts()).toEqual({ construction: 0, house: 1, total: 1 });
    expect(layer.debugPlacement(0)).toEqual({ kind: 'house', index: 0 });
    const c = new THREE.Color();
    layer.houseMesh.getColorAt(0, c);
    expect(c.r).toBeGreaterThan(0.9); // occupied = default (bright) tint
  });

  it('abandoned darkens the same house; reoccupied restores the tint', () => {
    const layer = new BuildingLayer(geo);
    layer.apply({ id: 0, x: 3, y: 4, state: 2 });
    layer.apply({ id: 0, x: 3, y: 4, state: 3 });
    expect(layer.counts()).toEqual({ construction: 0, house: 1, total: 1 }); // stays a house instance
    const c = new THREE.Color();
    layer.houseMesh.getColorAt(0, c);
    expect(c.r).toBeLessThan(0.4); // visibly derelict
    layer.apply({ id: 0, x: 3, y: 4, state: 2 });
    layer.houseMesh.getColorAt(0, c);
    expect(c.r).toBeGreaterThan(0.9);
  });

  it('demolish (state 0) removes the instance and keeps both meshes dense', () => {
    const layer = new BuildingLayer(geo);
    layer.apply({ id: 0, x: 0, y: 0, state: 2 });
    layer.apply({ id: 1, x: 1, y: 0, state: 2 });
    layer.apply({ id: 2, x: 2, y: 0, state: 2 });
    layer.apply({ id: 1, x: 1, y: 0, state: 0 }); // demolish the middle one
    expect(layer.counts()).toEqual({ construction: 0, house: 2, total: 2 });
    expect(layer.debugPlacement(1)).toBeUndefined();
    // denseness: remaining ids occupy indices 0..1, no holes
    expect(layer.debugPlacement(0)).toEqual({ kind: 'house', index: 0 });
    expect(layer.debugPlacement(2)).toEqual({ kind: 'house', index: 1 });
    expect(posOf(layer.houseMesh, 0).x).toBe(4); // id 0 still on its own tile
    expect(posOf(layer.houseMesh, 1).x).toBe(20); // id 2 moved into the freed slot, position intact
  });

  it('grows instance capacity when the city outgrows the allocation', () => {
    const layer = new BuildingLayer(geo, 2);
    for (let i = 0; i < 5; i++) layer.apply({ id: i, x: i, y: 0, state: 1 });
    expect(layer.counts().total).toBe(5);
    expect(layer.capacity).toBeGreaterThanOrEqual(5);
    expect(layer.debugPlacement(4)).toEqual({ kind: 'construction', index: 4 });
  });

  it('sync() from a save rebuilds the exact same projection as the event stream', () => {
    const slots: BuildingSlotData[] = [
      { state: 2, x: 1, y: 1, zone: 1, level: 1, occupants: 4, stateSinceTick: 96 },
      { state: 0, x: 0, y: 0, zone: 0, level: 0, occupants: 0, stateSinceTick: 0 }, // free slot
      { state: 1, x: 2, y: 2, zone: 1, level: 1, occupants: 0, stateSinceTick: 120 },
      { state: 3, x: 3, y: 3, zone: 2, level: 1, occupants: 0, stateSinceTick: 50 },
    ];
    const layer = new BuildingLayer(geo);
    layer.sync(slots);
    expect(layer.counts()).toEqual({ construction: 1, house: 2, total: 3 });
    expect(layer.debugPlacement(0)).toEqual({ kind: 'house', index: 0 }); // first house synced
    expect(layer.debugPlacement(1)).toBeUndefined();
    expect(layer.debugPlacement(2)).toEqual({ kind: 'construction', index: 0 });
    expect(layer.debugPlacement(3)).toEqual({ kind: 'house', index: 1 });
    const c = new THREE.Color();
    layer.houseMesh.getColorAt(layer.debugPlacement(3)?.index as number, c);
    expect(c.r).toBeLessThan(0.4); // abandoned tint survives the load
    // a rebuild from the same slots is stable (load-load idempotency)
    layer.sync(slots);
    expect(layer.counts()).toEqual({ construction: 1, house: 2, total: 3 });
  });

  it('uses two draw calls worth of meshes regardless of building count', () => {
    const layer = new BuildingLayer(geo);
    for (let i = 0; i < 40; i++) {
      layer.apply({ id: i, x: i % 8, y: Math.floor(i / 8), state: i % 2 === 0 ? 1 : 2 });
    }
    let meshes = 0;
    layer.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) meshes++;
    });
    expect(meshes).toBe(2); // future-proof for the <200 draw budget (FR-R04)
    layer.dispose();
  });
});
