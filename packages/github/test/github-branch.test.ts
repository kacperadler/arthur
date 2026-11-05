import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { github } from "../src/github.ts";
import { again } from "../src/github-branch.ts";
import { deleteOnOrigin } from "../src/github-git.ts";

// A job's branch on origin (AR0555): deleted when the core prunes its job (`jobs.keep`), and `arthur github branch sweep`; any
// branch there listed and deleted with `arthur github branch list|delete` (AR0560);
// against the fake host, real Git, and a bare origin in a folder of its own.

const TOKEN = "github_pat_11ARTHUR0test0Never0Printed0abcdefghijklmnopqrstuvwxyz";
const NONE = "0000000000000000000000000000000000000000";

const git = (path: string, ...args: readonly string[]) => execFileSync("git", ["-C", path, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { encoding: "utf8" }).trim();

// The project `shop` on main, its origin a bare folder whose `post-receive` notes each ref it changed in `received`, and the
// plugin set up on a fake host, polling each second once `start()`ed. `job(n)` makes an ended worker's record and its worktree on `arthur/<id>` with one commit;
// `tip(branch)` is origin's, "" for none; `deletes()` the refs origin deleted, in order; `branch(...args)` runs `arthur github
// branch ...` as the CLI does, a throw being exit 1 and its message, and `sweep(...args)` its `sweep`.
async function world(t: TestContext) {
	const [origin, path, received, gate] = [temporaryFolder(), join(temporaryFolder(), "shop"), join(temporaryFolder(), "received"), temporaryFolder()];
	// The owner's ~/.gitconfig, for the test alone: a push to an origin that is a folder allowed (AR0393), and origin's listing
	// (`git ls-remote`) through `<gate>/upload-pack`, which notes each call in `<gate>/calls`, fails as an origin out of reach
	// while `<gate>/down` exists, and once the listing is over moves the ref `<gate>/move` names (`<ref> <commit>`), once; and
	// a push through `<gate>/receive-pack`, which fails likewise while `<gate>/dropped` exists.
	const [script, receive] = [join(gate, "upload-pack"), join(gate, "receive-pack")];
	const move = `if [ -e '${gate}/move' ]; then git -C '${origin}' update-ref $(cat '${gate}/move') && rm '${gate}/move'; fi`;
	const down = (marker: string) => `if [ -e '${gate}/${marker}' ]; then echo 'fatal: Could not read from remote repository.' >&2; exit 128; fi`;
	writeFileSync(script, `#!/bin/sh\necho >> '${gate}/calls'\n${down("down")}\ngit upload-pack "$@" || exit\n${move}\n`, { mode: 0o755 });
	writeFileSync(receive, `#!/bin/sh\n${down("dropped")}\nexec git receive-pack "$@"\n`, { mode: 0o755 });
	writeFileSync(join(gate, "gitconfig"), `[protocol "file"]\n\tallow = always\n[remote "origin"]\n\tuploadpack = ${script}\n\treceivepack = ${receive}\n`);
	for (const [name, value] of Object.entries({ GIT_CONFIG_GLOBAL: join(gate, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1" })) {
		const was = process.env[name];
		process.env[name] = value;
		t.after(() => (was === undefined ? delete process.env[name] : (process.env[name] = was)));
	}
	// `path` in a folder of its own, its jobs' worktrees beside it, where a spawn puts them.
	mkdirSync(path);
	git(origin, "init", "--quiet", "--bare", "--initial-branch=main");
	writeFileSync(join(origin, "hooks", "post-receive"), `#!/bin/sh\ncat >> '${received}'\n`, { mode: 0o755 });
	// `reject(reason)`: origin answers each push to an `arthur/*` branch `[remote rejected] (<reason>)`, as a proc-receive hook
	// (githooks(5)) may, the ref kept; `reject("")`, no more.
	const pkt = `pkt() { printf '%04x%s' $((\${#1} + 4)) "$1"; }\nread_pkts() { while n=$(dd bs=1 count=4 2>/dev/null) && [ -n "$n" ] && [ "$n" != 0000 ]; do dd bs=1 count=$((0x$n - 4)) 2>/dev/null; echo; done; }`;
	const reject = (reason: string) => {
		const answer = `read_pkts > /dev/null\npkt version=1\nprintf 0000\nfor ref in $(read_pkts | cut -d ' ' -f 3); do pkt "ng $ref ${reason}"; done\nprintf 0000`;
		writeFileSync(join(origin, "hooks", "proc-receive"), `#!/bin/sh\n${pkt}\n${answer}\n`, { mode: 0o755 });
		git(origin, "config", ...(reason === "" ? ["--unset", "receive.procReceiveRefs"] : ["receive.procReceiveRefs", "refs/heads/arthur/"]));
	};
	git(path, "init", "--quiet", "--initial-branch=main");
	git(path, "remote", "add", "origin", origin);
	git(path, "commit", "--quiet", "--allow-empty", "-m", "first");
	git(path, "push", "--quiet", "origin", "main");
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void out.push(text));
	t.mock.method(console, "error", (text: string) => void err.push(text));
	const options = { instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }], poll: { everySeconds: 1 } };
	const fake = fakeHost({ name: "github", options, env: { ARTHUR_GITHUB_TOKEN: TOKEN } });
	const alone = temporaryFolder();
	git(alone, "init", "--quiet", "--initial-branch=main");
	fake.provide("projects", () => [
		{ name: "shop", path, prefix: "SH" },
		{ name: "alone", path: alone, prefix: "AL" },
	]);
	const plugin = github(options);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	const home = dirname(fake.host.folder);
	const job = (n: number) => {
		const id = `2026-01-01-worker-${n.toString(16).padStart(8, "0")}`;
		const [branch, worktree] = [`arthur/${id}`, join(dirname(path), ".arthur-worktrees", id)];
		git(path, "worktree", "add", "--quiet", "-b", branch, worktree, "main");
		git(worktree, "commit", "--quiet", "--allow-empty", "-m", `on ${id}`);
		mkdirSync(join(home, "jobs", id), { recursive: true });
		for (const [key, value] of Object.entries({ kind: "worker", project: "shop", branch, state: "ended", reason: "finished", root: path, worktree })) writeFileSync(join(home, "jobs", id, key), value);
		return { id, branch, worktree, tip: git(worktree, "rev-parse", "HEAD") };
	};
	const command = fake.commands.find((each) => each.name === "github");
	const branch = async (...args: string[]) => {
		const [said, failed] = [out.length, err.length];
		const code = await Promise.resolve(command?.run({ args: ["branch", ...args], project: undefined })).catch((error: Error) => (err.push(error.message), 1));
		return { code: code ?? 0, out: out.slice(said).join("\n"), err: err.slice(failed).join("\n") };
	};
	const sweep = (...args: string[]) => branch("sweep", ...args);
	return {
		fake,
		home,
		path,
		alone,
		origin,
		gate,
		job,
		branch,
		sweep,
		out,
		start: () => plugin.start?.(),
		reject,
		calls: () => (existsSync(join(gate, "calls")) ? readFileSync(join(gate, "calls"), "utf8").length : 0),
		tip: (branch: string) => spawnSync("git", ["-C", origin, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { encoding: "utf8" }).stdout.trim(),
		push: (branch: string) => fake.call<Promise<string>>("github.push", { project: "shop", branch }),
		merge: (branch: string) => git(path, "merge", "--quiet", "--no-ff", "-m", `Merge ${branch}`, branch),
		deletes: () => (existsSync(received) ? readFileSync(received, "utf8") : "").split("\n").flatMap((line) => (line.split(" ")[1] === NONE ? [line.split(" ")[2]] : [])),
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { readonly text: string }).text),
		keep: (job: { readonly id: string; readonly branch: string }, project = "shop") => fake.collect("jobs.keep", { kind: "worker", task: "", state: "ended", reason: "finished", worktree: "", project, ...job }),
	};
}

