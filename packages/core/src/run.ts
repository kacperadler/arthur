import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { takeLock } from "./lock.ts";
import type { Plugin } from "./plugin.ts";

// `arthur run` (spec/roadmap.md, entry 8): Arthur as a process. Calls `start` of the plugins, already set up, in their setup
// order, stays until SIGTERM (or SIGINT), then calls `stop` in reverse. One process per home folder: `<home>/run.pid` holds it.

const SIGNALS = ["SIGTERM", "SIGINT"] as const;
// Under the 2^31 ms a timer can wait; it only keeps the process alive until a signal comes.
const KEEP_ALIVE_MS = 2 ** 30;

// `plugins` in setup order, as `loadPlugins` returns them. Resolves to the exit code: 1 when a `start` or a `stop` failed.
// Throws, starting nothing, when another live process runs the home folder.
export async function runPlugins(plugins: readonly Plugin[], home: string): Promise<number> {
	let signalled: string | undefined;
	let wake = () => {};
	const stopping = new Promise<void>((resolve) => (wake = resolve));
	const signal = (name: string) => {
		signalled ??= name;
		wake();
	};
	// Listening before the lock is taken, so no signal ends the process while it holds the lock without stopping anything.
	for (const name of SIGNALS) process.on(name, signal);
	const keepAlive = setInterval(() => {}, KEEP_ALIVE_MS);
	try {
		mkdirSync(home, { recursive: true });
		const lock = takeLock(join(home, "run.pid"));
		if ("heldBy" in lock) throw new Error(`${home} is already run by pid ${lock.heldBy}; one arthur run per home folder`);
		try {
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
			lock.release();
		}
	} finally {
		clearInterval(keepAlive);
		for (const name of SIGNALS) process.off(name, signal);
	}
}
