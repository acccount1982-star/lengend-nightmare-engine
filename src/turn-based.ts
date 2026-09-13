import { lengendNightmareCampaign } from "./campaign.js";
import { SeededRandom } from "./random.js";
import { deserializeTurnBasedSnapshot, serializeTurnBasedSnapshot } from "./save.js";
import type {
  CampaignAction,
  CampaignDefinition,
  EngineEvent,
  EngineTransition,
  TurnBasedEngineConfig,
  TurnBasedSnapshot,
  TurnCommand,
} from "./types.js";

const START_LOG = [
  "The bolts are humming. Something is definitely waking up.",
  "A tournament bell tolls in the dark.",
];

function cloneSnapshot(snapshot: TurnBasedSnapshot): TurnBasedSnapshot {
  return {
    ...snapshot,
    level: { ...snapshot.level, enemy: { ...snapshot.level.enemy } },
    discovered: [...snapshot.discovered],
    upgrades: [...snapshot.upgrades],
    activeLog: [...snapshot.activeLog],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addLog(snapshot: TurnBasedSnapshot, message: string): readonly string[] {
  return [message, ...snapshot.activeLog].slice(0, 6);
}

function initialSnapshot(campaign: CampaignDefinition, seed: number): TurnBasedSnapshot {
  const level = campaign.levels[0];
  const random = new SeededRandom(seed);
  return {
    formatVersion: 1,
    mode: "turn-based",
    campaignId: campaign.id,
    seed,
    rngState: random.getState(),
    currentLevel: level.id,
    level,
    playerHp: campaign.player.maxHp,
    playerMaxHp: campaign.player.maxHp,
    enemyHp: level.enemy.hp,
    energy: campaign.player.maxEnergy,
    maxEnergy: campaign.player.maxEnergy,
    turn: 1,
    victories: 0,
    discovered: [],
    upgrades: [],
    activeLog: START_LOG,
    guarded: false,
    phase: "active",
  };
}

function rejected(snapshot: TurnBasedSnapshot, code: "INVALID_ACTION" | "INSUFFICIENT_ENERGY" | "GAME_NOT_ACTIVE", message: string): EngineTransition<TurnBasedSnapshot> {
  return {
    snapshot: cloneSnapshot(snapshot),
    events: [],
    accepted: false,
    error: { code, message },
  };
}

export class TurnBasedEngine {
  readonly campaign: CampaignDefinition;
  private readonly random: SeededRandom;
  private snapshot: TurnBasedSnapshot;

  constructor(config: TurnBasedEngineConfig = {}) {
    this.campaign = config.campaign ?? lengendNightmareCampaign;
    const seed = Math.trunc(config.seed ?? Date.now()) || 1;
    this.random = new SeededRandom(seed);
    this.snapshot = config.snapshot ? cloneSnapshot(config.snapshot) : initialSnapshot(this.campaign, seed);
    this.random.setState(this.snapshot.rngState);
  }

  getSnapshot(): TurnBasedSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  dispatch(command: TurnCommand): EngineTransition<TurnBasedSnapshot> {
    if (command.type === "turn.reset") {
      this.snapshot = initialSnapshot(this.campaign, this.snapshot.seed);
      this.random.setState(this.snapshot.rngState);
      return { snapshot: this.getSnapshot(), events: [{ type: "turn.reset", message: "The campaign starts with a clean slab." }], accepted: true };
    }

    if (command.type === "turn.retry") {
      if (this.snapshot.phase !== "defeat") {
        return rejected(this.snapshot, "GAME_NOT_ACTIVE", "A retry is only available after defeat.");
      }
      const level = this.campaign.levels[this.snapshot.currentLevel - 1];
      this.snapshot = {
        ...this.snapshot,
        level,
        playerHp: this.snapshot.playerMaxHp,
        enemyHp: level.enemy.hp,
        energy: this.snapshot.maxEnergy,
        turn: 1,
        guarded: false,
        phase: "active",
        activeLog: addLog(this.snapshot, "The creature pulls itself back together."),
      };
      return { snapshot: this.getSnapshot(), events: [{ type: "turn.retry", message: "The current encounter is ready to replay.", levelId: level.id }], accepted: true };
    }

    if (this.snapshot.phase !== "active") {
      return rejected(this.snapshot, "GAME_NOT_ACTIVE", this.snapshot.phase === "complete" ? "The campaign is complete." : "The creature is down. Retry the encounter to continue.");
    }

    const action = this.campaign.actions.find((candidate) => candidate.id === command.actionId);
    if (!action) {
      return rejected(this.snapshot, "INVALID_ACTION", `Unknown action: ${command.actionId}`);
    }
    if (this.snapshot.energy < action.cost) {
      return rejected(this.snapshot, "INSUFFICIENT_ENERGY", "Not enough charge for that move.");
    }

    const events: EngineEvent[] = [];
    const before = this.snapshot;
    let next: TurnBasedSnapshot = {
      ...before,
      turn: before.turn + 1,
      energy: before.energy - action.cost,
      guarded: false,
      lastAction: action.id,
    };

    if (action.effect === "damage") {
      const value = this.random.integer(action.minValue, action.maxValue);
      const damage = before.level.enemy.behavior === "braced" || before.level.enemy.behavior === "royal-guard" ? Math.max(1, value - 2) : value;
      next = { ...next, enemyHp: clamp(before.enemyHp - damage, 0, before.level.enemy.hp), activeLog: addLog(next, `${action.label} lands for ${damage} damage.`) };
      events.push({ type: "turn.action", message: `${action.label} lands for ${damage} damage.`, actionId: action.id, value: damage, levelId: before.level.id });
      if (next.enemyHp > 0 && before.level.enemy.behavior === "regenerates") {
        const regeneration = Math.min(3, before.level.enemy.hp - next.enemyHp);
        next = { ...next, enemyHp: next.enemyHp + regeneration, activeLog: addLog(next, `${before.level.enemy.name} knits back ${regeneration} vitality.`) };
        events.push({ type: "turn.enemy-response", message: `${before.level.enemy.name} regenerates ${regeneration} vitality.`, value: regeneration, levelId: before.level.id });
      }
    } else if (action.effect === "heal") {
      const value = this.random.integer(action.minValue, action.maxValue);
      const healing = Math.min(value, before.playerMaxHp - before.playerHp);
      next = { ...next, playerHp: before.playerHp + healing, activeLog: addLog(next, `Fresh thread holds. Restored ${healing} vitality.`) };
      events.push({ type: "turn.action", message: `Restored ${healing} vitality.`, actionId: action.id, value: healing, levelId: before.level.id });
    } else {
      next = { ...next, guarded: true, energy: Math.min(before.maxEnergy, next.energy + 1), activeLog: addLog(next, "You brace behind a slab of stitched iron.") };
      events.push({ type: "turn.action", message: "You brace for the next hit.", actionId: action.id, levelId: before.level.id });
    }

    if (next.enemyHp <= 0) {
      const reward = before.level.reward;
      const completed = before.level.id === this.campaign.levels.length;
      const followingLevel = this.campaign.levels[before.level.id] ?? before.level;
      const discovered = next.discovered.includes(before.level.enemy.id) ? next.discovered : [...next.discovered, before.level.enemy.id];
      next = {
        ...next,
        currentLevel: completed ? before.level.id : followingLevel.id,
        level: followingLevel,
        enemyHp: completed ? 0 : followingLevel.enemy.hp,
        energy: Math.min(next.maxEnergy, next.energy + 2),
        victories: Math.max(next.victories, before.level.id),
        discovered,
        upgrades: next.upgrades.includes(reward) ? next.upgrades : [...next.upgrades, reward],
        phase: completed ? "complete" : "active",
        activeLog: addLog(next, completed ? "The maker falls. The legend is yours." : `${before.level.enemy.name} falls. ${reward} joins your kit.`),
      };
      events.push({ type: "turn.level-won", message: `${before.level.enemy.name} is defeated.`, levelId: before.level.id });
      if (completed) {
        events.push({ type: "turn.complete", message: "The tournament is yours.", levelId: before.level.id });
      }
      this.snapshot = { ...next, rngState: this.random.getState() };
      return { snapshot: this.getSnapshot(), events, accepted: true };
    }

    if (action.effect !== "guard") {
      let incoming = this.random.integer(before.level.enemy.attackMin, before.level.enemy.attackMax);
      if (before.level.enemy.behavior === "heavy") incoming += 2;
      if (before.level.enemy.behavior === "charger" && before.turn % 2 === 0) incoming += 4;
      if (before.level.enemy.behavior === "slow") incoming = Math.max(1, incoming - 1);
      if (before.guarded) incoming = Math.ceil(incoming / 2);
      const playerHp = clamp(next.playerHp - incoming, 0, next.playerMaxHp);
      let energy = next.energy;
      if (before.level.enemy.behavior === "drainer") energy = Math.max(0, energy - 1);
      const defeated = playerHp <= 0;
      const response = `${before.level.enemy.name} replies for ${incoming} damage.`;
      next = { ...next, playerHp, energy: Math.min(next.maxEnergy, energy + 1), phase: defeated ? "defeat" : "active", activeLog: addLog(next, defeated ? `${response} The creature hits the floor.` : response) };
      events.push({ type: "turn.enemy-response", message: response, value: incoming, levelId: before.level.id });
      if (defeated) events.push({ type: "turn.defeat", message: "The encounter is lost. Rebuild and retry.", levelId: before.level.id });
    } else {
      next = { ...next, energy: Math.min(next.maxEnergy, next.energy) };
    }

    this.snapshot = { ...next, rngState: this.random.getState() };
    return { snapshot: this.getSnapshot(), events, accepted: true };
  }

  serialize(): string {
    return serializeTurnBasedSnapshot(this.snapshot);
  }

  restore(input: string): ReturnType<typeof deserializeTurnBasedSnapshot> {
    const result = deserializeTurnBasedSnapshot(input, this.campaign, this.snapshot);
    if (result.ok) {
      this.snapshot = result.snapshot;
      this.random.setState(result.snapshot.rngState);
    }
    return { ...result, snapshot: this.getSnapshot() };
  }
}

export function createTurnBasedEngine(config: TurnBasedEngineConfig = {}): TurnBasedEngine {
  return new TurnBasedEngine(config);
}

export function actionById(campaign: CampaignDefinition, actionId: string): CampaignAction | undefined {
  return campaign.actions.find((action) => action.id === actionId);
}