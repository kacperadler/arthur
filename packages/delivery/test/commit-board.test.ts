import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { takeLock } from "@arthur/core/lock";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";
import { fakeNpm } from "./fake-npm.ts";
import { noIdentityAnywhere, plantAfterCheck } from "./merge-setup.ts";

// arthur commit-board and `delivery.commit` (AR0738): what a commit of the board holds, what it leaves alone, and each refusal.

// Git's output with its leading blanks kept: a status line starts with one.
const git = (at: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", at, ...args], { encoding: "utf8" }).trimEnd();
const write = (root: string, files: Readonly<Record<string, string>>) => {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
};
const status = (root: string) => git(root, "status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean).sort();
const TICKET = "spec/features/AC0001-shop/ticket.md";
const FIRST = { "README.md": "# acme\n", "src.ts": "export const shop = 1;\n", "spec/build.json": "[]\n", "spec/vision.md": "# Vision\n", [TICKET]: "# AC0001 - Shop\n" };

// The repository `acme` (the main project) with `files` in its first commit, `blog`, a repository with no commit, and `plain`, a
// folder that is no repository; delivery with `options` on a fake host, a fake `npm` (fake-npm.ts) after `nvm` on the PATH `nvm.path`
// answers, no PATH ("") without `onNvm`; `run` runs `arthur commit-board` as the CLI does, a throw being `arthur commit-board: <message>` and exit code 1,
// without the lines a host with no user manager or sandbox adds.
async function load(t: TestContext, files: Readonly<Record<string, string>> = FIRST, options: Parameters<typeof delivery>[0] = {}, onNvm = true) {
	const [root, blog, plain, bin, nvm] = [join(temporaryFolder(), "acme"), join(temporaryFolder(), "blog"), temporaryFolder(), temporaryFolder(), temporaryFolder()];
	for (const each of [root, blog]) {
		mkdirSync(each);
		git(each, "init", "--quiet", "--initial-branch=main");
		for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.com"]] as const) git(each, "config", key, value);
	}
	write(root, files);
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	const fake = fakeHost({ name: "delivery", root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }, { name: "blog", path: blog, prefix: "BL" }, { name: "plain", path: plain, prefix: "PL" }]);
	const npm = fakeNpm(bin);
	fake.provide("nvm.path", () => (onNvm ? [nvm, bin, process.env.PATH].join(delimiter) : ""));
	await fake.setup(delivery(options));
	const run = async (args: readonly string[], project?: string) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => void (/^(uncapped|no sandbox): /.test(text) || out.push(text)));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === "commit-board")?.run({ args, project })).catch((error: Error) => (err.push(`arthur commit-board: ${error.message}`), 1));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n") };
	};
	const head = (at = root) => git(at, "rev-parse", "HEAD");
	const shown = (at = root) => git(at, "show", "--no-renames", "--name-status", "--format=%s", "HEAD").split("\n").filter(Boolean);
	return { root, blog, plain, nvm, fake, npm, run, head, shown };
}

