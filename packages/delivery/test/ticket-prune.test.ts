import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { fakeAgent, temporaryFolder, until } from "@arthur/core/testing";
import { load, OWNER, running, TICKET } from "./merge-setup.ts";

// arthur merge (merge-setup.ts): a dropped or merged ticket's jobs pruned and their hand-backs ended.

test("a dropped ticket's ended jobs are pruned, an unmerged branch deleted with git branch -D; a job in a run or blocked, one on another machine, a worktree with changes, another ticket's or project's job and a planted config keep theirs", async (t) => {
	const { root, fake, home, git, worker, aside, ended } = await load(t);
	const [kept, gone, blocked, remote, orphan] = [await worker(), await worker(), await worker(), await worker(), await worker()];
	// Their worktrees removed by hand: the prune finds only their unmerged branches, which no worktree holds.
	for (const job of [gone, blocked, remote, orphan]) git(root, "worktree", "remove", job.worktree);
	// Blocked by a plugin's hold after its run, on a machine no plugin registers now, and of a project no longer in the list.
	for (const [job, file, value] of [[blocked, "state", "blocked"], [remote, "machine", "gpu"], [orphan, "project", "gone"]] as const) writeFileSync(join(home, "jobs", job.id, file), value);
	// Jobs of another ticket, and of an id that only begins like AC0001, their branches unmerged and in no worktree: never forced.
	const strangers = [await aside("spec/features/AC0002-cart/ticket.md"), await aside("spec/features/AC00010-shops/ticket.md")];
	for (const job of strangers) git(root, "worktree", "remove", job.worktree);
	const dirty = await worker({});
	writeFileSync(join(dirty.worktree, "draft.ts"), "export const draft = 1;\n");
	const loose = await worker({ "loose.ts": "export const loose = 1;\n" }, "No ticket here.");
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "done" }] }))}${delimiter}${process.env.PATH}`;
	const running = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}` });
	t.after(() => writeFileSync(gate, ""));
	const said: string[] = [];
	t.mock.method(console, "log", (text: string) => void said.push(text));
	const drop = (project = "acme") => fake.emit("ticket-moved", { id: "AC0001", project, from: "in-progress", to: "dropped" });
	const all = [kept, gone, blocked, remote, orphan, dirty, loose, running, ...strangers];
	const exists = () => all.map((job) => [existsSync(join(home, "jobs", job.id)), git(root, "branch", "--list", job.branch ?? "") !== ""]);
	// A key a job can write in the repository's config: no git call runs, every branch stays.
	git(root, "config", "core.sshCommand", "/bin/false");
	drop();
	await until("the drop's lines", () => said.length > 0);
	const planted = `${join(root, ".git", "config")} sets core.sshcommand, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	assert.equal(said.at(-1), `delivery: AC0001 dropped: kept every unmerged branch: ${planted}`);
	assert.match(said.find((line) => line.includes(`${gone.id}:`)) ?? "", new RegExp(`^delivery: AC0001 dropped: ${gone.id}: kept branch ${gone.branch} and the record: git branch: error: `));
	assert.deepEqual(exists(), Array(all.length).fill([true, true]));
	git(root, "config", "--unset", "core.sshCommand");
	said.length = 0;
	drop();
	await until("the drop's lines", () => said.length > 0);
	// The jobs come in the order `arthur jobs` lists them, newest first; spawned in the same millisecond, either.
	assert.deepEqual(said.slice(-4).sort(), [
		`delivery: AC0001 dropped: ${gone.branch} deleted, not merged: AC0001 is dropped`,
		`delivery: AC0001 dropped: ${gone.id}: record deleted`,
		`delivery: AC0001 dropped: ${kept.branch} deleted, not merged: AC0001 is dropped`,
		`delivery: AC0001 dropped: ${kept.id}: record deleted`,
	].sort());
	assert.ok(said.includes(`delivery: AC0001 dropped: ${running.id}: kept: it is in a run; once it ends, delivery prunes it, its branch too`), said.join("\n"));
	assert.ok(said.includes(`delivery: AC0001 dropped: ${blocked.id}: kept: it is blocked (finished), not ended`), said.join("\n"));
	assert.ok(said.some((line) => line.startsWith(`delivery: AC0001 dropped: ${remote.id}: kept its worktree, branch and record: `)), said.join("\n"));
	assert.ok(said.some((line) => line.startsWith(`delivery: AC0001 dropped: ${dirty.id}: kept its worktree, branch and record: git worktree: `)), said.join("\n"));
	assert.equal(said.some((line) => [orphan, loose, ...strangers].some((job) => line.includes(job.id))), false, "another project's job, a job of no ticket, another ticket's are not the ticket's");
	assert.deepEqual(exists(), [[false, false], [false, false], ...Array(all.length - 2).fill([true, true])]);
	assert.equal(existsSync(kept.worktree), false);
	// The project's drop finds its job; with the project gone from the list, no checkout now to check its record against: everything kept, no branch forced.
	said.length = 0;
	drop("gone");
	await until("the drop's line", () => said.length > 0);
	assert.equal(said.join("\n"), `delivery: AC0001 dropped: ${orphan.id}: kept its worktree, branch and record: unknown project gone; projects: acme`);
	assert.deepEqual(exists()[4], [true, true]);
	said.length = 0;
	fake.emit("ticket-moved", { id: "AC0001", project: "acme", from: "in-progress", to: "review" });
	assert.equal(said.join("\n"), "", "only a drop prunes");
	// The job in a run, once it ends on the dropped ticket, goes as the drop's prune would have taken it.
	fake.host.board.move("AC0001", "dropped");
	said.length = 0;
	writeFileSync(gate, "");
	await ended(running.id);
	await until("its prune at its end", () => said.some((line) => line.startsWith(`delivery: AC0001 dropped: ${running.id}: worktree ${running.worktree} removed; branch ${running.branch} deleted; record deleted`)));
	assert.deepEqual(exists()[7], [false, false]);
});

test("a dropped ticket's prune that rejects is logged, from the drop and from the end of a job it kept in a run, and arthur run goes on", async (t) => {
	const { fake, worker, ended } = await load(t);
	const job = await worker();
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "done" }] }))}${delimiter}${process.env.PATH}`;
	const running = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}` });
	t.after(() => writeFileSync(gate, ""));
	fake.provide("jobs.keep", () => {
		throw new Error("the keep is unreadable");
	});
	const failed: string[] = [];
	t.mock.method(console, "error", (text: string) => void failed.push(text));
	t.mock.method(console, "log", () => undefined);
	const moved = fake.emit("ticket-moved", { id: "AC0001", project: "acme", from: "in-progress", to: "dropped" });
	await until("the drop's failure", () => failed.length > 0);
	assert.deepEqual(failed, [`plugin delivery: handler of ticket-moved (event ${moved.seq}) failed: the keep is unreadable`]);
	assert.equal(existsSync(job.worktree), false);
	fake.host.board.move("AC0001", "dropped");
	writeFileSync(gate, "");
	await ended(running.id);
	await until("the failure at its end", () => failed.includes("delivery: AC0001 dropped: the keep is unreadable"));
});

test("a dropped ticket's ended job whose record names another job's branch deletes no branch and says why", async (t) => {
	const { root, fake, home, git, worker, aside } = await load(t);
	const [liar, victim] = [await worker(), await aside("spec/features/AC0002-cart/ticket.md")];
	// Neither worktree holds a branch any more, so only the record's branch name stands between `git branch -D` and the other job's work.
	for (const job of [liar, victim]) git(root, "worktree", "remove", job.worktree);
	writeFileSync(join(home, "jobs", liar.id, "branch"), victim.branch);
	const said: string[] = [];
	t.mock.method(console, "log", (text: string) => void said.push(text));
	fake.emit("ticket-moved", { id: "AC0001", project: "acme", from: "in-progress", to: "dropped" });
	await until("the drop's line", () => said.length > 0);
	t.mock.restoreAll();
	assert.deepEqual(said, [`delivery: AC0001 dropped: ${liar.id}: kept its worktree, branch and record: its record names the branch ${victim.branch}, where the spawn made ${liar.branch} or none`]);
	assert.deepEqual([git(root, "branch", "--list", victim.branch), git(root, "branch", "--list", liar.branch), existsSync(join(home, "jobs", liar.id))], [victim.branch, liar.branch, true]);
});

test("a merge ends the hand-backs of its ticket's jobs, a worker still in a run included, so none goes on to review a merged ticket", async (t) => {
	const { fake, worker, merge } = await load(t);
	const job = await worker();
	const waiting = await worker({ "draft.ts": "export const draft = 1;\n" });
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "done" }] }))}${delimiter}${process.env.PATH}`;
	const running = await fake.host.jobs.spawn({ task: `Ticket: ${TICKET}` });
	t.after(() => writeFileSync(gate, ""));
	// What delivery's hand-back keeps of each (hand-back.ts): one waits for a slot to be continued, one runs on a review's findings.
	const folder = join(fake.host.folder, "hand-backs");
	mkdirSync(folder, { recursive: true });
	for (const [id, step] of [[waiting.id, "continue"], [running.id, "continued"]]) writeFileSync(join(folder, `${id}.json`), `${JSON.stringify({ worker: id, review: "2026-01-01-review-0000000f", findings: "Missing test.", step })}\n`);
	const merged = await merge(job.id, "--unreviewed", "--decision", OWNER);
	assert.equal(merged.code, undefined, merged.err);
	assert.deepEqual(readdirSync(folder), [], "no hand-back of the merged ticket is left");
	assert.match(merged.out, new RegExp(`\n${running.id}: kept: it is (working|idle), not ended\n`), "the worker in a run is kept all the same");
});
