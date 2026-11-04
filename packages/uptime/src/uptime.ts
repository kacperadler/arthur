import type { Plugin } from "@arthur/core/plugin";
import { type Check, checkSite, probe } from "./site-check.ts";
import { checkOptions, checkSites, EVERY_SECONDS, PROBES, type Site as UptimeSite, type UptimeOptions } from "./uptime-options.ts";
import { readState, writeState } from "./uptime-state.ts";

// The uptime plugin (spec/roadmap.md, entry 98): each project's sites checked over plain HTTP while `arthur run` runs, no model
// called. A site is down after 2 failed checks in a row: one `notice` with its URL, the reason and since when, and the event
// `uptime-down`; once it answers again, one notice with how long it was down, and `uptime-up`. When no site answers at all,
// nor any probe outside the projects, this machine is taken as offline (AR0623): no notice, no site checked, only the probes
// asked until one answers, a log line each way. What is down, and offline, survives a restart (uptime-state.ts). docs/uptime.md.

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
	let [begin, round] = [() => {}, async () => {}];
	return {
		name: "uptime",
		module: import.meta.url,
		options,
		check: checkOptions,
		after: ["projects"],
		piece: checkSites,
		setup(host) {
			const listed = host.collect<readonly { readonly name: string; readonly pieces?: { readonly uptime?: readonly UptimeSite[] } }[]>("projects").flat();
			const sites: Site[] = listed.flatMap(({ name: project, pieces }) =>
				(pieces?.uptime ?? []).map(({ url, expect, everySeconds = EVERY_SECONDS }) => ({ project, url, expect, every: everySeconds * 1000, next: 0, fails: 0, reason: "" })),
			);
			const key = (site: Site) => `${site.project} ${site.url}`;
			const probes = options.probes ?? PROBES;
			let offline: Date | undefined;
			const notice = (text: string) => host.events.emit("notice", { text: `uptime: ${text}` });
			const when = (at: Date) => { const { date, time, day } = host.clock.local(at); return `${time} on ${day} ${date} (${host.clock.timeZone})`; };
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
			const answered = async () => (await Promise.all(probes.map((url) => probe(url, LIMIT_SECONDS)))).includes(true);
			const apply = (checked: readonly Site[], checks: readonly Check[]) => {
				const at = host.clock.now();
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
				// While this machine is offline no site is asked: at each site's interval only the probes are, until one answers.
				if (offline !== undefined) {
					for (const site of due) site.next = Date.now() + site.every;
					if (!(await answered()) || !running) return;
					console.log(`uptime: a probe answers again, so the site checks run again, after ${lasted(offline, host.clock.now())} offline`);
					offline = undefined;
					save();
				}
				let [checked, checks] = [due, await checkAll(due)];
				// Before a site goes down for want of an answer, every other site and each probe is asked: none answering is offline.
				if (probes.length > 0 && reaching(checked, checks)) {
					const rest = sites.filter((site) => !due.includes(site));
					const [more, reached] = await Promise.all([checkAll(rest), answered()]);
					[checked, checks] = [[...due, ...rest], [...checks, ...more]];
					if (!reached && checks.every((check) => failed(check)?.answered === false) && running) {
						offline = host.clock.now();
						for (const site of sites) if (site.down === undefined) [site.fails, site.first] = [0, undefined];
						console.log(`uptime: none of the ${sites.length} sites answers, nor ${probes.join(" nor ")}, so this machine looks offline: no site is checked, only the probes, until one answers`);
						return save();
					}
				}
				if (running) apply(checked, checks);
			};
			// What was down at the last stop stays down, told once; a site no longer listed is forgotten at the next save.
			begin = () => {
				const state = readState(host.folder);
				offline = state.offline === undefined ? undefined : new Date(state.offline);
				for (const site of sites) { const down = state.down[key(site)]; if (down !== undefined) [site.down, site.reason, site.fails] = [new Date(down.since), down.reason, FAILS]; }
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
		stop() { running = false; clearInterval(timer); },
	};
}

// A project file's piece: `uptime.project([{ url: "https://shop.example/" }])`, its sites.
uptime.project = (sites: readonly UptimeSite[]) => ({ uptime: sites });
