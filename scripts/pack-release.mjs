import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const stagingDir = join(packageRoot, ".release-staging");
const releaseDir = join(packageRoot, "releases");

rmSync(stagingDir, { force: true, recursive: true });
mkdirSync(stagingDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

execFileSync("pnpm", ["pack", "--pack-destination", stagingDir], {
  cwd: packageRoot,
  stdio: "inherit",
});

const archive = readdirSync(stagingDir).find((name) => name.endsWith(".tgz"));
if (!archive) {
  throw new Error("pnpm pack did not create a tarball");
}

const target = join(releaseDir, `lengend-nightmare-engine-${packageJson.version}.tgz`);
copyFileSync(join(stagingDir, archive), target);
rmSync(stagingDir, { force: true, recursive: true });

if (!existsSync(target)) {
  throw new Error(`Release archive was not written to ${target}`);
}

console.log(`Release archive written to ${target}`);