test("a pruned job's branch is deleted on origin once when github pushed it or main holds it; a prune again deletes nothing and says nothing; the record keeps no one", async (t) => {
	const w = await world(t);
	const [one, two] = [w.job(1), w.job(2)];
	assert.equal(await w.push(one.branch), `github: pushed ${one.branch} to origin: [new branch]`);
	assert.equal(await w.push("main"), "github: pushed main to origin: [up to date]");
	// Pushed by plain git: no record, so main holding it is what lets it go.
	git(w.path, "push", "--quiet", "origin", two.branch);
	for (const each of [one, two]) w.merge(each.branch);
	assert.deepEqual(readdirSync(join(w.fake.host.folder, "pushed")), [one.id], "a job's branch pushed is recorded, main is not");
	assert.equal(readFileSync(join(w.fake.host.folder, "pushed", one.id), "utf8"), `${one.tip}\n`);
	assert.deepEqual(w.keep(one).concat(w.keep({ id: one.id, branch: "" })), [undefined, undefined], "github never keeps a record");
	// A test plugin keeps the record of `one`, so it can be pruned again.
	w.fake.provide("jobs.keep", ({ id }: { readonly id: string }) => (id === one.id ? "the test keeps it" : undefined));
	assert.deepEqual(w.fake.host.jobs.prune([one.id]), [`${one.id}: worktree ${one.worktree} removed; branch ${one.branch} deleted; kept the record: the test keeps it`]);
	await until("its branch gone from origin", () => w.tip(one.branch) === "");
	await until("its push record gone with it", () => !existsSync(join(w.fake.host.folder, "pushed", one.id)));
	// The prune again, then another job's: one after the other, so once `two` is gone the second look at `one` is over.
	assert.deepEqual(w.fake.host.jobs.prune([one.id, two.id]), [`${one.id}: kept the record: the test keeps it`, `${two.id}: worktree ${two.worktree} removed; branch ${two.branch} deleted; record deleted`]);
	await until("two's branch gone from origin", () => w.tip(two.branch) === "");
	await until("two's line", () => w.out.includes(`github: deleted ${two.branch} on origin (${two.tip.slice(0, 7)})`));
	assert.deepEqual(w.deletes(), [`refs/heads/${one.branch}`, `refs/heads/${two.branch}`]);
	assert.deepEqual(w.notices(), []);
	assert.equal(w.tip("main"), git(w.origin, "rev-parse", "main"), "main stays");
});