test("commit-board commits every changed board file, new, changed and deleted, and nothing else: what else is staged or changed stays as it was", async (t) => {
	const first = { "spec/roadmap.md": "# Roadmap\n", "spec/features/AC0001-shop/review-1.md": "# Review\n", "spec/quality/2026-01-01.md": "# Audit\n", "spec/retro/2026-01-01.md": "# Retro\n\nA report long enough to be told as renamed.\n" };
	const { root, fake, npm, run, head, shown } = await load(t, { ...FIRST, ...first });
	const board = {
		"spec/build.json": '[{ "id": "AC0002" }]\n',
		"spec/decisions.jsonl": "{}\n",
		"spec/schedule.json": "[]\n",
		"CHANGELOG.md": "# Changelog\n",
		[TICKET]: "# AC0001 - Shop\n\n## Decisions\n",
		"spec/features/AC0002-cart/ticket.md": "# AC0002 - Cart\n",
		"spec/features/AC0002-cart/notes/deep.md": "# Notes\n",
		"spec/quality/2026-01-02.md": "# Audit\n",
		"spec/retro/2026-01-02.md": "# Retro\n",
		"spec/retro/2026-01-02.html": "<p>Retro</p>\n",
		"spec/pyramid/2026-01-02.md": "# Pyramid\n",
		"spec/pyramid/2026-01-02.html": "<p>Pyramid</p>\n",
	};
	// Not the board's: the owner's files, a ticket's attachment, a page no report has, a file below a report folder, the code.
	const other = { "README.md": "# acme, edited\n", "spec/roadmap.md": "# Roadmap, edited\n", "spec/features/AC0002-cart/shot.png": "png", "spec/other.json": "{}\n", "spec/quality/2026-01-02.html": "<p>Audit</p>\n", "spec/quality/old/2026.md": "# Old\n", "spec/retro/notes.txt": "notes\n" };
	const staged = { "src.ts": "export const shop = 2;\n", "new.ts": "export const cart = 1;\n", "spec/vision.md": "# Vision, edited\n" };
	write(root, { ...board, ...other, ...staged });
	rmSync(join(root, "spec/features/AC0001-shop/review-1.md"));
	// One board file staged before the command, as a `git add` of the coordinator's left it, and one renamed.
	git(root, "add", "--", ...Object.keys(staged), "spec/schedule.json");
	git(root, "mv", "spec/retro/2026-01-01.md", "spec/retro/2026-01-01-2.md");
	const before = head();
	const left = [" M README.md", " M spec/roadmap.md", "?? spec/features/AC0002-cart/shot.png", "?? spec/other.json", "?? spec/quality/2026-01-02.html", "?? spec/quality/old/2026.md", "?? spec/retro/notes.txt", "A  new.ts", "M  spec/vision.md", "M  src.ts"];
	assert.deepEqual(await run(["Board: AC0002 planned"]), { code: undefined, out: `committed Board: AC0002 planned: ${git(root, "rev-parse", "--short", "HEAD")}, 15 files`, err: "" });
	assert.equal(git(root, "rev-parse", "HEAD^"), before, "one commit on top");
	const gone = ["D\tspec/features/AC0001-shop/review-1.md", "D\tspec/retro/2026-01-01.md", "A\tspec/retro/2026-01-01-2.md"];
	const names = [...Object.keys(board).map((path) => `${path === "spec/build.json" || path === TICKET ? "M" : "A"}\t${path}`), ...gone];
	assert.deepEqual(shown().sort(), ["Board: AC0002 planned", ...names].sort());
	assert.deepEqual(status(root), left.sort(), "every other file as it was, the staged ones staged");
	assert.equal(git(root, "diff", "--cached", "--name-only"), "new.ts\nspec/vision.md\nsrc.ts");
	assert.equal(npm(), "", "a project that declares no commit-msg script is committed without one");
	// A second call finds nothing of the board changed: no commit, and no refusal.
	const again = await run(["Board: AC0002 planned"]);
	assert.deepEqual([again.code, again.err, head()], [undefined, "", git(root, "rev-parse", "HEAD")]);
	assert.match(again.out, new RegExp(`^nothing to commit: no file of spec/build\\.json, spec/decisions\\.jsonl, spec/schedule\\.json, CHANGELOG\\.md, spec/features/\\*\\*/\\*\\.md, .*spec/pyramid/\\*\\.html changed in ${root}$`));
	assert.equal(git(root, "rev-list", "--count", "HEAD"), "2");
	assert.deepEqual(readdirSync(fake.host.folder).filter((name) => name.startsWith("cache_")), [], "its cache folder is removed");
});

