import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import dns from "node:dns/promises";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import type { AddressInfo } from "node:net";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { everyOption, type OptionTable } from "@arthur/core/option-table";
import type { Requirement } from "@arthur/core/plugin";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { checkOptions, table } from "../src/model-options.ts";
import { DEFAULTS, type ModelsOptions, models } from "../src/models.ts";

// The models plugin against the fake host, a fake Ollama and a fake OpenAI-compatible server on loopback ports the OS picks,
// each answering its model list in its documented shape, and the fake agent as `omp`, its usage report included.

type Seen = { readonly path: string; readonly headers: IncomingHttpHeaders };
type Answer = { readonly status: number; readonly body: unknown } | "hang";

// A server on 127.0.0.1 that notes each request and answers `answer(path)`; `hang` never answers.
async function server(answer: (path: string) => Answer) {
	const seen: Seen[] = [];
	const http = createServer((request, response) => {
		seen.push({ path: request.url ?? "", headers: request.headers });
		const said = answer(request.url ?? "");
		if (said === "hang") return;
		response.writeHead(said.status, { "content-type": "application/json" }).end(typeof said.body === "string" ? said.body : JSON.stringify(said.body));
	});
	await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
	const close = () => {
		http.closeAllConnections();
		http.close();
	};
	return { url: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, seen, close };
}

// Ollama's `GET /api/tags` and OpenAI's `GET /v1/models`, every field as their docs show them.
const TAGS = {
	models: [
		{
			name: "qwen3-coder:latest",
			model: "qwen3-coder:latest",
			modified_at: "2026-10-01T10:00:00.000000+02:00",
			size: 18556700761,
			digest: "06c1097efce0431c2045fe7b2e5108366e43bee1b4603a7aded8f21689e90bca",
			details: { parent_model: "", format: "gguf", family: "qwen3moe", families: ["qwen3moe"], parameter_size: "30.5B", quantization_level: "Q4_K_M" },
		},
	],
};
const MODELS = { object: "list", data: [{ id: "qwen3-32b", object: "model", created: 1760000000, owned_by: "organization_owner" }] };
const ollama = () => server((path) => (path === "/api/tags" ? { status: 200, body: TAGS } : { status: 404, body: "404 page not found" }));
const openai = () => server((path) => (path === "/v1/models" ? { status: 200, body: MODELS } : { status: 404, body: { error: "not found" } }));

const NOW = new Date("2026-01-01T00:00:00Z");
const after = (minutes: number) => NOW.getTime() + minutes * 60_000;

// omp's `usage --json`, as omp 18 prints it.
function report(windows: readonly { readonly id: string; readonly used: number; readonly tier?: string; readonly resetsIn: number }[], extra: object = {}) {
	return {
		generatedAt: NOW.getTime(),
		reports: [
			{
				provider: "anthropic",
				fetchedAt: NOW.getTime(),
				limits: windows.map(({ id, used, tier, resetsIn }) => ({
					id: `anthropic:${id}${tier ? `:${tier}` : ""}`,
					label: `Claude ${id === "5h" ? "5 Hour" : "7 Day"}${tier ? ` (${tier})` : ""}`,
					scope: { provider: "anthropic", windowId: id, ...(tier ? { tier } : { shared: true }) },
					window: { id, label: id === "5h" ? "5 Hour" : "7 Day", durationMs: id === "5h" ? 18000000 : 604800000, resetsAt: after(resetsIn) },
					amount: { used: used * 100, limit: 100, remaining: 100 - used * 100, usedFraction: used, remainingFraction: 1 - used, unit: "percent" },
					status: used >= 1 ? "exhausted" : "ok",
				})),
				metadata: { endpoint: "https://api.anthropic.com/api/oauth/usage", accountId: "acc-1", email: "owner@example.com", orgId: "org-1", orgName: "owner@example.com's Organization" },
			},
		],
		accountsWithoutUsage: [],
		disabledCredentials: [],
		capacity: {},
		...extra,
	};
}

