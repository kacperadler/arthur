import { join } from "node:path";
import { type DoctorLine, printAtStart, sendAtStart } from "./doctor.ts";
import { takeLock } from "./lock.ts";
import { ownHome } from "./own-home.ts";
import type { Plugin } from "./plugin.ts";

// `arthur run`, Arthur as a process: docs/commands/run.md. From the lock on until the stops it also sweeps for dead jobs every
// SWEEP_MS (spec/roadmap.md, entry 15). Its stop releases the lock only once every sweep in flight, which writes job records, has ended.

const SIGNALS = ["SIGTERM", "SIGINT"] as const;
// Under the 2^31 ms a timer can wait; it only keeps the process alive until a signal comes.
const KEEP_ALIVE_MS = 2 ** 30;
// How often the log is checked for lines another process wrote: one `fstat`, and a read only when it grew.
const FOLLOW_MS = 500;
const SWEEP_MS = 30_000;

// `plugins` in setup order, as `loadPlugins` returns them, with its `follow`, `doctor` and `emit`; `sweep` is the job runner's.
// Resolves to the exit code: 1 when a critical requirement is missing (doctor.ts), or a `start` or a `stop` failed. Throws,
// starting nothing, when another live process runs the home folder.
export async function runPlugins(
	plugins: readonly Plugin[],
	home: string,
	follow: (everyMs: number) => () => void,
	sweep: () => Promise<void>,
	doctor: () => Promise<readonly DoctorLine[]>,
	emit: (name: string, data: unknown) => void,
): Promise<number> {
	let signalled: string | undefined;
	const { promise: stopping, resolve: wake } = Promise.withResolvers<void>();
	const signal = (name: string) => {
		signalled ??= name;
		wake();
	};
	// Listening before the lock is taken, so no signal ends the process while it holds the lock without stopping anything.
	for (const name of SIGNALS) process.on(name, signal);
	const keepAlive = setInterval(() => {}, KEEP_ALIVE_MS);
	try {
		// Before the lock, which needs a writable home.
		const lines = await doctor();
		if (printAtStart(lines)) {
			sendAtStart(home, lines, emit);
			return 1;
		}
		ownHome(home);
		const lock = takeLock(join(home, "run.pid"));
		if ("heldBy" in lock) throw new Error(`${home} is already run by pid ${lock.heldBy}; one arthur run per home folder`);
		let unfollow = () => {};
		const failed = (error: unknown) => console.error(`arthur run: the sweep for dead jobs failed: ${error instanceof Error ? error.message : String(error)}`);
		let sweeps = Promise.resolve();
		const sweeping = setInterval(() => (sweeps = Promise.all([sweeps, Promise.try(sweep).catch(failed)]).then(() => {})), SWEEP_MS);
		try {
			unfollow = follow(FOLLOW_MS);
			// After the replay of the log, so this start's lines come last.
			sendAtStart(home, lines, emit);
			const started: Plugin[] = [];
			let code = 0;
			for (const plugin of plugins) {
				// A signal during a `start` lets it finish, so its plugin is stopped too; the plugins after it are not started.
				if (signalled !== undefined) break;
				try {
					await plugin.start?.();
					started.push(plugin);
				} catch (error) {
					console.error(`arthur run: plugin ${plugin.name}: start failed: ${error instanceof Error ? error.message : String(error)}`);
					code = 1;
					break;
				}
			}
			if (code === 0 && signalled === undefined) {
				console.log(`arthur run: pid ${process.pid} started ${started.map((plugin) => plugin.name).join(", ")}`);
				await stopping;
			}
			// Once the plugins stop, the events another process appends wait for the next start.
			unfollow();
			started.reverse();
			console.log(`arthur run: ${signalled ?? "a start failed"}: stopping ${started.map((plugin) => plugin.name).join(", ") || "nothing"}`);
			for (const plugin of started) {
				try {
					await plugin.stop?.();
				} catch (error) {
					console.error(`arthur run: plugin ${plugin.name}: stop failed: ${error instanceof Error ? error.message : String(error)}`);
					code = 1;
				}
			}
			console.log("arthur run: stopped");
			return code;
		} finally {
			unfollow();
			clearInterval(sweeping);
			await sweeps.then(lock.release);
		}
	} finally {
		clearInterval(keepAlive);
		for (const name of SIGNALS) process.off(name, signal);
	}
}
