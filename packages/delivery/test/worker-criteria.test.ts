import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "../src/delivery.ts";

// AR0584: a worker's prompt holds the project's review criteria, what fails its branch, read as the core reads a criteria file.

const PATH = ".agents/arthur/criteria/review.md";
const CRITERIA = "# Review\n\nFAIL on a missing test.\n";
const SECTION = `## The review criteria your branch is judged by (${PATH})\n\n# Review\n\nFAIL on a missing test.`;

// The repository `acme` with `files` committed, and delivery set up on the fake host, its project's `prompts` as given.
async function load(files: Readonly<Record<string, string>>, prompts?: { readonly criteriaDir: string }) {
	const root = join(temporaryFolder(), "acme");
	for (const [path, text] of Object.entries({ "README.md": "acme\n", ...files })) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	for (const args of [["init", "--quiet", "--initial-branch=main"], ["add", "--all"], ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "--quiet", "-m", "first"]]) execFileSync("git", ["-C", root, ...args]);
	const fake = fakeHost({ name: "delivery", root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC", ...(prompts === undefined ? {} : { prompts }) }]);
	await fake.setup(delivery());
	// What delivery's provider answers for `role` on a job of acme on `machine`, its worktree and main checkout as given.
	const section = (role: string, worktree = root, machine = "local", main = root) => fake.collect("prompt", role, { project: "acme", machine, worktree, root: main }).find((each) => each !== undefined);
	return { root, fake, section };
}

test("a worker's spawned prompt holds the project's review criteria once, under their own heading; another role gets none", async () => {
	const { fake, section } = await load({ [PATH]: CRITERIA });
	const job = await fake.host.jobs.spawn({ task: "Go." });
	const prompt = readFileSync(join(dirname(fake.host.folder), "jobs", job.id, "prompt"), "utf8");
	assert.equal(prompt.split(SECTION).length, 2, prompt);
	assert.equal(section("reviewer"), undefined);
	assert.equal(section("planner"), undefined);
});

test("missing or empty review criteria add nothing and warn nothing", async () => {
	assert.equal((await load({})).section("worker"), undefined);
	assert.equal((await load({ [PATH]: " \n\n" })).section("worker"), undefined);
});

test("the review criteria are read in the worktree here, in the main checkout for a job on another machine, and in the folder a project's prompts name", async () => {
	const { root, section } = await load({ [PATH]: CRITERIA });
	const worktree = join(temporaryFolder(), "worktree");
	mkdirSync(join(worktree, dirname(PATH)), { recursive: true });
	writeFileSync(join(worktree, PATH), "# Review\n\nThe worktree's.\n");
	assert.equal(section("worker", worktree), `## The review criteria your branch is judged by (${PATH})\n\n# Review\n\nThe worktree's.`);
	assert.equal(section("worker", "/srv/remote/worktree", "mac"), SECTION, "a worktree on another machine: the main checkout's");
	assert.equal(section("worker", worktree, "mac", root), SECTION);
	const folder = temporaryFolder();
	writeFileSync(join(folder, "review.md"), "# Folder review\n");
	const moved = await load({ [PATH]: CRITERIA }, { criteriaDir: folder });
	assert.equal(moved.section("worker"), `## The review criteria your branch is judged by (${join(folder, "review.md")})\n\n# Folder review`);
});

test("review criteria that are a symlink, under a symlinked folder, or no file are never read: the spawn warns and the worker goes without them", async () => {
	const secret = join(temporaryFolder(), "secret.md");
	writeFileSync(secret, "SECRET\n");
	const { root, fake, section } = await load({ "docs/review.md": "# Elsewhere\n" });
	const warning = { warnings: [`${PATH} is a symlink or not a file; the worker goes without the review criteria`] };
	mkdirSync(join(root, dirname(PATH)), { recursive: true });
	symlinkSync(secret, join(root, PATH));
	assert.deepEqual(section("worker"), warning, "a symlinked file");
	for (const args of [["add", "--all"], ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "--quiet", "-m", "link"]]) execFileSync("git", ["-C", root, ...args]);
	const job = await fake.host.jobs.spawn({ task: "Go." });
	assert.ok(job.warnings.includes(warning.warnings[0] ?? ""), job.warnings.join("\n"));
	assert.doesNotMatch(readFileSync(join(dirname(fake.host.folder), "jobs", job.id, "prompt"), "utf8"), /SECRET/);
	rmSync(join(root, dirname(PATH)), { recursive: true });
	symlinkSync(join(root, "docs"), join(root, dirname(PATH)));
	assert.deepEqual(section("worker"), warning, "a symlinked folder on the way");
	rmSync(join(root, dirname(PATH)));
	mkdirSync(join(root, PATH), { recursive: true });
	assert.deepEqual(section("worker"), warning, "a folder named review.md");
});
