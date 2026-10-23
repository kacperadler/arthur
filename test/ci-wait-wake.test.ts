import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { Plugin } from "@arthur/core/plugin";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "@arthur/delivery";
import { github } from "@arthur/github";
import { projects } from "@arthur/projects";
import { type FakeRun, fakeGithub } from "../packages/github/test/fake-github.ts";

// AR0257: the end of a CI run on a branch `arthur merge --auto` left waiting wakes the coordinator once, delivery's wake, not
// github's too. A plugin's own tests never load another plugin; this one, outside every package, loads projects, delivery and
// github together on one fake host, against the fake GitHub REST API of github's tests, polled every second.

const FOLDER = "spec/features/SH0001-shop";
const TOKEN = "github_pat_11ARTHUR0test0Never0Printed0abcdefghijklmnopqrstuvwxyz";
const RUNS = "/repos/acme/shop/actions/workflows/ci.yml/runs";
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

async function until(what: string, predicate: () => boolean) {
	for (const end = Date.now() + 20_000; !predicate(); await sleep(20)) if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
}

test("a waiting branch's CI end wakes the coordinator once, delivery's wake; the merge it asks for ends the wait and no later poll wakes again", async (t) => {
	const api = await fakeGithub(t);
	const folder = temporaryFolder();
	// Its origin a bare repository whose path names acme/shop, so github finds its repository and a push stays on this machine.
	const origin = join(folder, "acme", "shop.git");
	const shop = join(folder, "shop");
	mkdirSync(origin, { recursive: true });
	git(origin, "init", "--quiet", "--bare", "--initial-branch=main");
	const board = [{ id: "SH0001", title: "Shop", status: "planned", path: `${FOLDER}/ticket.md`, updated: "2026-10-21T08:00:00Z" }];
	const files = { "README.md": "# Shop\n", [`${FOLDER}/ticket.md`]: "# SH0001 - Shop\n", "spec/build.json": JSON.stringify(board), "package.json": JSON.stringify({ scripts: { check: 'node -e ""', test: "node test.js" } }), "test.js": 'console.log("ℹ tests 1\\nℹ pass 1");\n' };
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(shop, path)), { recursive: true });
		writeFileSync(join(shop, path), text);
	}
	git(shop, "init", "--quiet", "--initial-branch=main");
	// Repo-local, so `arthur merge`'s own `git merge` has an identity on a runner with no global one.
	git(shop, "config", "user.name", "t");
	git(shop, "config", "user.email", "t@example.com");
	git(shop, "add", "--all");
	git(shop, "commit", "--quiet", "-m", "first");
	git(shop, "remote", "add", "origin", origin);
	git(shop, "push", "--quiet", "origin", "main");
	const list = [{ name: "shop", prefix: "SH", path: shop, autoMerge: true, ci: { workflow: "ci.yml" } }];
	const fake = fakeHost({ name: "projects", now: new Date("2026-10-21T10:00:00Z"), env: { ARTHUR_GITHUB_TOKEN: TOKEN } });
	const options = { instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN", apiUrl: api.apiUrl }], poll: { everySeconds: 1 } };
	const [withDelivery, withGithub] = [delivery(), github(options)];
	const loaded: [Plugin, Readonly<Record<string, unknown>>][] = [
		[projects({ list }), { list }],
		[withDelivery, {}],
		[withGithub, options],
	];
	for (const [plugin, given] of loaded) await fake.setup({ setup: (host) => plugin.setup({ ...host, options: given }) });
	const path = process.env.PATH;
	t.after(() => {
		process.env.PATH = path;
		for (const [plugin] of loaded) plugin.stop?.();
	});
	const ended = async (id: string) => {
		const state = join(dirname(fake.host.folder), "jobs", id, "state");
		await until(`${id} to end`, () => existsSync(state) && readFileSync(state, "utf8") === "ended");
		fake.emit("job-ended", { id, state: "ended" });
	};
	const agent = (message: string) => {
		process.env.PATH = `${dirname(fakeAgent({ steps: [{ message }] }))}${delimiter}${path}`;
	};
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (line: string) => out.push(line));
	t.mock.method(console, "error", (line: string) => err.push(line));
	// A command's refusal throws, and the CLI prints it and exits 1.
	const run = async (name: string, ...args: string[]) => {
		const said = err.length;
		const code = await Promise.try(() => fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })).catch((error: Error) => (err.push(error.message), 1));
		return { code, err: err.slice(said).join("\n") };
	};
	const messages = () => fake.emitted.filter((event) => event.name === "coordinator-message").map((event) => (event.data as { readonly text: string }).text);

	agent("Done.");
	const job = await fake.host.jobs.spawn({ task: `Ticket: ${FOLDER}/ticket.md` });
	await ended(job.id);
	writeFileSync(join(job.worktree, "shop.ts"), "export const shop = 1;\n");
	git(job.worktree, "add", "--all");
	git(job.worktree, "commit", "--quiet", "-m", "feat(SH0001): the shop");
	const tip = git(job.worktree, "rev-parse", "HEAD");
	agent("PASS");
	await run("review", job.id);
	await ended(out.at(-1) ?? "");
	const ci: FakeRun = { id: 51, sha: tip, branch: job.branch ?? "", status: "in_progress", conclusion: null };
	api.runs["acme/shop/ci.yml"] = [ci];
	const refused = await run("merge", job.id, "--auto");
	assert.equal(refused.code, 1, refused.err);
	assert.match(refused.err, /: run 51, attempt 1, on [0-9a-f]{7}, the tip, is in_progress; it waits: /);
	const before = messages().length;

	// github's first poll takes what already finished as told: two of its polls see the run still going before it ends.
	const asked = api.count(RUNS);
	await withGithub.start?.();
	await until("two polls of github's", () => api.count(RUNS) >= asked + 2);
	await withDelivery.start?.();
	[ci.status, ci.conclusion] = ["completed", "success"];
	await until("ci-finished", () => fake.emitted.some((event) => event.name === "ci-finished"));
	const polls = api.count(RUNS);
	await until("two more polls", () => api.count(RUNS) >= polls + 2);
	const where = `${job.branch} (run 51, attempt 1, on ${tip.slice(0, 7)}): https://github.com/acme/shop/actions/runs/51`;
	assert.deepEqual(messages().slice(before), [`[delivery] CI passed on ${where}. It waited for that: arthur merge --auto ${job.id}`], "one wake, delivery's");

	const merged = await run("merge", job.id, "--auto");
	assert.equal(merged.code, undefined, merged.err);
	const after = api.count(RUNS);
	await until("two polls after the merge", () => api.count(RUNS) >= after + 2);
	assert.equal(messages().length, before + 1, "no poll after the merge wakes on that run again");
});
