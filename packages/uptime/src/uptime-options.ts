import { BlockList, isIP } from "node:net";
import { isAbsolute, normalize, sep } from "node:path";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The uptime plugin's options file (spec/roadmap.md, entries 98 and 93), checked before any setup by walking `table`:
// docs/uptime.md; and the check of a project's piece, its sites.

export type Site = { readonly url: string; readonly expect?: number | string; readonly everySeconds?: number };
// A project's piece as `uptime.project(sites, { runbook })` builds it; `runbook` counts from the project's folder.
export type Piece = { readonly sites: readonly Site[]; readonly runbook?: string };
export type UptimeOptions = { readonly enabled?: boolean; readonly probes?: readonly string[] };

export const summary = "each project's sites checked over HTTP on a schedule, a notice when one is down and when it is back, and the coordinator woken with a runbook";

export const tools: readonly Tool[] = [];

// Seconds between two checks of a site when `everySeconds` is left out.
export const EVERY_SECONDS = 60;

const address: Check = (value) => {
	const url = typeof value === "string" && URL.canParse(value) ? new URL(value) : undefined;
	return url?.protocol === "http:" || url?.protocol === "https:" ? undefined : "an http or https URL";
};
// Loopback, link-local (metadata), private (as models'): where a redirect leads only when the config names its host (AR0367),
// and never a probe (AR0620).
export const PRIVATE = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["127.0.0.0", 8], ["169.254.0.0", 16], ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["100.64.0.0", 10], ["::", 127], ["fe80::", 10], ["fc00::", 7]] as const) PRIVATE.addSubnet(address, prefix, address.includes(":") ? "ipv6" : "ipv4");
// Addresses outside the projects, asked with the other sites before a site with no answer is down (AR0620).
export const PROBES: readonly string[] = ["https://1.1.1.1/", "https://dns.google/"];
const probe = (value: unknown, at: number): OptionProblem[] => {
	const host = typeof value === "string" && URL.canParse(value) && new URL(value).protocol === "https:" ? new URL(value).hostname.replace(/^\[(.*)\]$/, "$1").replace(/\.+$/, "") : "localhost";
	const refused = /(^|\.)localhost$/i.test(host) || (isIP(host) !== 0 && PRIVATE.check(host, isIP(host) === 6 ? "ipv6" : "ipv4"));
	return refused ? [{ path: `probes[${at}]`, problem: `expected an https URL of a public host, not a loopback, link-local or private address, got ${describe(value)}` }] : [];
};
// The Fetch standard's bad ports (fetch.spec.whatwg.org/#bad-port): Node's fetch refuses them without a connection (AR0232).
export const BLOCKED_PORTS: readonly string[] = "1 7 9 11 13 15 17 19 20 21 22 23 25 37 42 43 53 69 77 79 87 95 101 102 103 104 109 110 111 113 115 117 119 123 135 137 139 143 161 179 389 427 465 512 513 514 515 526 530 531 532 540 548 554 556 563 587 601 636 989 990 993 995 1719 1720 1723 2049 3659 4045 4190 5060 5061 6000 6566 6665 6666 6667 6668 6669 6679 6697 10080".split(" ");
// The keys of one site of a project's piece.
const SITE: Readonly<Record<string, ValueOption>> = {
	url: { about: "The address checked, http or https; a redirect is followed, to another host only when none of its addresses is loopback, link-local or private", check: address },
	expect: {
		about: "What an answer needs: a status code such as 401, or a text the page holds (with a 2xx status)",
		default: "a 2xx status",
		check: (value) => (Number.isInteger(value) && (value as number) >= 100 && (value as number) <= 599) || (typeof value === "string" && value.trim() !== "") ? undefined : "a status code from 100 to 599, or non-empty text",
	},
	everySeconds: {
		about: "Seconds between two checks of it; a check is cut after 10 s, or after everySeconds when shorter",
		default: String(EVERY_SECONDS),
		check: (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of seconds, 1 or more"),
	},
};
// The plugin's one option; a project's sites are its piece, `uptime.project([...])` in its project file.
export const table: OptionTable = {
	probes: {
		about: "https URLs outside the projects, each a public host, asked before a site with no answer is down: when none answers, this machine is offline",
		default: PROBES.join(", "),
		check: (value) => (Array.isArray(value) && value.flatMap(probe).length === 0 ? undefined : "a list of https URLs of public hosts, [] for none"),
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const { probes, ...rest } = options;
	const listed = probes === undefined ? [] : Array.isArray(probes) ? probes.flatMap(probe) : [{ path: "probes", problem: `expected a list of https URLs, [] for none, got ${describe(probes)}` }];
	return [...Object.keys(rest).map((key) => ({ path: key, problem: "unknown option; options: probes" })), ...listed];
}

// A project's piece, a list of sites: its problems in one line, `; ` between them, or undefined.
export function checkSites(list: unknown): string | undefined {
	if (!Array.isArray(list) || list.length === 0) return `expected a list of at least one site { url, expect?, everySeconds? }, got ${describe(list)}`;
	const problems: string[] = [];
	const first = new Map<string, number>();
	list.forEach((entry: unknown, index) => {
		const where = `[${index}]`;
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return problems.push(`${where}: expected a site { url, expect?, everySeconds? }, got ${describe(entry)}`);
		const site = entry as Readonly<Record<string, unknown>>;
		for (const [key, value] of Object.entries(site)) {
			const option = Object.hasOwn(SITE, key) ? SITE[key] : undefined;
			const expected = option === undefined ? `unknown key; keys: ${Object.keys(SITE).join(", ")}` : value === undefined ? undefined : option.check(value);
			if (expected !== undefined) problems.push(`${where}.${key}: ${option === undefined ? expected : `expected ${expected}, got ${describe(value)}`}`);
		}
		if (site.url === undefined) problems.push(`${where}.url: url is required`);
		if (typeof site.url !== "string") return;
		const port = address(site.url) === undefined ? new URL(site.url).port : "";
		if (BLOCKED_PORTS.includes(port)) problems.push(`${where}.url: ${site.url} is on port ${port}, which fetch never reaches: the Fetch standard blocks it; use another port`);
		const twice = first.get(site.url);
		if (twice !== undefined) problems.push(`${where}.url: ${site.url} is listed twice, at [${twice}] and ${where}`);
		else first.set(site.url, index);
	});
	return problems.length === 0 ? undefined : problems.join("; ");
}

// A project's piece, `{ sites, runbook? }`: the problems of its sites as checkSites words them, and of its runbook, a path that
// stays inside the project's folder, as commit-rules' `file`.
export function checkPiece(piece: unknown): string | undefined {
	if (typeof piece !== "object" || piece === null || Array.isArray(piece)) return `expected { sites, runbook? }, as uptime.project([...sites], { runbook? }) builds it, got ${describe(piece)}`;
	const { sites, runbook, ...rest } = piece as Readonly<Record<string, unknown>>;
	const problems = [...Object.keys(rest).map((key) => `${key}: unknown key; keys: sites, runbook`), checkSites(sites)];
	if (runbook !== undefined && (typeof runbook !== "string" || runbook === "" || isAbsolute(runbook) || normalize(runbook).split(sep)[0] === ".."))
		problems.push(`runbook: expected a path inside the project's folder, such as "site-down.md", got ${describe(runbook)}`);
	const found = problems.filter((problem) => problem !== undefined);
	return found.length === 0 ? undefined : found.join("; ");
}
