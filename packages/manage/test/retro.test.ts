import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type ManageOptions, manage } from "../src/manage.ts";
import { RETRO_TASK } from "../src/retro.ts";

// The retro against the fake host and the fake agent, the test providing `schedule.register` as the schedule plugin would, and
// `channel.send` as a channel would (the plugin `test`): the repository `acme` (prefix AC), whose tickets are merged into main
// as `arthur merge` merges them, each with its review files and findings.

const PATH = process.env.PATH ?? "";
// A Wednesday, 02:00 UTC.
const NOW = new Date("2026-10-21T02:00:00Z");
const PROCEDURE = readFileSync(new URL("../roles/coordinator/retro-ended.md", import.meta.url), "utf8").trim();
const MESSAGE = "## Period\n\nAC0001 <merged> & went well.\n\n## 1. Say it twice\nKind: cleanup\n\n## Dead sentences\n\nnone";

const folder = (id: string) => `spec/features/${id}-t`;

async function load(t: TestContext, options: ManageOptions = {}, run: AgentRun = { steps: [{ message: MESSAGE }] }) {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(join(root, "spec"), { recursive: true });
	writeFileSync(join(root, "spec/vision.md"), "# Vision\n");
	writeFileSync(join(root, "spec/build.json"), "[]");
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: root, encoding: "utf8" }).trim();
	const commit = (message: string) => {
		git("add", "--all");
		git("commit", "--quiet", "--allow-empty", "-m", message);
		return git("rev-parse", "HEAD");
	};
	git("init", "--quiet", "--initial-branch=main");
	commit("first");
	const board: { id: string; title: string; status: string; path: string; updated: string }[] = [];
	// Ticket `id` merged as `arthur merge` merges it, with `fails` FAIL reviews (and a PASS after them) and `findings` findings.
	const merge = (id: string, fails = 0, findings = 0) => {
		git("checkout", "--quiet", "-b", id);
		mkdirSync(join(root, folder(id)), { recursive: true });
		writeFileSync(join(root, folder(id), "ticket.md"), `# ${id} - T\n`);
		for (let n = 1; n <= fails; n++) writeFileSync(join(root, folder(id), `review-${n}.md`), `# Review\n\n- Verdict: FAIL\n`);
		writeFileSync(join(root, folder(id), `review-${fails + 1}.md`), `# Review\n\n- Verdict: PASS\n`);
		if (findings > 0) writeFileSync(join(root, folder(id), "findings.md"), Array.from({ length: findings }, (_, n) => `## F${n + 1}. A finding\n\n- Status: open\n`).join("\n"));
		writeFileSync(join(root, folder(id), "outcome.md"), "# Outcome\n");
		commit(`work on ${id}`);
		git("checkout", "--quiet", "main");
		git("merge", "--quiet", "--no-ff", "-m", `Merge ${id}: Ticket ${id}`, id);
		board.push({ id, title: `Ticket ${id}`, status: "merged", path: `${folder(id)}/ticket.md`, updated: "2026-10-20T10:00:00Z" });
		writeFileSync(join(root, "spec/build.json"), JSON.stringify(board));
	};
	// `count` merges from AC<from> on, the FAILs and findings given to the first ones.
	const merges = (count: number, from: number, fails: number, findings: number) => {
		for (let n = 0; n < count; n++) merge(`AC${String(from + n).padStart(4, "0")}`, n < fails ? 1 : 0, n === 0 ? findings : 0);
	};
	process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "manage", options, now: NOW, root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	const entries: Record<string, unknown>[] = [];
	fake.provide("schedule.register", (plugin: unknown, list: Record<string, unknown>[]) => void entries.push(...list.map((each) => ({ plugin, ...each }))));
	await fake.setup(manage(options));
	const home = dirname(fake.host.folder);
	const read = (id: string, name: string) => (existsSync(join(home, "jobs", id, name)) ? readFileSync(join(home, "jobs", id, name), "utf8") : "");
	const retros = () => fake.host.jobs.list().filter((job) => job.kind === "retro");
	// A command as the CLI runs it, with what it printed.
	const command = async (name: string, ...args: string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === name)?.run({ args, project: undefined })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	// The entry's run, as the schedule calls it at its slot, and what it printed; the retro it started, if any.
	const scheduled = async () => {
		const before = retros().length;
		const printed: string[] = [];
		t.mock.method(console, "log", (line: string) => printed.push(line));
		await Promise.try(() => (entries[0]?.run as () => Promise<void>)()).finally(() => t.mock.restoreAll());
		return { printed, job: retros().length > before ? retros()[0] : undefined };
	};
	const ended = async (id: string) => {
		for (const deadline = Date.now() + 15_000; read(id, "state") !== "ended"; await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${id} to end`);
	};
	return { root, fake, git, commit, merge, merges, entries, command, scheduled, read, ended, jobs: fake.host.jobs };
}


test("retro-due, no retro yet: due exactly at 10 merges with 2 FAILs, or with 5 findings; one short of either is not due", async (t) => {
	const cases: [number, number, number, string][] = [
		[10, 2, 0, "retro due: 10 merges, 2 FAIL reviews and 0 findings since the start (no retro yet)"],
		[10, 0, 5, "retro due: 10 merges, 0 FAIL reviews and 5 findings since the start (no retro yet)"],
		[9, 2, 5, "no retro due: 9 merges, 2 FAIL reviews and 5 findings since the start (no retro yet); 10 merges needed"],
		[10, 1, 4, "no retro due: 10 merges, 1 FAIL review and 4 findings since the start (no retro yet); 2 FAIL reviews or 5 findings needed"],
	];
	for (const [count, fails, findings, line] of cases) {
		const env = await load(t);
		env.merges(count, 1, fails, findings);
		assert.deepEqual(await env.command("retro-due"), { code: 0, out: line, err: "" }, line);
	}
});

test("retro-due counts only ticket merges on main's first-parent line; an empty history is none; arguments are wrong usage", async (t) => {
	const env = await load(t);
	assert.equal((await env.command("retro-due")).out, "no retro due: 0 merges, 0 FAIL reviews and 0 findings since the start (no retro yet); 10 merges needed");
	env.merges(9, 1, 2, 0);
	env.git("checkout", "--quiet", "-b", "side");
	env.commit("on the side");
	env.git("checkout", "--quiet", "-b", "inner");
	env.commit("further in");
	env.git("checkout", "--quiet", "side");
	env.git("merge", "--quiet", "--no-ff", "-m", "Merge AC0099: Not on main", "inner");
	env.git("checkout", "--quiet", "main");
	env.git("merge", "--quiet", "--no-ff", "-m", "Merge branch 'side'", "side");
	assert.match((await env.command("retro-due")).out, /^no retro due: 9 merges, /, "neither a merge without a ticket id nor one off the first-parent line counts");
	env.merge("AC0100");
	assert.match((await env.command("retro-due")).out, /^retro due: 10 merges, 2 FAIL reviews/, "a ticket merge after them does");
	assert.deepEqual(await env.command("retro-due", "now"), { code: 2, out: "", err: "usage: arthur retro-due [--project <name>]" });
	assert.deepEqual(env.fake.collect("coordinator.context"), [(await env.command("retro-due")).out], "the coordinator's context carries the same line");
});

test("filed as spec/retro/<date>.md with its phone page; the next period starts at its commit; a second retro that day is -2", async (t) => {
	const env = await load(t);
	env.merges(10, 1, 2, 0);
	const first = await env.jobs.spawn({ task: RETRO_TASK, kind: "retro" });
	await env.ended(first.id);
	assert.equal(env.jobs.file(undefined, first.id), "spec/retro/2026-10-21.md");
	const report = `# Retro 2026-10-21\n\n- Job: ${first.id}\n- Merges up to: ${first.base}\n\n## Final message\n\n${MESSAGE}`;
	assert.equal(readFileSync(join(env.root, "spec/retro/2026-10-21.md"), "utf8"), report);
	const page = readFileSync(join(env.root, "spec/retro/2026-10-21.html"), "utf8");
	assert.match(page, /^<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retro 2026-10-21<\/title><style>/);
	assert.ok(page.includes("<body><h1>Retro 2026-10-21</h1><p>- Job: "), page);
	assert.ok(page.includes("<h2>Period</h2><p>AC0001 &lt;merged&gt; &amp; went well.</p><h2>1. Say it twice</h2><p>Kind: cleanup</p><h2>Dead sentences</h2><p>none</p></body></html>\n"), page);
	assert.throws(() => env.jobs.file(undefined, first.id), { message: `${first.id} is already filed as spec/retro/2026-10-21.md` });
	env.commit("the retro");
	assert.equal((await env.command("retro-due")).out, `no retro due: 0 merges, 0 FAIL reviews and 0 findings since the last retro, ${first.base.slice(0, 12)} (spec/retro/2026-10-21.md); 10 merges needed`);
	env.merges(10, 11, 0, 5);
	assert.match((await env.command("retro-due")).out, /^retro due: 10 merges, 0 FAIL reviews and 5 findings since the last retro, /, "only the merges since its commit");
	const second = await env.jobs.spawn({ task: RETRO_TASK, kind: "retro" });
	await env.ended(second.id);
	assert.equal(env.jobs.file(undefined, second.id), "spec/retro/2026-10-21-2.md");
	assert.deepEqual(readdirSync(join(env.root, "spec/retro")).sort(), ["2026-10-21-2.html", "2026-10-21-2.md", "2026-10-21.html", "2026-10-21.md"]);
	writeFileSync(join(env.root, "spec/retro/2026-10-21-2.md"), "# Retro\n\n- Merges up to: 0123456789abcdef0123456789abcdef01234567\n");
	assert.match((await env.command("retro-due")).out, /^retro due: 20 merges, 2 FAIL reviews and 5 findings since the start \(0123456789ab of spec\/retro\/2026-10-21-2\.md is no commit of this repository\)$/);
});