test("a folder named as a board file is none: no file below it is committed, a repository in a report's place neither; a tracked board file a folder replaced stops the commit", async (t) => {
	const { root, run, head, shown } = await load(t);
	// As a coordinator that writes only spec/ could leave them: code below folders named as the board's plain files and as its globs' own text.
	const below = ["spec/schedule.json/evil_spec.rb", "spec/decisions.jsonl/notes.md", "CHANGELOG.md/src/code.ts", "spec/features/**/*.md/evil.rb", "spec/quality/*.md/evil.rb", "spec/features/AC0001-shop/x.md/evil.rb"];
	write(root, Object.fromEntries(below.map((path) => [path, "code\n"])));
	const nested = join(root, "spec/retro/2026-01-01.md");
	mkdirSync(nested, { recursive: true });
	git(nested, "init", "--quiet");
	git(nested, "commit", "--quiet", "--allow-empty", "-m", "nested");
	const [before, dirty] = [head(), status(root)];
	const nothing = await run(["Board: nothing"]);
	assert.deepEqual([nothing.code, nothing.err, head(), status(root)], [undefined, "", before, dirty]);
	assert.match(nothing.out, /^nothing to commit: no file of spec\/build\.json, /);
	// The board itself a folder now: its removal is not committed, nor the ticket beside it; put back, the ticket goes in alone.
	rmSync(join(root, "spec/build.json"));
	write(root, { [TICKET]: "# AC0001 - Shop\n\n## Decisions\n", "spec/build.json/evil.rb": "code\n" });
	const replaced = status(root);
	assert.deepEqual(await run(["Board: a ticket"]), { code: 1, out: "", err: "arthur commit-board: spec/build.json: a symlink or a folder, which this commit never holds; remove it; nothing committed" });
	assert.deepEqual([head(), status(root)], [before, replaced]);
	rmSync(join(root, "spec/build.json"), { recursive: true });
	git(root, "checkout", "--", "spec/build.json");
	assert.deepEqual(await run(["Board: a ticket"]), { code: undefined, out: `committed Board: a ticket: ${git(root, "rev-parse", "--short", "HEAD")}, 1 file`, err: "" });
	assert.deepEqual([shown(), status(root)], [["Board: a ticket", `M\t${TICKET}`], dirty]);
});

test("a symlink among the changed board files stops the whole commit, nothing staged; once it is gone the commit goes in, a tracked symlink's removal with it", async (t) => {
	const { root, run, head, shown } = await load(t);
	symlinkSync("ticket.md", join(root, "spec/features/AC0001-shop/old.md"));
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "a link the owner committed");
	const before = head();
	const refused = (path: string) => ({ code: 1, out: "", err: `arthur commit-board: ${path}: a symlink or a folder, which this commit never holds; remove it; nothing committed` });
	// A new link to a file, a link to nothing, and the board itself replaced by a link to a file with a board in it.
	const links: Readonly<Record<string, string>> = { "spec/features/AC0001-shop/plan.md": "../../../README.md", "spec/features/AC0001-shop/gone.md": "nowhere.md", "spec/build.json": "../board.json" };
	write(root, { "board.json": "[]\n", "spec/decisions.jsonl": "{}\n" });
	for (const [path, target] of Object.entries(links)) {
		rmSync(join(root, path), { force: true });
		symlinkSync(target, join(root, path));
		const dirty = status(root);
		assert.deepEqual(await run(["Board: a link"]), refused(path), path);
		assert.deepEqual([head(), status(root)], [before, dirty], `${path}: nothing committed, nothing staged, the log beside it neither`);
		rmSync(join(root, path));
		if (path === "spec/build.json") git(root, "checkout", "--", path);
	}
	rmSync(join(root, "spec/features/AC0001-shop/old.md"));
	assert.equal((await run(["Board: the log"])).err, "");
	assert.deepEqual(shown().sort(), ["A\tspec/decisions.jsonl", "Board: the log", "D\tspec/features/AC0001-shop/old.md"]);
	assert.deepEqual(status(root), ["?? board.json"]);
});

