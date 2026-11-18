import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { head, topLevel } from "../src/git.ts";
import { temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// A repository with no commit yet, and a folder two levels inside it.
function repository(): { readonly root: string; readonly inside: string } {
	const root = realpathSync(temporaryFolder());
	git(root, "init", "--quiet", "--initial-branch=main");
	mkdirSync(join(root, "a", "b"), { recursive: true });
	return { root, inside: join(root, "a", "b") };
}

test("topLevel is the repository's top folder from any folder in it, and undefined outside Git and for a folder that is missing", () => {
	const { root, inside } = repository();
	const outside = temporaryFolder();
	assert.deepEqual([topLevel(root), topLevel(inside), topLevel(outside), topLevel(join(root, "missing"))], [root, root, undefined, undefined]);
});

test("head is the commit a name names, HEAD when left out, and undefined without a commit, outside Git and for a name that is no commit", () => {
	const { root, inside } = repository();
	assert.deepEqual([head(root), head(root, "main"), head(temporaryFolder())], [undefined, undefined, undefined], "no commit yet, and outside Git");
	writeFileSync(join(inside, "file"), "x\n");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const first = git(root, "rev-parse", "HEAD");
	git(root, "tag", "-a", "-m", "one", "v1");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "second");
	const second = git(root, "rev-parse", "HEAD");
	assert.match(first, /^[0-9a-f]{40}$/);
	assert.notEqual(git(root, "rev-parse", "v1"), first, "an annotated tag is an object of its own");
	assert.deepEqual([head(root), head(inside), head(root, "main"), head(root, "v1"), head(root, first.slice(0, 7)), head(root, "HEAD~1")], [second, second, second, first, first, first]);
	const [tree, blob] = [git(root, "rev-parse", "HEAD^{tree}"), git(root, "rev-parse", "HEAD:a/b/file")];
	const notOne = ["missing", "f".repeat(40), tree, blob, "HEAD~2", "", "--all", "main v1", "v1..main"];
	assert.deepEqual(notOne.map((name) => head(root, name)), notOne.map(() => undefined));
	// A replacement that makes the blob a commit for a plain git is not read.
	git(root, "replace", "-f", blob, second);
	assert.deepEqual([git(root, "rev-parse", "--verify", `${blob}^{commit}`), head(root, blob)], [blob, undefined]);
});

// A `git` first on the PATH that notes each start's arguments in a file and runs the real one; the starts so far, a line each.
function loggedGit(t: TestContext): () => string[] {
	const [bin, was] = [temporaryFolder(), process.env.PATH];
	const log = join(bin, "starts");
	writeFileSync(log, "");
	writeFileSync(join(bin, "git"), `#!/bin/sh\necho "$*" >> '${log}'\nPATH='${was}' exec git "$@"\n`, { mode: 0o755 });
	process.env.PATH = `${bin}:${was}`;
	t.after(() => void (process.env.PATH = was));
	return () => readFileSync(log, "utf8").split("\n").slice(0, -1);
}

test("topLevel and head each start git once, for an answer and for none, a call that runs no hook or fsmonitor and reads no replacement (AR0725)", (t) => {
	const { root } = repository();
	const outside = temporaryFolder();
	const starts = loggedGit(t);
	const hard = "--no-replace-objects -c core.hooksPath=/dev/null -c core.fsmonitor=false";
	// What `ask` answers, then each start of git it made.
	const started = (ask: () => string | undefined) => {
		const before = starts().length;
		return [ask(), ...starts().slice(before)];
	};
	assert.deepEqual(started(() => topLevel(root)), [root, `${hard} -C ${root} rev-parse --show-toplevel`]);
	assert.deepEqual(started(() => topLevel(outside)), [undefined, `${hard} -C ${outside} rev-parse --show-toplevel`]);
	assert.deepEqual(started(() => head(root)), [undefined, `${hard} -C ${root} rev-parse --verify HEAD^{commit}`]);
	git(root, "commit", "--quiet", "--allow-empty", "-m", "first");
	const commit = git(root, "rev-parse", "HEAD");
	assert.deepEqual(started(() => head(root, "main")), [commit, `${hard} -C ${root} rev-parse --verify main^{commit}`]);
});