// `omp` on PATH: the fake agent playing `run`, which notes every start beside it.
const PATH = process.env.PATH ?? "";
function agent(run: AgentRun): string {
	const omp = fakeAgent(run);
	process.env.PATH = [dirname(omp), PATH].join(delimiter);
	return join(dirname(omp), "starts.jsonl");
}
const says = (value: unknown) => agent({ steps: [{ stdout: JSON.stringify(value) }] });
const starts = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").length : 0);

async function load(options: ModelsOptions, env: Readonly<Record<string, string>> = {}, root?: string) {
	const fake = fakeHost({ name: "models", options, env, now: NOW, root });
	await fake.setup(models(options));
	const pick = (list: readonly string[], machine = "local") => fake.call<Promise<{ model: string; why: string; free: boolean }>>("models.pick", list, machine);
	return { fake, pick };
}

test("refused at load: a kind other than the two, a url not http or https or with a public host, probeSeconds not a positive whole number", () => {
	const problems = (options: Readonly<Record<string, unknown>>) => checkOptions(options).map((each) => `${each.path}: ${each.problem}`);
	assert.deepEqual(problems({ providers: { mac: { kind: "vllm", url: "http://127.0.0.1:1" } } }), ['providers.mac.kind: expected ollama or openai-compatible, got "vllm"']);
	for (const url of ["ftp://127.0.0.1/", "http://8.8.8.8:11434", "http://example.com:11434", "http://172.32.0.1", "http://100.128.0.1", "http://[2001:db8::1]:1234", "not a url"])
		assert.match(problems({ providers: { mac: { kind: "ollama", url } } }).join("\n"), /^providers\.mac\.url: expected an http or https url whose host is loopback, private or Tailscale/, url);
	for (const url of ["http://127.0.0.1:11434", "http://localhost:11434", "https://mac.tail1234.ts.net", "http://10.0.0.7", "http://172.31.0.1", "http://192.168.1.20", "http://100.64.0.1", "http://[::1]:1234/v1", "http://[fd7a:115c:a1e5::1]:11434"])
		assert.deepEqual(problems({ providers: { mac: { kind: "ollama", url } } }), [], url);
	for (const probeSeconds of [0, -1, 1.5, "3"]) assert.equal(problems({ probeSeconds }).length, 1, String(probeSeconds));
	assert.deepEqual(problems({ probeSeconds: 1, limits: { warnAt: 80, stopAt: 100 } }), []);
	assert.deepEqual(problems({ limits: { stopAt: 0 } }), ["limits.stopAt: expected a percentage above 0 and at most 100, got 0"]);
	assert.deepEqual(problems({ providers: { mac: { url: "http://127.0.0.1" } } }), ["providers.mac.kind: provider mac: kind is required"]);
	assert.deepEqual(problems({ providers: { Mac: { kind: "ollama", url: "http://127.0.0.1" } } }), ["providers.Mac: expected a provider name of lowercase letters, digits and dashes"]);
});

test("a name is resolved at load and at each probe: one that resolves to a public address refuses the load, then the probe", async () => {
	const lookup = dns.lookup;
	let answer = "100.101.102.103";
	dns.lookup = (async () => [{ address: answer, family: 4 }]) as unknown as typeof dns.lookup;
	syncBuiltinESMExports();
	try {
		answer = "8.8.8.8";
		const options = { providers: { mac: { kind: "ollama" as const, url: "http://mac.tail1234.ts.net:11434" } } };
		await assert.rejects(load(options), { message: /^provider mac: mac\.tail1234\.ts\.net resolves to 8\.8\.8\.8, a public address; Arthur reaches a model server only over a private network/ });
		answer = "100.101.102.103";
		const { pick } = await load(options);
		answer = "8.8.8.8";
		await assert.rejects(pick(["mac/qwen3-coder"]), { message: "no model available: mac/qwen3-coder: refused: mac.tail1234.ts.net resolves to 8.8.8.8, not a private address" });
	} finally {
		dns.lookup = lookup;
		syncBuiltinESMExports();
	}
});

