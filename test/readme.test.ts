import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "packages", "core", "src", "cli.ts");
const status = readFileSync(join(ROOT, "README.md"), "utf8")
	.split("\n")
	.find((line) => line.startsWith("**Status:"));
const folder = mkdtempSync(join(tmpdir(), "arthur-readme-"));
after(() => rmSync(folder, { recursive: true, force: true }));

// The README's status line names the command that runs today and links the roadmap. Both must hold, or the status lies.
test("the README status line names a command that runs and links an existing roadmap", () => {
	assert.ok(status, "README.md has a Status line");
	const command = status.match(/`(arthur [^`]+)`/)?.[1];
	assert.ok(command, "the status line names an arthur command");
	const link = status.match(/\]\(([^)]+)\)/)?.[1];
	assert.ok(link && existsSync(join(ROOT, link)), `the status line links an existing file: ${link}`);

	writeFileSync(join(folder, "arthur.config.ts"), 'export default { plugins: [{ name: "orchestration", setup() {} }] };\n');
	const run = spawnSync(process.execPath, [CLI, ...command.split(" ").slice(1)], {
		cwd: folder,
		encoding: "utf8",
		// Its own XDG_CONFIG_HOME, never the caller's: without one the CLI reads the owner's env file, which a job cannot read.
		env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: folder },
	});
	assert.deepEqual([run.status, run.stderr], [0, ""], `${command} exits 0 on the smallest config Arthur starts`);
});
