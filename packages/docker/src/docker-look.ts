import type { Host, Ran } from "@arthur/core/plugin";

// What Docker holds on one machine (spec/roadmap.md, entry 72), each object with its labels and the job they name, read in one
// call there: what `arthur docker` shows and the sweep decides on (docker-sweep.ts); its readers of a call's sections and its
// count of kinds serve the cleanup at each prune too (docker-cleanup.ts). docs/docker.md, "The sweep".

export type Row = Readonly<Record<string, unknown>>;
type Labels = Readonly<Record<string, string>>;
// One object Docker holds: the word its removal takes, `<kind>:<id>`, its name, its row, its labels and the job they name.
export type Thing = { readonly kind: string; readonly word: string; readonly name: string; readonly row: Row; readonly labels: Labels; readonly job?: string };
// What a machine's Docker holds: its clock, its data root, each object, `docker system df`'s rows, the script folders there.
export type Seen = { readonly now: number; readonly root: string; readonly things: readonly Thing[]; readonly system: readonly Row[]; readonly folders: readonly string[] };

const LIST_SECONDS = 60;
// The kinds in the order they go: a container holds the others, a network or volume no image.
export const KINDS = ["container", "network", "volume", "image"];

// With `$1` the folder of the jobs' scripts. Exit 3: no docker there; 4: Docker does not answer. Else Docker's clock and data
// root, each kind's listing, each image's labels (`docker image ls` shows none), `docker system df`, then the script folders.
const LIST = `command -v docker >/dev/null || exit 3
info=$(docker info --format '{{.SystemTime}}{{"\\n"}}{{.DockerRootDir}}') || exit 4
echo ":info"; printf '%s\\n' "$info"
for kind in "container ls --all" "network ls" "volume ls" "image ls"; do echo ":\${kind%% *}"; docker $kind --format '{{json .}}' || exit; done
ids=$(docker image ls --format '{{.ID}}') || exit
echo ":labels"; [ -z "$ids" ] || docker image inspect --format '{{.Id}} {{json .Config.Labels}}' $ids
echo ":system"; docker system df --format '{{json .}}' || exit
echo ":folders"; ls "$1" 2>/dev/null; exit 0`;

// A call that failed: cut by its limit, or its exit code and first line.
export const why = (ran: Ran, limit: number) => (ran.code === null ? `timed out after ${limit} s` : `exited ${ran.code}: ${ran.stderr.trim().split("\n")[0]}`);
// The lines after each `:<section>` line, by section; a section named twice holds the lines of both.
export function sections(stdout: string): Map<string, string[]> {
	const found = new Map<string, string[]>();
	let at: string[] = [];
	for (const line of stdout.split("\n")) {
		if (line.startsWith(":")) found.set(line.slice(1), (at = found.get(line.slice(1)) ?? []));
		else if (line !== "") at.push(line);
	}
	return found;
}
export const json = (lines: readonly string[] = []): Row[] => lines.map((line) => JSON.parse(line));
// `k=v,k=v`, as a listing prints labels.
const pairs = (text: unknown): Labels => Object.fromEntries(String(text ?? "").split(",").filter((pair) => pair !== "").map((pair) => [pair.split("=")[0], pair.slice(pair.indexOf("=") + 1)]));
// The job a resource's labels name: its `arthur.job`, else a compose project named as the docker script names a job's.
const jobOf = (labels: Labels) => labels["arthur.job"] ?? /^arthur-[0-9a-f]{8}$/.exec(labels["com.docker.compose.project"] ?? "")?.[0];
// The record of `job`, a job's id or its compose project's name, among `ids`.
export const recordOf = (ids: readonly string[], job: string) => ids.find((id) => id === job || `arthur-${id.slice(-8)}` === job);

// `2 containers, 1 network, 1 script folder` of a list of kinds, in the order they go.
export const count = (kinds: readonly string[]) =>
	[...KINDS, "folder"]
		.map((kind) => [kind === "folder" ? "script folder" : kind, kinds.filter((each) => each === kind).length] as const)
		.flatMap(([kind, many]) => (many === 0 ? [] : [`${many} ${kind}${many === 1 ? "" : "s"}`]))
		.join(", ");

// What Docker on `machine` holds, or why it could not be read, and whether that is a failure.
export async function look(host: Host, machine: string): Promise<Seen | { readonly problem: string; readonly failed: boolean }> {
	const ran = await host.jobs.run(machine, ["sh", "-c", LIST, "docker", `${host.jobs.home(machine)}/docker/jobs`], LIST_SECONDS);
	const said = ran.stderr.trim().split("\n")[0];
	if (ran.code === 3) return { problem: "command -v finds no docker there", failed: false };
	if (ran.code === 255) return { problem: `offline: ${said}`, failed: true };
	if (ran.code === 4) return { problem: `Docker does not answer: ${said}`, failed: true };
	if (ran.code !== 0) return { problem: `listing what Docker holds ${why(ran, LIST_SECONDS)}`, failed: true };
	const found = sections(ran.stdout);
	const [time = "", root = ""] = found.get("info") ?? [];
	// `sha256:<id> <labels>`: the short ID `docker image ls` prints is the first 12 hex digits.
	const images = new Map((found.get("labels") ?? []).map((line) => [line.slice(7, 19), (JSON.parse(line.slice(line.indexOf(" ") + 1)) ?? {}) as Labels]));
	const things = KINDS.flatMap((kind) =>
		json(found.get(kind)).map((row): Thing => {
			const id = String(kind === "volume" ? row.Name : row.ID);
			const labels = kind === "image" ? (images.get(id) ?? {}) : pairs(row.Labels);
			const name = kind === "container" ? row.Names : kind !== "image" ? row.Name : row.Tag === "<none>" ? id : `${row.Repository}:${row.Tag}`;
			return { kind, word: `${kind}:${id}`, name: `${kind} ${name}`, row, labels, job: jobOf(labels) };
		}),
	);
	return { now: Date.parse(time), root, things, system: json(found.get("system")), folders: (found.get("folders") ?? []).filter((name) => /^[\w-]+$/.test(name)) };
}
