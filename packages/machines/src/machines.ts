import { arch, platform } from "node:process";
import { coreVersion } from "@arthur/core";
import type { Plugin } from "@arthur/core/plugin";
import { checkMachine, publicAddress, type Report } from "./machine-check.ts";
import { checkOptions, type Labels, type MachineEntry, type MachinesOptions } from "./machine-options.ts";

// The machines plugin (spec/roadmap.md, entry 30): the machines of the `list` option, each registered with the core's job
// runner; `local`'s labels; each machine checked at start and every `check.everySeconds` (machine-check.ts), its changes
// emitted as `machine-online` and `machine-offline`; `arthur machines` and `/machines`; a doctor requirement per machine.
// docs/commands/machines.md.

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
			// One doctor run, one round: its first check starts every machine's, so checks asked one after another still cost one.
			host.provide("doctor", () => {
				let shared: Promise<ReadonlyMap<string, Report>> | undefined;
				let reports: ReadonlyMap<string, Report> | undefined;
				return list.map((machine) => ({
					name: machine.name,
					check: async () => {
						const report = (reports = await (shared ??= checked())).get(machine.name);
						return report?.online === true ? `ok (${report.os} ${report.arch}, arthur ${report.version})` : `missing: ${report?.reason}`;
					},
					costs: `no job runs on ${machine.name}`,
					// The fix of this run's reason.
					get fix() {
						const report = reports?.get(machine.name);
						return report?.online === false ? report.fix : `ssh ${machine.ssh} true, by hand`;
					},
					critical: false,
				}));
			});
			const localLabels = { os: platform === "darwin" ? "macos" : platform, arch, ...(local.labels?.tools === undefined ? {} : { tools: local.labels.tools }) };
			const overview = async () => {
				const reports = await checked();
				const jobs = host.jobs.list().filter((job) => job.state !== "ended");
				const block = (name: string, head: string, labels: Labels, maxJobs: number | undefined) => {
					const own = jobs.filter((job) => job.machine === name).map((job) => `${job.id} (${job.state || "no state"})`);
					const shown = Object.entries(labels).map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(" ") : value}`);
					return `${name}${head}\n  labels: ${shown.join(", ") || "none"}; maxJobs: ${maxJobs ?? "not set"}; ${own.length === 0 ? "no jobs" : `jobs: ${own.join(", ")}`}`;
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
