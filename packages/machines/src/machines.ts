import { arch, platform } from "node:process";
import { coreVersion } from "@arthur/core";
import type { Plugin } from "@arthur/core/plugin";
import { checkMachine, missingHere, publicAddress, type Report } from "./machine-check.ts";
import { checkOptions, type Labels, type MachineEntry, type MachinesOptions } from "./machine-options.ts";
import { labelsText, placement } from "./machine-place.ts";

// The machines plugin (spec/roadmap.md, entries 30 and 31): the machines of the `list` option, each registered with the core's
// job runner; `local`'s labels; each machine checked at start and every `check.everySeconds` (machine-check.ts), its changes
// emitted as `machine-online` and `machine-offline`; each job placed by labels (machine-place.ts); `arthur machines` and
// `/machines`; a doctor requirement per machine, `local` only with tools labels. docs/commands/machines.md.

export type { MachineEntry, MachinesOptions };

// Each check is cut here, its ssh killed; checks run in parallel, so a round costs no more than one check.
const LIMIT_SECONDS = 10;

// `work`'s answer, or `late` once LIMIT_SECONDS passed (a name lookup that hangs).
function within<T>(work: Promise<T>, late: T): Promise<T> {
	let timer: NodeJS.Timeout | undefined;
	const cut = new Promise<T>((resolve) => (timer = setTimeout(resolve, LIMIT_SECONDS * 1000, late)));
	return Promise.race([work, cut]).finally(() => clearTimeout(timer));
}

