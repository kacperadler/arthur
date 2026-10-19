import { execFile } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import type { Requirement } from "@arthur/core/plugin";
import { alive, put } from "./request.ts";

// The session's requirements for `arthur doctor` (spec/roadmap.md, entry 80): the systemd user service that keeps `arthur run`
// up, installed, enabled, with `Restart=always`, and linger on, so it starts at boot. None without a user manager (macOS, a
// container): the core's `controllers` line says so, once. docs/session.md, "arthur doctor". And whether this `arthur run` is
// that service's, so `/restart` may end it while a restart is due (restart.ts).

const UNIT = "arthur.service";
// In the plugin's folder: the pid of the `arthur run` that the service starts again once it ends, while that one runs.
export const SERVICE = "service";

type Ran = { readonly ok: boolean; readonly stdout: string; readonly said: string };

// One command, cut after 10 s; `said`: why it failed, its first line on stderr, else what ended it.
function ran(command: string, args: readonly string[]): Promise<Ran> {
	const { promise, resolve } = Promise.withResolvers<Ran>();
	execFile(command, args, { encoding: "utf8", timeout: 10_000 }, (error, stdout, stderr) => {
		const why = error?.code === "ENOENT" ? `${command} not found on PATH` : error?.killed ? "no answer within 10 s" : `exit code ${error?.code}`;
		resolve({ ok: error === null, stdout, said: stderr.trim().split("\n")[0] || why });
	});
	return promise;
}

// At `arthur run`'s start: noted when it is the main process of arthur.service with `Restart=always`; a by-hand one is not,
// even beside a running service.
export async function noteService(folder: string): Promise<void> {
	const file = join(folder, SERVICE);
	rmSync(file, { force: true });
	const shown = await ran("systemctl", ["--user", "show", UNIT, "-p", "MainPID", "-p", "Restart"]);
	const value = (key: string) => new RegExp(`^${key}=(.*)$`, "m").exec(shown.stdout)?.[1];
	if (shown.ok && value("MainPID") === String(process.pid) && value("Restart") === "always") put(file, String(process.pid));
}

// The pid of the `arthur run` its service starts again once it ends, when that one runs; from any process.
export function servicePid(folder: string): number | undefined {
	const file = join(folder, SERVICE);
	const pid = existsSync(file) ? Number(readFileSync(file, "utf8")) : Number.NaN;
	return Number.isInteger(pid) && pid > 0 && alive(pid) ? pid : undefined;
}

export async function serviceRequirements(): Promise<Requirement[]> {
	if (!(await ran("systemctl", ["--user", "show-environment"])).ok) return [];
	const user = userInfo().username;
	return [
		{
			name: "service",
			check: async () => {
				const shown = await ran("systemctl", ["--user", "show", UNIT, "-p", "LoadState", "-p", "UnitFileState", "-p", "Restart"]);
				if (!shown.ok) return `missing: systemctl --user show ${UNIT}: ${shown.said}`;
				const value = (key: string) => new RegExp(`^${key}=(.*)$`, "m").exec(shown.stdout)?.[1] ?? "";
				if (value("LoadState") !== "loaded") return `missing: ${UNIT} is not installed`;
				const state = value("UnitFileState");
				if (state !== "enabled") return `missing: ${UNIT} is ${state === "" ? "not enabled" : `${state}, not enabled`}`;
				if (value("Restart") !== "always") return `missing: ${UNIT} has Restart=${value("Restart")}, not always`;
				return "ok";
			},
			costs: "nothing starts arthur run at boot, or again after it ends",
			fix: "write ~/.config/systemd/user/arthur.service as docs/setup.md step 9 shows, then systemctl --user daemon-reload && systemctl --user enable --now arthur",
		},
		{
			name: "linger",
			check: async () => {
				const shown = await ran("loginctl", ["show-user", user, "-p", "Linger", "--value"]);
				if (!shown.ok) return `missing: loginctl show-user ${user}: ${shown.said}`;
				return shown.stdout.trim() === "yes" ? "ok" : `missing: linger is off for ${user}`;
			},
			costs: `the user manager, and arthur run with it, starts only once ${user} logs in, not at boot`,
			fix: `sudo loginctl enable-linger ${user}`,
		},
	];
}
