import { homedir } from "node:os";
import { join } from "node:path";
import type { Host, Requirement } from "@arthur/core/plugin";
import { type Kind, type Provider, providerModel } from "./model-options.ts";
import { listed, type Probe } from "./probe.ts";

// The models plugin's `arthur doctor` lines (spec/roadmap.md, entries 80 and 82): curl, each provider reachable from here, each
// provider model a list names present, and omp's own models.yml, here and on each registered machine, leaving omp's `ollama`
// and `lm-studio` providers to the job's environment. A provider or a model is critical only when a list names it with no
// later model on another provider or built in.

// omp's models.yml on a machine, as omp finds it there; exit code 3 when there is none (ssh's own failure is 255).
const YML = 'f="${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}/models.yml"; [ -e "$f" ] || exit 3; cat "$f"';

// omp's provider for each kind, whose variables a job's environment sets (models.ts).
export const OMP_PROVIDER: Readonly<Record<Kind, string>> = { ollama: "ollama", "openai-compatible": "lm-studio" };

export function doctorLines(host: Host, providers: Readonly<Record<string, Provider>>, ask: (machine: string, name: string) => Promise<Probe>): Requirement[] {
	if (Object.keys(providers).length === 0) return [];
	// Every list a plugin knows of (orchestration's roles), each answer a list of lists.
	const lists = host.collect<readonly (readonly string[])[]>("models.lists").flat();
	const last = (provider: string, model?: string) =>
		lists.some((list) => list.some((each, index) => providerModel(providers, each)?.provider === provider && (model === undefined || each === model) && list.slice(index + 1).every((later) => providerModel(providers, later)?.provider === provider)));
	const named = [...new Set(lists.flat().filter((model) => providerModel(providers, model) !== undefined))];
	const folder = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".omp", "agent");
	const own = [...new Set(Object.values(providers).map((provider) => OMP_PROVIDER[provider.kind]))];
	return [
		{
			name: "curl",
			check: async () => ((await host.jobs.run("local", ["curl", "--version"], 10)).code === 0 ? "ok" : "missing: curl is not on the PATH"),
			costs: "no provider is probed, so every provider model is unavailable",
			fix: "install curl (apt install curl)",
			critical: Object.keys(providers).some((name) => last(name)),
		},
		...Object.entries(providers).map(([name, provider]) => ({
			name: `provider ${name}`,
			check: async () => {
				const answer = await ask("local", name);
				return "reason" in answer ? `missing: ${answer.reason}` : `ok (${answer.models.length} model${answer.models.length === 1 ? "" : "s"})`;
			},
			costs: `the models of ${name} are skipped, each list going on to its next model`,
			fix: `start the server at ${provider.url}, its machine awake and on the network`,
			critical: last(name),
		})),
		...named.map((model) => {
			const { provider, name } = providerModel(providers, model) as { provider: string; name: string };
			const kind = (providers[provider] as Provider).kind;
			return {
				name: `model ${model}`,
				check: async () => {
					const answer = await ask("local", provider);
					if ("reason" in answer) return `missing: ${answer.reason}`;
					return listed(kind, answer.models, name) ? "ok" : "missing: not in its model list";
				},
				costs: `a list that names ${model} goes on to its next model`,
				fix: kind === "ollama" ? `ollama pull ${name}, on the machine of ${provider}` : `load ${name} in the server of ${provider}`,
				critical: last(provider, model),
			};
		}),
		// omp's models.yml here and on each machine; one that does not answer is not checked: its `machines <name>` line says why.
		...host.jobs.machines().map((machine) => {
			const where = machine === "local" ? join(folder, "models.yml") : `omp's models.yml on ${machine}`;
			return {
				name: machine === "local" ? "omp models.yml" : `omp models.yml on ${machine}`,
				check: async () => {
					const ran = await host.jobs.run(machine, ["sh", "-c", YML], 10);
					const said = ran.stderr.trim().split("\n").at(-1) || `exit code ${ran.code}`;
					if (ran.code === 3) return "ok (no models.yml)";
					if (ran.code === 255) return `ok (not reached: ${said})`;
					if (ran.code !== 0) return `missing: it was not read: ${said}`;
					const found = own.filter((omp) => new RegExp(`^\\s+["']?${omp}["']?\\s*:`, "m").test(ran.stdout));
					return found.length === 0 ? "ok" : `missing: ${where} configures ${found.join(" and ")}, which replaces the provider a job's environment sets`;
				},
				costs: "a job on a provider model reaches the server omp's models.yml names, not its provider's",
				fix: `remove the ${own.join(" and ")} provider from ${where}`,
				critical: true,
			};
		}),
	];
}
