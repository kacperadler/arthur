import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Coordinator } from "./orchestration-options.ts";

// The coordinator's process (spec/roadmap.md, entry 23): one interactive agent in its own tmux session, started again after
// it ends, never beside a previous one still alive: docs/commands/coordinator.md.

const ROLE = fileURLToPath(new URL("../roles/coordinator.md", import.meta.url));
const ENV_GUARD = fileURLToPath(import.meta.resolve("@arthur/core/env-guard"));
const INBOX = fileURLToPath(new URL("inbox-extension.ts", import.meta.url));
// How often the session is looked at, and how often a previous agent still alive is.
const POLL_MS = 500;
const EXIT_POLL_MS = 200;
// In the plugin's folder: the last agent started, `<pid> <start time>`; and the mark `arthur coordinator stop` leaves.
export const PID_FILE = "coordinator.pid";
export const STOPPED = "stopped";

// tmux on the coordinator's own server: a socket with a slash is a path (`-S`), any other a name in tmux's folder (`-L`).
export function tmux(coordinator: Coordinator, args: readonly string[], inherit = false) {
	const socket = [coordinator.socket.includes("/") ? "-S" : "-L", coordinator.socket];
	return spawnSync("tmux", [...socket, ...args], inherit ? { stdio: "inherit" } : { encoding: "utf8" });
}

// `none` without the session; `dead` when its agent exited and a `remain-on-exit` in the human's tmux.conf kept the pane.
export function pane(coordinator: Coordinator): "none" | "alive" | "dead" {
	const shown = tmux(coordinator, ["display-message", "-p", "-t", `=${coordinator.session}:`, "#{pane_dead}"]);
	if (shown.status !== 0) return "none";
	return String(shown.stdout).trim() === "1" ? "dead" : "alive";
}

// The start time `ps` gives a live process, empty for a gone one: with the pid it names one process, whatever reuses the pid.
const startTime = (pid: string): string => (/^\d+$/.test(pid) ? String(spawnSync("ps", ["-o", "lstart=", "-p", pid], { encoding: "utf8" }).stdout ?? "").trim() : "");

// Keeps the coordinator running until `stop`, which ends its session; a stop mark left by `arthur coordinator stop` is lifted
// first, since a new `arthur run` starts it again. Its lines go to `arthur run`'s output.
export function supervise(coordinator: Coordinator, folder: string, agent: string): { stop(): Promise<void> } {
	rmSync(join(folder, STOPPED), { force: true });
	const quit = new AbortController();
	const pause = (ms: number) => sleep(ms, undefined, { signal: quit.signal }).catch(() => {});
	const delay = coordinator.restartDelaySeconds;
	const running = (async () => {
		// When the next start may be tried; whether the agent was seen alive since the last start.
		let next = 0;
		let up = false;
		while (!quit.signal.aborted) {
			const now = pane(coordinator);
			if (now === "alive") up = true;
			else {
				if (now === "dead") tmux(coordinator, ["kill-session", "-t", `=${coordinator.session}`]);
				const stopped = existsSync(join(folder, STOPPED));
				if (up) {
					console.log(`orchestration: the coordinator ended; ${stopped ? "arthur coordinator stop asked, so it stays stopped until arthur run starts again" : `starting it again in ${delay} s`}`);
					[up, next] = [false, Date.now() + delay * 1000];
				}
				if (!stopped && Date.now() >= next) {
					up = await start();
					if (!up) next = Date.now() + delay * 1000;
				}
			}
			await pause(POLL_MS);
		}
	})();
	return {
		async stop() {
			quit.abort();
			await running;
			tmux(coordinator, ["kill-session", "-t", `=${coordinator.session}`]);
		},
	};

	// One start, once the previous agent exited or `exitWaitSeconds` passed; false when it did not start.
	async function start(): Promise<boolean> {
		const file = join(folder, PID_FILE);
		const [pid = "", ...since] = existsSync(file) ? readFileSync(file, "utf8").trim().split(" ") : [];
		const alive = () => since.length > 0 && startTime(pid) === since.join(" ");
		const began = Date.now();
		while (alive() && Date.now() - began < coordinator.exitWaitSeconds * 1000 && !quit.signal.aborted) await pause(EXIT_POLL_MS);
		if (quit.signal.aborted) return false;
		const waited = ((Date.now() - began) / 1000).toFixed(1);
		if (alive()) {
			console.error(`orchestration: coordinator start refused: the previous ${agent} (pid ${pid}) is still running ${waited} s later; trying again in ${delay} s`);
			return false;
		}
		if (Date.now() - began >= EXIT_POLL_MS) console.log(`orchestration: the previous ${agent} (pid ${pid}) exited after ${waited} s`);
		const { model, thinking, quick, session } = coordinator;
		const command = [agent, "--continue", "--auto-approve", ...(model ? ["--model", model] : []), ...(thinking ? ["--thinking", thinking] : []), ...(quick ? ["--smol", quick] : [])];
		command.push("-e", ENV_GUARD, "-e", INBOX, "--append-system-prompt", ROLE);
		const env = ["-e", `ARTHUR_ORCHESTRATION_FOLDER=${folder}`];
		const made = tmux(coordinator, ["new-session", "-d", "-P", "-F", "#{pane_pid}", "-s", session, "-c", process.cwd(), ...env, ...command]);
		if (made.status !== 0) {
			const why = made.error?.message ?? String(made.stderr).trim().split("\n").at(-1);
			console.error(`orchestration: coordinator start failed: tmux new-session: ${why}; trying again in ${delay} s`);
			return false;
		}
		const started = String(made.stdout).trim();
		writeFileSync(`${file}.new`, `${started} ${startTime(started)}\n`);
		renameSync(`${file}.new`, file);
		console.log(`orchestration: coordinator started: ${agent} (pid ${started}) in tmux session ${session}`);
		return true;
	}
}
