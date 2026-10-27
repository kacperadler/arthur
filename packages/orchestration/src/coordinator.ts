import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Answer } from "@arthur/core/plugin";
import { type Servers, writeMcp } from "./mcp.ts";
import type { Coordinator } from "./orchestration-options.ts";

// The coordinator's process (spec/roadmap.md, entry 23): one interactive agent in its own tmux session, started again after
// it ends, never beside a previous one still alive: docs/commands/coordinator.md.

const ENV_GUARD = fileURLToPath(import.meta.resolve("@arthur/core/env-guard"));
const INBOX = fileURLToPath(new URL("inbox-extension.ts", import.meta.url));
const CONTEXT = fileURLToPath(new URL("context-extension.ts", import.meta.url));
// What the context extension runs before each turn: this node, the core's CLI, in the folder `arthur run` runs in.
const CONTEXT_COMMAND = JSON.stringify([process.execPath, fileURLToPath(import.meta.resolve("@arthur/core/cli")), "coordinator", "context"]);
// How often the session is looked at, and how often a previous agent still alive is.
const POLL_MS = 500;
const EXIT_POLL_MS = 200;
// In the plugin's folder: the last agent started, `<pid> <start time>`; the mark `arthur coordinator stop` leaves; and the mark
// `coordinator.restart` leaves for a fresh conversation at the next start.
export const PID_FILE = "coordinator.pid";
export const STOPPED = "stopped";
export const FRESH = "fresh";

// tmux on the coordinator's own server: a socket with a slash is a path (`-S`), any other a name in tmux's folder (`-L`).
export function tmux(coordinator: Coordinator, args: readonly string[], inherit = false) {
	const socket = [coordinator.socket.includes("/") ? "-S" : "-L", coordinator.socket];
	return spawnSync("tmux", [...socket, ...args], inherit ? { stdio: "inherit" } : { encoding: "utf8" });
}

// `none` without the session; `dead` when its agent exited and a `remain-on-exit` in the human's tmux.conf kept the pane. The
// session's name is checked, so another session on the same server (whose global environment AR0434 clears) is never taken for it.
export function pane(coordinator: Coordinator): "none" | "alive" | "dead" {
	const shown = tmux(coordinator, ["display-message", "-p", "-t", `=${coordinator.session}:`, "#{session_name} #{pane_dead}"]);
	const [name, dead] = String(shown.stdout).trim().split(" ");
	if (shown.status !== 0 || name !== coordinator.session) return "none";
	return dead === "1" ? "dead" : "alive";
}

// The start time `ps` gives a live process, empty for a gone one: with the pid it names one process, whatever reuses the pid.
const startTime = (pid: string): string => (/^\d+$/.test(pid) ? String(spawnSync("ps", ["-o", "lstart=", "-p", pid], { encoding: "utf8" }).stdout ?? "").trim() : "");

// What another plugin adds to the coordinator's agent through `collect("coordinator.extension")`: an OMP extension it loads
// with `-e` after orchestration's own, and the variables it reads. An answer of another shape is left out, named.
export type Extension = { readonly file: string; readonly env: Readonly<Record<string, string>> };
export function extensions(answers: readonly Answer<unknown>[]): Extension[] {
	return answers.flatMap((answer) => {
		const { file, env } = ("value" in answer ? (answer.value ?? {}) : {}) as { readonly file?: unknown; readonly env?: unknown };
		const variables = typeof env === "object" && env !== null ? Object.entries(env) : undefined;
		if (typeof file === "string" && isAbsolute(file) && existsSync(file) && variables?.every(([key, value]) => /^ARTHUR_[A-Z0-9_]+$/.test(key) && typeof value === "string"))
			return [{ file, env: Object.fromEntries(variables) as Record<string, string> }];
		const why = "error" in answer ? answer.error.message : "expected { file, env }: the absolute path of an existing file, and ARTHUR_* variables with text values";
		console.error(`orchestration: the coordinator.extension of ${answer.plugin} is left out: ${why}`);
		return [];
	});
}

