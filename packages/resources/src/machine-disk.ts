import type { Host } from "@arthur/core/plugin";

// Each machine's free disk (spec/roadmap.md, entry 69): every filesystem its jobs write, its `home` and each path another
// plugin names for it through `collect("resources.disk", machine)`, read with `df -Pk` there: in the `machines` plugin's
// check of a round, else over the core's SSH on another machine, `local` taking the same path: docs/resources.md, "Free disk".

// One filesystem: the first path asked that lies on it, and its free bytes.
export type Disk = { readonly path: string; readonly free: number };
// What one check of the disk found: each filesystem once, and the paths not there.
export type Disks = { readonly disk: readonly Disk[]; readonly skipped: readonly string[] };
// A command's exit code (null when cut) and output, as `host.jobs.run` answers it.
type Ran = { readonly code: number | null; readonly stdout: string; readonly stderr: string };

const LIMIT_SECONDS = 10;
const GB = 2 ** 30;
// One answer per path, in order: `missing` for a path not there, else df's header and the line of its filesystem.
export const DF = 'for path do if [ -e "$path" ]; then df -Pk "$path" || exit; else echo missing; fi; done';
// A line of POSIX `df -P`: filesystem, 1024-blocks, used, available, capacity, mount point.
const LINE = /^(.+?)\s+\d+\s+\d+\s+(\d+)\s+(?:\d+%|-)\s+(\/.*)$/;

// Bytes as GB of 2^30, cut to one decimal, without `.0`: `12.3 GB`, `20 GB`.
export const diskGB = (bytes: number) => `${Math.floor((Math.max(0, bytes) / GB) * 10) / 10} GB`;

// The least free filesystem; undefined when none was measured.
export function leastFree(disk: readonly Disk[] | undefined): Disk | undefined {
	return disk?.reduce((least: Disk | undefined, each) => (least === undefined || each.free < least.free ? each : least), undefined);
}

// The least free filesystem when it is under `floor` bytes, 0 being no floor; else undefined.
export function underFloor(disk: readonly Disk[] | undefined, floor: number): Disk | undefined {
	const least = leastFree(disk);
	return floor > 0 && least !== undefined && least.free < floor ? least : undefined;
}

// The paths machine `name`'s df reads: its home first, then each one a provider names; why not, when a provider answers what
// is no absolute path.
export async function diskPaths(host: Host, name: string): Promise<readonly string[] | { readonly error: string }> {
	const asked: unknown[] = (await Promise.all(host.collect<unknown>("resources.disk", name))).flat();
	const wrong = asked.find((path) => typeof path !== "string" || !path.startsWith("/"));
	if (wrong !== undefined) return { error: `resources.disk answered ${JSON.stringify(wrong)}, not an absolute path` };
	return [host.jobs.home(name), ...(asked as string[])];
}

// Machine `name`'s filesystems now, df run there on `paths` (diskPaths).
export async function measureDisk(host: Host, name: string, paths: readonly string[]): Promise<Disks | { readonly error: string }> {
	return readDisk(paths, await host.jobs.run(name, ["sh", "-c", DF, "sh", ...paths], LIMIT_SECONDS));
}

// The filesystems DF's answer on `paths` names; why not, when the home is not there, or df fails or answers what is no
// `df -P` output. Two paths on one filesystem count once.
export function readDisk(paths: readonly string[], ran: Ran): Disks | { readonly error: string } {
	const said = ran.stderr.trim().split("\n").at(-1) || `exit code ${ran.code}`;
	if (ran.code === null) return { error: `df -Pk timed out after ${LIMIT_SECONDS} s` };
	if (ran.code === 255) return { error: `ssh failed: ${said}` };
	if (ran.code !== 0) return { error: `df -Pk failed there: ${said}` };
	const lines = ran.stdout.split("\n").filter((line) => line.trim() !== "" && !/^Filesystem\s/.test(line));
	const unread = { error: `df -Pk answered ${JSON.stringify(ran.stdout.trim().slice(0, 80))}, not POSIX df -P output` };
	if (lines.length !== paths.length) return unread;
	const [disk, skipped, seen] = [[] as Disk[], [] as string[], new Set<string>()];
	for (const [index, line] of lines.entries()) {
		const path = paths[index] as string;
		if (line === "missing" && index === 0) return { error: `its home ${path} is not there` };
		if (line === "missing") {
			skipped.push(path);
			continue;
		}
		const [, filesystem, available, mount] = LINE.exec(line) ?? [];
		if (available === undefined) return unread;
		if (!seen.has(`${filesystem} ${mount}`)) disk.push({ path, free: Number(available) * 1024 });
		seen.add(`${filesystem} ${mount}`);
	}
	return { disk, skipped };
}
