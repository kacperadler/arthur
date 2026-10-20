import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The uptime plugin's options file (spec/roadmap.md, entries 98 and 93), checked before any setup by walking `table`:
// docs/uptime.md. Whether each key of `sites` names a project is the setup's to say, once the project list is there.

export type Site = { readonly url: string; readonly expect?: number | string; readonly everySeconds?: number };
export type UptimeOptions = { readonly enabled?: boolean; readonly sites?: Readonly<Record<string, readonly Site[]>> };

export const summary = "each project's sites checked over HTTP on a schedule, a notice when one is down and when it is back";

export const tools: readonly Tool[] = [];

// Seconds between two checks of a site when `everySeconds` is left out.
export const EVERY_SECONDS = 60;

const address: Check = (value) => {
	const url = typeof value === "string" && URL.canParse(value) ? new URL(value) : undefined;
	return url?.protocol === "http:" || url?.protocol === "https:" ? undefined : "an http or https URL";
};
// The Fetch standard's bad ports (fetch.spec.whatwg.org/#bad-port): Node's fetch refuses them without a connection (AR0232).
const BLOCKED_PORTS: readonly string[] = "1 7 9 11 13 15 17 19 20 21 22 23 25 37 42 43 53 69 77 79 87 95 101 102 103 104 109 110 111 113 115 117 119 123 135 137 139 143 161 179 389 427 465 512 513 514 515 526 530 531 532 540 548 554 556 563 587 601 636 989 990 993 995 1719 1720 1723 2049 3659 4045 4190 5060 5061 6000 6566 6665 6666 6667 6668 6669 6679 6697 10080".split(" ");
const SITE: Readonly<Record<string, ValueOption>> = {
	url: { about: "The address checked, http or https; a redirect is followed", check: address },
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
const projectSites: Check = (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? undefined : "an object of each project's list of sites, by the project's name");

export const table: OptionTable = {
	sites: { about: "Each project's sites, by the project's name: a list of { url, expect?, everySeconds? }", check: projectSites, each: SITE },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { sites } = options;
	if (sites === undefined) return problems;
	if (projectSites(sites) !== undefined) return [...problems, { path: "sites", problem: `expected ${projectSites(sites)}, got ${describe(sites)}` }];
	for (const [project, list] of Object.entries(sites as Readonly<Record<string, unknown>>)) {
		const at = `sites.${project}`;
		if (!Array.isArray(list)) {
			problems.push({ path: at, problem: `project ${project}: expected a list of sites, got ${describe(list)}` });
			continue;
		}
		const first = new Map<string, string>();
		list.forEach((entry: unknown, index) => {
			const where = `${at}[${index}]`;
			if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return problems.push({ path: where, problem: `project ${project}: expected a site { url, expect?, everySeconds? }, got ${describe(entry)}` });
			const site = entry as Readonly<Record<string, unknown>>;
			for (const [key, value] of Object.entries(site)) {
				const option = Object.hasOwn(SITE, key) ? SITE[key] : undefined;
				const expected = option === undefined ? `unknown key; keys: ${Object.keys(SITE).join(", ")}` : value === undefined ? undefined : option.check(value);
				if (expected !== undefined) problems.push({ path: `${where}.${key}`, problem: `project ${project}: ${option === undefined ? expected : `expected ${expected}, got ${describe(value)}`}` });
			}
			if (site.url === undefined) problems.push({ path: `${where}.url`, problem: `project ${project}: url is required` });
			if (typeof site.url !== "string") return;
			const port = address(site.url) === undefined ? new URL(site.url).port : "";
			if (BLOCKED_PORTS.includes(port)) problems.push({ path: `${where}.url`, problem: `project ${project}: ${site.url} is on port ${port}, which fetch never reaches: the Fetch standard blocks it; use another port` });
			const twice = first.get(site.url);
			if (twice !== undefined) problems.push({ path: `${where}.url`, problem: `project ${project}: ${site.url} is listed twice, at ${twice} and ${where}` });
			else first.set(site.url, where);
		});
	}
	return problems;
}
