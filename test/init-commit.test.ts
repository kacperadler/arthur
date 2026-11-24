import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import type { Plugin } from "@arthur/core/plugin";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "@arthur/delivery";
import { projects } from "@arthur/projects";
import { projectFolders } from "./project-folders.ts";

// AR0738: `arthur init` of the projects plugin with the plugin whose `delivery.commit` it asks: the files it wrote are committed
// as `arthur commit-board` commits the board. A plugin's own tests never load another plugin; this one, outside every package, loads both.

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" }).trimEnd();
const ONBOARD = "start the onboarding: arthur spawn --kind onboarding --project shop 'Onboard shop.'";

// `shop`, a repository with `files` committed, none and no commit without any, an identity of its own, and `arthur init shop` on
// projects and delivery: its exit code and what it printed, without the lines a host with no user manager or sandbox adds.
async function init(t: TestContext, files: Readonly<Record<string, string>>) {
	const shop = temporaryFolder();
	git(shop, "init", "--quiet", "--initial-branch=main");
	for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.com"]] as const) git(shop, "config", key, value);
	for (const [path, text] of Object.entries(files)) writeFileSync(join(shop, path), text);
	if (Object.keys(files).length > 0) git(shop, "add", "--all");
	if (Object.keys(files).length > 0) git(shop, "commit", "--quiet", "-m", "first");
	const given = projectFolders([{ name: "shop", prefix: "SH", path: shop }]);
	const fake = fakeHost({ name: "projects" });
	const plugins: [Plugin, Readonly<Record<string, unknown>>][] = [[projects(given), given], [delivery(), {}]];
	for (const [plugin, options] of plugins) await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void (/^(uncapped|no sandbox): /.test(text) || out.push(text)));
	t.mock.method(console, "error", (text: string) => err.push(text));
	const code = await fake.commands.find((each) => each.name === "init")?.run({ args: ["shop"], project: undefined });
	t.mock.restoreAll();
	const created = (out[0] ?? "").split("\n")[0]?.replace(/^created: /, "").split(", ") ?? [];
	return { shop, code, out: out.join("\n"), err: err.join("\n"), created };
}

test("arthur init commits the files it created, and only those, in a repository with no commit yet", async (t) => {
	const { shop, code, out, err, created } = await init(t, {});
	assert.deepEqual([code, err], [undefined, ""]);
	for (const path of ["spec/vision.md", ".agents/arthur/criteria/styleguide.md", ".nvmrc", "spec/build.json"]) assert.ok(created.includes(path), `${path} in ${created.join(", ")}`);
	const hash = git(shop, "rev-parse", "--short", "HEAD");
	assert.equal(out.split("\n").slice(1).join("\n"), `left as it was: nothing\ncommitted chore: arthur init: ${hash}, ${created.length} files\nnext: ${ONBOARD}`);
	assert.deepEqual(git(shop, "show", "--name-only", "--format=%s", "HEAD").split("\n").filter(Boolean).sort(), ["chore: arthur init", ...created].sort());
	assert.equal(git(shop, "status", "--porcelain", "--untracked-files=all"), "", "nothing left to commit: a job's worktree starts from this HEAD");
});

test("the project's commit-msg script refuses arthur init's commit too: exit code 1, its files written and left uncommitted, none staged", async (t) => {
	const { shop, code, out, err, created } = await init(t, { "package.json": JSON.stringify({ scripts: { "commit-msg": "echo 'no init here' >&2; exit 1" } }), "README.md": "# Shop\n" });
	const refusal = "chore: arthur init not committed: npm run commit-msg refused: no init here; fix what it names, then run it again";
	assert.deepEqual([code, err], [1, `arthur init: nothing committed: ${refusal}; commit these files, then ${ONBOARD}`]);
	assert.equal(out.split("\n").length, 2, "what it created and what it left, and no line of a commit");
	assert.equal(git(shop, "log", "--format=%s"), "first");
	assert.deepEqual(created.filter((path) => !existsSync(join(shop, path))), [], "every file it created is there");
	assert.deepEqual(git(shop, "status", "--porcelain", "--untracked-files=all").split("\n").sort(), created.map((path) => `?? ${path}`).sort());
});
