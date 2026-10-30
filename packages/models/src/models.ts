import { isIP } from "node:net";
import type { Plugin } from "@arthur/core/plugin";
import { doctorLines, OMP_PROVIDER } from "./model-doctor.ts";
import { checkOptions, hostOf, isPrivate, type ModelsOptions, providerModel } from "./model-options.ts";
import { addresses, listed, probes } from "./probe.ts";
import { type Kept, overLimit, overWarning, usageLines, usageReport } from "./usage.ts";

// The models plugin (spec/roadmap.md, entry 82): named providers, Ollama or OpenAI-compatible servers on the private network;
// `models.pick`, the first available model of a list, which the core asks at every spawn; a job on a provider model gets the
// provider in its own environment through `prepare`; each account's limit windows from the agent's report, `arthur usage` and
// `/usage`, which skip a model at `limits.stopAt` and warn at `limits.warnAt`; its `arthur doctor` lines. docs/models.md.

export type { ModelsOptions };

// How often `arthur run` asks for the usage report, which is fetched again only once it is 10 minutes old.
const USAGE_CHECK_MS = 60_000;
// What `probeSeconds` and `limits` hold when they are left out.
export const DEFAULTS = { probeSeconds: 3, warnAt: 80, stopAt: 95 };

export function models(options: ModelsOptions = {}): Plugin {
	let timer: NodeJS.Timeout | undefined;
	let refresh = () => {};
	return {
		name: "models",
		module: import.meta.url,
		options,
		check: checkOptions,
		async setup(host) {
			const { providers = {}, probeSeconds = DEFAULTS.probeSeconds, limits = {} } = host.options as ModelsOptions;
			const [warnAt, stopAt] = [limits.warnAt ?? DEFAULTS.warnAt, limits.stopAt ?? DEFAULTS.stopAt];
			// A name is resolved at load: one that resolves outside the private network refuses it; one not found now is the probe's to report.
			const refused = await Promise.all(
				Object.entries(providers).map(async ([name, provider]) => {
					const server = hostOf(new URL(provider.url));
					const outside = isIP(server) === 0 ? (await addresses(server).catch(() => [])).find((address) => !isPrivate(address)) : undefined;
					return outside === undefined ? [] : [`provider ${name}: ${server} resolves to ${outside}, a public address`];
				}),
			);
			if (refused.flat().length > 0) throw new Error(`${refused.flat().join("; ")}; Arthur reaches a model server only over a private network (loopback, private, Tailscale)`);
			const ask = probes(host, providers, probeSeconds);
			const usage = usageReport(host);
			const now = () => host.clock.now().getTime();
			refresh = () => void usage.fresh().catch((error: Error) => console.error(`models: the usage report failed: ${error.message}`));

			host.provide("models.pick", async (list: readonly string[], machine = "local") => {
				const skipped: string[][] = [];
				let report: Kept | undefined;
				for (const model of list) {
					const named = providerModel(providers, model);
					let reason: string | undefined;
					if (named !== undefined) {
						const answer = await ask(machine, named.provider);
						const kind = providers[named.provider]?.kind ?? "ollama";
						reason = "reason" in answer ? answer.reason : listed(kind, answer.models, named.name) ? undefined : "not in its model list";
					} else reason = overLimit((report ??= await usage.fresh()), model.split("/")[0] ?? "", stopAt, now());
					if (reason === undefined) {
						const warned = overWarning(report ?? usage.kept(), warnAt, now());
						const why = [...skipped.map(([name, said]) => `${name} ${said}`), `using ${model}`, ...(warned.length === 0 ? [] : [`over limits.warnAt ${warnAt}%: ${warned.join(", ")}`])];
						return { model, why: why.join("; "), free: named !== undefined };
					}
					skipped.push([model, reason]);
				}
				throw new Error(`no model available: ${skipped.map(([name, said]) => `${name}: ${said}`).join("; ")}`);
			});

			// The provider of a job's model in its own environment, under omp's provider of its kind; nothing for a built-in model.
			host.jobs.prepare((job) => {
				const named = providerModel(providers, job.model ?? "");
				const provider = named === undefined ? undefined : providers[named.provider];
				if (named === undefined || provider === undefined) return undefined;
				const key = provider.keyEnv === undefined ? undefined : host.env[provider.keyEnv];
				const prefix = provider.kind === "ollama" ? "OLLAMA" : "LM_STUDIO";
				return { [`${prefix}_BASE_URL`]: provider.url, ...(key === undefined ? {} : { [`${prefix}_API_KEY`]: key }), ARTHUR_AGENT_MODEL: `${OMP_PROVIDER[provider.kind]}/${named.name}` };
			});

			host.provide("doctor", () => doctorLines(host, providers, ask));
			host.provide("coordinator.context", () => {
				const warned = overWarning(usage.kept(), warnAt, now());
				return warned.length === 0 ? "" : `Usage windows at or over limits.warnAt (${warnAt}%):\n${warned.map((line) => `- ${line}`).join("\n")}`;
			});
			// The highest used percent of the last report's windows, the `--usage` bound of a grant (orchestration's `arthur silent`);
			// undefined without a window, or when the last fetch failed.
			host.provide("models.usage", () => {
				const { accounts = [], failed } = usage.kept();
				const used = failed === undefined ? accounts.flatMap((account) => account.windows.map((window) => window.used * 100)) : [];
				return used.length === 0 ? undefined : Math.max(...used);
			});
			host.commands.register({
				name: "usage",
				doc: new URL("../docs/commands/usage.md", import.meta.url),
				phone: { about: "each account's limit windows: used % and when each resets", reply: async (text) => (text.trim() === "" ? usageLines(await usage.fresh(), now(), false) : "usage: /usage") },
				async run({ args }) {
					if (args.length > 1 || (args.length === 1 && args[0] !== "--email")) {
						console.error("usage: arthur usage [--email]");
						return 2;
					}
					console.log(usageLines(await usage.fresh(), now(), args[0] === "--email"));
				},
			});
		},
		start() {
			refresh();
			timer = setInterval(refresh, USAGE_CHECK_MS);
		},
		stop() {
			clearInterval(timer);
		},
	};
}
