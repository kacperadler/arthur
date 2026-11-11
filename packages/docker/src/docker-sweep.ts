import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { queueLock } from "@arthur/core/lock";
import type { Host } from "@arthur/core/plugin";
import { bytes, human } from "./docker-cleanup.ts";
import { count, json, look, recordOf, type Seen, sections, type Thing, why } from "./docker-look.ts";

// The sweep of Docker's leftovers (spec/roadmap.md, entry 72), one machine at a time, each under a lock of its own: what a job
// whose record no longer exists labelled, at any age, but a running container; unlabelled dangling images and unused networks
// older than `leftoverHours`, the owner's own stopped containers and volumes kept (AR-D520); then the build cache unused that
// long, cut to `buildCache`; and the script folders of jobs that no longer exist. Never what is labelled `arthur.keep`.
// docs/docker.md, "The sweep".

export type Settings = { readonly hours: number; readonly cache: string };
// A machine swept: its line, a dry run's lines, and what makes the notice worth sending.
export type Swept = { readonly line: string; readonly would: readonly string[]; readonly failed: boolean; readonly reclaimed: boolean; readonly under: boolean };

// A sweep waits its turn behind the one before on the machine for as long as that one can take: its listing's 60 s, its removal's.
const REMOVE_SECONDS = 600;
const WAIT_MS = (60 + REMOVE_SECONDS + 60) * 1000;
const STOPPED = ["created", "exited", "dead"];
const PREDEFINED = ["bridge", "host", "none"];
const GB = 2 ** 30;

// With `$1` the hours, `$2` the cache cap (0: none), `$3` Docker's data root, `$4` the floor's path or "", then a `<kind>:<id>`
// or `folder:<path>` word each. A line per word, `removed <word>` or `kept <word> <Docker's first line>`; exit 5 once Docker
// stops answering, so a refusal is told from a failure by `docker info`. Then the cache, `docker system df` and `df -Pk`.
const REMOVE = `hours=$1 cache=$2 root=$3 floor=$4; shift 4
up() { docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 || exit 5; }
first() { printf '%s\\n' "$1" | head -n 1; }
for word in "$@"; do
	kind=\${word%%:*} what=\${word#*:} volumes=
	if [ "$kind" = folder ]; then rm -rf "$what" && echo "removed $word"; continue; fi
	[ "$kind" = container ] && volumes=--volumes
	if said=$(docker "$kind" rm $volumes "$what" 2>&1 >/dev/null); then echo "removed $word"; else up; echo "kept $word $(first "$said")"; fi
done
said=$(docker builder prune --force --filter "until=\${hours}h" 2>&1 >/dev/null) || { up; echo "unpruned $(first "$said")"; }
[ "$cache" = 0 ] || said=$(docker builder prune --force --max-used-space "$cache" 2>&1 >/dev/null) || { up; echo "uncut $(first "$said")"; }
echo ":system"; docker system df --format '{{json .}}'
echo ":root"; df -Pk "$root"
echo ":floor"; [ -z "$floor" ] || df -Pk "$floor"`;

// A listing's `CreatedAt`, `2026-11-09 08:00:00.123 +0100 CET`, in milliseconds; NaN for anything else, so its age is never enough.
const created = (text: unknown) => {
	const [, day, time, hours, minutes] = /^(\S+) (\d\d:\d\d:\d\d)(?:\.\d+)? ([+-]\d\d)(\d\d)\b/.exec(String(text)) ?? [];
	return day === undefined ? Number.NaN : Date.parse(`${day}T${time}${hours}:${minutes}`);
};
// Bytes as GB of 2^30, cut to one decimal, as the resources plugin says its floor.
const gb = (size: number) => `${Math.floor((Math.max(0, size) / GB) * 10) / 10} GB`;

// Why the sweep removes `thing`, or undefined: it keeps `arthur.keep`, a container not stopped, what a job with a record labelled,
// and of the rest, every unlabelled one but a dangling image or an unused network `hours` old or older.
function doom(thing: Thing, seen: Seen, ids: readonly string[], hours: number): string | undefined {
	if (Object.hasOwn(thing.labels, "arthur.keep")) return undefined;
	if (thing.job !== undefined) return recordOf(ids, thing.job) !== undefined || (thing.kind === "container" && !STOPPED.includes(String(thing.row.State))) ? undefined : `its job ${thing.job} no longer exists`;
	const age = (seen.now - created(thing.row.CreatedAt)) / 3_600_000;
	if (!(age >= hours)) return undefined;
	if (thing.kind === "image") return thing.row.Repository === "<none>" && thing.row.Tag === "<none>" ? `dangling, ${Math.floor(age)} h old` : undefined;
	const name = String(thing.row.Name);
	const used = seen.things.some((each) => each.kind === "container" && String(each.row.Networks).split(",").includes(name));
	return thing.kind === "network" && !PREDEFINED.includes(name) && !used ? `unused, ${Math.floor(age)} h old` : undefined;
}

// The floor of each machine, from the last `disk-low` seen for it; a file missing or edited into another shape is none.
function floors(host: Host): Readonly<Record<string, { readonly path: string; readonly floor: number } | undefined>> {
	try {
		return JSON.parse(readFileSync(join(host.folder, "floors.json"), "utf8"));
	} catch {
		return {};
	}
}

// A `disk-low` of a machine: its floor kept for the sweeps after, read by `arthur docker sweep` too.
export function keepFloor(host: Host, machine: string, path: string, floor: number): void {
	const file = join(host.folder, "floors.json");
	writeFileSync(`${file}.tmp`, `${JSON.stringify({ ...floors(host), [machine]: { path, floor } }, null, "\t")}\n`);
	renameSync(`${file}.tmp`, file);
}