// Keeps the coordinator running until `stop`, which ends its session; a stop mark left by `arthur coordinator stop` is lifted
// first, since a new `arthur run` starts it again. Its MCP servers, `<folder>/mcp/` for `--plugin-dir`, are written once here
// (removed when it has none). Its lines go to `arthur run`'s output.
export function supervise(coordinator: Coordinator, folder: string, agent: string, added: readonly Extension[] = [], servers?: Servers): { stop(): Promise<void> } {
	rmSync(join(folder, STOPPED), { force: true });
	writeMcp(folder, servers);
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
		const fresh = existsSync(join(folder, FRESH));
		const command = [agent, ...(fresh ? [] : ["--continue"]), "--auto-approve", ...(model ? ["--model", model] : []), ...(thinking ? ["--thinking", thinking] : []), ...(quick ? ["--smol", quick] : [])];
		command.push("-e", ENV_GUARD, "-e", INBOX, "-e", CONTEXT, ...added.flatMap((extension) => ["-e", extension.file]));
		if (servers !== undefined) command.push("--plugin-dir", join(folder, "mcp"));
		const { restore, refused } = own(coordinator);
		const variables = [`ARTHUR_ORCHESTRATION_FOLDER=${folder}`, `ARTHUR_ORCHESTRATION_CONTEXT=${CONTEXT_COMMAND}`, ...added.flatMap((extension) => Object.entries(extension.env).map(([key, value]) => `${key}=${value}`))];
		const env = variables.flatMap((variable) => ["-e", variable]);
		const made = refused ?? tmux(coordinator, ["new-session", "-d", "-P", "-F", "#{pane_pid}", "-s", session, "-c", process.cwd(), ...env, ...command]);
		if (restore.length > 0) tmux(coordinator, restore);
		if (made.status !== 0) {
			const why = made.error?.message ?? String(made.stderr).trim().split("\n").at(-1);
			console.error(`orchestration: coordinator start failed: tmux ${refused ? "set-environment, set-option" : "new-session"}: ${why}; trying again in ${delay} s`);
			return false;
		}
		const started = String(made.stdout).trim();
		writeFileSync(`${file}.new`, `${started} ${startTime(started)}\n`);
		renameSync(`${file}.new`, file);
		if (fresh) rmSync(join(folder, FRESH), { force: true });
		console.log(`orchestration: coordinator started: ${agent} (pid ${started}) in tmux session ${session}${fresh ? ", a fresh conversation" : ""}`);
		return true;
	}
}

// The agent holds `arthur run`'s environment only, so the redaction by name reads its values (AR0434). A server this start makes
// copies it; one started earlier holds its own global environment, so a name `arthur run` lacks is cleared there, and one it
// holds with another value is named in `update-environment` at free indices, so `new-session` copies `arthur run`'s value from
// the tmux client's environment, never its argv (AR0465); `restore` unsets those indices after. `refused`: that call, when it failed.
function own(coordinator: Coordinator) {
	const shown = tmux(coordinator, ["show-environment", "-g"]);
	const global = (shown.status === 0 ? String(shown.stdout).split("\n") : []).filter((line) => line.indexOf("=") > 0).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)] as const);
	const clear = global.flatMap(([name]) => (process.env[name] === undefined ? [";", "set-environment", "-g", "-u", name] : []));
	const given = global.flatMap(([name, value]) => (process.env[name] === undefined || process.env[name] === value ? [] : [name]));
	const listed = given.length > 0 ? String(tmux(coordinator, ["show-options", "-g", "update-environment"]).stdout ?? "") : "";
	const free = Math.max(-1, ...[...listed.matchAll(/^update-environment\[(\d+)\]/gm)].map((match) => Number(match[1]))) + 1;
	const indices = given.map((_, at) => `update-environment[${free + at}]`);
	const calls = [...clear, ...given.flatMap((name, at) => [";", "set-option", "-g", indices[at] as string, name])];
	const called = calls.length > 0 ? tmux(coordinator, calls.slice(1)) : undefined;
	const restore = indices.flatMap((index) => [";", "set-option", "-gu", index]).slice(1);
	return { restore, refused: called?.status === 0 ? undefined : called };
}