test("refused, each a notice, origin's branch kept: a tip moved since github's push, a tip neither pushed nor in main, main, a foreign name, an unknown project, a planted config, the checkout's own branch; a project without origin says nothing", async (t) => {
	const w = await world(t);
	const [moved, unmerged, own] = [w.job(1), w.job(2), w.job(3)];
	assert.equal(await w.push(moved.branch), `github: pushed ${moved.branch} to origin: [new branch]`);
	w.merge(moved.branch);
	// Another commit reaches origin's branch after Arthur's push, from another clone.
	const other = temporaryFolder();
	execFileSync("git", ["clone", "--quiet", "--branch", moved.branch, w.origin, other]);
	git(other, "commit", "--quiet", "--allow-empty", "-m", "elsewhere");
	git(other, "push", "--quiet", "origin", moved.branch);
	const later = git(other, "rev-parse", "HEAD");
	assert.deepEqual(w.fake.host.jobs.prune([moved.id]), [`${moved.id}: worktree ${moved.worktree} removed; branch ${moved.branch} deleted; record deleted`]);
	const said = `github: ${moved.branch} not deleted on origin: origin's tip ${later.slice(0, 7)} is not the commit Arthur pushed (${moved.tip.slice(0, 7)}), nor in main`;
	await until("the moved tip's notice", () => w.notices().includes(said));
	// Pushed by plain git, so no record, and not in main; its local branch gone by hand.
	git(w.path, "push", "--quiet", "origin", unmerged.branch);
	git(w.path, "worktree", "remove", unmerged.worktree);
	git(w.path, "branch", "--quiet", "-D", unmerged.branch);
	w.keep({ id: own.id, branch: own.branch }, "alone");
	w.keep(unmerged);
	w.keep({ id: own.id, branch: "main" });
	w.keep({ id: own.id, branch: "arthur/other" });
	w.keep(unmerged, "nope");
	// Before the checkout moves to `own`'s branch: each answer reads main as it is when its turn comes.
	await until("five notices", () => w.notices().length === 5);
	git(w.path, "config", "core.sshCommand", "/bin/false");
	w.keep(unmerged);
	await until("six notices", () => w.notices().length === 6);
	git(w.path, "config", "--unset", "core.sshCommand");
	git(w.path, "worktree", "remove", own.worktree);
	git(w.path, "checkout", "--quiet", own.branch);
	git(w.path, "push", "--quiet", "origin", own.branch);
	w.keep(own);
	const refused = [
		said,
		`github: ${unmerged.branch} not deleted on origin: origin's tip ${unmerged.tip.slice(0, 7)} is not the commit Arthur pushed (none recorded), nor in main`,
		`github: main not deleted on origin: it is not arthur/${own.id}, the branch of job ${own.id}`,
		`github: arthur/other not deleted on origin: it is not arthur/${own.id}, the branch of job ${own.id}`,
		`github: ${unmerged.branch} not deleted on origin: no project nope`,
		`github: ${unmerged.branch} not deleted on origin: ${join(w.path, ".git", "config")} sets core.sshcommand, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`,
		`github: ${own.branch} not deleted on origin: ${w.path} has it checked out`,
	];
	await until("every notice", () => w.notices().length === refused.length && w.notices());
	assert.deepEqual(w.notices(), refused, "the project without origin said nothing");
	assert.deepEqual([w.tip(moved.branch), w.tip(unmerged.branch), w.tip(own.branch)], [later, unmerged.tip, own.tip]);
	assert.deepEqual(w.deletes(), []);
});