test("the first available model: a provider model listed by its server, a name without a tag matching its :latest; a free model", async () => {
	const [mac, lab] = [await ollama(), await openai()];
	try {
		const { pick } = await load({ providers: { mac: { kind: "ollama", url: mac.url }, lab: { kind: "openai-compatible", url: `${lab.url}/v1` } } });
		assert.deepEqual(await pick(["mac/qwen3-coder", "anthropic/claude-haiku-5-5"]), { model: "mac/qwen3-coder", why: "using mac/qwen3-coder", free: true });
		assert.deepEqual(await pick(["mac/qwen3-coder:latest"]), { model: "mac/qwen3-coder:latest", why: "using mac/qwen3-coder:latest", free: true });
		assert.deepEqual(await pick(["lab/qwen3-32b"]), { model: "lab/qwen3-32b", why: "using lab/qwen3-32b", free: true });
		assert.deepEqual(await pick(["anthropic/claude-haiku-5-5"]), { model: "anthropic/claude-haiku-5-5", why: "using anthropic/claude-haiku-5-5", free: false }, "a built-in model is always available");
		assert.deepEqual([mac.seen.map((each) => each.path), lab.seen.map((each) => each.path)], [["/api/tags"], ["/v1/models"]], "one probe per provider, reused");
	} finally {
		mac.close();
		lab.close();
	}
});

test("a list skips a model whose server is unreachable, slow, lacks it, answers 401 or no model list; all unavailable refuses, naming each", async () => {
	const closed = await ollama();
	closed.close();
	const slow = await server(() => "hang");
	const lacks = await ollama();
	const denied = await server(() => ({ status: 401, body: { error: { message: "Invalid API key", type: "invalid_request_error" } } }));
	const other = await server(() => ({ status: 200, body: { hello: "world" } }));
	try {
		const { pick } = await load({
			probeSeconds: 1,
			providers: {
				off: { kind: "ollama", url: closed.url },
				slow: { kind: "ollama", url: slow.url },
				lacks: { kind: "ollama", url: lacks.url },
				denied: { kind: "openai-compatible", url: `${denied.url}/v1`, keyEnv: "ARTHUR_MODELS_DENIED_KEY" },
				other: { kind: "openai-compatible", url: `${other.url}/v1` },
			},
		}, { ARTHUR_MODELS_DENIED_KEY: "sk-secret-123" });
		const list = ["off/qwen3", "slow/qwen3", "lacks/llama3", "denied/qwen3", "other/qwen3"];
		const refused = await pick(list).then(() => "picked", (error: Error) => error.message);
		assert.match(refused, /^no model available: off\/qwen3: unreachable: curl: \(7\) .*; slow\/qwen3: unreachable: timed out after 1 s; lacks\/llama3: not in its model list; denied\/qwen3: its model list answered HTTP 401; other\/qwen3: its model list answered something that is not a model list$/);
		assert.ok(!refused.includes("sk-secret-123"), "the key is never in a refusal");
		assert.equal(denied.seen[0]?.headers.authorization, "Bearer sk-secret-123", "the key reaches the probe's header");
		assert.equal(other.seen[0]?.headers.authorization, undefined, "no keyEnv, no header");
		const picked = await pick([...list, "anthropic/claude-haiku-5-5"]);
		assert.equal(picked.model, "anthropic/claude-haiku-5-5");
		assert.match(picked.why, /^off\/qwen3 unreachable: curl: \(7\) .*; slow\/qwen3 unreachable: timed out after 1 s; lacks\/llama3 not in its model list; .*; using anthropic\/claude-haiku-5-5$/);
	} finally {
		for (const each of [slow, lacks, denied, other]) each.close();
	}
});

