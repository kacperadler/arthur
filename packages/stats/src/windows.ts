import type { Host } from "@arthur/core/plugin";
import { readSpend } from "./spend-read.ts";
import { money } from "./spend.ts";

// `arthur stats windows` (spec/roadmap.md, entry 112): each usage window of the agent's report, which the models plugin gives as
// `models.windows`, beside what Arthur spent at list price on that provider's models in the window's span, by role. A role's part
// of the window is an estimate, used × its share, and at most that: the account's use outside Arthur counts in the window too.
// docs/commands/stats-windows.md.

type Window = { readonly provider: string; readonly label: string; readonly used: number; readonly resetsAt?: number; readonly durationMs?: number };

const HEAD = "Usage windows, each beside Arthur's spend at list price on its provider's models in its span; by role, its share ≈ its part of the window, at most: the account's use outside Arthur counts too.";
const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
const sum = (parts: readonly { readonly cost: number }[]) => parts.reduce((all, part) => all + part.cost, 0);

export async function windows(host: Pick<Host, "folder" | "clock" | "collect">): Promise<string> {
	const [answer] = await Promise.all(host.collect<Promise<readonly Window[] | string>>("models.windows"));
	if (answer === undefined) return "no usage windows: the models plugin is not loaded";
	if (typeof answer === "string") return `no usage windows: ${answer}`;
	if (answer.length === 0) return "no usage windows: no account reports one";
	const now = host.clock.now().getTime();
	// Every line once, each window keeping those in its span.
	const { spent } = readSpend(host.folder, host.clock, { since: { at: 0, label: "" } });
	const lines = answer.map((window) => {
		const head = `- ${window.provider} ${window.label} ${percent(window.used)} used`;
		if (window.durationMs === undefined) return `${head}: the report gives no span`;
		// A window without its reset is taken as the span before now.
		const start = (window.resetsAt ?? now) - window.durationMs;
		const { date, time } = host.clock.local(new Date(start));
		const parts = spent.filter((row) => row.time >= start).map((row) => ({ role: row.role, cost: sum(Object.entries(row.usage).flatMap(([model, used]) => (model.startsWith(`${window.provider}/`) ? [used] : []))) }));
		const all = sum(parts);
		const roles = [...Map.groupBy(parts, (part) => part.role)].map(([role, its]) => ({ role, cost: sum(its) })).filter((role) => role.cost > 0);
		const shares = roles.toSorted((a, b) => b.cost - a.cost || (a.role < b.role ? -1 : 1)).map(({ role, cost }) => `${role} ${percent(cost / all)} ≈ ${percent((window.used * cost) / all)}`);
		return `${head}, since ${date} ${time}: ${money(all)}${shares.length === 0 ? "" : `; ${shares.join(", ")}`}`;
	});
	return [HEAD, ...lines].join("\n");
}
