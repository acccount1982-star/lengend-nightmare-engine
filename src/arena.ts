import type {
  ArenaCommand,
  ArenaConfig,
  ArenaEntity,
  ArenaInput,
  ArenaSnapshot,
  EngineEvent,
  EngineTransition,
} from "./types.js";

const DEFAULT_STEP_MS = 1000 / 60;

function cloneEntity(entity: ArenaEntity): ArenaEntity {
  return { ...entity, position: { ...entity.position }, velocity: { ...entity.velocity } };
}

function cloneSnapshot(snapshot: ArenaSnapshot): ArenaSnapshot {
  return {
    ...snapshot,
    entities: snapshot.entities.map(cloneEntity),
    inputs: Object.fromEntries(Object.entries(snapshot.inputs).map(([id, input]) => [id, { ...input }])),
  };
}

function defaultEntities(): readonly ArenaEntity[] {
  return [
    { id: "player", kind: "player", position: { x: 120, y: 80 }, velocity: { x: 0, y: 0 }, radius: 18, hp: 100, maxHp: 100, active: true },
    { id: "training-dummy", kind: "enemy", position: { x: 360, y: 80 }, velocity: { x: 0, y: 0 }, radius: 18, hp: 100, maxHp: 100, active: true },
  ];
}

function overlaps(left: ArenaEntity, right: ArenaEntity): boolean {
  const dx = left.position.x - right.position.x;
  const dy = left.position.y - right.position.y;
  const radius = left.radius + right.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export class RealTimeArena {
  private snapshot: ArenaSnapshot;
  private accumulator = 0;
  private readonly gravity: number;
  private readonly initialEntities: readonly ArenaEntity[];

  constructor(config: ArenaConfig) {
    this.gravity = config.gravity ?? 980;
    this.initialEntities = (config.entities ?? defaultEntities()).map(cloneEntity);
    this.snapshot = {
      mode: "real-time",
      arenaId: config.id ?? "arena",
      width: config.width,
      height: config.height,
      fixedStepMs: config.fixedStepMs ?? DEFAULT_STEP_MS,
      tick: 0,
      timeMs: 0,
      entities: this.initialEntities.map(cloneEntity),
      inputs: {},
    };
  }

  getSnapshot(): ArenaSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  dispatch(command: ArenaCommand): EngineTransition<ArenaSnapshot> {
    if (command.type === "arena.reset") {
      this.accumulator = 0;
      this.snapshot = { ...this.snapshot, tick: 0, timeMs: 0, entities: this.initialEntities.map(cloneEntity), inputs: {} };
      return { snapshot: this.getSnapshot(), events: [], accepted: true };
    }
    if (command.type === "arena.set-input") {
      this.snapshot = { ...this.snapshot, inputs: { ...this.snapshot.inputs, [command.entityId]: { ...command.input } } };
      return { snapshot: this.getSnapshot(), events: [], accepted: true };
    }
    if (!Number.isFinite(command.deltaMs) || command.deltaMs < 0) {
      return { snapshot: this.getSnapshot(), events: [], accepted: false, error: { code: "INVALID_COMMAND", message: "Arena step must use a non-negative finite duration." } };
    }

    this.accumulator += Math.min(command.deltaMs, 250);
    const events: EngineEvent[] = [];
    while (this.accumulator >= this.snapshot.fixedStepMs) {
      this.accumulator -= this.snapshot.fixedStepMs;
      events.push(...this.tick());
    }
    return { snapshot: this.getSnapshot(), events, accepted: true };
  }

  private tick(): readonly EngineEvent[] {
    const dt = this.snapshot.fixedStepMs / 1000;
    const floor = this.snapshot.height;
    const entities = this.snapshot.entities.map((entity) => {
      if (!entity.active) return entity;
      const input: ArenaInput = this.snapshot.inputs[entity.id] ?? {};
      const horizontal = input.left === input.right ? 0 : input.left ? -1 : 1;
      const speed = entity.kind === "player" ? 180 : 90;
      const jump = input.jump && entity.position.y <= entity.radius + 1 ? -330 : entity.velocity.y;
      const velocity = {
        x: horizontal * speed,
        y: jump + this.gravity * dt,
      };
      const position = {
        x: Math.max(entity.radius, Math.min(this.snapshot.width - entity.radius, entity.position.x + velocity.x * dt)),
        y: Math.max(entity.radius, Math.min(floor - entity.radius, entity.position.y + velocity.y * dt)),
      };
      return { ...entity, position, velocity: position.y >= floor - entity.radius ? { ...velocity, y: 0 } : velocity };
    });

    const collisions: EngineEvent[] = [];
    for (let leftIndex = 0; leftIndex < entities.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < entities.length; rightIndex += 1) {
        const left = entities[leftIndex];
        const right = entities[rightIndex];
        if (left.active && right.active && overlaps(left, right)) {
          collisions.push({ type: "arena.collision", message: `${left.id} collided with ${right.id}.`, entityIds: [left.id, right.id] });
        }
      }
    }

    this.snapshot = {
      ...this.snapshot,
      tick: this.snapshot.tick + 1,
      timeMs: this.snapshot.timeMs + this.snapshot.fixedStepMs,
      entities,
    };
    const attackEvents = entities.flatMap((entity) => {
      const input = this.snapshot.inputs[entity.id];
      return entity.active && input?.attack
        ? [{ type: "arena.attack" as const, message: `${entity.id} attempted an arena attack.`, entityIds: [entity.id] }]
        : [];
    });
    return [{ type: "arena.tick", message: `Arena tick ${this.snapshot.tick}.`, value: this.snapshot.tick }, ...attackEvents, ...collisions];
  }
}

export function createRealTimeArena(config: ArenaConfig): RealTimeArena {
  return new RealTimeArena(config);
}