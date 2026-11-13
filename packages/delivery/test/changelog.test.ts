import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

// `arthur changelog` against the fake host, over the projects acme and beta, whose boards and ticket folders the test writes
// as the core and `arthur merge`'s outcome leave them.

type Ticket = { readonly id: string; readonly status: string; readonly updated?: string; readonly kind?: string; readonly merged?: string; readonly gone?: boolean };

const HEAD = "# Changelog\n\nGenerated from the merged tickets of `spec/build.json` by `arthur changelog`; a hand edit is overwritten at the next merge.\n";

// A project's folder with `tickets` on its board, each `ticket.md` with its `- Kind:` under `## Goal` (none without `kind`),
// and with `merged` an `outcome.md` whose Merged line is `<day>, <hash>`; `gone` leaves its ticket.md out.
function project(tickets: readonly Ticket[]): string {
	const root = temporaryFolder();
	const write = (path: string, text: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	};
	for (const { id, kind, merged, gone } of tickets) {
		const goal = kind === undefined ? "We are after a shop." : `We are after a shop.\n\n- Kind: ${kind}`;
		if (gone !== true) write(`spec/features/${id}-x/ticket.md`, `# ${id} - Title of ${id}\n\n## Description\n\n- Kind: bug\n\n## Goal\n\n${goal}\n\n## Done means\n\n- Kind: bug\n`);
		if (merged !== undefined) write(`spec/features/${id}-x/outcome.md`, `# ${id} - Outcome\n\n- Merged: ${merged}\`\n- Branch: arthur/x\n`);
	}
	const board = tickets.map(({ id, status, updated }) => ({ id, title: `Title of ${id}`, status, path: `spec/features/${id}-x/ticket.md`, updated: updated ?? "2026-01-01T00:00:00Z" }));
	write("spec/build.json", JSON.stringify(board));
	return root;
}

