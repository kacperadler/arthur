import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";

// .github/workflows/release.yml and its step, test/release.ts, run in a clone of a real Git origin, with a fake `npm` and a
// fake `gh` first on PATH that note each call in `calls`; `gh` notes the notes it reads from its stdin in `notes`.

const SCRIPT = join(import.meta.dirname, "release.ts");
const CHANGELOG = [
	"# Changelog\n\nGenerated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.\n",
	"## Unreleased\n\n### 2026-02-03\n\n#### Added\n\n- AC0003 Pay (ccc3333)\n",
	"## 0.2.0 (2026-02-02)\n\n### 2026-02-02\n\n#### Changed\n\n- AC0002 Release 0.2.0 (bbb2222)\n\n### 2026-02-01\n\n#### Added\n\n- AC0001 Shop (aaa1111)\n",
	"## 0.1.0 (2026-01-20)\n\n### 2026-01-20\n\n#### Fixed\n\n- AC0000 Start (9990000)\n",
].join("\n");
const NOTES = "### 2026-02-02\n\n#### Changed\n\n- AC0002 Release 0.2.0 (bbb2222)\n\n### 2026-02-01\n\n#### Added\n\n- AC0001 Shop (aaa1111)\n";

type Setup = { readonly pkg?: object; readonly changelog?: string; readonly tags?: readonly string[]; readonly fail?: string; readonly origin?: boolean };

// Runs test/release.ts in a clone whose tip holds `pkg` and `changelog`, `tags` pushed to origin first, the fake npm failing
// the step `fail` names ("ci", "run check", "test") and the fake gh failing on "gh"; `origin: false` leaves the clone none.
function release({ pkg = { name: "acme", version: "0.2.0" }, changelog = CHANGELOG, tags = ["v0.1.0", "v0.2.0-rc.1"], fail = "", origin = true }: Setup = {}) {
	const root = temporaryFolder();
	const [bare, work, bin] = [join(root, "origin.git"), join(root, "shop"), join(root, "bin")];
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", cwd, ...args], { encoding: "utf8" }).trim();
	mkdirSync(work);
	git(root, "init", "--quiet", "--bare", bare);
	git(work, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(work, "package.json"), `${JSON.stringify(pkg)}\n`);
	writeFileSync(join(work, "CHANGELOG.md"), changelog);
	git(work, "add", "--all");
	git(work, "commit", "--quiet", "-m", "Merge AC0002: Release 0.2.0");
	git(work, "remote", "add", "origin", bare);
	for (const tag of tags) git(work, "tag", tag);
	git(work, "push", "--quiet", "origin", "main", ...tags);
	for (const tag of tags) git(work, "tag", "--delete", tag);
	if (origin === false) git(work, "remote", "remove", "origin");
	mkdirSync(bin);
	const calls = join(root, "calls");
	writeFileSync(join(bin, "npm"), `#!/bin/sh\necho "npm $*" >> '${calls}'\n[ "$*" != '${fail}' ]\n`, { mode: 0o755 });
	writeFileSync(join(bin, "gh"), `#!/bin/sh\necho "gh $*" >> '${calls}'\ncat > '${join(root, "notes")}'\n[ gh != '${fail}' ]\n`, { mode: 0o755 });
	const ran = spawnSync(process.execPath, [SCRIPT], { cwd: work, encoding: "utf8", env: { ...process.env, PATH: [bin, process.env.PATH].join(delimiter) } });
	const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
	return { code: ran.status, out: ran.stdout.trim(), err: ran.stderr.trim(), calls: read(calls), notes: read(join(root, "notes")), sha: git(work, "rev-parse", "HEAD") };
}

test("a version without its tag on origin: npm ci, npm run check and npm test, then gh release create at the tip with its CHANGELOG.md section as the notes", () => {
	const made = release();
	assert.deepEqual(made, {
		code: 0,
		out: `released v0.2.0 at ${made.sha.slice(0, 7)}`,
		err: "",
		calls: `npm ci\nnpm run check\nnpm test\ngh release create v0.2.0 --target ${made.sha} --notes-file -\n`,
		notes: NOTES,
		sha: made.sha,
	});
	assert.equal(release({ changelog: CHANGELOG.replace(/\n## 0\.1\.0[^]*$/, "") }).notes, NOTES, "the last section, up to the end of the file");
});

test("no release: a version whose tag exists, a package.json without a version, a CHANGELOG.md without its section; nothing runs", () => {
	const cases: [Setup, string][] = [
		[{ tags: ["v0.2.0"] }, "v0.2.0 exists on origin: no release"],
		[{ pkg: { name: "acme" } }, "package.json has no version: no release"],
		[{ pkg: { name: "acme", version: "0.3.0" } }, "CHANGELOG.md has no section 0.3.0: no release of v0.3.0; a release ticket's merge writes it"],
		[{ pkg: { name: "acme", version: "0.2" } }, "CHANGELOG.md has no section 0.2: no release of v0.2; a release ticket's merge writes it"],
	];
	for (const [setup, out] of cases) {
		const { code, out: said, err, calls } = release(setup);
		assert.deepEqual({ code, said, err, calls }, { code: 0, said: out, err: "", calls: "" }, out);
	}
});

test("a failed check, install, release or origin makes none and fails the run, naming it; nothing runs after it", () => {
	const cases: [Setup, string, string][] = [
		[{ fail: "ci" }, "npm ci failed: no release of v0.2.0", "npm ci\n"],
		[{ fail: "run check" }, "npm run check failed: no release of v0.2.0", "npm ci\nnpm run check\n"],
		[{ fail: "test" }, "npm test failed: no release of v0.2.0", "npm ci\nnpm run check\nnpm test\n"],
	];
	for (const [setup, err, calls] of cases) {
		const { code, out, err: said, calls: ran, notes } = release(setup);
		assert.deepEqual({ code, out, said, ran, notes }, { code: 1, out: "", said: err, ran: calls, notes: "" }, err);
	}
	const gh = release({ fail: "gh" });
	assert.deepEqual([gh.code, gh.out, gh.err], [1, "", "gh release create v0.2.0 failed"]);
	const lost = release({ origin: false });
	assert.deepEqual([lost.code, lost.calls], [1, ""]);
	assert.match(lost.err, /^git ls-remote origin failed: .*'origin'.*; no release of v0\.2\.0$/s);
});

test("release.yml runs that step on a push to main that changes package.json, with its own token, allowed to write contents", () => {
	const yml = readFileSync(join(import.meta.dirname, "..", ".github", "workflows", "release.yml"), "utf8");
	assert.match(yml, /\non:\n {2}push:\n {4}branches: \[main\]\n {4}paths: \[package\.json\]\n\n/);
	assert.match(yml, /\n {4}permissions:\n {6}contents: write\n/);
	assert.match(yml, /\n {6}- run: node test\/release\.ts\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n$/);
});