test("two picks at once make one request to the server; it is reused for 30 s on the host's clock, then asked again", async () => {
	const mac = await ollama();
	try {
		const { fake, pick } = await load({ providers: { mac: { kind: "ollama", url: mac.url } } });
		await Promise.all([pick(["mac/qwen3-coder"]), pick(["mac/qwen3-coder"])]);
		assert.equal(mac.seen.length, 1);
		fake.setNow(new Date(NOW.getTime() + 29_999));
		await pick(["mac/qwen3-coder"]);
		assert.equal(mac.seen.length, 1, "within 30 s");
		fake.setNow(new Date(NOW.getTime() + 30_000));
		await pick(["mac/qwen3-coder"]);
		assert.equal(mac.seen.length, 2, "30 s later");
	} finally {
		mac.close();
	}
});

test("a job on another machine is probed from there, through host.jobs.run over ssh, the key on stdin and never in an argument", async () => {
	const bin = temporaryFolder();
	const log = join(bin, "ssh.log");
	writeFileSync(join(bin, "ssh"), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nwhile [ $# -gt 0 ]; do case "$1" in -o) shift 2;; -*) shift;; *) break;; esac; done\nshift\nexec sh -c "$*"\n`, { mode: 0o755 });
	process.env.PATH = [bin, PATH].join(delimiter);
	const lab = await openai();
	try {
		const options: ModelsOptions = { providers: { lab: { kind: "openai-compatible", url: `${lab.url}/v1`, keyEnv: "ARTHUR_MODELS_LAB_KEY" } } };
		const { fake, pick } = await load(options, { ARTHUR_MODELS_LAB_KEY: "sk-lab-456" });
		fake.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: temporaryFolder(), labels: {} });
		assert.equal((await pick(["lab/qwen3-32b"], "gpu")).model, "lab/qwen3-32b");
		const calls = readFileSync(log, "utf8");
		assert.match(calls, /gpu 'curl' '--config' '-'/);
		assert.ok(!calls.includes("sk-lab-456"));
		assert.equal(lab.seen[0]?.headers.authorization, "Bearer sk-lab-456");
		await pick(["lab/qwen3-32b"], "local");
		assert.equal(lab.seen.length, 2, "each machine has its own probe");
	} finally {
		lab.close();
		process.env.PATH = PATH;
	}
});

// The job's record, every file of it, as text.
const record = (home: string, id: string) =>
	readdirSync(join(home, "jobs", id), { withFileTypes: true }).flatMap((entry) => (entry.isFile() ? [readFileSync(join(home, "jobs", id, entry.name), "utf8")] : [])).join("\n");
async function ended(home: string, id: string): Promise<string> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const state = existsSync(join(home, "jobs", id, "state")) ? readFileSync(join(home, "jobs", id, "state"), "utf8") : "";
		if (state === "ended") return readFileSync(join(home, "jobs", id, "reason"), "utf8");
	}
	throw new Error(`job ${id} did not end`);
}