test("a page alone takes its name too: the report and its page go to the next free -<n>", async (t) => {
	const env = await load(t);
	mkdirSync(join(env.root, "spec/retro"));
	writeFileSync(join(env.root, "spec/retro/2026-10-21.html"), "by hand");
	const job = await env.jobs.spawn({ task: RETRO_TASK, kind: "retro" });
	await env.ended(job.id);
	assert.equal(env.jobs.file(undefined, job.id), "spec/retro/2026-10-21-2.md");
	assert.equal(readFileSync(join(env.root, "spec/retro/2026-10-21.html"), "utf8"), "by hand");
	assert.ok(existsSync(join(env.root, "spec/retro/2026-10-21-2.html")));
});

test("a retro is a read-only job, its prompt the period's files, stats, board, and the roles and criteria the plugins ship", async (t) => {
	const outside = temporaryFolder();
	mkdirSync(join(outside, "criteria"));
	writeFileSync(join(outside, "criteria/review.md"), "# Review\n");
	const env = await load(t);
	const inside = join(env.root, "packages/manage");
	mkdirSync(join(inside, "roles/coordinator"), { recursive: true });
	writeFileSync(join(inside, "roles/retro.md"), "# Retro\n");
	writeFileSync(join(inside, "roles/coordinator/retro-ended.md"), "# When\n");
	env.merge("AC0001", 2, 3);
	env.merge("AC0002");
	env.git("checkout", "--quiet", "-b", "gone");
	env.commit("work on a ticket since dropped");
	env.git("checkout", "--quiet", "main");
	env.git("merge", "--quiet", "--no-ff", "-m", "Merge AC0077: Dropped from the board", "gone");
	const plugin = fakeHost({ name: "manage", root: env.root, code: [inside, outside] });
	plugin.provide("projects", () => [{ name: "acme", path: env.root, prefix: "AC" }]);
	await plugin.setup(manage({}));
	const job = await plugin.host.jobs.spawn({ task: RETRO_TASK, kind: "retro" });
	const home = dirname(plugin.host.folder);
	const read = (name: string) => readFileSync(join(home, "jobs", job.id, name), "utf8");
	assert.deepEqual([job.branch, read("task"), job.kind], [undefined, RETRO_TASK, "retro"]);
	const prompt = read("prompt");
	assert.match(prompt, /^# Retro\n\n## Your job\n/);
	const section = prompt.slice(prompt.indexOf("## This retro"));
	assert.ok(section.startsWith(`## This retro\n\nYou look back on project acme at ${job.base}; your worktree is a detached checkout of that commit.\n\n`), section);
	assert.ok(
		section.includes(
			"### Merges since the start (no retro yet)\n\nno retro due: 3 merges, 2 FAIL reviews and 3 findings since the start (no retro yet); 10 merges needed\n\n" +
				`- AC0001 Ticket AC0001 (${folder("AC0001")}/): outcome.md, review-1.md (FAIL), review-2.md (FAIL), findings.md (3)\n` +
				`- AC0002 Ticket AC0002 (${folder("AC0002")}/): outcome.md\n- AC0077: not on the board, nothing to read\n\n`,
		),
		section,
	);
	assert.ok(section.includes("### Stats\n\nStats of acme: 2 merged tickets\n"), "no retro yet: every merged ticket");
	assert.ok(section.includes("### Board\n\n"), section);
	assert.ok(section.endsWith(`### Roles and criteria\n\nThe files the plugins ship:\n- packages/manage/roles/retro.md\n- packages/manage/roles/coordinator/retro-ended.md\n- ${join(outside, "criteria/review.md")}\n\nThe project's own criteria files, beside the retro criteria above: styleguide, audit, retro.\n`), section);
});

test("retro.day and retro.at register one weekly entry; it starts a retro only while one is due, and none on another day", async (t) => {
	const env = await load(t, { retro: { day: "wed", at: "02:00", budgetUsd: 5 } });
	assert.deepEqual(env.entries.map(({ run, ...rest }) => ({ ...rest, run: typeof run })), [{ plugin: "manage", id: "retro", at: "02:00", days: ["wed"], option: "retro.at", run: "function" }]);
	env.merges(10, 1, 1, 4);
	const none = await env.scheduled();
	assert.deepEqual(none, { printed: ["manage: retro: no job, no retro due: 10 merges, 1 FAIL review and 4 findings since the start (no retro yet); 2 FAIL reviews or 5 findings needed"], job: undefined });
	env.merge("AC0011", 1);
	const started = await env.scheduled();
	assert.ok(started.job !== undefined);
	assert.deepEqual(started.printed, [`manage: retro: started job ${started.job.id}`]);
	assert.deepEqual([env.read(started.job.id, "task"), env.read(started.job.id, "budget")], [RETRO_TASK, "5"]);
	env.fake.setNow(new Date("2026-10-22T02:00:00Z"));
	assert.deepEqual((await env.scheduled()).printed, ["manage: retro: no job, thu is not in retro.day (wed)"], "a missed slot run late on a Thursday");
	assert.deepEqual((await load(t)).entries, [], "no retro option, no entry");
	await assert.rejects(Promise.try(() => manage({ retro: { day: "fri", at: "22:30" } }).setup(fakeHost({ name: "manage", options: { retro: { day: "fri", at: "22:30" } } }).host)), {
		message: "retro.at needs the schedule plugin, which starts the retro; add schedule() to the config's plugins, or leave retro out",
	});
});

test("/retro with no page answers so; with pages it sends the newest through the channel it came from, to its place", async (t) => {
	const env = await load(t);
	const none = `no retro page yet: spec/retro/ in ${env.root} holds none; a retro's filing writes one beside its report`;
	assert.equal(await env.fake.host.commands.route("/retro", { channel: "test" }), none);
	assert.deepEqual(await env.command("retro"), { code: 0, out: none, err: "" });
	const sent: unknown[] = [];
	// A channel as docs/commands/send.md describes one: it checks the message and throws a refusal, or answers its send.
	env.fake.provide("channel.send", (message: { files: string[]; place?: string }) => {
		if (message.files.some((file) => !existsSync(file))) throw new Error(`${message.files[0]}: no such file\nsecond line`);
		return async () => {
			sent.push(message);
			return `sent ${message.files.length} file in 1 message`;
		};
	});
	mkdirSync(join(env.root, "spec/retro"));
	for (const name of ["2026-10-14.html", "2026-10-21.html", "2026-10-21-2.html", "2026-10-21-2.md", "notes.html"]) writeFileSync(join(env.root, "spec/retro", name), name);
	assert.equal(await env.fake.host.commands.route("/retro", { channel: "test", place: "12" }), "spec/retro/2026-10-21-2.html: test: sent 1 file in 1 message");
	assert.deepEqual(sent, [{ files: [join(env.root, "spec/retro/2026-10-21-2.html")], place: "12" }]);
	assert.equal(await env.fake.host.commands.route("/retro", { channel: "telegram" }), "spec/retro/2026-10-21-2.html not sent: telegram provides no channel.send");
	assert.equal(sent.length, 1, "another channel's provider is not asked to send");
	assert.equal(await env.fake.host.commands.route("/retro now"), "usage: /retro");
	assert.deepEqual(await env.command("retro"), { code: 0, out: "spec/retro/2026-10-21-2.html", err: "" });
	assert.deepEqual(await env.command("retro", "x"), { code: 2, out: "", err: "usage: arthur retro [--project <name>]" });
});

test("the wake of a retro carries its procedure, of no other kind", async (t) => {
	const { fake } = await load(t);
	assert.deepEqual(fake.collect("coordinator.wake", { id: "x", kind: "retro" }), [undefined, PROCEDURE]);
	assert.deepEqual(fake.collect("coordinator.wake", { id: "x", kind: "audit" })[1], undefined);
});
