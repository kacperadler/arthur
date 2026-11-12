import { execFile } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// The notice of a new release (spec/roadmap.md, entry 107), which the schedule plugin runs daily as manage's entry
// `manage.release`: each release tag on the core's origin newer than the one its checkout is at, told once. docs/manage.md,
// "The release notice".

const LIMIT_MS = 30_000;
const VERSION = /^\d+\.\d+\.\d+$/;

// `x.y.z` against `x.y.z`, below 0 when `a` is older: each number as a number, so 0.10.0 is newer than 0.9.0.
const compare = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

// git's stdout in `root`, cut after `limitMs`; never asks for a password, which no one is there to type.
function git(root: string, args: readonly string[], limitMs: number): Promise<string> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	execFile("git", ["-C", root, ...args], { timeout: limitMs, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (error, stdout, stderr) => {
		if (error === null) return resolve(stdout);
		const said = error.killed ? `cut after ${limitMs / 1000} s` : stderr.trim().split("\n")[0] || error.message;
		reject(new Error(`git ${args.join(" ")} in ${root}: ${said}`));
	});
	return promise;
}

// The newest release already told, from `<folder>/releases.json`; a file missing, broken or edited by hand is none.
function told(folder: string): string | undefined {
	try {
		const file: unknown = JSON.parse(readFileSync(join(folder, "releases.json"), "utf8"));
		const newest = typeof file === "object" && file !== null && "told" in file ? file.told : undefined;
		return typeof newest === "string" && VERSION.test(newest) ? newest : undefined;
	} catch {
		return undefined;
	}
}

// One run: nothing when the core (`host.code[0]`) is not a checkout at a release tag `v<x.y.z>`, such as a development
// checkout of main; else one `notice` per newer release on origin not told yet, oldest first. A listing that fails throws.
export async function releaseNotice(host: Pick<Host, "code" | "folder" | "events">, limitMs = LIMIT_MS): Promise<void> {
	const core = host.code[0];
	if (core === undefined) return;
	const tags = await git(core, ["tag", "--points-at", "HEAD", "--list", "v*"], limitMs).catch(() => "");
	const here = tags.split("\n").flatMap((tag) => /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1] ?? []).sort(compare).at(-1);
	if (here === undefined) return;
	// `<sha>\trefs/tags/v<x.y.z>`, a line each; the pattern also matches the end of a longer name, which the full match drops.
	const listed = await git(core, ["ls-remote", "--tags", "--refs", "origin", "v*"], limitMs);
	const releases = listed.split("\n").flatMap((line) => /^[0-9a-f]+\trefs\/tags\/v(\d+\.\d+\.\d+)$/.exec(line)?.[1] ?? []);
	const last = told(host.folder);
	const floor = last !== undefined && compare(last, here) > 0 ? last : here;
	const fresh = releases.filter((release) => compare(release, floor) > 0).sort(compare);
	if (fresh.length === 0) return;
	// Sent before it is written: a write that fails tells a release twice rather than never.
	for (const release of fresh) host.events.emit("notice", { text: `Arthur ${release} is out; this one runs ${here}: arthur update` });
	const file = join(host.folder, "releases.json");
	writeFileSync(`${file}.tmp`, `${JSON.stringify({ told: fresh.at(-1) }, null, "\t")}\n`);
	renameSync(`${file}.tmp`, file);
}