test("a branch not in main whose origin tip is the one github pushed is deleted (a dropped ticket's); a failed delete is a notice and frees the worktree all the same", async (t) => {
	const w = await world(t);
	const [dropped, failing] = [w.job(1), w.job(2)];
	assert.equal(await w.push(dropped.branch), `github: pushed ${dropped.branch} to origin: [new branch]`);
	git(w.path, "worktree", "remove", dropped.worktree);
	git(w.path, "branch", "--quiet", "-D", dropped.branch);
	assert.deepEqual(w.fake.host.jobs.prune([dropped.id]), [`${dropped.id}: record deleted`]);
	await until("the dropped branch gone from origin", () => w.tip(dropped.branch) === "");
	assert.equal(await w.push(failing.branch), `github: pushed ${failing.branch} to origin: [new branch]`);
	w.merge(failing.branch);
	writeFileSync(join(w.origin, "hooks", "pre-receive"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	assert.deepEqual(w.fake.host.jobs.prune([failing.id]), [`${failing.id}: worktree ${failing.worktree} removed; branch ${failing.branch} deleted; record deleted`]);
	assert.equal(existsSync(failing.worktree), false);
	await until("the failure's notice", () => w.notices().includes(`github: ${failing.branch} not deleted on origin: [remote rejected] (pre-receive hook declined)`));
	assert.equal(w.tip(failing.branch), failing.tip);
	assert.equal(existsSync(join(w.fake.host.folder, "pushed", failing.id)), true, "its record stays for the next try");
	assert.deepEqual(w.notices().length, 1);
	const refused = w.job(3);
	assert.equal(await w.push(refused.branch), `github: ${refused.branch} not pushed to origin: [remote rejected] (pre-receive hook declined)`);
	assert.equal(existsSync(join(w.fake.host.folder, "pushed", refused.id)), false, "a push origin refused records no tip");
});

test("a delete git failed (origin out of reach) is recorded and told once, retried each poll without a word, and done once origin answers; a second prune adds no second record; 24 hours of failures are told once and given up, a minute less is not", async (t) => {
	const w = await world(t);
	const [one, two] = [w.job(1), w.job(2)];
	for (const each of [one, two]) {
		assert.equal(await w.push(each.branch), `github: pushed ${each.branch} to origin: [new branch]`);
		w.merge(each.branch);
	}
	writeFileSync(join(w.gate, "down"), "");
	w.fake.host.jobs.prune([one.id, two.id]);
	const left = (job: { readonly branch: string }) => `github: ${job.branch} not deleted on origin, retrying: fatal: Could not read from remote repository.`;
	await until("both told", () => w.notices().length === 2);
	assert.deepEqual(w.notices(), [left(one), left(two)]);
	const pending = join(w.fake.host.folder, "pending");
	const record = (id: string) => JSON.parse(readFileSync(join(pending, id), "utf8"));
	const first = record(one.id);
	assert.deepEqual({ ...first, since: "" }, { project: "shop", branch: one.branch, tip: one.tip, since: "" });
	assert.ok(Math.abs(Date.now() - Date.parse(first.since)) < 60_000, first.since);
	// A second prune of `one` while origin is out of reach; another job's foreign name queued after it says when it is over.
	const other = "2026-01-01-worker-0000000f";
	w.keep(one);
	w.keep({ id: other, branch: "main" });
	await until("the foreign name's notice", () => w.notices().length === 3);
	assert.equal(w.notices()[2], `github: main not deleted on origin: it is not arthur/${other}, the branch of job ${other}`);
	assert.deepEqual(readdirSync(pending).toSorted(), [one.id, two.id], "no second record");
	assert.deepEqual(record(one.id), first, "nor a new start");
	// Two past 24 hours of failures is given up at the next poll; one, a minute short of them, is tried again.
	const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
	writeFileSync(join(pending, two.id), JSON.stringify({ ...record(two.id), since: ago(24 * 3600_000 + 1000) }));
	writeFileSync(join(pending, one.id), JSON.stringify({ ...first, since: ago(24 * 3600_000 - 60_000) }));
	const calls = w.calls();
	w.start();
	await until("two given up", () => w.notices().length === 4);
	assert.equal(w.notices()[3], `github: ${two.branch} still on origin after 24 h: fatal: Could not read from remote repository.; arthur github branch sweep deletes it once origin answers`);
	// The first poll tried both, the second `one` alone, without a word.
	await until("two polls", () => w.calls() >= calls + 3);
	assert.deepEqual(readdirSync(pending), [one.id]);
	assert.equal(w.notices().length, 4);
	rmSync(join(w.gate, "down"));
	await until("one gone from origin", () => w.tip(one.branch) === "");
	await until("its line", () => w.out.includes(`github: deleted ${one.branch} on origin (${one.tip.slice(0, 7)})`));
	await until("its record gone", () => readdirSync(pending).length === 0);
	assert.equal(existsSync(join(w.fake.host.folder, "pushed", one.id)), false, "its push record with it");
	assert.equal(w.notices().length, 4, "a success after failures says no more");
	assert.equal(w.tip(two.branch), two.tip, "two, given up, stays");
	assert.deepEqual(w.deletes(), [`refs/heads/${one.branch}`]);
});

test("a lease refused (origin's tip moved between the look and the delete) is told as before, and not recorded for a retry", async (t) => {
	const w = await world(t);
	const one = w.job(1);
	assert.equal(await w.push(one.branch), `github: pushed ${one.branch} to origin: [new branch]`);
	w.merge(one.branch);
	const main = w.tip("main");
	writeFileSync(join(w.gate, "move"), `refs/heads/${one.branch} ${main}`);
	w.fake.host.jobs.prune([one.id]);
	await until("the notice", () => w.notices().length === 1);
	assert.deepEqual(w.notices(), [`github: ${one.branch} not deleted on origin: [rejected] (stale info)`]);
	assert.equal(existsSync(join(w.fake.host.folder, "pending", one.id)), false);
	assert.equal(w.tip(one.branch), main);
});

test("a delete push git failed once origin was listed is retried: the connection dropped, or [remote rejected] for a server's error", async (t) => {
	const w = await world(t);
	const [one, two] = [w.job(1), w.job(2)];
	for (const each of [one, two]) {
		assert.equal(await w.push(each.branch), `github: pushed ${each.branch} to origin: [new branch]`);
		w.merge(each.branch);
	}
	writeFileSync(join(w.gate, "dropped"), "");
	w.fake.host.jobs.prune([one.id]);
	await until("one told", () => w.notices().length === 1);
	rmSync(join(w.gate, "dropped"));
	w.reject("503 Service Unavailable");
	w.fake.host.jobs.prune([two.id]);
	await until("two told", () => w.notices().length === 2);
	assert.deepEqual(w.notices(), [
		`github: ${one.branch} not deleted on origin, retrying: fatal: Could not read from remote repository.`,
		`github: ${two.branch} not deleted on origin, retrying: [remote rejected] (503 Service Unavailable)`,
	]);
	const pending = join(w.fake.host.folder, "pending");
	assert.deepEqual([one, two].map((each) => JSON.parse(readFileSync(join(pending, each.id), "utf8")).tip), [one.tip, two.tip], "origin's tip, as listed");
	assert.deepEqual([w.tip(one.branch), w.tip(two.branch)], [one.tip, two.tip]);
	w.reject("");
	w.start();
	await until("both gone from origin", () => w.tip(one.branch) === "" && w.tip(two.branch) === "");
	await until("their records gone", () => readdirSync(pending).length === 0);
	assert.equal(w.notices().length, 2);
});

test("retried: git's own failure, or a [remote rejected] for a server's error; never a refusal git's porcelain gave", () => {
	// Each server's error matches one alternative only, so each alternative is needed.
	const retried = ["fatal: Could not read from remote repository.", "ssh: connect to host github.com port 22: Connection refused", "no end in 60 s", "[remote rejected] (internal server error)", "[remote rejected] (504)", "[remote rejected] (Service Unavailable)", "[remote rejected] (Bad Gateway)"];
	const refused = ["[rejected] (stale info)", "[remote rejected] (pre-receive hook declined)", "[remote rejected] (failed to update ref)", "[rejected] (fetch first)", "[rejected] (500 in the name)", "[remote rejected] (5000 refs)"];
	assert.deepEqual([...retried, ...refused].map(again), [...retried.map(() => true), ...refused.map(() => false)]);
});

test("the delete is leased: a branch whose tip moved since it was read is refused, the others of the same push deleted; a planted config refuses it whole, running nothing", async (t) => {
	const w = await world(t);
	const [moved, fine] = [w.job(1), w.job(2)];
	git(w.path, "push", "--quiet", "origin", moved.branch, fine.branch);
	git(w.path, "config", "core.sshCommand", "/bin/false");
	const planted = `${join(w.path, ".git", "config")} sets core.sshcommand, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	assert.deepEqual([...(await deleteOnOrigin(w.path, new Map([[fine.branch, fine.tip]])))], [[fine.branch, planted]]);
	git(w.path, "config", "--unset", "core.sshCommand");
	assert.deepEqual(w.deletes(), []);
	const stale = git(w.path, "rev-parse", "main");
	const result = await deleteOnOrigin(w.path, new Map([[moved.branch, stale], [fine.branch, fine.tip]]));
	assert.deepEqual([...result], [[moved.branch, "[rejected] (stale info)"], [fine.branch, ""]]);
	assert.deepEqual([w.tip(moved.branch), w.tip(fine.branch)], [moved.tip, ""]);
});

test("arthur github branch sweep deletes origin's arthur/* branches whose job is gone and whose tip main holds, keeps every other one with why; --dry-run deletes nothing", async (t) => {
	const w = await world(t);
	const [merged, alive, unmerged, refused] = [w.job(1), w.job(2), w.job(3), w.job(4)];
	w.merge(merged.branch);
	w.merge(refused.branch);
	git(w.path, "push", "--quiet", "origin", merged.branch, alive.branch, unmerged.branch, refused.branch, `${merged.tip}:refs/heads/arthur/other`, `${merged.tip}:refs/heads/feature`);
	for (const each of [merged, unmerged, refused]) execFileSync("rm", ["-rf", join(w.home, "jobs", each.id)]);
	mkdirSync(join(w.fake.host.folder, "pushed"), { recursive: true });
	writeFileSync(join(w.fake.host.folder, "pushed", merged.id), `${merged.tip}\n`);
	const kept = [
		`kept ${alive.branch}: its job still exists; arthur prune ${alive.id} frees it`,
		`kept ${unmerged.branch}: its tip ${unmerged.tip.slice(0, 7)} is not in main`,
		"kept arthur/other: not arthur/<job id>",
	];
	const dry = await w.sweep("--dry-run");
	assert.deepEqual(dry, {
		code: 0,
		out: [`would delete ${merged.branch} (${merged.tip.slice(0, 7)})`, ...kept.slice(0, 2), `would delete ${refused.branch} (${refused.tip.slice(0, 7)})`, kept[2], "--dry-run: 2 would be deleted, 3 kept; nothing deleted"].join("\n"),
		err: "",
	});
	assert.deepEqual(w.deletes(), [], "nothing deleted");
	// Origin refuses one ref of the push; the other goes.
	writeFileSync(join(w.origin, "hooks", "update"), `#!/bin/sh\n[ "$1" != refs/heads/${refused.branch} ]\n`, { mode: 0o755 });
	const swept = await w.sweep();
	assert.deepEqual(swept, {
		code: 1,
		out: [`deleted ${merged.branch} (${merged.tip.slice(0, 7)})`, ...kept.slice(0, 2), `kept ${refused.branch}: [remote rejected] (hook declined)`, kept[2], "1 deleted, 4 kept"].join("\n"),
		err: "",
	});
	assert.deepEqual(w.deletes(), [`refs/heads/${merged.branch}`]);
	assert.deepEqual([w.tip(alive.branch), w.tip(unmerged.branch), w.tip(refused.branch), w.tip("arthur/other"), w.tip("feature"), w.tip("main") !== ""], [alive.tip, unmerged.tip, refused.tip, merged.tip, merged.tip, true]);
	assert.equal(existsSync(join(w.fake.host.folder, "pushed", merged.id)), false, "its push record goes with it");
	execFileSync("rm", [join(w.origin, "hooks", "update")]);
	assert.equal((await w.sweep()).out.split("\n").at(-1), "1 deleted, 3 kept", "a second sweep deletes the one origin refused");
});

test("arthur github branch sweep says an origin with no arthur/* branch; refuses an origin it may not reach, wrong usage and a job's call", async (t) => {
	const w = await world(t);
	assert.deepEqual(await w.sweep(), { code: 0, out: "no arthur/* branches on origin of project shop", err: "" });
	assert.deepEqual(await w.sweep("--all"), { code: 2, out: "", err: "usage: arthur github pr list [--all]|get <n>|merge <n> | branch list|delete <branch> [--unmerged]|sweep [--dry-run] [--project <name>]" });
	assert.equal((await w.sweep("x")).code, 2);
	for (const args of [["delete"], ["delete", "a", "b"], ["delete", "a", "--dry-run"], ["list", "x"], ["list", "--unmerged"], ["sweep", "--unmerged"]]) assert.equal((await w.branch(...args)).code, 2, args.join(" "));
	const command = w.fake.commands.find((each) => each.name === "github");
	assert.deepEqual(await Promise.resolve(command?.run({ args: ["branch", "sweep"], project: "alone" })).catch((error: Error) => error.message), `origin's branches of project alone not listed: ${w.alone} has no origin remote`);
	git(w.path, "config", "core.sshCommand", "/bin/false");
	const planted = await w.sweep();
	assert.equal(planted.code, 1);
	assert.match(planted.err, /^origin's branches of project shop not listed: .*config sets core\.sshcommand, which a job can write/);
	git(w.path, "config", "--unset", "core.sshCommand");
	const was = process.env.ARTHUR_JOB;
	process.env.ARTHUR_JOB = "/home/arthur/.arthur/jobs/2026-10-29-worker-0a1b2c3d";
	t.after(() => (was === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = was)));
	const refusal = "arthur github branch sweep: refused inside a job 2026-10-29-worker-0a1b2c3d: a job runs only the commands its role needs; put what the coordinator should do in your final message";
	assert.deepEqual(await w.sweep("--dry-run"), { code: 1, out: "", err: refusal });
	assert.deepEqual(w.deletes(), []);
});

// A job's process: ARTHUR_JOB names its record, as a spawn sets it; restored at the test's end.
function asJob(t: TestContext): void {
	const was = process.env.ARTHUR_JOB;
	process.env.ARTHUR_JOB = "/home/arthur/.arthur/jobs/2026-10-29-worker-0a1b2c3d";
	t.after(() => (was === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = was)));
}

test("arthur github branch list: each branch on origin with its tip, whether main holds it or the checkout lacks it, and the job on it; inside a job too; an origin out of reach, and none", async (t) => {
	const w = await world(t);
	const [merged, working, unmerged] = [w.job(1), w.job(2), w.job(3)];
	w.merge(merged.branch);
	writeFileSync(join(w.home, "jobs", working.id, "state"), "working");
	// A commit only origin has, pushed from another clone.
	const other = temporaryFolder();
	execFileSync("git", ["clone", "--quiet", w.origin, other]);
	git(other, "commit", "--quiet", "--allow-empty", "-m", "elsewhere");
	git(other, "push", "--quiet", "origin", "HEAD:refs/heads/feature");
	git(w.path, "push", "--quiet", "origin", "main", merged.branch, working.branch, unmerged.branch);
	const short = (path: string, ref: string) => git(path, "rev-parse", "--short=7", ref);
	asJob(t);
	const lines = [
		`${merged.branch} ${short(w.path, merged.branch)} merged into main, job ${merged.id} (ended)`,
		`${working.branch} ${short(w.path, working.branch)} not in main, job ${working.id} (working)`,
		`${unmerged.branch} ${short(w.path, unmerged.branch)} not in main, job ${unmerged.id} (ended)`,
		`feature ${short(other, "HEAD")} not here`,
		`main ${short(w.path, "main")} merged into main`,
	];
	assert.deepEqual(await w.branch("list"), { code: 0, out: lines.join("\n"), err: "" });
	writeFileSync(join(w.gate, "down"), "");
	assert.deepEqual(await w.branch("list"), { code: 1, out: "", err: "origin's branches of project shop not listed: fatal: Could not read from remote repository." });
	rmSync(join(w.gate, "down"));
	const empty = temporaryFolder();
	git(empty, "init", "--quiet", "--bare");
	git(w.path, "remote", "set-url", "origin", empty);
	assert.deepEqual(await w.branch("list"), { code: 0, out: "no branches on origin of project shop", err: "" });
});

test("arthur github branch delete deletes a branch on origin once, leased; refuses the checkout's branch, origin's default, a job's not ended, an unmerged tip without --unmerged, a tip moved since the read, a planted config, a job's call", async (t) => {
	const w = await world(t);
	const [merged, working, unmerged, moved] = [w.job(1), w.job(2), w.job(3), w.job(4)];
	for (const each of [merged, working, moved]) w.merge(each.branch);
	writeFileSync(join(w.home, "jobs", working.id, "state"), "working");
	git(w.path, "push", "--quiet", "origin", "main", "main:release", merged.branch, working.branch, unmerged.branch, moved.branch);
	// Origin's default is `release`, so `main` is refused only as the checkout's branch, and `release` only as the default.
	git(w.origin, "symbolic-ref", "HEAD", "refs/heads/release");
	const refused = (branch: string, why: string) => ({ code: 1, out: "", err: `${branch} not deleted on origin: ${why}` });
	assert.deepEqual(await w.branch("delete", "main"), refused("main", `${w.path} has it checked out`));
	assert.deepEqual(await w.branch("delete", "release"), refused("release", "it is origin's default branch"));
	assert.deepEqual(await w.branch("delete", working.branch), refused(working.branch, `it is the branch of job ${working.id}, which has not ended (working)`));
	assert.deepEqual(await w.branch("delete", unmerged.branch), refused(unmerged.branch, `its tip ${unmerged.tip.slice(0, 7)} is not in main; --unmerged deletes it all the same`));
	// Another commit reaches origin's branch between the listing and the delete.
	writeFileSync(join(w.gate, "move"), `refs/heads/${moved.branch} ${unmerged.tip}`);
	assert.deepEqual(await w.branch("delete", moved.branch), refused(moved.branch, "[rejected] (stale info)"));
	git(w.path, "config", "core.sshCommand", "/bin/false");
	assert.match((await w.branch("delete", merged.branch)).err, /^origin's branches of project shop not listed: .*config sets core\.sshcommand, which a job can write/);
	git(w.path, "config", "--unset", "core.sshCommand");
	assert.deepEqual(w.deletes(), [], "nothing deleted yet");
	assert.deepEqual(await w.branch("delete", merged.branch), { code: 0, out: `deleted ${merged.branch} on origin (${merged.tip.slice(0, 7)})`, err: "" });
	assert.deepEqual(await w.branch("delete", merged.branch), refused(merged.branch, "origin has no such branch"));
	assert.deepEqual(await w.branch("delete", unmerged.branch, "--unmerged"), { code: 0, out: `deleted ${unmerged.branch} on origin (${unmerged.tip.slice(0, 7)})`, err: "" });
	assert.deepEqual(w.deletes(), [`refs/heads/${merged.branch}`, `refs/heads/${unmerged.branch}`]);
	assert.deepEqual([w.tip("main") !== "", w.tip("release") !== "", w.tip(working.branch), w.tip(moved.branch)], [true, true, working.tip, unmerged.tip]);
	asJob(t);
	const job = "refused inside a job 2026-10-29-worker-0a1b2c3d: a job runs only the commands its role needs; put what the coordinator should do in your final message";
	assert.deepEqual(await w.branch("delete", moved.branch, "--unmerged"), { code: 1, out: "", err: `arthur github branch delete: ${job}` });
	assert.equal(w.tip(moved.branch), unmerged.tip);
});
