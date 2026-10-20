import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, Plugin } from "@arthur/core/plugin";
import { ownHealth } from "./health-checks.ts";
import { checkOptions, type ManageOptions } from "./manage-options.ts";
import { stats } from "./stats.ts";

// The manage plugin (spec/roadmap.md, entries 60 and 61): `arthur health` and `/health`, one line per thing that should have
// happened by now and has not, from every plugin's answer to `health`, manage's own checks among them (health-checks.ts); read
// only. With `health.everyMinutes`, `arthur run` runs the same round that often and sends its new lines as one `notice`; a
// problem the round before saw too is not sent again, across a restart too. `arthur stats`: the merged tickets' reviews, costs
// and days (stats.ts). docs/manage.md.

export type { ManageOptions };

// How often `arthur run` looks whether a round is due by the host's clock.
const TICK_MS = 1000;
const ALL_WELL = "All well: nothing that should have happened by now is missing.";

// Every provider's lines in setup order, trimmed, blank ones dropped; a provider that throws costs its own line only, named.
function healthLines(host: Host): string[] {
	return host.collectEach<unknown>("health").flatMap((answer) =>
		"error" in answer
			? [`${answer.plugin}: health failed: ${answer.error.message.split("\n")[0]}`]
			: [answer.value].flat().flatMap((line) => (typeof line === "string" && line.trim() !== "" ? [line.trim()] : [])),
	);
}

// A line as a problem: its numbers left out, so the same problem an hour older, or a share that changed, is not new.
const problem = (line: string) => line.replace(/\b\d+(?:[.,:]\d+)*\b/g, "#");

// The problems the last round saw, in `<folder>/health.json`; a file missing, broken or edited by hand is none.
function lastSeen(folder: string): readonly string[] {
	try {
		const file: unknown = JSON.parse(readFileSync(join(folder, "health.json"), "utf8"));
		const seen = typeof file === "object" && file !== null && "problems" in file ? file.problems : undefined;
		return Array.isArray(seen) ? seen.filter((each): each is string => typeof each === "string") : [];
	} catch {
		return [];
	}
}

export function manage(options: ManageOptions = {}): Plugin {
	let round = () => {};
	let every: number | undefined;
	let timer: NodeJS.Timeout | undefined;
	let now = () => Date.now();
	return {
		name: "manage",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			const minutes = (host.options as ManageOptions).health?.everyMinutes;
			every = minutes === undefined ? undefined : minutes * 60_000;
			now = () => host.clock.now().getTime();
			host.provide("health", () => ownHealth(host));
			const report = () => {
				const lines = healthLines(host);
				return lines.length === 0 ? ALL_WELL : lines.join("\n");
			};
			host.commands.register({
				name: "health",
				doc: new URL("../docs/commands/health.md", import.meta.url),
				phone: { about: "what should have happened by now and has not, one line each", reply: (text) => (text.trim() === "" ? report() : "usage: /health") },
				run({ args }) {
					if (args.length > 0) {
						console.error("usage: arthur health");
						return 2;
					}
					console.log(report());
				},
			});
			host.commands.register({
				name: "stats",
				doc: new URL("../docs/commands/stats.md", import.meta.url),
				run({ args, project }) {
					if (args.length > 0) {
						console.error("usage: arthur stats [--project <name>]");
						return 2;
					}
					console.log(stats(host, project));
				},
			});
			round = () => {
				const lines = healthLines(host);
				const seen = new Set(lastSeen(host.folder));
				const fresh = lines.filter((line) => !seen.has(problem(line)));
				// Sent before it is written: a write that fails sends a line twice rather than never.
				if (fresh.length > 0) host.events.emit("notice", { text: `Health:\n${fresh.map((line) => `- ${line}`).join("\n")}` });
				const problems = [...new Set(lines.map(problem))];
				if (JSON.stringify(problems) === JSON.stringify([...seen])) return;
				const file = join(host.folder, "health.json");
				writeFileSync(`${file}.tmp`, `${JSON.stringify({ problems }, null, "\t")}\n`);
				renameSync(`${file}.tmp`, file);
			};
		},
		start() {
			if (every === undefined) return;
			const step = every;
			let next = 0;
			const look = () => {
				if (now() < next) return;
				next = now() + step;
				try {
					round();
				} catch (error) {
					console.error(`manage: the health round failed: ${(error as Error).message}`);
				}
			};
			look();
			timer = setInterval(look, TICK_MS);
		},
		stop() {
			clearInterval(timer);
		},
	};
}
