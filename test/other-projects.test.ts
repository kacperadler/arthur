import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { headMessages, namings, otherProjects } from "./other-projects.ts";

const ROOT = join(import.meta.dirname, "..");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
// Outside a job, whatever this process's ARTHUR_JOB: the kit clears it, so this only spells it out.
const NO_JOB = { ...process.env, ARTHUR_JOB: "" };
// The ARTHUR_JOB this process started with, which the kit cleared: in a job's sandbox, where the configs of projects/ do not load,
// the real checkout's check learns their prefixes from that job's home (Linux's /proc; none elsewhere).
const STARTED = existsSync("/proc/self/environ") ? /(?:^|\0)ARTHUR_JOB=([^\0]*)/.exec(readFileSync("/proc/self/environ", "utf8"))?.[1] : undefined;
// A null piece too: the file is hand-edited, and the check reads it before the projects plugin refuses it.
const config = (prefix: string) => `export default [{ github: { workflow: "ci.yml" } }, null, { projects: { prefix: "${prefix}", path: "../.." } }];\n`;
// Ids no project of the fixtures has: Arthur's own, the other fixture prefixes', too short, inside a longer word, lowercase.
const PASS = "AR0001 AR-D1 AC0001 SH-D2 DM0003 BL-D4 WS015 XWS0150 WS0150a ws0150 WS-D\n";

// A main checkout with `projects/` beside its `.git`, git-ignored as Arthur's: `arthur`, the made-up `Web.Shop` (prefix WS), and a file.
function checkout(files: Readonly<Record<string, string>>): string {
	const root = join(temporaryFolder(), "main");
	const projects = { "projects/arthur/project.config.ts": config("AR"), "projects/Web.Shop/project.config.ts": config("WS"), "projects/notes.md": "" };
	for (const [path, text] of Object.entries({ ".gitignore": "/projects/\n", ...projects, ...files })) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	return root;
}

// Such a checkout whose commits run Arthur's commit-msg hook: `commit` answers its exit code and what it printed.
function hooked(files: Readonly<Record<string, string>>) {
	const root = checkout(files);
	for (const path of [".githooks/commit-msg", "test/other-projects.ts"]) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		copyFileSync(join(ROOT, path), join(root, path));
	}
	git(root, "config", "core.hooksPath", ".githooks");
	const commit = (message: string, env: NodeJS.ProcessEnv = NO_JOB, ...config: string[]) => {
		const ran = spawnSync("git", ["-C", root, ...config, "commit", "--quiet", "--allow-empty", "-m", message], { encoding: "utf8", env });
		return [ran.status, ran.stderr.trim()];
	};
	return { root, commit };
}

const refused = (where: string) => `commit refused: ${where}: names the project Web.Shop; Arthur's repository names no other project (AR0627)`;

test("no tracked file of Arthur, nor a commit HEAD brings, names another project of the main checkout's projects/, or one of its ids", async () => {
	const found = namings(ROOT, await otherProjects(ROOT, { ARTHUR_JOB: STARTED }), headMessages(ROOT));
	// The count and the first 20 only: a deepEqual diff of the tens of thousands of lines a wrong prefix finds here grows to many GB.
	assert.equal(found.length, 0, found.slice(0, 20).join("\n"));
});

test("a project of projects/ but arthur, a folder, is named by a tracked file's path or content or a commit message, in any case or as a slug", async () => {
	const files = { "README.md": "Arthur, its arthur folder and notes.md.\n", "docs/deploy.md": "Deployed to web.shop.\n", "spec/features/AR0001-move-web-shop/ticket.md": "# AR0001\n", "projects.md": "Other.\n" };
	const root = checkout(files);
	assert.deepEqual(await otherProjects(root, NO_JOB), [{ name: "Web.Shop", prefix: "WS" }]);
	git(root, "commit", "--quiet", "--allow-empty", "-m", "feat: the landing of WEB.SHOP");
	const head = git(root, "rev-parse", "--short", "HEAD");
	const expected = ["docs/deploy.md", "spec/features/AR0001-move-web-shop/ticket.md", `commit ${head}`].map((where) => `${where}: names the project Web.Shop`);
	assert.deepEqual(namings(root, await otherProjects(root, NO_JOB), headMessages(root)), expected);
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: later");
	assert.deepEqual(headMessages(root).map((each) => each.where), [`commit ${git(root, "rev-parse", "--short", "HEAD")}`], "a commit HEAD does not bring was checked when it was");
	const worktree = join(dirname(root), "worktree");
	git(root, "worktree", "add", "--quiet", worktree);
	assert.deepEqual(await otherProjects(worktree, NO_JOB), [{ name: "Web.Shop", prefix: "WS" }], "a worktree reads the main checkout's projects/");
	const clone = join(dirname(root), "clone");
	git(root, "clone", "--quiet", root, clone);
	assert.deepEqual(namings(clone, await otherProjects(clone, NO_JOB), headMessages(clone)), [], "a clone without projects/, as CI, names none");
});

