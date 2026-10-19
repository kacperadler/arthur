import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type ProjectEntry, projects } from "../src/projects.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const SKELETON = (path: string) => readFileSync(new URL(`../skeleton/${path}`, import.meta.url), "utf8");
const NODE = `${process.versions.node.split(".")[0]}\n`;
const NEXT = "nothing committed: commit these files, then start the onboarding: arthur spawn --kind onboarding --project shop 'Onboard shop.'";

// A repository with `files`, committed unless `commit` is false; with no files and no commit, an empty repository.
function repository(files: Readonly<Record<string, string>>, commit = true): string {
	const root = temporaryFolder();
	git(root, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	if (!commit) return root;
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	return root;
}

// The plugin set up with `list`, beside a role registered as another plugin's, which reads `criteria` (the coordinator's by default).
async function load(list: readonly ProjectEntry[], criteria = ["styleguide", "autopilot"]): Promise<FakeHost> {
	const fake = fakeHost({ name: "projects" });
	const other = { name: "coordinator", file: new URL("../roles/onboarding.md", import.meta.url), criteria };
	await fake.setup({ setup: (host) => (host.jobs.registerRole(other), projects({ list }).setup({ ...host, options: { list } })) });
	return fake;
}

// `arthur init` as the CLI runs it: its exit code, and what it printed on stdout and stderr.
async function init(t: TestContext, fake: FakeHost, args: readonly string[], project?: string) {
	const [out, err]: [string[], string[]] = [[], []];
	const log = t.mock.method(console, "log", (line: string) => void out.push(line));
	const error = t.mock.method(console, "error", (line: string) => void err.push(line));
	const code = await fake.commands.find((command) => command.name === "init")?.run({ args, project });
	log.mock.restore();
	error.mock.restore();
	return { code, out: out.join("\n"), err: err.join("\n") };
}

test("arthur init of a project not in the config is refused and writes nothing", async (t) => {
	const shop = repository({ "README.md": "# Shop\n" });
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }]);
	assert.deepEqual(await init(t, fake, ["blog"]), { code: 1, out: "", err: "arthur init: unknown project blog; projects: shop" });
	assert.equal(git(shop, "status", "--porcelain", "--untracked-files=all"), "");
});

test("arthur init over an existing board is refused and writes nothing, a board broken by hand included", async (t) => {
	for (const board of ["[]\n", "{ broken"]) {
		const shop = repository({ "spec/build.json": board });
		const fake = await load([{ name: "shop", prefix: "SH", path: shop }]);
		const err = `arthur init: shop has a board already, ${join(shop, "spec/build.json")}; arthur init is for a repository without one`;
		assert.deepEqual(await init(t, fake, ["shop"]), { code: 1, out: "", err }, board);
		assert.equal(git(shop, "status", "--porcelain", "--untracked-files=all"), "", board);
	}
});

test("an empty repository gets the vision and criteria skeletons, an .nvmrc and an empty board; a second init is refused", async (t) => {
	const shop = repository({}, false);
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }]);
	const created = ["spec/vision.md", ".agents/arthur/criteria/styleguide.md", ".agents/arthur/criteria/autopilot.md", ".nvmrc", "spec/build.json"];
	const board = () => fake.collect<readonly { name: string; check: () => string }[]>("doctor")[0]?.find((each) => each.name === "shop board")?.check();
	assert.equal(board(), "missing: no spec/build.json");
	assert.deepEqual(await init(t, fake, ["shop"]), { code: undefined, out: [`created: ${created.join(", ")}`, "left as it was: nothing", NEXT].join("\n"), err: "" });
	assert.equal(board(), "ok", "doctor finds the board init wrote");
	const read = (path: string) => readFileSync(join(shop, path), "utf8");
	assert.deepEqual(created.map(read), [SKELETON("vision.md"), SKELETON("criteria/styleguide.md"), SKELETON("criteria/autopilot.md"), NODE, "[]\n"]);
	assert.match(SKELETON("vision.md"), /^# Vision\n\n## Purpose\n/);
	assert.deepEqual(fake.host.board.list("shop"), [], "the board reads as an empty one");
	// Nothing committed: the repository still has no commit, and every file is untracked.
	assert.throws(() => git(shop, "rev-parse", "--verify", "--quiet", "HEAD"));
	assert.equal(git(shop, "status", "--porcelain", "--untracked-files=all").split("\n").length, created.length);
	const again = await init(t, fake, ["shop"]);
	assert.deepEqual([again.code, again.out], [1, ""]);
	assert.match(again.err, /^arthur init: shop has a board already, /);
});

