import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { jobSlice, temporaryFolder, until } from "@arthur/core/testing";
import { fakeGithub } from "../packages/github/test/fake-github.ts";

// AR0590: a job of shop1, spawned by the real CLI with every plugin that registers an in-job command, in its real sandbox, reads
// nothing of shop2 in the shared home (its record, the event log, a plugin's state, a record spawned after it started), while its
// own record, shop1's records and the projects plugin's lists stay readable and `arthur jobs`, `board`, `findings` and `ci` answer
// for shop1. A plugin's own tests never load another plugin; this one, outside every package, loads them together.

const PACKAGES = join(import.meta.dirname, "..", "packages");
const CLI = join(PACKAGES, "core", "src", "cli.ts");
const PLUGINS = ["orchestration", "projects", "delivery", "develop", "findings", "github", "machines", "manage", "models", "resources", "schedule", "session", "youtrack"];
const [SHOP1, SHOP2, LATER] = ["2026-10-30-worker-5a0a1000", "2026-10-30-worker-5b0b2000", "2026-10-31-worker-5b0b3000"];
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" }).trim();

function write(folder: string, files: Readonly<Record<string, string>>): void {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(folder, path)), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
}

// A record as a spawn writes it, of `project`, its task naming what only that project's job knows.
const record = (project: string) => ({ kind: "worker", project, state: "ended", reason: "finished", task: `${project}'s task: the owner's plan for ${project}\n` });