async function sweepOne(host: Host, machine: string, settings: Settings, dryRun: boolean): Promise<Swept> {
	const seen = await look(host, machine);
	if ("problem" in seen) return { line: `${machine}: ${seen.problem}${seen.failed ? "; not swept" : ""}`, would: [], failed: seen.failed, reclaimed: false, under: false };
	// Read after the listing: a job's record exists before anything it makes, so each resource of a live job finds its record.
	const ids = host.jobs.list().map((record) => record.id);
	const doomed = seen.things.flatMap((thing) => [doom(thing, seen, ids, settings.hours)].flatMap((reason) => (reason === undefined ? [] : [{ thing, reason }])));
	const home = `${host.jobs.home(machine)}/docker/jobs`;
	const folders = seen.folders.filter((id) => !ids.includes(id));
	const cut = settings.cache === "0" ? "" : `, then cut it to ${settings.cache}`;
	if (dryRun) {
		const would = [...doomed.map(({ thing, reason }) => `would remove ${thing.name} (${reason})`), ...folders.map((id) => `would remove script folder ${home}/${id}`), `would prune the build cache unused for ${settings.hours} h${cut}`];
		return { line: `${machine}: --dry-run: ${doomed.length + folders.length} would be removed; nothing removed`, would: would.map((line) => `${machine}: ${line}`), failed: false, reclaimed: false, under: false };
	}
	const floor = floors(host)[machine];
	const words = [...doomed.map(({ thing }) => thing.word), ...folders.map((id) => `folder:${home}/${id}`)];
	const ran = await host.jobs.run(machine, ["sh", "-c", REMOVE, "docker", String(settings.hours), settings.cache, seen.root, floor?.path ?? "", ...words], REMOVE_SECONDS);
	const lines = ran.stdout.split("\n");
	const name = (word: string) => doomed.find(({ thing }) => thing.word === word)?.thing.name ?? `script folder ${word.slice(7)}`;
	const removed = words.filter((word) => lines.includes(`removed ${word}`));
	const kept = words.flatMap((word) => lines.filter((line) => line.startsWith(`kept ${word} `)).map((line) => `kept ${name(word)}: ${line.slice(word.length + 6)}`));
	const went = removed.length === 0 ? "nothing to remove" : `removed ${count(removed.map((word) => word.slice(0, word.indexOf(":"))))}`;
	if (ran.code !== 0) {
		const rest = words.filter((word) => !removed.includes(word)).map(name);
		const line = `${machine}: ${ran.code === 5 ? "Docker stopped answering" : `the removal ${why(ran, REMOVE_SECONDS)}`} half-way: ${went}${rest.length === 0 ? "" : `; left: ${rest.join(", ")}`}`;
		return { line, would: [], failed: true, reclaimed: removed.length > 0, under: false };
	}
	const said = (prefix: string, text: string) => lines.filter((line) => line.startsWith(`${prefix} `)).map((line) => `${text}: ${line.slice(prefix.length + 1)}`);
	const uncut = said("uncut", "build cache not cut");
	const cache = [...said("unpruned", "build cache not pruned"), ...(cut === "" ? [] : uncut.length > 0 ? uncut : [`build cache cut to ${settings.cache}`])];
	const after = sections(ran.stdout);
	const freed = Math.max(0, bytes(seen.system) - bytes(json(after.get("system"))));
	// df's `Available`, in KiB, on the line after its header.
	const free = (section: string) => Number(after.get(section)?.[1]?.split(/\s+/)[3] ?? Number.NaN) * 1024;
	const under = floor !== undefined && free("floor") < floor.floor;
	const parts = [went, ...kept, ...cache, `${human(freed)} reclaimed`, ...(Number.isNaN(free("root")) ? [] : [`${gb(free("root"))} free on ${seen.root}`])];
	if (under) parts.push(`still under the floor: ${gb(free("floor"))} free on ${floor.path}, floor ${gb(floor.floor)}`);
	return { line: `${machine}: ${parts.join("; ")}`, would: [], failed: false, reclaimed: removed.length > 0 || freed > 0, under };
}

// Sweeps each of `machines` in turn, each after any sweep there before it ends, across processes too; a throw in a machine's
// sweep costs that machine only, a lock still held after WAIT_MS rejects the whole call (findings.md, F3).
export async function sweep(host: Host, machines: readonly string[], settings: Settings, dryRun = false): Promise<Swept[]> {
	const swept: Swept[] = [];
	for (const machine of machines) {
		const release = await queueLock(join(host.folder, `sweep.${machine}.lock`), WAIT_MS);
		try {
			swept.push(await sweepOne(host, machine, settings, dryRun));
		} catch (error) {
			swept.push({ line: `${machine}: the sweep failed: ${(error as Error).message.split("\n")[0]}`, would: [], failed: true, reclaimed: false, under: false });
		} finally {
			release();
		}
	}
	return swept;
}

// The daily sweep and one on `disk-low`: one notice, unless nothing was reclaimed, nothing failed and no machine is under its floor.
export async function sweepAndTell(host: Host, machines: readonly string[], settings: Settings, cause: string): Promise<void> {
	const swept = await sweep(host, machines, settings);
	if (swept.some((each) => each.failed || each.reclaimed || each.under)) host.events.emit("notice", { text: [`docker: the sweep (${cause}):`, ...swept.map((each) => `- ${each.line}`)].join("\n") });
}
