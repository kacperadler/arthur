import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Command, Host } from "@arthur/core/plugin";
import { BASELINE, type EvalOptions, RUNS } from "./develop-options.ts";
import { type Agent, evalRun } from "./eval-run.ts";
import { readScenario, type Scenario, scenarios } from "./eval-scenario.ts";

// `arthur eval [<scenario>...] [--runs <n>] [--save-baseline]` (spec/roadmap.md, entry 67): each scenario of the loaded
// packages run `runs` times at once, each run one coordinator turn (eval-run.ts) with orchestration's context for its copy of
// the fixture at the scenario's hour, its pass rate against the baseline in the main project's checkout, and which scenarios
// moved. docs/commands/eval.md.

const USAGE = "usage: arthur eval [<scenario>...] [--runs <n>] [--save-baseline]";
const ENV_GUARD = fileURLToPath(import.meta.resolve("@arthur/core/env-guard"));

type Rate = { readonly passed: number; readonly runs: number };

// The baseline at `path`, none when it does not exist; throws when it is not one, so a hand edit never counts as a rate.
function readBaseline(path: string): Readonly<Record<string, Rate>> {
	if (!existsSync(path)) return {};
	const json: unknown = JSON.parse(readFileSync(path, "utf8"));
	const rate = (value: unknown) => typeof value === "object" && value !== null && Number.isInteger((value as Rate).runs) && (value as Rate).runs >= 1 && Number.isInteger((value as Rate).passed) && (value as Rate).passed >= 0 && (value as Rate).passed <= (value as Rate).runs;
	const wrong = typeof json !== "object" || json === null || Array.isArray(json) ? "(the whole file)" : Object.entries(json).find(([, value]) => !rate(value))?.[0];
	if (wrong !== undefined) throw new Error(`${path} is not a baseline: ${wrong} is not { passed, runs }, passed 0 to runs`);
	return json as Record<string, Rate>;
}

// The instant within 12 hours of `now` whose hour on the owner's clock is `hour`, its minutes now's; twice, so a change of the
// zone's offset on the way (summer time) is caught up.
function atHour(clock: Host["clock"], hour: number, now: Date): Date {
	let at = now.getTime();
	for (let pass = 0; pass < 2; pass++) at += (((hour - Number(clock.local(new Date(at)).time.slice(0, 2)) + 36) % 24) - 12) * 3_600_000;
	return new Date(at);
}

async function evaluate(host: Host, args: readonly string[]): Promise<number> {
	let parsed: { readonly positionals: string[]; readonly values: { readonly runs?: string; readonly "save-baseline"?: boolean } };
	try {
		parsed = parseArgs({ args: [...args], options: { runs: { type: "string" }, "save-baseline": { type: "boolean" } }, allowPositionals: true, strict: true });
	} catch (error) {
		console.error(`${(error as Error).message}\n${USAGE}`);
		return 2;
	}
	const { positionals: names, values } = parsed;
	if (values.runs !== undefined && !/^[1-9]\d*$/.test(values.runs)) {
		console.error(`--runs "${values.runs}": a whole number of runs, 1 or more\n${USAGE}`);
		return 2;
	}
	const options = (host.options.evals ?? {}) as EvalOptions;
	const runs = values.runs === undefined ? (options.runs ?? RUNS) : Number(values.runs);
	const known = scenarios(host.code);
	const unknown = names.filter((name) => !known.has(name));
	if (known.size === 0) throw new Error("no scenario: no loaded package has evals/<name>/scenario.json");
	if (unknown.length > 0) throw new Error(`unknown scenario ${unknown.join(", ")}; scenarios: ${[...known.keys()].join(", ")}`);
	// The board refuses an empty project list itself.
	const path = join(host.board.projects()[0]!.path, options.baseline ?? BASELINE);
	const baseline = readBaseline(path);
	// No coordinator role (orchestration not enabled) refuses before any run.
	host.jobs.prompt("coordinator");
	// Orchestration's context for a run's copy of the fixture, at the scenario's hour, with the plugins' lines it sets.
	const context = (root: string, { hour, context }: Scenario) => host.call<string>("coordinator.checkoutContext", { root, at: atHour(host.clock, hour, host.clock.now()), context });
	const [roles] = host.collect<{ readonly model?: unknown; readonly thinking?: unknown } | undefined>("roles.model", "coordinator");
	const [model, thinking] = [roles?.model, roles?.thinking].map((value) => (typeof value === "string" && value !== "" ? value : undefined));
	const agent: Agent = {
		command: host.agent,
		args: ["-p", "--mode", "json", "--no-session", "--auto-approve", "-e", ENV_GUARD, ...(model ? ["--model", model] : []), ...(thinking ? ["--thinking", thinking] : [])],
	};
	// Each registered command's page, so the stub prints what `arthur <command> --help` prints live.
	const pages = Object.fromEntries(host.commands.docs().map(({ name, doc }) => [name, readFileSync(doc, "utf8")]));
	const out = join(host.folder, "evals", new Date().toISOString().replace(/[:.]/g, "-"));
	const report: string[] = [];
	const say = (line: string) => (report.push(line), console.log(line));
	say(`arthur eval: model ${model ?? "the agent's default"}, thinking ${thinking ?? "the agent's default"}, ${runs} run${runs === 1 ? "" : "s"} each; transcripts in ${out}`);
	const results: Record<string, Rate> = {};
	const moved: string[] = [];
	for (const name of names.length > 0 ? [...new Set(names)] : [...known.keys()]) {
		const scenario = await readScenario(host, name, known.get(name) ?? "");
		const failures = typeof scenario === "string" ? Array.from({ length: runs }, () => [scenario]) : await Promise.all(Array.from({ length: runs }, (_, index) => evalRun(scenario, agent, context, pages, join(out, `${name.replace("/", "-")}-${index + 1}`))));
		const passed = failures.filter((list) => list.length === 0).length;
		results[name] = { passed, runs };
		const was = baseline[name];
		const change = was === undefined ? "" : passed / runs > was.passed / was.runs ? "up" : passed / runs < was.passed / was.runs ? "down" : "same";
		if (was !== undefined && change !== "same") moved.push(`${name} (${change}, ${was.passed}/${was.runs} to ${passed}/${runs})`);
		say(`${name}: ${passed}/${runs} (${was === undefined ? "no baseline" : `baseline ${was.passed}/${was.runs}, ${change}`})`);
		for (const [index, list] of failures.entries()) for (const failure of list) say(`  run ${index + 1}: ${failure}`);
	}
	const total = Object.values(results).reduce((sum, rate) => sum + rate.passed, 0);
	say(`passed ${total}/${Object.keys(results).length * runs} runs; moved against the baseline: ${moved.length === 0 ? "none" : moved.join(", ")}`);
	if (values["save-baseline"]) {
		// The scenarios left out of this eval keep their rates.
		const saved = { ...baseline, ...results };
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(`${path}.${process.pid}`, `${JSON.stringify(Object.fromEntries(Object.entries(saved).sort(([a], [b]) => (a < b ? -1 : 1))), null, "\t")}\n`);
		renameSync(`${path}.${process.pid}`, path);
		say(`baseline saved: ${path}`);
	}
	mkdirSync(out, { recursive: true });
	writeFileSync(join(out, "report"), `${report.join("\n")}\n`);
	return 0;
}

export function evalCommand(host: Host): Command {
	return { name: "eval", doc: new URL("../docs/commands/eval.md", import.meta.url), run: ({ args }) => evaluate(host, args) };
}
