import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { headMessages, namings, otherProjects } from "./other-projects.ts";

const ROOT = join(import.meta.dirname, "..");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

// A main checkout with `projects/` beside its `.git`, git-ignored as Arthur's: `arthur`, the made-up `Web.Shop`, and a file.
function checkout(files: Readonly<Record<string, string>>): string {
	const root = join(temporaryFolder(), "main");
	for (const [path, text] of Object.entries({ ".gitignore": "/projects/\n", "projects/arthur/project.config.ts": "", "projects/Web.Shop/project.config.ts": "", "projects/notes.md": "", ...files })) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	return root;
}

test("no tracked file of Arthur, nor a commit HEAD brings, names another project of the main checkout's projects/", () => {
	assert.deepEqual(namings(ROOT, otherProjects(ROOT), headMessages(ROOT)), []);
});

test("a project of projects/ but arthur, a folder, is named by a tracked file's path or content or a commit message, in any case or as a slug", () => {
	const files = { "README.md": "Arthur, its arthur folder and notes.md.\n", "docs/deploy.md": "Deployed to web.shop.\n", "spec/features/AR0001-move-web-shop/ticket.md": "# AR0001\n", "projects.md": "Other.\n" };
	const root = checkout(files);
	assert.deepEqual(otherProjects(root), ["Web.Shop"]);
	git(root, "commit", "--quiet", "--allow-empty", "-m", "feat: the landing of WEB.SHOP");
	const head = git(root, "rev-parse", "--short", "HEAD");
	const expected = ["docs/deploy.md", "spec/features/AR0001-move-web-shop/ticket.md", `commit ${head}`].map((where) => `${where}: names the project Web.Shop`);
	assert.deepEqual(namings(root, otherProjects(root), headMessages(root)), expected);
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: later");
	assert.deepEqual(headMessages(root).map((each) => each.where), [`commit ${git(root, "rev-parse", "--short", "HEAD")}`], "a commit HEAD does not bring was checked when it was");
	const worktree = join(dirname(root), "worktree");
	git(root, "worktree", "add", "--quiet", worktree);
	assert.deepEqual(otherProjects(worktree), ["Web.Shop"], "a worktree reads the main checkout's projects/");
	const clone = join(dirname(root), "clone");
	git(root, "clone", "--quiet", root, clone);
	assert.deepEqual(namings(clone, otherProjects(clone), headMessages(clone)), [], "a clone without projects/, as CI, names none");
});

test("a merge brings its branch's commits: each message is checked, the merge's own too", () => {
	const root = checkout({});
	git(root, "switch", "--quiet", "--create", "side");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: for web-shop");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "fix: clean");
	git(root, "switch", "--quiet", "main");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "docs: about web.shop, on main before the merge");
	git(root, "merge", "--quiet", "--no-ff", "-m", "Merge side: Web.Shop", "side");
	const short = (rev: string) => git(root, "rev-parse", "--short", rev);
	assert.deepEqual(namings(root, otherProjects(root), headMessages(root)), [short("HEAD"), short("side~1")].map((commit) => `commit ${commit}: names the project Web.Shop`));
});

test("a sign-off carrying the commit's own author's or committer's address is exempt, and nothing else (AR-D501)", () => {
	const root = checkout({});
	const signed = (identity: string[], author: string, trailer = "Owner <owner@web.shop>") => {
		git(root, ...identity, "commit", "--quiet", "--allow-empty", `--author=${author}`, "-m", `fix: signed\n\nSigned-off-by: ${trailer}`);
		return namings(root, otherProjects(root), headMessages(root));
	};
	const [owner, other] = [["-c", "user.email=owner@web.shop"], ["-c", "user.email=t@example.com"]];
	assert.deepEqual(signed(other, "Owner <OWNER@web.shop>"), [], "the author's");
	assert.deepEqual(signed(owner, "T <t@example.com>"), [], "the committer's");
	const head = () => [`commit ${git(root, "rev-parse", "--short", "HEAD")}: names the project Web.Shop`];
	assert.deepEqual(signed(other, "T <t@example.com>"), head(), "neither's");
	assert.deepEqual(signed(owner, "Owner <owner@web.shop>", "Web.Shop <owner@web.shop>"), head(), "the name beside it");
});

test("the commit-msg hook refuses a commit whose message or files name such a project, and says which", () => {
	const root = checkout({});
	for (const path of [".githooks/commit-msg", "test/other-projects.ts"]) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		copyFileSync(join(ROOT, path), join(root, path));
	}
	git(root, "config", "core.hooksPath", ".githooks");
	const commit = (message: string, ...config: string[]) => {
		const ran = spawnSync("git", ["-C", root, ...config, "commit", "--quiet", "--allow-empty", "-m", message], { encoding: "utf8" });
		return [ran.status, ran.stderr.trim()];
	};
	const refused = (where: string) => `commit refused: ${where}: names the project Web.Shop; Arthur's repository names no other project (AR0627)`;
	assert.deepEqual(commit("docs: deploy web-shop"), [1, refused("the commit message")]);
	writeFileSync(join(root, "deploy.md"), "To WEB.SHOP.\n");
	git(root, "add", "deploy.md");
	assert.deepEqual(commit("docs: deploy"), [1, refused("deploy.md")]);
	git(root, "rm", "--quiet", "--cached", "deploy.md");
	writeFileSync(join(root, ".gitignore"), "/projects/\n# web.shop\n");
	assert.deepEqual(commit("docs: deploy"), [0, ""], "an untracked file, and a change not staged, are not the commit's");
	assert.equal(git(root, "log", "-1", "--format=%s"), "docs: deploy");
	const owner = ["-c", "user.name=Owner", "-c", "user.email=Owner@Web.Shop"];
	assert.deepEqual(commit("docs: signed\n\nSigned-off-by: Owner <owner@web.shop>", ...owner), [0, ""], "the owner's own address in his sign-off (AR-D501)");
	assert.deepEqual(commit("docs: signed\n\nSigned-off-by: Owner <owner@web.shop>"), [1, refused("the commit message")], "an address not the commit's own");
	assert.deepEqual(commit("docs: signed\n\nSigned-off-by: Web.Shop <owner@web.shop>", ...owner), [1, refused("the commit message")], "the rest of the line");
	assert.deepEqual(commit("docs: write to owner@web.shop", ...owner), [1, refused("the commit message")], "the address outside a sign-off");
});
