export type EngineMode = "turn-based" | "real-time";

export type ActionEffect = "damage" | "heal" | "guard";

export type EnemyBehavior =
  | "slow"
  | "braced"
  | "heavy"
  | "regenerates"
  | "mimic"
  | "charger"
  | "drainer"
  | "chaotic"
  | "royal-guard"
  | "final-boss";

export interface CampaignAction {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  readonly detail: string;
  readonly effect: ActionEffect;
  readonly minValue: number;
  readonly maxValue: number;
}

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly trait: string;
  readonly behavior: EnemyBehavior;
  readonly attackMin: number;
  readonly attackMax: number;
}

export interface CampaignLevel {
  readonly id: number;
  readonly title: string;
  readonly chapter: string;
  readonly environment: string;
  readonly objective: string;
  readonly enemy: EnemyDefinition;
  readonly reward: string;
}

export interface CampaignDefinition {
  readonly id: string;
  readonly version: number;
  readonly player: {
    readonly id: string;
    readonly name: string;
    readonly maxHp: number;
    readonly maxEnergy: number;
  };
  readonly actions: readonly CampaignAction[];
  readonly levels: readonly CampaignLevel[];
}

export type TurnPhase = "active" | "defeat" | "complete";

export interface TurnBasedSnapshot {
  readonly formatVersion: 1;
  readonly mode: "turn-based";
  readonly campaignId: string;
  readonly seed: number;
  readonly rngState: number;
  readonly currentLevel: number;
  readonly level: CampaignLevel;
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly enemyHp: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly turn: number;
  readonly victories: number;
  readonly discovered: readonly string[];
  readonly upgrades: readonly string[];
  readonly activeLog: readonly string[];
  readonly guarded: boolean;
  readonly phase: TurnPhase;
  readonly lastAction?: string;
}

export type TurnCommand =
  | { readonly type: "turn.action"; readonly actionId: string }
  | { readonly type: "turn.retry" }
  | { readonly type: "turn.reset" };

export interface EngineEvent {
  readonly type:
    | "turn.action"
    | "turn.enemy-response"
    | "turn.level-won"
    | "turn.defeat"
    | "turn.complete"
    | "turn.reset"
    | "turn.retry"
    | "arena.tick"
    | "arena.collision"
    | "arena.attack";
  readonly message: string;
  readonly actionId?: string;
  readonly value?: number;
  readonly levelId?: number;
  readonly entityIds?: readonly string[];
}

export type EngineErrorCode =
  | "INVALID_COMMAND"
  | "INVALID_ACTION"
  | "INSUFFICIENT_ENERGY"
  | "GAME_NOT_ACTIVE"
  | "INVALID_SAVE";

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
}

export interface EngineTransition<Snapshot> {
  readonly snapshot: Snapshot;
  readonly events: readonly EngineEvent[];
  readonly accepted: boolean;
  readonly error?: EngineError;
}

export interface TurnBasedEngineConfig {
  readonly campaign?: CampaignDefinition;
  readonly seed?: number;
  readonly snapshot?: TurnBasedSnapshot;
}

export interface RestoreResult {
  readonly ok: boolean;
  readonly migrated: boolean;
  readonly snapshot: TurnBasedSnapshot;
  readonly error?: EngineError;
}

export interface ArenaPosition {
  readonly x: number;
  readonly y: number;
}

export interface ArenaVelocity {
  readonly x: number;
  readonly y: number;
}

export interface ArenaEntity {
  readonly id: string;
  readonly kind: "player" | "enemy" | "prop";
  readonly position: ArenaPosition;
  readonly velocity: ArenaVelocity;
  readonly radius: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly active: boolean;
}

export interface ArenaInput {
  readonly left?: boolean;
  readonly right?: boolean;
  readonly jump?: boolean;
  readonly attack?: boolean;
}

export interface ArenaConfig {
  readonly id?: string;
  readonly width: number;
  readonly height: number;
  readonly fixedStepMs?: number;
  readonly gravity?: number;
  readonly entities?: readonly ArenaEntity[];
}

export interface ArenaSnapshot {
  readonly mode: "real-time";
  readonly arenaId: string;
  readonly width: number;
  readonly height: number;
  readonly fixedStepMs: number;
  readonly tick: number;
  readonly timeMs: number;
  readonly entities: readonly ArenaEntity[];
  readonly inputs: Readonly<Record<string, ArenaInput>>;
}

export type ArenaCommand =
  | { readonly type: "arena.set-input"; readonly entityId: string; readonly input: ArenaInput }
  | { readonly type: "arena.step"; readonly deltaMs: number }
  | { readonly type: "arena.reset" };

export type HybridCommand = TurnCommand | ArenaCommand;

export interface HybridEngineConfig extends TurnBasedEngineConfig {
  readonly arena?: ArenaConfig;
}

export interface HybridSnapshot {
  readonly turnBased: TurnBasedSnapshot;
  readonly arena: ArenaSnapshot;
}