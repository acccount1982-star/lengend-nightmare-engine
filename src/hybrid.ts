import { createRealTimeArena, RealTimeArena } from "./arena.js";
import { createTurnBasedEngine, TurnBasedEngine } from "./turn-based.js";
import type {
  ArenaCommand,
  EngineTransition,
  HybridCommand,
  HybridEngineConfig,
  HybridSnapshot,
  TurnCommand,
  TurnBasedSnapshot,
} from "./types.js";

export class HybridGameEngine {
  readonly turnBased: TurnBasedEngine;
  readonly arena: RealTimeArena;

  constructor(config: HybridEngineConfig = {}) {
    this.turnBased = createTurnBasedEngine(config);
    this.arena = createRealTimeArena(config.arena ?? { width: 640, height: 360 });
  }

  getSnapshot(): HybridSnapshot {
    return {
      turnBased: this.turnBased.getSnapshot(),
      arena: this.arena.getSnapshot(),
    };
  }

  dispatch(command: HybridCommand): EngineTransition<TurnBasedSnapshot> | EngineTransition<ReturnType<RealTimeArena["getSnapshot"]>> {
    return command.type.startsWith("turn")
      ? this.turnBased.dispatch(command as TurnCommand)
      : this.arena.dispatch(command as ArenaCommand);
  }
}

export function createHybridGameEngine(config: HybridEngineConfig = {}): HybridGameEngine {
  return new HybridGameEngine(config);
}