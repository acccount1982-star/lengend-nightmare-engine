# Lengend Nightmare Engine

An original, platform-neutral TypeScript engine for monster arena games. The package contains two composable simulation layers:

- a deterministic turn-based campaign engine for actions, resources, enemy behaviors, rewards, saves, and progression;
- a fixed-timestep real-time arena simulation with inputs, entities, movement, bounds, and collision hooks.

The engine has no React, DOM, Tailwind, browser storage, or native runtime dependency. Clients own rendering, input devices, and persistence adapters.

## Install

Install the versioned first-release archive with one command:

```bash
pnpm add https://github.com/lengend-nightmare/engine/releases/download/v0.1.0/lengend-nightmare-engine-0.1.0.tgz
```

The URL is intentionally tied to a versioned release archive so applications can pin the engine and upgrade deliberately.

The package is also prepared for the public npm registry:

```sh
pnpm add @lengend-nightmare/engine
```

Use the [npm package page](https://www.npmjs.com/package/@lengend-nightmare/engine) when the registry release is preferred.

## Usage

```ts
import {
  createTurnBasedEngine,
  lengendNightmareCampaign,
} from "@lengend-nightmare/engine";

const engine = createTurnBasedEngine({
  campaign: lengendNightmareCampaign,
  seed: 1978,
});

const transition = engine.dispatch({
  type: "turn.action",
  actionId: "attack",
});

console.log(transition.snapshot, transition.events);
const save = engine.serialize();
```

When working inside this monorepo, use the workspace package instead:

```bash
pnpm --filter @workspace/lengend-nightmare-game add @lengend-nightmare/engine@workspace:*
```

For real-time play, create an arena with `createRealTimeArena`, send `arena.set-input` commands, and advance it with `arena.step`. The fixed timestep keeps simulation behavior reproducible across renderers.

## Distribution

`pnpm run build` emits JavaScript and declaration files to `dist/`. The package is intentionally independent from the game clients so a future app, editor, or renderer can consume the same simulation contract.

Release preparation lives in `CHANGELOG.md`, with the current package version tracked in `package.json`. Run `pnpm run pack:release` to build the package and write a versioned archive to `releases/`. The source, changelog, and release history are available in the [GitHub repository](https://github.com/lengend-nightmare/engine). The package is distributed under the [MIT license](./LICENSE), which permits commercial use, modification, redistribution, and sublicensing with the copyright and permission notice retained.

## Originality

This is an original implementation inspired only by common arena-game structures. It does not include proprietary code, names, art, characters, or rules from other games.