// A repository with one commit, and `omp` the fake agent playing `run` with its environment written to `env` beside it.
function repository(run: AgentRun) {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	const omp = fakeAgent(run);
	const bin = temporaryFolder();
	writeFileSync(join(bin, "omp"), `#!/bin/sh\nenv > '${join(bin, "env")}'\nexec '${omp}' "$@"\n`, { mode: 0o755 });
	process.env.PATH = [bin, PATH].join(delimiter);
	// The agent's job runs, not its `usage --json`.
	const starts = () => readFileSync(join(dirname(omp), "starts.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line).args as string[]).filter((args) => args.includes("--mode"));
	return { root, env: () => readFileSync(join(bin, "env"), "utf8"), starts };
}

test("a job on a provider model gets the provider in its own environment only, as omp's provider of its kind, and costs 0", async () => {
	const mac = await ollama();
	const lab = await openai();
	const { root, env, starts } = repository({ steps: [{ message: "Done." }] });
	try {
		const options: ModelsOptions = { providers: { mac: { kind: "ollama", url: mac.url, keyEnv: "ARTHUR_MODELS_MAC_KEY" }, lab: { kind: "openai-compatible", url: `${lab.url}/v1` } } };
		const { fake } = await load(options, { ARTHUR_MODELS_MAC_KEY: "ollama-secret-789" }, root);
		const home = dirname(fake.host.folder);
		const job = await fake.host.jobs.spawn({ task: "Build it.", model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"], timeoutMinutes: 30, budgetUsd: 5 });
		assert.equal(await ended(home, job.id), "finished");
		const read = (name: string) => readFileSync(join(home, "jobs", job.id, name), "utf8");
		assert.deepEqual([read("model"), read("model-why"), read("budget"), read("timeout")], ["mac/qwen3-coder", "using mac/qwen3-coder; budget: none, free model mac/qwen3-coder", "0", "30"]);
		const args = starts()[0] ?? [];
		assert.equal(args[args.indexOf("--model") + 1], "ollama/qwen3-coder");
		assert.match(env(), new RegExp(`^OLLAMA_BASE_URL=${mac.url}$`, "m"));
		assert.match(env(), /^OLLAMA_API_KEY=ollama-secret-789$/m);
		assert.ok(!record(home, job.id).includes("ollama-secret-789"), "the key is in no file of the record, its log included");
		assert.ok(!readFileSync(join(home, "events.jsonl"), "utf8").includes("ollama-secret-789"));

		const second = await fake.host.jobs.spawn({ task: "Again.", model: "lab/qwen3-32b" });
		assert.equal(await ended(home, second.id), "finished");
		const again = starts()[1] ?? [];
		assert.equal(again[again.indexOf("--model") + 1], "lm-studio/qwen3-32b");
		assert.match(env(), new RegExp(`^LM_STUDIO_BASE_URL=${lab.url}/v1$`, "m"));
		assert.doesNotMatch(env(), /LM_STUDIO_API_KEY|OLLAMA_/, "no keyEnv, no key; the other provider's variables are not there");

		const builtIn = await fake.host.jobs.spawn({ task: "Once more.", model: "anthropic/claude-haiku-5-5" });
		assert.equal(await ended(home, builtIn.id), "finished");
		const third = starts()[2] ?? [];
		assert.equal(third[third.indexOf("--model") + 1], "anthropic/claude-haiku-5-5");
		assert.doesNotMatch(env(), /ARTHUR_AGENT_MODEL|LM_STUDIO_|OLLAMA_/);
		assert.equal(readFileSync(join(home, "jobs", builtIn.id, "budget"), "utf8"), "2", "a built-in model keeps its budget");
	} finally {
		mac.close();
		lab.close();
		process.env.PATH = PATH;
	}
});

test("refused at spawn before any record: every model unavailable; a single provider model is probed too, with no fallback", async () => {
	const lacks = await ollama();
	const { root } = repository({ steps: [{ message: "Done." }] });
	try {
		const { fake } = await load({ providers: { mac: { kind: "ollama", url: lacks.url } } }, {}, root);
		const home = dirname(fake.host.folder);
		await assert.rejects(fake.host.jobs.spawn({ task: "Build it.", model: "mac/llama3" }), { message: "no model available: mac/llama3: not in its model list" });
		await assert.rejects(fake.host.jobs.spawn({ task: "Build it.", model: ["mac/llama3", "mac/qwen3"] }), { message: "no model available: mac/llama3: not in its model list; mac/qwen3: not in its model list" });
		const worktrees = execFileSync("git", ["-C", root, "worktree", "list"], { encoding: "utf8" }).trim().split("\n");
		assert.deepEqual([existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")) : [], worktrees.length], [[], 1]);
	} finally {
		lacks.close();
		process.env.PATH = PATH;
	}
});

test("a model lost mid-job fails the job with the agent's reason; it is never switched to another model mid-run", async () => {
	const mac = await ollama();
	const { root, starts } = repository({ steps: [{ message: "", stopReason: "error", error: "Connection error: fetch failed (http://mac:11434)" }] });
	try {
		const { fake } = await load({ providers: { mac: { kind: "ollama", url: mac.url } } }, {}, root);
		const job = await fake.host.jobs.spawn({ task: "Build it.", model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"] });
		assert.equal(await ended(dirname(fake.host.folder), job.id), "failed: the agent stopped on error: Connection error: fetch failed (http://mac:11434)");
		assert.equal(starts().length, 1, "one run of the agent, on its one model");
	} finally {
		mac.close();
		process.env.PATH = PATH;
	}
});

test("arthur usage prints each account's windows from the agent's report, its email only when asked, no data for an account that has none", async () => {
	says(report([{ id: "5h", used: 0.13, resetsIn: 23 }, { id: "7d", used: 0.76, resetsIn: 44 * 60 }], { accountsWithoutUsage: [{ provider: "openai-codex", accountId: "acc-2", email: "other@example.com" }] }));
	const { fake } = await load({});
	const usage = fake.commands.find((command) => command.name === "usage");
	const printed: string[] = [];
	const log = console.log;
	console.log = (line: string) => void printed.push(line);
	try {
		await usage?.run({ args: [], project: undefined } as never);
		await usage?.run({ args: ["--email"], project: undefined } as never);
	} finally {
		console.log = log;
	}
	assert.deepEqual(printed, [
		"anthropic: Claude 5 Hour 13% used, resets in 23 min; Claude 7 Day 76% used, resets in 1 d 20 h\nopenai-codex: no data",
		"anthropic (owner@example.com): Claude 5 Hour 13% used, resets in 23 min; Claude 7 Day 76% used, resets in 1 d 20 h\nopenai-codex: no data",
	]);
	assert.equal(await fake.host.commands.route("/usage"), "anthropic: Claude 5 Hour 13% used, resets in 23 min; Claude 7 Day 76% used, resets in 1 d 20 h\nopenai-codex: no data");
});

test("an agent without a usage report: arthur usage says so and no model is skipped", async () => {
	agent({ steps: [{ stderr: "error: unknown command usage" }], exitCode: 2 });
	const { fake, pick } = await load({});
	assert.equal(await fake.host.commands.route("/usage"), "the agent has no usage report (omp usage --json: error: unknown command usage); no model is skipped for its limits");
	assert.equal((await pick(["anthropic/claude-opus-5"])).model, "anthropic/claude-opus-5");
});

test("a report older than 10 minutes is fetched again; a failed fetch keeps the last one with its age", async () => {
	const first = says(report([{ id: "7d", used: 0.5, resetsIn: 600 }]));
	const { fake } = await load({});
	await fake.host.commands.route("/usage");
	fake.setNow(new Date(after(9)));
	await fake.host.commands.route("/usage");
	assert.equal(starts(first), 1, "9 minutes on, the report is kept");
	const failing = agent({ steps: [{ stderr: "network down" }], exitCode: 1 });
	fake.setNow(new Date(after(11)));
	assert.equal(await fake.host.commands.route("/usage"), "as of 11 min ago; the fetch 0 min ago failed: omp usage --json: network down\nanthropic: Claude 7 Day 50% used, resets in 9 h 49 min");
	assert.equal(starts(failing), 1);
});

test("a list skips a built-in model whose provider's window is at or over limits.stopAt; a window over limits.warnAt is on the spawn line and in the context", async () => {
	says(report([{ id: "5h", used: 0.82, resetsIn: 60 }, { id: "7d", used: 0.96, resetsIn: 600 }, { id: "7d", used: 0.99, tier: "fable", resetsIn: 600 }]));
	const { fake, pick } = await load({});
	const picked = await pick(["anthropic/claude-opus-5", "openai-codex/gpt-5"]);
	assert.equal(picked.model, "openai-codex/gpt-5");
	assert.equal(
		picked.why,
		"anthropic/claude-opus-5 at its limit: anthropic Claude 7 Day 96% used, resets in 10 h 0 min (limits.stopAt 95%); using openai-codex/gpt-5; over limits.warnAt 80%: anthropic: Claude 5 Hour 82% used, resets in 1 h 0 min, anthropic: Claude 7 Day 96% used, resets in 10 h 0 min, anthropic: Claude 7 Day (fable) 99% used, resets in 10 h 0 min",
	);
	assert.match(fake.collect<string>("coordinator.context")[0] ?? "", /^Usage windows at or over limits\.warnAt \(80%\):\n- anthropic: Claude 5 Hour 82% used/);
	const { pick: higher } = await load({ limits: { stopAt: 97, warnAt: 100 } });
	assert.deepEqual(await higher(["anthropic/claude-opus-5"]), { model: "anthropic/claude-opus-5", why: "using anthropic/claude-opus-5", free: false }, "a tier's own window does not skip the provider");
});

test("doctor: each provider reachable, each listed model present, critical only with no later model elsewhere; omp's models.yml", async () => {
	const mac = await ollama();
	const closed = await ollama();
	closed.close();
	const folder = temporaryFolder();
	process.env.PI_CODING_AGENT_DIR = folder;
	try {
		const options: ModelsOptions = { providers: { mac: { kind: "ollama", url: mac.url }, off: { kind: "openai-compatible", url: `${closed.url}/v1` } } };
		const fake = fakeHost({ name: "models", options, now: NOW });
		fake.provide("models.lists", () => [["mac/qwen3-coder", "mac/llama3"], ["off/qwen3", "anthropic/claude-haiku-5-5"]]);
		await fake.setup(models(options));
		const lines = async () => Promise.all((fake.collect<Requirement[]>("doctor")[0] ?? []).map(async (line) => [line.name, await line.check(), line.critical === true]));
		mkdirSync(folder, { recursive: true });
		assert.deepEqual(await lines(), [
			["curl", "ok", true],
			["provider mac", "ok (1 model)", true],
			["provider off", (await lines())[2]?.[1], false],
			["model mac/qwen3-coder", "ok", true],
			["model mac/llama3", "missing: not in its model list", true],
			["model off/qwen3", (await lines())[5]?.[1], false],
			["omp models.yml", "ok (no models.yml)", true],
		]);
		assert.match(String((await lines())[2]?.[1]), /^missing: unreachable: curl: \(7\)/);
		writeFileSync(join(folder, "models.yml"), "providers:\n  lm-studio:\n    baseUrl: http://127.0.0.1:1234/v1\n");
		assert.deepEqual((await lines())[6], ["omp models.yml", `missing: ${join(folder, "models.yml")} configures lm-studio, which replaces the provider a job's environment sets`, true]);
		assert.deepEqual(fakeHost({ name: "models" }).collect("doctor"), [], "no plugin set up, nothing provided");
	} finally {
		delete process.env.PI_CODING_AGENT_DIR;
		mac.close();
	}
});

// Each default `table` writes as a value, by its path, parsed as JSON when it parses; `words` are the paths of those written as
// words for a person, left out.
function valueDefaults(table: OptionTable, words: readonly string[]): Record<string, unknown> {
	const value = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	return Object.fromEntries(everyOption(table).flatMap(({ path, entry }) => (entry.default === undefined || words.includes(path) ? [] : [[path, value(entry.default)]])));
}

test("each default the option table writes as a value is the one the code applies with nothing set", () => {
	assert.deepEqual(valueDefaults(table, ["providers.*.keyEnv"]), { probeSeconds: DEFAULTS.probeSeconds, "limits.warnAt": DEFAULTS.warnAt, "limits.stopAt": DEFAULTS.stopAt });
});
