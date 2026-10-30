import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The uptime plugin's options file (spec/roadmap.md, entries 98 and 93), checked before any setup by walking `table`:
// docs/uptime.md; and the check of a project's piece, its sites.

export type Site = { readonly url: string; readonly expect?: number | string; readonly everySeconds?: number };
export type UptimeOptions = { readonly enabled?: boolean };

export const summary = "each project's sites checked over HTTP on a schedule, a notice when one is down and when it is back";

export const tools: readonly Tool[] = [];

// Seconds between two checks of a site when `everySeconds` is left out.
export const EVERY_SECONDS = 60;

const address: Check = (value) => {
	const url = typeof value === "string" && URL.canParse(value) ? new URL(value) : undefined;
	return url?.protocol === "http:" || url?.protocol === "https:" ? undefined : "an http or https URL";
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
// The plugin takes no option but `enabled`: a project's sites are its piece, `uptime.project([...])` in its project file.
export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; uptime takes none: a project's sites are its uptime.project([...]) in its project file" }));
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