test("a project's ticket and decision ids, its prefix read from its config, name it in a tracked file's path or line or a message; others' do not", async () => {
	const files = { "notes.md": PASS, "docs/XWS0150-WS015.md": "", "docs/deploy.md": "First.\nAfter WS0150 and WS-D156, WS01500 again.\nWS-D90\nWS9099\n", "logo.bin": "\0WS0150\n", "spec/WS-D7/plan.md": "" };
	const root = checkout(files);
	const where = (...each: string[]) => each.map((one) => `${one}: names the project Web.Shop`);
	const at = (message: string) => {
		git(root, "commit", "--quiet", "--allow-empty", "-m", message);
		return namings(root, [{ name: "Web.Shop", prefix: "WS" }], headMessages(root));
	};
	const head = () => `commit ${git(root, "rev-parse", "--short", "HEAD")}`;
	const lines = ["spec/WS-D7/plan.md", "docs/deploy.md:2", "docs/deploy.md:3", "docs/deploy.md:4", "logo.bin:1"];
	assert.deepEqual(at("fix: as WS-D156 asked"), where(...lines, head()));
	assert.deepEqual(at("docs: x\n\nFor WS0150."), where(...lines, head()), "in the body");
	assert.deepEqual(at(`docs: x\n\n${PASS}`), where(...lines), "Arthur's own and other prefixes' ids");
	const other = checkout({ "projects/Web.Shop/project.config.ts": config("QQ"), "deploy.md": "WS0150\nQQ0150\n" });
	assert.deepEqual(namings(other, await otherProjects(other, NO_JOB), []), where("deploy.md:2"), "the prefix its config holds, not a fixed one");
});

test("a merge brings its branch's commits: each message is checked, the merge's own too", async () => {
	const root = checkout({});
	git(root, "switch", "--quiet", "--create", "side");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: for WS0150");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: for web-shop");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: clean");
	git(root, "switch", "--quiet", "main");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "docs: about web.shop and WS-D1, on main before the merge");
	git(root, "merge", "--quiet", "--no-ff", "-m", "Merge side: Web.Shop", "side");
	const short = (rev: string) => git(root, "rev-parse", "--short", rev);
	const named = [short("HEAD"), short("side~1"), short("side~2")].map((commit) => `commit ${commit}: names the project Web.Shop`);
	assert.deepEqual(namings(root, await otherProjects(root, NO_JOB), headMessages(root)), named);
});

test("a sign-off carrying the commit's own author's or committer's address is exempt, and nothing else (AR-D501)", async () => {
	const root = checkout({});
	const projects = await otherProjects(root, NO_JOB);
	const signed = (identity: string[], author: string, trailer = "Owner <owner@web.shop>") => {
		git(root, ...identity, "commit", "--quiet", "--allow-empty", `--author=${author}`, "-m", `fix: signed\n\nSigned-off-by: ${trailer}`);
		return namings(root, projects, headMessages(root));
	};
	const [owner, other] = [["-c", "user.email=owner@web.shop"], ["-c", "user.email=t@example.com"]];
	assert.deepEqual(signed(other, "Owner <OWNER@web.shop>"), [], "the author's");
	assert.deepEqual(signed(owner, "T <t@example.com>"), [], "the committer's");
	const head = () => [`commit ${git(root, "rev-parse", "--short", "HEAD")}: names the project Web.Shop`];
	assert.deepEqual(signed(other, "T <t@example.com>"), head(), "neither's");
	assert.deepEqual(signed(owner, "Owner <owner@web.shop>", "Web.Shop <owner@web.shop>"), head(), "the name beside it");
});

