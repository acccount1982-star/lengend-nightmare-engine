import assert from "node:assert/strict";
import test from "node:test";
import { createRealTimeArena, createTurnBasedEngine, deserializeTurnBasedSnapshot, lengendNightmareCampaign } from "../src/index";

test("same seed and commands produce the same turn-based snapshot", () => {
  const first = createTurnBasedEngine({ seed: 42 });
  const second = createTurnBasedEngine({ seed: 42 });
  const commands = ["attack", "guard", "overcharge", "stitch"] as const;
  for (const actionId of commands) {
    first.dispatch({ type: "turn.action", actionId });
    second.dispatch({ type: "turn.action", actionId });
  }
  assert.deepEqual(first.getSnapshot(), second.getSnapshot());
});

test("campaign victory unlocks the next level, reward, and codex entry", () => {
  const engine = createTurnBasedEngine({ seed: 8 });
  for (let move = 0; move < 10 && engine.getSnapshot().currentLevel === 1; move += 1) {
    engine.dispatch({ type: "turn.action", actionId: "attack" });
  }
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.currentLevel, 2);
  assert.equal(snapshot.victories, 1);
  assert.ok(snapshot.discovered.includes(lengendNightmareCampaign.levels[0].enemy.id));
  assert.ok(snapshot.upgrades.includes(lengendNightmareCampaign.levels[0].reward));
});

test("defeat can be retried without losing campaign progress", () => {
  const engine = createTurnBasedEngine({ seed: 2 });
  for (let move = 0; move < 30 && engine.getSnapshot().phase === "active"; move += 1) {
    engine.dispatch({ type: "turn.action", actionId: "attack" });
  }
  assert.equal(engine.getSnapshot().phase, "defeat");
  const retry = engine.dispatch({ type: "turn.retry" });
  assert.equal(retry.accepted, true);
  assert.equal(engine.getSnapshot().phase, "active");
  assert.equal(engine.getSnapshot().playerHp, engine.getSnapshot().playerMaxHp);
});

test("legacy saves migrate and invalid saves fail safely", () => {
  const engine = createTurnBasedEngine({ seed: 5 });
  const legacy = JSON.stringify({ currentLevel: 2, victories: 1, playerHp: 73, discovered: ["mossback-rook"] });
  const migrated = engine.restore(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, true);
  assert.equal(engine.getSnapshot().currentLevel, 2);
  const invalid = deserializeTurnBasedSnapshot("{not-json", lengendNightmareCampaign, engine.getSnapshot());
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.code, "INVALID_SAVE");
});

test("real-time arena advances on fixed steps and emits collision hooks", () => {
  const arena = createRealTimeArena({
    id: "test-arena",
    width: 200,
    height: 120,
    fixedStepMs: 10,
    entities: [
      { id: "player", kind: "player", position: { x: 40, y: 100 }, velocity: { x: 0, y: 0 }, radius: 10, hp: 10, maxHp: 10, active: true },
      { id: "enemy", kind: "enemy", position: { x: 40, y: 100 }, velocity: { x: 0, y: 0 }, radius: 10, hp: 10, maxHp: 10, active: true },
    ],
  });
  const transition = arena.dispatch({ type: "arena.step", deltaMs: 20 });
  assert.equal(transition.snapshot.tick, 2);
  assert.ok(transition.events.some((event) => event.type === "arena.collision"));
});