test("a checkout whose own Git config names a program is refused before any git call that could run it, nothing committed or staged", async (t) => {
	const { root, run, head } = await load(t);
	write(root, { "spec/decisions.jsonl": "{}\n" });
	git(root, "config", "filter.x.smudge", "cat");
	const before = head();
	const refused = await run(["Decisions: AC-D1 asked"]);
	assert.deepEqual([refused.code, refused.out], [1, ""]);
	assert.match(refused.err, /^arthur commit-board: .*\.git\/config sets filter\.x\.smudge, which a job can write and which may name a program Arthur's git would run; .*; nothing committed$/);
	assert.deepEqual([head(), status(root)], [before, ["?? spec/decisions.jsonl"]]);
	git(root, "config", "--unset", "filter.x.smudge");
	// core.fsmonitor passes the check, as each git call turns it off: the program it names does not run.
	const [ran, monitor] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "fsmonitor")];
	writeFileSync(monitor, `#!/bin/sh\necho fsmonitor >> '${ran}'\nprintf 'token\\0/\\0'\n`, { mode: 0o755 });
	git(root, "config", "core.fsmonitor", monitor);
	assert.equal((await run(["Decisions: AC-D1 asked"])).err, "");
	assert.equal(existsSync(ran), false, "the fsmonitor did not run");
	assert.equal(git(root, "log", "-1", "--format=%s"), "Decisions: AC-D1 asked");
	git(root, "status");
	assert.equal(existsSync(ran), true, "a plain git status runs it");
});

test("the project's commit-msg script checks the commit first, on nvm's PATH, the hooks off: its refusal leaves the files uncommitted and unstaged", async (t) => {
	// The project's own check, as its commit-msg hook: the PATH nvm answers, the subject in the file it is handed, then each staged file naming web-shop refused.
	const nvm = (folder: string) => `process.env.PATH.split(${JSON.stringify(delimiter)}).includes(${JSON.stringify(folder)})`;
	const vet = (folder: string) =>
		`const { spawnSync } = require("node:child_process");\nconst fs = require("node:fs");\nif (!${nvm(folder)}) { console.error("not nvm's PATH"); process.exit(1); }\nif (fs.readFileSync(process.argv[2], "utf8") !== "Decisions: AC-D1 asked\\n") { console.error("not the message"); process.exit(1); }\nconst named = spawnSync("git", ["grep", "--cached", "-l", "-F", "-e", ["web", "shop"].join("-")], { encoding: "utf8" }).stdout.trim().split("\\n").filter(Boolean);\nfor (const file of named) console.error(\`commit refused: \${file}: names the project\`);\nprocess.exit(named.length > 0 ? 1 : 0);\n`;
	const { root, fake, nvm: folder, npm, run, head, shown } = await load(t, { ...FIRST, "package.json": JSON.stringify({ scripts: { "commit-msg": "node vet.js" } }) });
	write(root, { "vet.js": vet(folder) });
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "the check");
	const ran = join(temporaryFolder(), "ran");
	for (const name of ["pre-commit", "commit-msg", "post-commit"]) writeFileSync(join(root, ".git/hooks", name), `#!/bin/sh\necho ${name} >> '${ran}'\n`, { mode: 0o755 });
	write(root, { "spec/decisions.jsonl": '{ "question": "Deploy web-shop?" }\n', [TICKET]: "# AC0001 - Shop\n\n## Decisions\n" });
	const [before, dirty] = [head(), status(root)];
	const why = "; fix what it names, then run it again";
	assert.deepEqual(await run(["Decisions: AC-D1 asked"]), { code: 1, out: "", err: `arthur commit-board: Decisions: AC-D1 asked not committed: npm run commit-msg refused: commit refused: spec/decisions.jsonl: names the project${why}` });
	assert.deepEqual([head(), status(root)], [before, dirty], "nothing committed, nothing left staged");
	write(root, { "spec/decisions.jsonl": '{ "question": "Deploy the shop?" }\n' });
	assert.deepEqual(await run(["WIP"]), { code: 1, out: "", err: `arthur commit-board: WIP not committed: npm run commit-msg refused: not the message${why}` }, "the script reads the subject");
	assert.deepEqual([head(), status(root)], [before, dirty]);
	// A path another plugin names that starts with a dash is a path to every git call, and unstaged again after the refusal.
	write(root, { "-x.md": "# x\n" });
	assert.throws(() => fake.host.call("delivery.commit", { project: "acme", subject: "WIP", paths: ["-x.md"] }), /^Error: WIP not committed: npm run commit-msg refused: not the message; /);
	assert.deepEqual(status(root), [...dirty, "?? -x.md"].sort());
	rmSync(join(root, "-x.md"));
	assert.equal((await run(["Decisions: AC-D1 asked"])).err, "", "the refusals released the lock");
	assert.deepEqual(shown().sort(), ["A\tspec/decisions.jsonl", "Decisions: AC-D1 asked", `M\t${TICKET}`]);
	assert.equal(npm().split("\n").filter((line) => line.startsWith("run --silent commit-msg -- ")).length, 4, "the script ran once a call");
	assert.equal(existsSync(ran), false, "no hook of the checkout ran");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "control");
	assert.equal(existsSync(ran), true, "a plain git commit runs them");
});

