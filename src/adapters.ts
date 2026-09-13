import type { EngineTransition, RestoreResult, TurnBasedSnapshot, TurnCommand } from "./types.js";
import type { TurnBasedEngine } from "./turn-based.js";

export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TurnBasedStorageAdapter {
  load(): RestoreResult;
  save(): void;
  clear(): void;
}

export interface AsyncTurnBasedStorageAdapter {
  load(): Promise<RestoreResult>;
  save(): Promise<void>;
  clear(): Promise<void>;
}

export interface TurnBasedClientAdapter {
  getSnapshot(): TurnBasedSnapshot;
  dispatch(command: TurnCommand): EngineTransition<TurnBasedSnapshot>;
  subscribe(listener: (snapshot: TurnBasedSnapshot) => void): () => void;
}

export function createTurnBasedStorageAdapter(
  engine: TurnBasedEngine,
  storage: SyncStorage,
  key = "lengend-nightmare-save",
): TurnBasedStorageAdapter {
  return {
    load: () => {
      const saved = storage.getItem(key);
      return saved ? engine.restore(saved) : { ok: true, migrated: false, snapshot: engine.getSnapshot() };
    },
    save: () => storage.setItem(key, engine.serialize()),
    clear: () => storage.removeItem(key),
  };
}

export function createAsyncTurnBasedStorageAdapter(
  engine: TurnBasedEngine,
  storage: AsyncStorage,
  key = "lengend-nightmare-save",
): AsyncTurnBasedStorageAdapter {
  return {
    load: async () => {
      const saved = await storage.getItem(key);
      return saved ? engine.restore(saved) : { ok: true, migrated: false, snapshot: engine.getSnapshot() };
    },
    save: async () => storage.setItem(key, engine.serialize()),
    clear: async () => storage.removeItem(key),
  };
}

export function connectTurnBasedEngine(engine: TurnBasedEngine): TurnBasedClientAdapter {
  const listeners = new Set<(snapshot: TurnBasedSnapshot) => void>();
  return {
    getSnapshot: () => engine.getSnapshot(),
    dispatch: (command) => {
      const transition = engine.dispatch(command);
      if (transition.accepted) {
        const snapshot = engine.getSnapshot();
        listeners.forEach((listener) => listener(snapshot));
      }
      return transition;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}