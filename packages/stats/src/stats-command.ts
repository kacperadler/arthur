import { parseArgs } from "node:util";
import type { Host } from "@arthur/core/plugin";
import { parseSince } from "./spend-read.ts";
import { spend } from "./spend.ts";
import { ticketStats } from "./tickets.ts";
import { windows } from "./windows.ts";

// `arthur stats`, the spend view, `arthur stats tickets`, the merged tickets' report, `arthur stats windows`, the usage windows
// beside the spend, and `/stats` (spec/roadmap.md, entries 110 to 112): docs/commands/stats.md, stats-tickets.md and stats-windows.md.

const USAGE = "usage: arthur stats [--since today|yesterday|<n>d|YYYY-MM-DD] [--project <name>] [--role <role>] [--ticket <id>] [--model <provider/model>]";
const TICKETS_USAGE = "usage: arthur stats tickets [--project <name>]";
const WINDOWS_USAGE = "usage: arthur stats windows";
const PHONE_USAGE = "usage: /stats [today|yesterday|<n>d|YYYY-MM-DD] [<ticket id>]";
const TICKET = /^[A-Z]+\d{4,}$/;
// A job's sandbox hides Arthur's home, so the plugin's folder (job-sandbox.ts); the report reads only the board.
const HIDDEN = "the spend is kept in Arthur's home, which a job cannot read; arthur stats tickets runs here";

export function statsCommand(host: Host): void {
	host.commands.register({
		name: "stats",
		doc: new URL("../docs/commands/stats.md", import.meta.url),
		inJob: true,
		phone: {
			about: "spend at list price, the last 7 days by default: the total, by role, the top 3 tickets; or one ticket's runs",
			reply(text) {
				if (host.job !== undefined) return HIDDEN;
				const words = text.split(/\s+/).filter((word) => word !== "");
				const ticket = words.find((word) => TICKET.test(word));
				const rest = words.filter((word) => word !== ticket);
				const since = parseSince(rest[0] ?? "7d", host.clock);
				if (rest.length > 1 || since === undefined) return PHONE_USAGE;
				return spend(host, { since, ticket }, true);
			},
		},
		async run({ args, project }) {
			if (args[0] === "tickets") {
				if (args.length > 1) return (console.error(TICKETS_USAGE), 2);
				return void console.log(ticketStats(host, project));
			}
			if (args[0] === "windows" && args.length > 1) return (console.error(WINDOWS_USAGE), 2);
			if (host.job !== undefined) return (console.error(`arthur stats: ${HIDDEN}`), 1);
			if (args[0] === "windows") return void console.log(await windows(host));
			let values: { readonly since?: string; readonly role?: string; readonly ticket?: string; readonly model?: string };
			try {
				({ values } = parseArgs({ args: [...args], options: { since: { type: "string" }, role: { type: "string" }, ticket: { type: "string" }, model: { type: "string" } } }));
			} catch {
				return (console.error(USAGE), 2);
			}
			const since = parseSince(values.since ?? "7d", host.clock);
			if (since === undefined) return (console.error(USAGE), 2);
			console.log(spend(host, { since, project, role: values.role, ticket: values.ticket, model: values.model }));
		},
	});
}