test("init writes a skeleton for each criteria file a registered role reads, its title alone when none is shipped", async (t) => {
	const shop = repository({ "README.md": "# Shop\n" });
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }], ["code-review", "styleguide"]);
	assert.equal((await init(t, fake, ["shop"])).out.split("\n")[0], "created: spec/vision.md, .agents/arthur/criteria/styleguide.md, .agents/arthur/criteria/code-review.md, .nvmrc, spec/build.json");
	assert.equal(readFileSync(join(shop, ".agents/arthur/criteria/code-review.md"), "utf8"), "# Code review\n");
	assert.equal(existsSync(join(shop, ".agents/arthur/criteria/autopilot.md")), false, "no registered role reads autopilot here");
});

// The board appearing while init runs, as a second init's does: a dangling symlink there passes the first look, as no board.
test("a board found only when init writes it is refused, never written through", async (t) => {
	const shop = repository({ "README.md": "# Shop\n" });
	mkdirSync(join(shop, "spec"));
	symlinkSync("../board.json", join(shop, "spec/build.json"));
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }]);
	const err = `arthur init: shop has a board already, ${join(shop, "spec/build.json")}; arthur init is for a repository without one`;
	assert.deepEqual(await init(t, fake, ["shop"]), { code: 1, out: "", err });
	assert.equal(existsSync(join(shop, "board.json")), false);
});

test("an existing .nvmrc is kept unchanged, and so is the owner's vision, a symlink there never written through", async (t) => {
	const shop = repository({ ".nvmrc": "18.20.0\n", "spec/vision.md": "# Shop\n\nSells tools.\n" });
	mkdirSync(join(shop, ".agents/arthur/criteria"), { recursive: true });
	symlinkSync("../../../outside.md", join(shop, ".agents/arthur/criteria/autopilot.md"));
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }]);
	const { code, out } = await init(t, fake, ["shop"]);
	assert.equal(code, undefined);
	assert.deepEqual(out.split("\n").slice(0, 2), [
		"created: .agents/arthur/criteria/styleguide.md, spec/build.json",
		"left as it was: spec/vision.md, .agents/arthur/criteria/autopilot.md, .nvmrc",
	]);
	assert.deepEqual([readFileSync(join(shop, ".nvmrc"), "utf8"), readFileSync(join(shop, "spec/vision.md"), "utf8")], ["18.20.0\n", "# Shop\n\nSells tools.\n"]);
	assert.equal(existsSync(join(shop, "outside.md")), false, "the dangling symlink's target was not created");
});

test("a repository without package.json still gets an .nvmrc with the major version of the Node Arthur runs on", async (t) => {
	const api = repository({ "pyproject.toml": "[project]\nname = 'api'\n" });
	const fake = await load([{ name: "api", prefix: "API", path: api }]);
	assert.equal((await init(t, fake, ["api"])).code, undefined);
	assert.equal(readFileSync(join(api, ".nvmrc"), "utf8"), NODE);
	assert.match(NODE, /^\d+\n$/);
	assert.equal(existsSync(join(api, "package.json")), false);
});

test("prompts moves the vision and the criteria init writes", async (t) => {
	const shop = repository({ "README.md": "# Shop\n" });
	const fake = await load([{ name: "shop", prefix: "SH", path: shop, prompts: { vision: "./docs/vision.md", criteriaDir: "docs/criteria/" } }]);
	const { out } = await init(t, fake, ["shop"]);
	assert.equal(out.split("\n")[0], "created: docs/vision.md, docs/criteria/styleguide.md, docs/criteria/autopilot.md, .nvmrc, spec/build.json");
	assert.equal(existsSync(join(shop, "spec/vision.md")), false);
});

test("arthur init without one project, with two, or with --project is wrong usage and writes nothing", async (t) => {
	const shop = repository({ "README.md": "# Shop\n" });
	const fake = await load([{ name: "shop", prefix: "SH", path: shop }]);
	const usage = { code: 2, out: "", err: "usage: arthur init <project>" };
	assert.deepEqual(await init(t, fake, []), usage);
	assert.deepEqual(await init(t, fake, ["shop", "shop"]), usage);
	assert.deepEqual(await init(t, fake, ["shop"], "shop"), usage);
	assert.equal(git(shop, "status", "--porcelain", "--untracked-files=all"), "");
});