test("while a merge holds main, commit-board is refused and stages nothing; after it the commit goes in", async (t) => {
	const { root, fake, run, head } = await load(t);
	write(root, { "spec/decisions.jsonl": "{}\n" });
	mkdirSync(join(fake.host.folder, "acme"), { recursive: true });
	const lock = takeLock(join(fake.host.folder, "acme", "merge.lock"));
	assert.ok("release" in lock);
	const before = head();
	assert.deepEqual(await run(["Decisions: AC-D1 asked"]), { code: 1, out: "", err: `arthur commit-board: main of acme is held by pid ${process.pid}, a merge or another commit; nothing committed: run it again once that ended` });
	assert.deepEqual([head(), status(root)], [before, ["?? spec/decisions.jsonl"]]);
	lock.release();
	assert.equal((await run(["Decisions: AC-D1 asked"])).err, "");
	assert.notEqual(head(), before);
	assert.equal(existsSync(join(fake.host.folder, "acme", "merge.lock")), false, "its own hold of the lock ends with it");
});

test("commit-board takes one subject, for the main project or the one --project names; anything else is wrong usage, an unknown project or no repository", async (t) => {
	const { root, blog, plain, run, head, shown } = await load(t);
	write(root, { "spec/decisions.jsonl": "{}\n" });
	write(blog, { "spec/build.json": "[]\n", "README.md": "# blog\n" });
	const before = head();
	const usage = "usage: arthur commit-board '<subject>' [--project <name>]";
	assert.deepEqual(await run([]), { code: 2, out: "", err: `arthur commit-board: no subject\n${usage}` });
	assert.deepEqual(await run([" \n"]), { code: 2, out: "", err: `arthur commit-board: no subject\n${usage}` });
	assert.deepEqual(await run(["Board:", "moved"]), { code: 2, out: "", err: `arthur commit-board: one subject; got 2 words\n${usage}` });
	assert.deepEqual(await run(["--amend"]), { code: 2, out: "", err: `arthur commit-board: unknown flag --amend\n${usage}` });
	assert.deepEqual(await run(["Board: moved"], "nope"), { code: 1, out: "", err: "arthur commit-board: no project nope in the project list" });
	assert.deepEqual(await run(["Board: moved"], "plain"), { code: 1, out: "", err: `arthur commit-board: git status in ${plain} failed: fatal: not a git repository (or any of the parent directories): .git; nothing committed` });
	assert.deepEqual([head(), status(root)], [before, ["?? spec/decisions.jsonl"]]);
	// The other project's board, in a repository with no commit yet; the main project's stays uncommitted.
	assert.match((await run(["Board: first"], "blog")).out, /^committed Board: first: \w+, 1 file$/);
	assert.deepEqual([shown(blog), status(blog), status(root)], [["Board: first", "A\tspec/build.json"], ["?? README.md"], ["?? spec/decisions.jsonl"]]);
});

