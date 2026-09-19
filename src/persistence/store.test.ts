import { describe, expect, it } from 'vitest';
import { memoryDriver, SlotManager } from './store.js';

describe('SlotManager', () => {
  it('round-trips bytes and returns null for missing slots', async () => {
    const m = new SlotManager(memoryDriver());
    expect(await m.load('city0')).toBeNull();
    await m.save('city0', new Uint8Array([1, 2, 3]));
    expect(await m.load('city0')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rotates auto -> auto.bak on autosave', async () => {
    const m = new SlotManager(memoryDriver());
    await m.saveAuto(new Uint8Array([1]));
    await m.saveAuto(new Uint8Array([2]));
    expect(await m.load('auto')).toEqual(new Uint8Array([2]));
    expect(await m.load('auto.bak')).toEqual(new Uint8Array([1]));
    expect(await m.loadAuto()).toEqual(new Uint8Array([2]));
  });

  it('falls back to memory driver in node (no OPFS/IDB)', async () => {
    const m = await SlotManager.create();
    expect(m.driverName).toBe('memory');
  });
});