test("a job of shop1 gets Permission denied on shop2's record, the event log, plugin state and a later record; its own commands answer for shop1 (AR0590)", async (t) => {
	const api = await fakeGithub(t);
	const folder = temporaryFolder();
	const [arthur, home, gate] = [join(folder, "arthur"), join(folder, "arthur", ".arthur"), join(folder, "gate")];
	for (const [name, prefix] of [["shop1", "SA"], ["shop2", "SB"]] as const) {
		const id = `${prefix}0001`;
		const ticket = `spec/features/${id}-${name}/ticket.md`;
		const board = [{ id, title: `The ${name} ticket`, status: "planned", path: ticket, updated: "2026-10-30T08:00:00Z" }];
		write(join(folder, name), { [ticket]: `# ${id} - The ${name} ticket\n`, [ticket.replace("ticket.md", "findings.md")]: `# ${id} - Findings\n\n## F1. A ${name} finding\n\n- Status: open\n`, "spec/build.json": JSON.stringify(board) });
		git(join(folder, name), "init", "--quiet", "--initial-branch=main");
		git(join(folder, name), "add", "--all");
		git(join(folder, name), "commit", "--quiet", "-m", "first");
		git(join(folder, name), "remote", "add", "origin", join(folder, "acme", `${name}.git`));
		const pieces = [{ projects: { prefix, path: `../../../${name}` } }, { github: { workflow: "ci.yml" } }];
		write(arthur, { [`projects/${name}/project.config.ts`]: `export default ${JSON.stringify(pieces)};\n` });
	}
	const head = git(join(folder, "shop1"), "rev-parse", "HEAD");
	api.runs["acme/shop1/ci.yml"] = [{ id: 7001, sha: head, branch: "main", status: "completed", conclusion: "success" }];
	// The agent: each read in the job's sandbox, once the test made a shop2 record after its start, then the commands a role runs.
	const reads = {
		"shop2's record": join(home, "jobs", SHOP2, "task"),
		"the event log": join(home, "events.jsonl"),
		"shop2's checks in delivery's folder": join(home, "delivery", SHOP2, "checks"),
		"github's state": join(home, "github", "state.json"),
		"a shop2 record spawned later": join(home, "jobs", LATER, "task"),
		"its record": "$ARTHUR_JOB/task",
		"a shop1 record": join(home, "jobs", SHOP1, "task"),
		"the projects plugin's checkouts": join(home, "projects", "checkouts"),
	};
	const lines = Object.entries(reads).map(([name, path]) => `if cat "${path}" >/dev/null 2>"$ARTHUR_JOB/err"; then echo "${name} read"; elif grep -q 'Permission denied' "$ARTHUR_JOB/err"; then echo "${name} denied"; else echo "${name} failed"; fi`);
	const commands = ["jobs", "board", "findings SA0001", "ci main"].map((command) => `echo "== ${command}"; node '${CLI}' ${command}`);
	const agent = join(folder, "agent");
	writeFileSync(agent, `#!/bin/sh\nwhile [ ! -e '${gate}' ]; do sleep 0.05; done\ncd '${arthur}'\nexport ARTHUR_GITHUB_TOKEN=t ARTHUR_YOUTRACK_URL=http://127.0.0.1:9 ARTHUR_YOUTRACK_TOKEN=t\n{\n${[...lines, ...commands].join("\n")}\n} > "$ARTHUR_JOB/out" 2>&1\n`, { mode: 0o755 });
	const plugins = PLUGINS.map((name) => (name === "github" ? `github({ instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN", apiUrl: ${JSON.stringify(api.apiUrl)} }] })` : name === "projects" ? 'projects({ folders: ["projects/shop1", "projects/shop2"] })' : name === "schedule" ? 'schedule({ file: "spec/schedule.json" })' : name === "youtrack" ? 'youtrack({ instances: [{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" }] })' : `${name}({})`));
	write(arthur, {
		"arthur.config.ts": `${PLUGINS.map((name) => `import { ${name} } from ${JSON.stringify(join(PACKAGES, name, "src", `${name}.ts`))};`).join("\n")}\nexport default { core: { agent: { command: ${JSON.stringify(agent)} } }, plugins: [${plugins.join(", ")}] };\n`,
		"spec/schedule.json": "[]\n",
		...Object.fromEntries([SHOP1, SHOP2].flatMap((id) => Object.entries(record(id === SHOP1 ? "shop1" : "shop2")).map(([name, text]) => [`.arthur/jobs/${id}/${name}`, text]))),
		".arthur/events.jsonl": `${JSON.stringify({ seq: 1, time: "2026-10-30T08:00:00Z", plugin: "telegram", name: "message", data: { text: "shop2: the owner's word on shop2" } })}\n`,
		[`.arthur/delivery/${SHOP2}/checks`]: "check pass 0123456 clean\n",
		".arthur/github/state.json": `${JSON.stringify({ runs: { shop2: ["9001/1"] }, pulls: {} })}\n`,
	});
	const env = { PATH: process.env.PATH ?? "", HOME: folder, XDG_CONFIG_HOME: join(folder, ".config"), ARTHUR_JOB_SLICE: jobSlice.slice, ARTHUR_GITHUB_TOKEN: "t", ARTHUR_YOUTRACK_URL: "http://127.0.0.1:9", ARTHUR_YOUTRACK_TOKEN: "t" };
	const spawned = spawnSync(process.execPath, [CLI, "spawn", "Read.", "--project", "shop1"], { cwd: arthur, encoding: "utf8", env });
	assert.equal(spawned.status, 0, spawned.stderr);
	const id = spawned.stdout.trim();
	await until("the job's run", () => existsSync(join(home, "jobs", id, "pid")));
	write(home, Object.fromEntries(Object.entries(record("shop2")).map(([name, text]) => [`jobs/${LATER}/${name}`, text])));
	writeFileSync(gate, "");
	await until("the job's end", () => existsSync(join(home, "jobs", id, "state")) && readFileSync(join(home, "jobs", id, "state"), "utf8") === "ended", { deadlineMs: 60_000 });
	const reason = readFileSync(join(home, "jobs", id, "reason"), "utf8");
	if (reason.startsWith("failed: no sandbox")) return t.skip(reason);
	const [said = "", ...answers] = readFileSync(join(home, "jobs", id, "out"), "utf8").split(/^== /m);
	assert.deepEqual(said.trim().split("\n"), Object.keys(reads).map((name, at) => `${name} ${at < 5 ? "denied" : "read"}`), reason);
	const answer = Object.fromEntries(answers.map((text) => [text.slice(0, text.indexOf("\n")), text.slice(text.indexOf("\n") + 1)]));
	assert.match(answer.jobs ?? "", new RegExp(`^ended\\n.*${SHOP1.slice(-8)}`, "m"), "shop1's other job is listed");
	assert.match(answer.jobs ?? "", new RegExp(id.slice(-8)), "the job itself is listed");
	assert.doesNotMatch(answer.jobs ?? "", /5b0b[23]000/, "no shop2 job is");
	assert.match(answer.board ?? "", /^SA0001 planned .*The shop1 ticket\n$/);
	assert.match(answer["findings SA0001"] ?? "", /## F1\. A shop1 finding/);
	assert.equal(answer["ci main"], `run 7001, attempt 1, of ci.yml on ${head.slice(0, 7)} (main's tip): success\nhttps://github.com/acme/shop1/actions/runs/7001\n`);
});
