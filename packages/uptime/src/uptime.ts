import type { Plugin } from "@arthur/core/plugin";
import { type Check, checkSite } from "./site-check.ts";
import { checkOptions, EVERY_SECONDS, type UptimeOptions } from "./uptime-options.ts";
import { readState, writeState } from "./uptime-state.ts";

// The uptime plugin (spec/roadmap.md, entry 98): each project's sites checked over plain HTTP while `arthur run` runs, no model
// called. A site is down after 2 failed checks in a row: one `notice` with its URL, the reason and since when, and the event
// `uptime-down`; once it answers again, one notice with how long it was down, and `uptime-up`. When no site answers at all,
// this machine is taken as offline: one notice for it, none per site. What is down survives a restart (uptime-state.ts).
// docs/uptime.md.

export type { UptimeOptions };

// A check is cut after this many seconds, or after the site's everySeconds when shorter, so two checks of a site never overlap.
const LIMIT_SECONDS = 10;
// How often the sites due for a check are looked for.
const TICK_MS = 1000;
// Failed checks in a row that make a site down.
const FAILS = 2;

type Site = { readonly project: string; readonly url: string; readonly expect?: number | string; readonly every: number; next: number; fails: number; first?: Date; reason: string; down?: Date };

const failed = (check: Check) => (check.ok ? undefined : check);

export function uptime(options: UptimeOptions = {}): Plugin {
	let [running, busy] = [false, false];
	let timer: NodeJS.Timeout | undefined;
	let begin = () => {};
	let round = async () => {};
	return {
		name: "uptime",
		module: import.meta.url,
		options,
		check: checkOptions,
		after: ["projects"],
		setup(host) {
			const listed = (host.options as UptimeOptions).sites ?? {};
			const projects = new Set(host.collect<readonly { readonly name: string }[]>("projects").flat().map((project) => project.name));
			const strangers = Object.keys(listed).filter((name) => !projects.has(name));
			if (strangers.length > 0) throw new Error(`sites names ${strangers.join(", ")}, not a project of the projects list; each key of sites is a project's name`);
			const sites: Site[] = Object.entries(listed).flatMap(([project, list]) =>
				list.map(({ url, expect, everySeconds = EVERY_SECONDS }) => ({ project, url, expect, every: everySeconds * 1000, next: 0, fails: 0, reason: "" })),
			);
			const key = (site: Site) => `${site.project} ${site.url}`;
			let offline: Date | undefined;
			const notice = (text: string) => host.events.emit("notice", { text: `uptime: ${text}` });
			const when = (at: Date) => {
				const { date, time, day } = host.clock.local(at);
				return `${time} on ${day} ${date} (${host.clock.timeZone})`;
			};
			const lasted = (from: Date, to: Date) => {
				const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
				const minutes = Math.floor(seconds / 60);
				return seconds < 60 ? `${seconds} s` : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
			};
			// Written when what a restart needs differs from what was written last: once at the first round, then at each change.
			let written = "";
			const save = () => {
				const state = {
					down: Object.fromEntries(sites.flatMap((site) => (site.down === undefined ? [] : [[key(site), { since: site.down.toISOString(), reason: site.reason }]]))),
					...(offline === undefined ? {} : { offline: offline.toISOString() }),
				};
				if (JSON.stringify(state) !== written) writeState(host.folder, state);
				written = JSON.stringify(state);
			};
			const checkAll = (list: readonly Site[]) => {
				for (const site of list) site.next = Date.now() + site.every;
				return Promise.all(list.map((site) => checkSite(site.url, site.expect, Math.min(LIMIT_SECONDS, site.every / 1000))));
			};
			// Whether a site not down yet fails its FAILS-th check in a row without an answer: the moment offline is told apart.
			const reaching = (checked: readonly Site[], checks: readonly Check[]) =>
				checked.some((site, at) => site.down === undefined && site.fails + 1 >= FAILS && failed(checks[at] as Check)?.answered === false);
			const silent = (checks: readonly Check[]) => checks.every((check) => failed(check)?.answered === false);
			const apply = (checked: readonly Site[], checks: readonly Check[]) => {
				const at = host.clock.now();
				if (offline !== undefined) {
					if (silent(checks)) return;
					notice(`a site answers again, so the checks run again, after ${lasted(offline, at)} without an answer from any site`);
					offline = undefined;
				} else if (checked.length === sites.length && silent(checks) && reaching(checked, checks) && sites.filter((site) => site.down === undefined).length >= 2) {
					offline = at;
					for (const site of sites) if (site.down === undefined) [site.fails, site.first] = [0, undefined];
					notice(`none of the ${sites.length} sites answers (${checked[0]?.url}: ${failed(checks[0] as Check)?.reason}), so this machine looks offline and the checks cannot run; one notice follows when a site answers again`);
					return save();
				}
				checked.forEach((site, index) => {
					const check = checks[index] as Check;
					if (check.ok) {
						if (site.down !== undefined) {
							notice(`${site.url} (project ${site.project}) answers again, after ${lasted(site.down, at)} down since ${when(site.down)}`);
							host.events.emit("uptime-up", { project: site.project, url: site.url, since: site.down.toISOString(), downSeconds: Math.round((at.getTime() - site.down.getTime()) / 1000) });
						}
						[site.fails, site.first, site.down] = [0, undefined, undefined];
						return;
					}
					[site.fails, site.first] = [site.fails + 1, site.first ?? at];
					if (site.down !== undefined || site.fails < FAILS) return;
					[site.down, site.reason] = [site.first, check.reason];
					notice(`${site.url} (project ${site.project}) is down since ${when(site.down)}: ${check.reason}`);
					host.events.emit("uptime-down", { project: site.project, url: site.url, reason: check.reason, since: site.down.toISOString() });
				});
				save();
			};
			round = async () => {
				const due = sites.filter((site) => site.next - Date.now() < TICK_MS / 2);
				if (due.length === 0) return;
				let [checked, checks] = [due, await checkAll(due)];
				// Before a site goes down for want of an answer, every other site is asked too: when none answers, this machine is offline.
				if (offline === undefined && reaching(checked, checks) && sites.filter((site) => site.down === undefined).length >= 2) {
					const rest = sites.filter((site) => !due.includes(site));
					[checked, checks] = [[...due, ...rest], [...checks, ...(await checkAll(rest))]];
				}
				if (running) apply(checked, checks);
			};
			// What was down at the last stop stays down, told once; a site no longer listed is forgotten at the next save.
			begin = () => {
				const state = readState(host.folder);
				offline = state.offline === undefined ? undefined : new Date(state.offline);
				for (const site of sites) {
					const down = state.down[key(site)];
					if (down !== undefined) [site.down, site.reason, site.fails] = [new Date(down.since), down.reason, FAILS];
				}
			};
		},
		start() {
			running = true;
			begin();
			const look = () => {
				if (busy) return;
				busy = true;
				void round().finally(() => (busy = false));
			};
			look();
			timer = setInterval(look, TICK_MS);
		},
		stop() {
			running = false;
			clearInterval(timer);
		},
	};
}
