// Save slots: OPFS (primary) -> IndexedDB (fallback) -> memory (tests/private mode).
import { SaveError } from './codec.js';

export type SlotId = 'city0' | 'city1' | 'city2' | 'auto' | 'auto.bak';

export interface SaveDriver {
  readonly name: string;
  read(slot: SlotId): Promise<Uint8Array | null>;
  write(slot: SlotId, data: Uint8Array): Promise<void>;
}

export function memoryDriver(): SaveDriver {
  const map = new Map<string, Uint8Array>();
  return {
    name: 'memory',
    read: (slot) => Promise.resolve(map.get(slot)?.slice() ?? null),
    write: (slot, data) => {
      map.set(slot, data.slice());
      return Promise.resolve();
    },
  };
}

interface FsHandle {
  getFile(): Promise<Blob>;
  createWritable(): Promise<{ write(d: Uint8Array): Promise<void>; close(): Promise<void> }>;
  move?(dest: string): Promise<void>;
}
interface FsDir {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsHandle>;
}

async function opfsDir(): Promise<FsDir> {
  const storage = (globalThis as unknown as { navigator?: Navigator }).navigator?.storage as unknown as
    | { getDirectory(): Promise<{ getDirectoryHandle(n: string, o?: { create?: boolean }): Promise<FsDir> }> }
    | undefined;
  if (!storage?.getDirectory) throw new Error('no OPFS');
  const root = await storage.getDirectory();
  return root.getDirectoryHandle('saves', { create: true });
}

export function opfsDriver(): SaveDriver {
  const file = (s: SlotId): string => `${s}.city`;
  return {
    name: 'opfs',
    read: async (slot) => {
      try {
        const dir = await opfsDir();
        const h = await dir.getFileHandle(file(slot));
        return new Uint8Array(await (await h.getFile()).arrayBuffer());
      } catch {
        return null;
      }
    },
    write: async (slot, data) => {
      try {
        const dir = await opfsDir();
        const tmp = await dir.getFileHandle(`${file(slot)}.tmp`, { create: true });
        const w = await tmp.createWritable();
        await w.write(data);
        await w.close();
        if (tmp.move) {
          await tmp.move(file(slot)); // atomic publish where supported
        } else {
          const final = await dir.getFileHandle(file(slot), { create: true });
          const w2 = await final.createWritable();
          await w2.write(data);
          await w2.close();
        }
      } catch (e) {
        throw new SaveError('IO', `OPFS write failed: ${(e as Error).message}`);
      }
    },
  };
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'));
      return;
    }
    const req = indexedDB.open('city-builder', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('saves');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb open failed'));
  });
}

export function indexedDbDriver(): SaveDriver {
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await idbOpen();
    try {
      return await new Promise<T>((resolve, reject) => {
        const t = db.transaction('saves', mode);
        const req = fn(t.objectStore('saves'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('idb request failed'));
      });
    } finally {
      db.close();
    }
  };
  return {
    name: 'indexeddb',
    read: async (slot) => {
      try {
        const v = await tx('readonly', (s) => s.get(slot) as IDBRequest<Uint8Array | undefined>);
        return v ? new Uint8Array(v) : null;
      } catch {
        return null;
      }
    },
    write: async (slot, data) => {
      try {
        await tx('readwrite', (s) => s.put(data.slice(), slot));
      } catch (e) {
        throw new SaveError('IO', `IndexedDB write failed: ${(e as Error).message}`);
      }
    },
  };
}

export class SlotManager {
  constructor(readonly driver: SaveDriver) {}

  get driverName(): string {
    return this.driver.name;
  }

  save(slot: SlotId, data: Uint8Array): Promise<void> {
    return this.driver.write(slot, data);
  }

  load(slot: SlotId): Promise<Uint8Array | null> {
    return this.driver.read(slot);
  }

  /** Autosave with rotation: auto -> auto.bak, then write auto. Crash-safe restore order. */
  async saveAuto(data: Uint8Array): Promise<void> {
    const prev = await this.driver.read('auto');
    if (prev) await this.driver.write('auto.bak', prev);
    await this.driver.write('auto', data);
  }

  async loadAuto(): Promise<Uint8Array | null> {
    return (await this.driver.read('auto')) ?? (await this.driver.read('auto.bak'));
  }

  /** Probe drivers in preference order. Always resolves (memory never fails). */
  static async create(): Promise<SlotManager> {
    try {
      await opfsDir();
      return new SlotManager(opfsDriver());
    } catch {
      /* fall through */
    }
    try {
      const db = await idbOpen();
      db.close();
      return new SlotManager(indexedDbDriver());
    } catch {
      /* fall through */
    }
    return new SlotManager(memoryDriver());
  }
}
