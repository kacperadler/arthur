import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// Each authenticated account's limit windows from the agent's own report, `<agent> usage --json` (spec/roadmap.md, entry 82),
// kept in `<folder>/usage.json` so every process reads the last one: docs/commands/usage.md.

export type Window = { readonly label: string; readonly used: number; readonly resetsAt?: number; readonly tier: boolean };
export type Account = { readonly provider: string; readonly email?: string; readonly windows: readonly Window[] };
// The last report and when it came (`at`); `failed`, a fetch that failed after it, or with none before.
export type Kept = { readonly at?: number; readonly accounts?: readonly Account[]; readonly failed?: { readonly at: number; readonly reason: string } };

const STALE_MS = 10 * 60_000;
const FETCH_SECONDS = 60;

// The accounts of omp's report, `{ reports: [{ provider, limits: [{ label, scope, window, amount }], metadata }],
// accountsWithoutUsage }`, or why it is not one. An account without usage, or without a window, has no data.
function accountsOf(stdout: string): Account[] | string {
	let report: { readonly reports?: unknown; readonly accountsWithoutUsage?: unknown };
	try {
		report = JSON.parse(stdout) ?? {};
	} catch {
		return "its report is not JSON";
	}
	if (!Array.isArray(report.reports)) return "its report has no reports list";
	type Limit = { readonly label?: unknown; readonly scope?: { readonly tier?: unknown }; readonly window?: { readonly resetsAt?: unknown }; readonly amount?: { readonly usedFraction?: unknown } } | null;
	type Report = { readonly provider?: unknown; readonly limits?: unknown; readonly metadata?: { readonly email?: unknown } } | null;
	const accounts = report.reports.map((entry: Report): Account => ({
		provider: String(entry?.provider ?? "unknown"),
		...(typeof entry?.metadata?.email === "string" ? { email: entry.metadata.email } : {}),
		windows: (Array.isArray(entry?.limits) ? entry.limits : []).flatMap((limit: Limit) => {
			const [used, resetsAt] = [limit?.amount?.usedFraction, limit?.window?.resetsAt];
			if (typeof used !== "number" || !Number.isFinite(used)) return [];
			return [{ label: String(limit?.label ?? "a window"), used, ...(typeof resetsAt === "number" ? { resetsAt } : {}), tier: limit?.scope?.tier !== undefined }];
		}),
	}));
	const without = Array.isArray(report.accountsWithoutUsage) ? report.accountsWithoutUsage : [];
	return [...accounts, ...without.map((entry: { readonly provider?: unknown } | string | null) => ({ provider: String(typeof entry === "string" ? entry : (entry?.provider ?? "unknown")), windows: [] }))];
}

// The report of one load: `fresh` fetches it again once the last fetch is 10 minutes old, one fetch at a time; `kept` reads
// what the last fetch of any process left.
export function usageReport(host: Host): { fresh(): Promise<Kept>; kept(): Kept } {
	const file = join(host.folder, "usage.json");
	const kept = (): Kept => {
		try {
			return JSON.parse(readFileSync(file, "utf8")) as Kept;
		} catch {
			return {};
		}
	};
	let running: Promise<Kept> | undefined;
	const fetch = async (): Promise<Kept> => {
		const ran = await host.jobs.run("local", [host.agent, "usage", "--json"], FETCH_SECONDS);
		const accounts = ran.code === 0 ? accountsOf(ran.stdout) : `${host.agent} usage --json: ${ran.stderr.trim().split("\n").at(-1) || `exit code ${ran.code}`}`;
		const now = host.clock.now().getTime();
		const next: Kept = typeof accounts === "string" ? { ...kept(), failed: { at: now, reason: accounts } } : { at: now, accounts };
		writeFileSync(`${file}.${process.pid}`, JSON.stringify(next));
		renameSync(`${file}.${process.pid}`, file);
		return next;
	};
	return {
		kept,
		fresh() {
			const last = kept();
			const tried = Math.max(last.at ?? 0, last.failed?.at ?? 0);
			if (host.clock.now().getTime() - tried < STALE_MS) return Promise.resolve(last);
			return (running ??= fetch().finally(() => (running = undefined)));
		},
	};
}

// `ms` as a person reads it: `23 min`, `5 h 10 min`, `2 d 3 h`.
function span(ms: number): string {
	const minutes = Math.max(0, Math.round(ms / 60_000));
	if (minutes < 60) return `${minutes} min`;
	if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
	return `${Math.floor(minutes / (24 * 60))} d ${Math.floor((minutes % (24 * 60)) / 60)} h`;
}

export function windowText(window: Window, now: number): string {
	return `${window.label} ${Math.round(window.used * 100)}% used${window.resetsAt === undefined ? "" : `, resets in ${span(window.resetsAt - now)}`}`;
}

// What `arthur usage` and `/usage` print: a line per account, its provider numbered when it has several, its email only when
// asked; first the report's age when the last fetch failed.
export function usageLines(kept: Kept, now: number, email: boolean): string {
	if (kept.accounts === undefined) return `the agent has no usage report${kept.failed === undefined ? "" : ` (${kept.failed.reason})`}; no model is skipped for its limits`;
	const lines = kept.failed === undefined || kept.at === undefined ? [] : [`as of ${span(now - kept.at)} ago; the fetch ${span(now - kept.failed.at)} ago failed: ${kept.failed.reason}`];
	const seen = new Map<string, number>();
	for (const account of kept.accounts) {
		const count = kept.accounts.filter((other) => other.provider === account.provider).length;
		const index = (seen.get(account.provider) ?? 0) + 1;
		seen.set(account.provider, index);
		const who = email && account.email !== undefined ? ` (${account.email})` : count > 1 ? ` (account ${index})` : "";
		lines.push(`${account.provider}${who}: ${account.windows.length === 0 ? "no data" : account.windows.map((window) => windowText(window, now)).join("; ")}`);
	}
	return lines.length === 0 ? "no account reports its usage" : lines.join("\n");
}

// Why a built-in model of `provider` is skipped: every account of it has a window, not one of a single model tier, at or over
// `stopAt` percent; undefined when one has room, or none reports.
export function overLimit(kept: Kept, provider: string, stopAt: number, now: number): string | undefined {
	const accounts = (kept.accounts ?? []).filter((account) => account.provider === provider && account.windows.length > 0);
	const full = accounts.map((account) => account.windows.find((window) => !window.tier && window.used * 100 >= stopAt));
	if (accounts.length === 0 || full.includes(undefined)) return undefined;
	return `at its limit: ${provider} ${windowText(full[0] as Window, now)} (limits.stopAt ${stopAt}%)`;
}

// Every window at or over `warnAt` percent, `<provider>: <window>` each.
export function overWarning(kept: Kept, warnAt: number, now: number): string[] {
	return (kept.accounts ?? []).flatMap((account) => account.windows.filter((window) => window.used * 100 >= warnAt).map((window) => `${account.provider}: ${windowText(window, now)}`));
}
