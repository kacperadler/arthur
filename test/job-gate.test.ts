import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";

// AR0353: inside a job (the wrapper sets ARTHUR_JOB to its record) the real CLI, with every plugin that registers a command
// loaded, runs only the commands its roles need, and refuses every other one before it acts. A plugin's own tests never load
// another plugin; this one, outside every package, loads them together.

const PACKAGES = join(import.meta.dirname, "..", "packages");
const CLI = join(PACKAGES, "core", "src", "cli.ts");
const RECORD = "/home/arthur/.arthur/jobs/2026-10-23-worker-0a1b2c3d";
const REFUSAL = "refused inside a job 2026-10-23-worker-0a1b2c3d: a job runs only the commands its role needs; put what the coordinator should do in your final message";
const PLUGINS = ["orchestration", "projects", "delivery", "develop", "findings", "github", "machines", "manage", "models", "resources", "schedule", "session", "youtrack"];
const CONFIG = `${PLUGINS.map((name) => `import { ${name} } from ${JSON.stringify(join(PACKAGES, name, "src", `${name}.ts`))};`).join("\n")}
export default { plugins: [orchestration({}), projects({ folders: ["projects/shop"] }), delivery({}), develop({}), findings({}),
	github({ instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }] }), machines({}), manage({}), models({}), resources({}), schedule({ file: "spec/schedule.json" }), session({}),
	youtrack({ instances: [{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" }] })] };
`;

// The project `shop` holding the config, its board with SH0001 and a schedule file, and the home holding the job's record,
// which names its project; one run outside a job first makes the home folder as a live one has it.
function shop(): string {
	const folder = temporaryFolder();
	const board = [{ id: "SH0001", title: "Shop", status: "planned", path: "spec/features/SH0001-shop/ticket.md", updated: "2026-10-21T08:00:00Z" }];
	for (const [path, text] of Object.entries({ "arthur.config.ts": CONFIG, "projects/shop/project.config.ts": 'export default [{ projects: { prefix: "SH", path: "../.." } }];\n', "spec/features/SH0001-shop/ticket.md": "# SH0001 - Shop\n", "spec/build.json": JSON.stringify(board), "spec/schedule.json": "[]\n", [`.arthur/jobs/${RECORD.split("/").at(-1)}/project`]: "shop\n" })) {
		mkdirSync(dirname(join(folder, path)), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: folder });
	assert.equal(arthur(folder, "", "version").status, 0);
	return folder;
}

function arthur(folder: string, job: string, ...args: string[]) {
	const env = { PATH: process.env.PATH ?? "", HOME: folder, XDG_CONFIG_HOME: join(folder, ".config"), ARTHUR_GITHUB_TOKEN: "t", ARTHUR_YOUTRACK_URL: "http://127.0.0.1:9", ARTHUR_YOUTRACK_TOKEN: "t", ARTHUR_JOB: job };
	return spawnSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env });
}

// Every path under `folder` with its file's text, `.git` left out.
function tree(folder: string): string[] {
	const paths = readdirSync(folder, { recursive: true, encoding: "utf8" }).filter((path) => path !== ".git" && !path.startsWith(".git/")).sort();
	return paths.map((path) => (statSync(join(folder, path)).isDirectory() ? `${path}/` : `${path}: ${readFileSync(join(folder, path), "utf8")}`));
}

test("inside a job every command that changes Arthur's state refuses with one line before it acts, and nothing in the folder changes", () => {
	const folder = shop();
	const before = tree(folder);
	const job = "2026-10-23-worker-00000001";
	for (const [name, ...args] of [
		["merge", job, "--unreviewed"],
		["merge", "--auto"],
		["spawn", "Fix it.", "--budget", "0", "--timeout", "0"],
		["continue", job, "Go on.", "--budget", "0"],
		["stop", job],
		["stopall"],
		["steer", job, "Stop."],
		["prune", "--all"],
		["send", "a.png"],
		["ticket", "new", "Mine"],
		["ticket", "status", "SH0001", "planned", "--autopilot"],
		["ticket", "status", "SH0001", "dropped"],
		["review", job],
		["review-needed"],
		["changelog"],
		["silent", "on"],
		["coordinator", "stop"],
		["restart"],
		["decision", "ask", "--kind", "question", "--question", "Why?"],
		["eval", "develop"],
		["init", "shop"],
		["ci", "main", "--rerun"],
		["run"],
		["setup"],
		["config", "check"],
		["doctor"],
		["attach"],
		["retro"],
		["usage"],
		["schedule", "add", "nightly", "03:00", "--task", "Audit."],
		["schedule", "remove", "nightly"],
		["remote-job", "stop", "/home/arthur/.arthur", job],
		["remote-job", "add", "/home/arthur/.arthur"],
	] as const) {
		const run = arthur(folder, RECORD, name, ...args);
		const said = name === "schedule" || name === "remote-job" ? `${name} ${args[0]}` : name === "ci" ? "ci --rerun" : name;
		assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", `arthur ${said}: ${REFUSAL}\n`], [name, ...args].join(" "));
	}
	assert.deepEqual(tree(folder), before, "nothing was written in the folder or its home");
});

test("inside a job the commands a role needs run, each to its own answer; youtrack keeps its own refusal of a write", () => {
	const folder = shop();
	for (const [args, status, answer] of [
		[["help"], 0, /^usage: arthur <command>/],
		[["help", "merge"], 0, /^# arthur merge\n/],
		[["merge", "--help"], 0, /^# arthur merge\n/],
		[["version"], 0, /^[0-9a-f]{12}\n$/],
		[["jobs"], 0, /^no jobs\n$/],
		[["decisions"], 0, /^no decisions yet\n$/],
		[["board"], 0, /^SH0001 planned +- +Shop\n$/],
		[["task", "SH0001"], 0, /^SH0001 planned\n# SH0001 - Shop\n/],
		[["plan", "SH0001"], 0, /^SH0001: no plan /],
		[["findings", "SH0001"], 0, /^SH0001: no findings /],
		[["projects"], 0, /^SH shop\n/],
		[["machines"], 0, /^local: /],
		[["resources"], 0, /^local: /],
		[["roles"], 0, /^worker: /],
		[["stats"], 0, /^No merged ticket in shop yet\.\n$/],
		[["retro-due"], 0, /^no retro due: /],
		[["health"], 0, /./],
		[["schedule"], 0, /^no entries; /],
		[["schedule", "list"], 0, /^no entries; /],
		[["ci", "main"], 1, /^arthur ci: project shop has no github\.project\(\{ workflow \}\), so github watches no run of it\n$/],
		[["youtrack"], 2, /^usage: arthur youtrack /],
		[["youtrack", "issue", "tag", "SH-1", "x"], 1, /^arthur youtrack: a job never writes to YouTrack;/],
		[["plugin"], 2, /^usage: arthur plugin new /],
		[["remote-job", "records", join(folder, ".arthur")], 0, /^\{\}\n$/],
	] as const) {
		const run = arthur(folder, RECORD, ...args);
		assert.deepEqual([run.status, answer.test(run.stdout + run.stderr)], [status, true], `${args.join(" ")}: ${run.stdout}${run.stderr}`);
	}
	const ticket = arthur(folder, "", "ticket", "new", "Mine");
	assert.deepEqual([ticket.status, ticket.stdout], [0, "SH0002 spec/features/SH0002-mine/ticket.md\n"], "with ARTHUR_JOB empty the same command acts");
});