test("delivery.commit commits the paths another plugin names, as arthur init's, in a repository with no commit; an unknown project throws", async (t) => {
	const { blog, fake, shown } = await load(t);
	const paths = [".nvmrc", ".agents/arthur/criteria/styleguide.md", "spec/vision.md", "spec/build.json", "-x.md"];
	write(blog, { ...Object.fromEntries(paths.map((path) => [path, "text\n"])), "README.md": "# blog\n" });
	const commit = (project: string) => fake.host.call<string>("delivery.commit", { project, subject: "chore: arthur init", paths });
	assert.match(commit("blog"), /^committed chore: arthur init: \w+, 5 files$/);
	assert.deepEqual(shown(blog).sort(), ["chore: arthur init", ...paths.map((path) => `A\t${path}`)].sort());
	assert.deepEqual(status(blog), ["?? README.md"]);
	assert.equal(commit("blog"), `nothing to commit: no file of ${paths.join(", ")} changed in ${blog}`);
	assert.throws(() => commit("nope"), /^Error: no project nope in the project list$/);
});

test("of the paths another plugin names, a file is committed only when its path is one of them or a glob matches it whole: no file below a folder named so", async (t) => {
	const { blog, fake, shown } = await load(t);
	const paths = ["sub", "docs", "top.txt", ":(glob)docs/*.md", ":(glob)docs/**/*.txt"];
	const named = ["top.txt", "docs/a.md", "docs/.b.md", "docs/c.txt", "docs/deep/er/c.txt", "docs/line\nbreak/c.txt"];
	// Each listed by Git below `sub` or `docs`: a `*` that would cross a slash, a glob matched in part at either end, a dot read as any character.
	const left = ["docs/deep/a.md", "docs/a.md.bak", "sub/docs/a.md", "docs/axmd", "sub/top.txt"];
	write(blog, Object.fromEntries([...named, ...left].map((path) => [path, "text\n"])));
	assert.match(fake.host.call<string>("delivery.commit", { project: "blog", subject: "docs: first", paths }), /^committed docs: first: \w+, 6 files$/);
	// Git quotes the path with a line break in it.
	assert.deepEqual(shown(blog).sort(), ["docs: first", ...named.map((path) => `A\t${path.includes("\n") ? JSON.stringify(path) : path}`)].sort());
	assert.deepEqual(status(blog), left.map((path) => `?? ${path}`).sort());
});

test("with nvm.path answering no PATH the commit-msg script runs on the PATH as it is; one that removes the command's cache folder does not fail the commit", async (t) => {
	const { root, fake, run, shown } = await load(t, FIRST, {}, false);
	// The real npm, as the PATH of the tests holds it.
	write(root, { "package.json": JSON.stringify({ scripts: { "commit-msg": `rm -rf '${fake.host.folder}'/cache_* #` } }) });
	git(root, "add", "package.json");
	git(root, "commit", "--quiet", "-m", "the check");
	write(root, { "spec/decisions.jsonl": "{}\n" });
	assert.deepEqual(await run(["Decisions: AC-D1 asked"]), { code: undefined, out: `committed Decisions: AC-D1 asked: ${git(root, "rev-parse", "--short", "HEAD")}, 1 file`, err: "" });
	assert.deepEqual(shown(), ["Decisions: AC-D1 asked", "A\tspec/decisions.jsonl"]);
});