// `arthur changelog` as the CLI runs it, a throw rejecting; `acme` the main project, Pacific/Auckland the clock's time zone.
async function load(t: TestContext, acme: string, beta = project([])) {
	const fake = fakeHost({ name: "delivery", timeZone: "Pacific/Auckland" });
	fake.provide("projects", () => [{ name: "acme", path: acme, prefix: "AC" }, { name: "beta", path: beta, prefix: "BE" }]);
	await fake.setup(delivery());
	const command = fake.commands.find((each) => each.name === "changelog");
	return async (args: readonly string[] = [], name?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => command?.run({ args, project: name })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
}

test("no merged ticket: the head and one line; wrong usage and an unknown project write nothing", async (t) => {
	const acme = project([{ id: "AC0001", status: "in-progress" }, { id: "AC0002", status: "dropped" }]);
	const run = await load(t, acme);
	assert.deepEqual(await run(["now"]), { code: 2, out: "", err: "usage: arthur changelog [--project <name>]" });
	await assert.rejects(run([], "nope"), /unknown project nope; projects: acme, beta/);
	assert.equal(existsSync(join(acme, "CHANGELOG.md")), false);
	assert.deepEqual(await run(), { code: 0, out: "wrote CHANGELOG.md: 0 merged tickets", err: "" });
	assert.equal(readFileSync(join(acme, "CHANGELOG.md"), "utf8"), `${HEAD}\nNo merged ticket yet.\n`);
});

test("by day, newest first, then by kind; a ticket without a kind, with an old one or any other, or without its ticket.md is Other; two runs write the same bytes", async (t) => {
	// The board in no order: the changelog's comes from the ids and the days only.
	const acme = project([
		{ id: "AC10000", status: "merged", kind: "fix", merged: "2026-01-03, `aaa1111" },
		{ id: "AC0005", status: "merged", kind: "refactor", merged: "2026-01-02, `bbb2222" },
		{ id: "AC0002", status: "merged", merged: "2026-01-03, `ccc3333" },
		{ id: "AC0009", status: "merged", kind: "feat", merged: "2026-01-03, `ddd4444" },
		{ id: "AC9999", status: "merged", kind: "security", merged: "2026-01-03, `eee5555" },
		{ id: "AC0001", status: "merged", kind: "docs", merged: "2026-01-02, `fff6666" },
		// No outcome.md: the day of its last move on the board, 20:00 UTC being the next day in Auckland.
		{ id: "AC0003", status: "merged", kind: "bug", updated: "2026-01-01T20:00:00Z" },
		{ id: "AC0004", status: "merged", kind: "toString", merged: "2026-01-02, `abc0004" },
		{ id: "AC0006", status: "merged", kind: "fix", merged: "2026-01-02, `abc0006", gone: true },
		{ id: "AC0007", status: "done", kind: "feat" },
		{ id: "AC0008", status: "dropped", kind: "feat" },
	]);
	const run = await load(t, acme);
	writeFileSync(join(acme, "CHANGELOG.md"), "# Changelog\n\nEdited by hand.\n");
	assert.deepEqual(await run(), { code: 0, out: "wrote CHANGELOG.md: 9 merged tickets", err: "" });
	const first = readFileSync(join(acme, "CHANGELOG.md"), "utf8");
	assert.equal(
		first,
		[
			HEAD,
			"## 2026-01-03\n\n### Added\n\n- AC0009 Title of AC0009 (ddd4444)\n\n### Fixed\n\n- AC9999 Title of AC9999 (eee5555)\n- AC10000 Title of AC10000 (aaa1111)\n\n### Other\n\n- AC0002 Title of AC0002 (ccc3333)\n",
			"## 2026-01-02\n\n### Changed\n\n- AC0001 Title of AC0001 (fff6666)\n- AC0005 Title of AC0005 (bbb2222)\n\n### Other\n\n- AC0003 Title of AC0003\n- AC0004 Title of AC0004 (abc0004)\n- AC0006 Title of AC0006 (abc0006)\n",
		].join("\n"),
	);
	await run();
	assert.equal(readFileSync(join(acme, "CHANGELOG.md"), "utf8"), first, "the same bytes again");
});

test("--project writes that project's CHANGELOG.md from its own board, the main one's left alone", async (t) => {
	const acme = project([{ id: "AC0001", status: "merged", kind: "feat", merged: "2026-01-02, `aaa1111" }]);
	const beta = project([{ id: "BE0001", status: "merged", kind: "fix", merged: "2026-01-04, `bbb2222" }]);
	const run = await load(t, acme, beta);
	assert.deepEqual(await run([], "beta"), { code: 0, out: "wrote CHANGELOG.md: 1 merged ticket", err: "" });
	assert.equal(readFileSync(join(beta, "CHANGELOG.md"), "utf8"), `${HEAD}\n## 2026-01-04\n\n### Fixed\n\n- BE0001 Title of BE0001 (bbb2222)\n`);
	assert.equal(existsSync(join(acme, "CHANGELOG.md")), false);
});

// A Git history in `root`: each step writes its files and commits them on main at its time (UTC), or with `branch` commits them
// there and merges it into main with --no-ff at that time; returns each step's commit on main, short.
type Step = { readonly at: string; readonly files: Readonly<Record<string, string>>; readonly branch?: true };
function history(root: string, steps: readonly Step[]): string[] {
	const git = (at: string, ...args: string[]) => {
		const env = { ...process.env, GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at };
		return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", root, ...args], { encoding: "utf8", env }).trim();
	};
	git(steps[0]?.at ?? "", "init", "--quiet", "--initial-branch=main");
	return steps.map(({ at, files, branch }) => {
		if (branch) git(at, "checkout", "--quiet", "-b", "side");
		for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
		git(at, "add", "--all");
		git(at, "commit", "--quiet", "--allow-empty", "-m", at);
		if (branch) git(at, "checkout", "--quiet", "main"), git(at, "merge", "--quiet", "--no-ff", "-m", "Merge side", "side"), git(at, "branch", "--quiet", "-D", "side");
		return git(at, "rev-parse", "--short", "HEAD");
	});
}

const pkg = (version: string, more = {}) => `${JSON.stringify({ name: "acme", version, ...more })}\n`;
const outcome = (root: string, id: string, merged: string) => writeFileSync(join(root, `spec/features/${id}-x/outcome.md`), `# ${id} - Outcome\n\n- Merged: ${merged}\`\n`);

test("releases: a commit of main's first-parent line that changes the root version; each ticket under the first at or after its merge, by day without it", async (t) => {
	const ids = [["AC0001", "feat"], ["AC0002", "chore"], ["AC0003", "fix"], ["AC0005", "feat"], ["AC0006"], ["AC0007"], ["AC0008", undefined, "2026-02-03T12:00:00Z"]] as const;
	// No outcome.md: AC0006 merged before any release, AC0008 on the day of two, 2026-02-04 in Auckland, under the first of them.
	const acme = project(ids.map(([id, kind, updated]) => ({ id, status: "merged", kind, updated: updated ?? "2026-01-31T00:00:00Z" })));
	const [, , ac1, ac2, ac3, , , ac5] = history(acme, [
		{ at: "2026-02-01T00:00:00Z", files: { "README.md": "# acme\n" } },
		// A version that appears, where there was none, is no release.
		{ at: "2026-02-01T01:00:00Z", files: { "package.json": pkg("0.1.0") } },
		{ at: "2026-02-01T02:00:00Z", files: { "a.ts": "1\n" } },
		// The release ticket's own merge: a release; the branch's commit under it, off the first-parent line, is none.
		{ at: "2026-02-02T00:00:00Z", files: { "package.json": pkg("0.2.0") }, branch: true },
		{ at: "2026-02-03T00:00:00Z", files: { "package.json": pkg("0.2.0", { description: "A shop" }) } },
		// 20:00 UTC is the next day in Auckland, the clock's time zone.
		{ at: "2026-02-03T20:00:00Z", files: { "package.json": pkg("0.3.0") } },
		{ at: "2026-02-04T00:00:00Z", files: { "package.json": pkg("0.3.1") } },
		{ at: "2026-02-05T00:00:00Z", files: { "a.ts": "2\n" } },
	]);
	for (const [id, merged] of [["AC0001", `2026-02-01, \`${ac1}`], ["AC0002", `2026-02-02, \`${ac2}`], ["AC0003", `2026-02-03, \`${ac3}`], ["AC0005", `2026-02-05, \`${ac5}`], ["AC0007", "2026-02-06, `0000000"]] as const) outcome(acme, id, merged);
	const run = await load(t, acme);
	assert.deepEqual(await run(), { code: 0, out: "wrote CHANGELOG.md: 7 merged tickets", err: "" });
	const unreleased = `## Unreleased\n\n### 2026-02-06\n\n#### Other\n\n- AC0007 Title of AC0007 (0000000)\n\n### 2026-02-05\n\n#### Added\n\n- AC0005 Title of AC0005 (${ac5})\n`;
	const old = `### 2026-02-02\n\n#### Changed\n\n- AC0002 Title of AC0002 (${ac2})\n\n### 2026-02-01\n\n#### Added\n\n- AC0001 Title of AC0001 (${ac1})\n\n### 2026-01-31\n\n#### Other\n\n- AC0006 Title of AC0006\n`;
	const at030 = `### 2026-02-04\n\n#### Other\n\n- AC0008 Title of AC0008\n\n### 2026-02-03\n\n#### Fixed\n\n- AC0003 Title of AC0003 (${ac3})\n`;
	const releases = ["## 0.3.1 (2026-02-04)\n\nNo merged ticket in this release.\n", `## 0.3.0 (2026-02-04)\n\n${at030}`, `## 0.2.0 (2026-02-02)\n\n${old}`];
	assert.equal(readFileSync(join(acme, "CHANGELOG.md"), "utf8"), [HEAD, unreleased, ...releases].join("\n"));
});

// AR0699: release 0.1.0 was tagged by hand on the merge where package.json first got a version, which no version change counts.
test("a v<x.y.z> tag on the first-parent line, lightweight or annotated, is that version's release at its commit; a version a change made, a tag off the line or of another name, is not", async (t) => {
	const acme = project(["AC0001", "AC0002", "AC0003", "AC0004", "AC0005"].map((id) => ({ id, status: "merged", kind: "fix" })));
	const steps = history(acme, [
		{ at: "2026-03-01T00:00:00Z", files: { "README.md": "# acme\n" } },
		{ at: "2026-03-02T00:00:00Z", files: { "package.json": pkg("0.1.0") }, branch: true },
		{ at: "2026-03-03T00:00:00Z", files: { "a.ts": "1\n" } },
		{ at: "2026-03-04T00:00:00Z", files: { "b.ts": "1\n" }, branch: true },
		{ at: "2026-03-05T00:00:00Z", files: { "package.json": pkg("0.4.0") } },
		{ at: "2026-03-06T00:00:00Z", files: { "c.ts": "1\n" } },
	]);
	const [, s1 = "", s2 = "", s3 = "", s4 = "", s5 = ""] = steps;
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", acme, ...args], { encoding: "utf8" }).trim();
	git("tag", "v0.1.0", s1);
	git("tag", "--annotate", "--message", "0.2.0", "v0.2.0", s2);
	git("tag", "v0.3.0", `${s3}^2`);
	for (const tag of ["v0.4.0", "v1.0", "v1.0.0-rc.1", "vnext", "v1.0.0x"]) git("tag", tag, s5);
	for (const [id, step, day] of [["AC0001", s1, "02"], ["AC0002", s2, "03"], ["AC0003", s3, "04"], ["AC0004", s4, "05"], ["AC0005", s5, "06"]]) outcome(acme, id ?? "", `2026-03-${day}, \`${step}`);
	// `arthur changelog` counts the tags the checkout has; only a merge fetches origin's: its v0.9.0 is no release here.
	const origin = join(temporaryFolder(), "origin.git");
	git("init", "--quiet", "--bare", origin);
	git("push", "--quiet", origin, "main", `${s5}:refs/tags/v0.9.0`);
	git("remote", "add", "origin", origin);
	const run = await load(t, acme);
	assert.deepEqual(await run(), { code: 0, out: "wrote CHANGELOG.md: 5 merged tickets", err: "" });
	const fixed = (id: string, step: string, day: string) => `### 2026-03-${day}\n\n#### Fixed\n\n- ${id} Title of ${id} (${step})\n`;
	assert.equal(
		readFileSync(join(acme, "CHANGELOG.md"), "utf8"),
		[
			HEAD,
			`## Unreleased\n\n${fixed("AC0005", s5, "06")}`,
			// The tag off the line counts as none: AC0003 goes to the next release; the tag v0.4.0 is not a second 0.4.0.
			`## 0.4.0 (2026-03-05)\n\n${fixed("AC0004", s4, "05")}\n${fixed("AC0003", s3, "04")}`,
			`## 0.2.0 (2026-03-03)\n\n${fixed("AC0002", s2, "03")}`,
			`## 0.1.0 (2026-03-02)\n\n${fixed("AC0001", s1, "02")}`,
		].join("\n"),
	);
});

test("a project whose root version never changed gets the CHANGELOG.md it got without Git, byte for byte; so does a package.json broken by hand, and a commit replaced (refs/replace)", async (t) => {
	const acme = project([{ id: "AC0001", status: "merged", kind: "feat", merged: "2026-02-02, `aaa1111" }, { id: "AC0002", status: "merged", kind: "fix", updated: "2026-02-03T00:00:00Z" }]);
	const run = await load(t, acme);
	await run();
	const before = readFileSync(join(acme, "CHANGELOG.md"), "utf8");
	const [first, second] = history(acme, [
		{ at: "2026-02-01T00:00:00Z", files: { "package.json": pkg("1.0.0") } },
		{ at: "2026-02-02T00:00:00Z", files: { "package.json": pkg("1.0.0", { description: "A shop" }) } },
		{ at: "2026-02-03T00:00:00Z", files: { "package.json": "{ broken" } },
		{ at: "2026-02-04T00:00:00Z", files: { "package.json": pkg("1.0.1") } },
	]);
	// A replacement of the second commit by one that changes the version, as a job's program may plant one: Git's own history is read.
	const git = (input: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", acme, ...args], { encoding: "utf8", input }).trim();
	const blob = git(pkg("2.0.0"), "hash-object", "-w", "--stdin");
	git("", "replace", second ?? "", git("", "commit-tree", "-p", first ?? "", "-m", "planted", git(`100644 blob ${blob}\tpackage.json\n`, "mktree")));
	await run();
	assert.equal(readFileSync(join(acme, "CHANGELOG.md"), "utf8"), before);
});