export function machines(options: MachinesOptions = {}): Plugin {
	let round: (() => Promise<ReadonlyMap<string, Report>>) | undefined;
	let [following, everySeconds] = [false, 60];
	let timer: NodeJS.Timeout | undefined;
	return {
		name: "machines",
		options,
		check: checkOptions,
		async setup(host) {
			const { local = {}, list = [], check = {} } = host.options as MachinesOptions;
			everySeconds = check.everySeconds ?? 60;
			// A public address refuses the load; a name not found now is the machine's check to report, as offline.
			const addresses = await Promise.all(list.map((machine) => within(publicAddress(host, machine.ssh).catch(() => undefined), undefined)));
			const refused = list.flatMap((machine, index) => (addresses[index] === undefined ? [] : [`machine ${machine.name}: ssh ${machine.ssh} resolves to ${addresses[index]}, a public address`]));
			if (refused.length > 0) throw new Error(`${refused.join("; ")}; Arthur reaches its machines only over a private network (loopback, RFC 1918, Tailscale)`);
			for (const { name, ssh, home, labels = {} } of list) host.jobs.registerMachine({ name, ssh, home, labels });
			// The state each machine's last event told; one round at a time, shared by whoever asks while it runs.
			const told = new Map<string, boolean>();
			let running: Promise<ReadonlyMap<string, Report>> | undefined;
			const timedOut = (machine: MachineEntry): Report => ({ online: false, reason: `check timed out after ${LIMIT_SECONDS} s`, fix: `ssh ${machine.ssh} true, by hand` });
			round = () =>
				(running ??= Promise.all(list.map(async (machine) => [machine.name, await within(checkMachine(host, machine, coreVersion(), LIMIT_SECONDS), timedOut(machine))] as const)).then((reports) => {
					running = undefined;
					for (const [name, report] of reports) {
						if (!following || told.get(name) === report.online) continue;
						told.set(name, report.online);
						if (report.online) host.events.emit("machine-online", { machine: name, os: report.os, arch: report.arch, version: report.version });
						else host.events.emit("machine-offline", { machine: name, reason: report.reason });
					}
					return new Map(reports);
				}));
			const checked = round;
			const localLabels = { os: platform === "darwin" ? "macos" : platform, arch, ...(local.labels?.tools === undefined ? {} : { tools: local.labels.tools }) };
			// `local`'s line, only with tools labels, in the shape of a listed machine's; `local` itself is always there.
			const here = (tools: readonly string[]) => {
				let lacking: readonly string[] | string = [];
				const found = `${localLabels.os} ${localLabels.arch}, arthur ${coreVersion()}`;
				const named = () => (typeof lacking === "string" ? tools : lacking).join(", ");
				return {
					name: "local",
					check: async () => {
						lacking = await missingHere(host, tools, LIMIT_SECONDS);
						if (typeof lacking === "string") return `missing: ${lacking} (${found})`;
						return lacking.length === 0 ? `ok (${found})` : `missing: command -v finds no ${named()} here (${found})`;
					},
					get costs() {
						return `no job that needs ${named()} runs on local`;
					},
					get fix() {
						return `install ${named()} on the PATH of arthur run, or drop what it does not need from local's tools label`;
					},
					critical: false,
				};
			};
			// One doctor run, one round: its first check starts every machine's, so checks asked one after another still cost one.
			host.provide("doctor", () => {
				let shared: Promise<ReadonlyMap<string, Report>> | undefined;
				let reports: ReadonlyMap<string, Report> | undefined;
				const listed = list.map((machine) => {
					// The tools labels this run's check did not find there, once it answered.
					const lacking = () => {
						const report = reports?.get(machine.name);
						return report?.online === true ? report.missing.join(", ") : "";
					};
					return {
						name: machine.name,
						check: async () => {
							const report = (reports = await (shared ??= checked())).get(machine.name);
							if (report?.online !== true) return `missing: ${report?.reason}`;
							const found = `${report.os} ${report.arch}, arthur ${report.version}`;
							return lacking() === "" ? `ok (${found})` : `missing: command -v finds no ${lacking()} there (${found})`;
						},
						get costs() {
							return lacking() === "" ? `no job runs on ${machine.name}` : `no job that needs ${lacking()} runs on ${machine.name}`;
						},
						// The fix of this run's reason.
						get fix() {
							const report = reports?.get(machine.name);
							if (report?.online === false) return report.fix;
							return lacking() === "" ? `ssh ${machine.ssh} true, by hand` : `install ${lacking()} on ${machine.name}, on the PATH of a command over ssh (docs/deploy.md), or drop what it does not need from its tools label`;
						},
						critical: false,
					};
				});
				return local.labels?.tools === undefined ? listed : [here(local.labels.tools), ...listed];
			});
			const seats = [{ name: "local", labels: localLabels, maxJobs: local.maxJobs }, ...list.map(({ name, labels = {}, maxJobs }) => ({ name, labels, maxJobs }))];
			host.provide("jobs.place", placement(host, seats, checked));
			const overview = async () => {
				const reports = await checked();
				const jobs = host.jobs.list().filter((job) => job.state !== "ended");
				const block = (name: string, head: string, labels: Labels, maxJobs: number | undefined) => {
					const own = jobs.filter((job) => job.machine === name).map((job) => `${job.id} (${job.state || "no state"})`);
					return `${name}${head}\n  labels: ${labelsText(labels)}; maxJobs: ${maxJobs ?? "not set"}; ${own.length === 0 ? "no jobs" : `jobs: ${own.join(", ")}`}`;
				};
				const state = (report: Report | undefined) => (report?.online === true ? `online (${report.os} ${report.arch}, arthur ${report.version})` : `offline: ${report?.reason}; fix: ${report?.fix}`);
				return [
					block("local", `: online (${localLabels.os} ${localLabels.arch}, arthur ${coreVersion()})`, localLabels, local.maxJobs),
					...list.map((machine) => block(machine.name, ` (ssh ${machine.ssh}): ${state(reports.get(machine.name))}`, machine.labels ?? {}, machine.maxJobs)),
				].join("\n");
			};
			host.commands.register({
				name: "machines",
				doc: new URL("../docs/commands/machines.md", import.meta.url),
				phone: { about: "every machine: its labels, online or why not, its jobs", reply: (text) => (text.trim() === "" ? overview() : "usage: /machines") },
				async run({ args }) {
					if (args.length > 0) {
						console.error("usage: arthur machines");
						return 2;
					}
					console.log(await overview());
				},
			});
		},
		start() {
			following = true;
			void round?.();
			timer = setInterval(() => void round?.(), everySeconds * 1000);
		},
		stop() {
			following = false;
			clearInterval(timer);
		},
	};
}