test("the commit-msg hook refuses a commit whose message or files name such a project or hold its ids, and says which", () => {
	const { root, commit } = hooked({});
	assert.deepEqual(commit("docs: deploy web-shop"), [1, refused("the commit message")]);
	assert.deepEqual(commit("fix: as WS-D156 asked"), [1, refused("the commit message")]);
	assert.deepEqual(commit("docs: x\n\nFor WS0150."), [1, refused("the commit message")]);
	assert.deepEqual(commit(`docs: x\n\n${PASS}`), [0, ""], "Arthur's own and other prefixes' ids");
	for (const [text, where] of [["To WEB.SHOP.\n", "deploy.md"], ["First.\nWS0150\n", "deploy.md:2"], ["First.\nAs WS-D156 asked.\n", "deploy.md:2"]] as const) {
		writeFileSync(join(root, "deploy.md"), text);
		git(root, "add", "deploy.md");
		assert.deepEqual(commit("docs: deploy"), [1, refused(where)]);
	}
	git(root, "rm", "--quiet", "--cached", "deploy.md");
	writeFileSync(join(root, "WS0150.md"), "");
	git(root, "add", "WS0150.md");
	assert.deepEqual(commit("docs: deploy"), [1, refused("WS0150.md")], "an id in a path");
	git(root, "rm", "--quiet", "--cached", "WS0150.md");
	writeFileSync(join(root, ".gitignore"), "/projects/\n# web.shop WS0150\n");
	assert.deepEqual(commit("docs: deploy"), [0, ""], "an untracked file, and a change not staged, are not the commit's");
	assert.equal(git(root, "log", "-1", "--format=%s"), "docs: deploy");
	const owner = ["-c", "user.name=Owner", "-c", "user.email=Owner@Web.Shop"];
	assert.deepEqual(commit("docs: signed\n\nSigned-off-by: Owner <owner@web.shop>", NO_JOB, ...owner), [0, ""], "the owner's own address in his sign-off (AR-D501)");
	assert.deepEqual(commit("docs: signed\n\nSigned-off-by: Owner <owner@web.shop>"), [1, refused("the commit message")], "an address not the commit's own");
	assert.deepEqual(commit("docs: signed\n\nSigned-off-by: Web.Shop <owner@web.shop>", NO_JOB, ...owner), [1, refused("the commit message")], "the rest of the line");
	assert.deepEqual(commit("docs: write to owner@web.shop", NO_JOB, ...owner), [1, refused("the commit message")], "the address outside a sign-off");
});

test("a prefix not in its config is learned in a job from <home>/projects/prefixes; learned from neither, it refuses every commit", async () => {
	const { root, commit } = hooked({});
	rmSync(join(root, "projects/Web.Shop/project.config.ts"));
	const home = join(dirname(root), "home");
	const file = join(home, "projects", "prefixes");
	const job = { ...process.env, ARTHUR_JOB: join(home, "jobs", "x") };
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, "arthur AR\nWeb.Shop WS\n");
	assert.deepEqual(await otherProjects(root, job), [{ name: "Web.Shop", prefix: "WS" }]);
	assert.deepEqual(commit("fix: for WS0150", job), [1, refused("the commit message")]);
	writeFileSync(join(root, "deploy.md"), "WS-D156\n");
	git(root, "add", "deploy.md");
	assert.deepEqual(commit("docs: deploy", job), [1, refused("deploy.md:1")]);
	git(root, "rm", "--quiet", "--cached", "deploy.md");
	assert.deepEqual(commit("docs: deploy", job), [0, ""]);
	const unlearned = new RegExp(`^commit refused: projects/Web\\.Shop/project\\.config\\.ts: its prefix was not learned \\(Cannot find module .*; (.*)\\), so its ids cannot be checked;`);
	const why = (env: NodeJS.ProcessEnv) => {
		const [status, stderr] = commit("docs: deploy", env);
		return [status, unlearned.exec(String(stderr))?.[1]];
	};
	for (const text of ["arthur AR\nOther.Shop QQ\n", "arthur AR\nWeb.Shop ws\n"]) {
		writeFileSync(file, text);
		assert.deepEqual(why(job), [1, `${file}: no line for it`], text);
	}
	rmSync(file);
	assert.deepEqual(why(job), [1, `${file}: missing`]);
	assert.deepEqual(why(NO_JOB), [1, "no ARTHUR_JOB, so no prefixes file"]);
	const unreadable = ['export default [{ projects: { path: "../.." } }];\n', config("ws"), "export default [{ projects: null }];\n", 'export default [{ projects: { prefix: ["WS"], path: "../.." } }];\n'];
	for (const written of unreadable) {
		const other = checkout({ "projects/Web.Shop/project.config.ts": written, "deploy.md": "web.shop WS0150\n" });
		const reason = "no projects.project({ prefix }) of capital letters A-Z; no ARTHUR_JOB, so no prefixes file";
		const finding = `projects/Web.Shop/project.config.ts: its prefix was not learned (${reason}), so its ids cannot be checked`;
		assert.deepEqual(namings(other, await otherProjects(other, NO_JOB), []), ["deploy.md: names the project Web.Shop", finding], written);
	}
});