test("a commit Git itself refuses, no identity anywhere, is said with the last line Git wrote and leaves nothing staged", async (t) => {
	const { root, run, head } = await load(t);
	noIdentityAnywhere(t);
	for (const key of ["user.name", "user.email"]) git(root, "config", "--unset", key);
	write(root, { "spec/decisions.jsonl": "{}\n", [TICKET]: "# AC0001 - Shop\n\n## Decisions\n" });
	const [before, dirty] = [head(), status(root)];
	const refused = await run(["Decisions: AC-D1 asked"]);
	assert.deepEqual([refused.code, refused.out], [1, ""]);
	assert.match(refused.err, /^arthur commit-board: Decisions: AC-D1 asked not committed: fatal: .+; fix what it names, then run it again$/);
	assert.deepEqual([head(), status(root)], [before, dirty], "nothing committed, nothing left staged");
});

test("a check that throws, a package.json at HEAD that is no JSON, stops the commit as a refusal does: nothing committed, nothing left staged", async (t) => {
	const { root, run, head } = await load(t, { ...FIRST, "package.json": "{" });
	write(root, { "spec/decisions.jsonl": "{}\n", [TICKET]: "# AC0001 - Shop\n\n## Decisions\n" });
	const [before, dirty] = [head(), status(root)];
	const refused = await run(["Decisions: AC-D1 asked"]);
	assert.deepEqual([refused.code, refused.out, refused.err.startsWith("arthur commit-board: ")], [1, "", true]);
	assert.deepEqual([head(), status(root)], [before, dirty]);
});

test("the commit-msg script is killed after merge.stepSeconds, as a step of a merge is, and the commit refused", async (t) => {
	const { root, run, head } = await load(t, { ...FIRST, "package.json": JSON.stringify({ scripts: { "commit-msg": "sleep 10 #" } }) }, { merge: { stepSeconds: 1 } });
	write(root, { "spec/decisions.jsonl": "{}\n" });
	const before = head();
	const err = "arthur commit-board: Decisions: AC-D1 asked not committed: npm run commit-msg refused: timed out after 1 s; fix what it names, then run it again";
	assert.deepEqual(await run(["Decisions: AC-D1 asked"]), { code: 1, out: "", err });
	assert.deepEqual([head(), status(root)], [before, ["?? spec/decisions.jsonl"]]);
});

test("a replacement of HEAD that hides the commit-msg script, and a signing program set after the config check, change nothing: the check runs, the commit is unsigned", async (t) => {
	const { root, run, head } = await load(t, { ...FIRST, "package.json": JSON.stringify({ scripts: { "commit-msg": "! grep -q web-shop spec/decisions.jsonl #" } }) });
	// HEAD read through refs/replace, as a job's git replace would leave it, is a commit with no file: no package.json, no script.
	git(root, "replace", head(), git(root, "commit-tree", "-m", "no check", git(root, "hash-object", "-w", "-t", "tree", "/dev/null")));
	write(root, { "spec/decisions.jsonl": '{ "question": "Deploy web-shop?" }\n' });
	const before = head();
	assert.equal((await run(["Decisions: AC-D1 asked"])).err, "arthur commit-board: Decisions: AC-D1 asked not committed: npm run commit-msg refused: exit 1; fix what it names, then run it again");
	assert.equal(head(), before);
	const [ran, program] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "program")];
	writeFileSync(program, `#!/bin/sh\necho program >> '${ran}'\nexit 1\n`, { mode: 0o755 });
	// No commit.gpgSign from the env (a job's sandbox sets one), which Git would read after the repository's config.
	const count = process.env.GIT_CONFIG_COUNT;
	process.env.GIT_CONFIG_COUNT = "0";
	t.after(() => void (count === undefined ? delete process.env.GIT_CONFIG_COUNT : (process.env.GIT_CONFIG_COUNT = count)));
	plantAfterCheck(t, [["commit.gpgSign", "true"], ["gpg.program", program]]);
	write(root, { "spec/decisions.jsonl": "{}\n" });
	assert.equal((await run(["Decisions: AC-D1 asked"])).err, "");
	assert.deepEqual([git(root, "rev-parse", "HEAD^"), git(root, "config", "gpg.program"), existsSync(ran)], [before, program, false], "committed unsigned, the key planted");
});
