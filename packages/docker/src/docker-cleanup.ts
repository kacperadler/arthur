import type { Host, Ran } from "@arthur/core/plugin";

// The docker plugin's `jobs.cleanup` hook (spec/roadmap.md, entry 71): right before a job's worktree goes, on its machine through
// `host.jobs.run`, what the job made in Docker, by its `arthur.job` label or its compose project's: its containers stopped and
// removed with their anonymous volumes, then its networks, volumes and images; each one Docker refuses kept and named; then the
// shared build cache cut to `buildCache` and the job's script folder removed. docs/docker.md, "At each prune".

// The job as the hook reads it.
type Job = { readonly id: string; readonly project: string; readonly machine: string };
type Row = Readonly<Record<string, unknown>>;

// Both calls together stay under the 2 minutes the core gives a hook.
const [LIST_SECONDS, REMOVE_SECONDS] = [30, 85];
// The object kinds in the order they go: a container holds the others, a network or volume no image.
const KINDS = ["container", "network", "volume", "image"];
// docker/go-units' decimal units, as `docker system df` prints sizes.
const UNITS = ["B", "kB", "MB", "GB", "TB", "PB"];

// With `$1` the job's id and `$2` its compose project. Exit 3: no docker there; 4: Docker does not answer. Else each kind's
// listing by the job's label, then by its compose project's, a JSON line per object after a `:<kind>` line; last `docker system df`.
const LIST = `command -v docker >/dev/null || exit 3
docker info --format '{{.ServerVersion}}' >/dev/null || exit 4
for kind in "container ls --all" "network ls" "volume ls" "image ls"; do
	for label in "arthur.job=$1" "com.docker.compose.project=$2"; do echo ":\${kind%% *}"; docker $kind --filter "label=$label" --format '{{json .}}' || exit; done
done
echo ":system"; docker system df --format '{{json .}}'`;

// With `$1` the cache cap (0: none), `$2` the job's script folder, `$3` its containers, then a `<kind>:<id>` word per object.
// A line per object, `removed <word>` or `kept <word> <Docker's first line>`, and one for the cache; exit 5 once Docker stops
// answering, so a refusal is told from a failure by `docker info`, never by Docker's words. Last `docker system df` again.
const REMOVE = `cache=$1 folder=$2 containers=$3; shift 3
up() { docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 || exit 5; }
[ -z "$containers" ] || docker container stop --timeout 10 $containers >/dev/null 2>&1
for word in "$@"; do
	kind=\${word%%:*}; volumes=; [ "$kind" = container ] && volumes=--volumes
	if said=$(docker "$kind" rm $volumes "\${word#*:}" 2>&1 >/dev/null); then echo "removed $word"; else up; echo "kept $word $(printf '%s\\n' "$said" | head -n 1)"; fi
done
if [ "$cache" != 0 ]; then
	if said=$(docker builder prune --force --max-used-space "$cache" 2>&1 >/dev/null); then echo "cut"; else up; echo "uncut $(printf '%s\\n' "$said" | head -n 1)"; fi
fi
rm -rf "$folder"
echo ":system"; docker system df --format '{{json .}}'`;

const why = (ran: Ran, limit: number) => (ran.code === null ? `timed out after ${limit} s` : `exited ${ran.code}: ${ran.stderr.trim().split("\n")[0]}`);
// The JSON lines after each `:<kind>` line, by kind.
function sections(stdout: string): Map<string, Row[]> {
	const found = new Map<string, Row[]>();
	let kind = "";
	for (const line of stdout.split("\n")) {
		if (line.startsWith(":")) kind = line.slice(1);
		else if (line.startsWith("{")) found.set(kind, [...(found.get(kind) ?? []), JSON.parse(line)]);
	}
	return found;
}
// The sum of `docker system df`'s sizes, in bytes; a size it prints as no number counts 0.
const bytes = (rows: readonly Row[] = []) =>
	rows.reduce((sum, row) => {
		const [, size = "0", unit = "B"] = /^([\d.]+)([kMGTP]?B)$/.exec(String(row.Size)) ?? [];
		return sum + Number(size) * 1000 ** UNITS.indexOf(unit);
	}, 0);
// Bytes as docker/go-units prints them: 4 significant digits, decimal units.
function human(size: number): string {
	let unit = 0;
	for (; size >= 1000 && unit < UNITS.length - 1; unit++) size /= 1000;
	return `${Number(size.toPrecision(4))}${UNITS[unit]}`;
}

// `ours(job)`: whether the job's machine is labelled and its project lets it be; `cache`: the `buildCache` option.
export function dockerCleanup(host: Host, ours: (job: Job) => boolean, cache: string) {
	return async (job: Job): Promise<string | undefined> => {
		if (!ours(job)) return undefined;
		const listed = await host.jobs.run(job.machine, ["sh", "-c", LIST, "docker", job.id, `arthur-${job.id.slice(-8)}`], LIST_SECONDS);
		if (listed.code === 3) return undefined;
		const left = "what the job made there is left for the sweep";
		if (listed.code === 4) throw new Error(`Docker does not answer: ${listed.stderr.trim().split("\n")[0]}; ${left}`);
		if (listed.code !== 0) throw new Error(`listing what the job made ${why(listed, LIST_SECONDS)}; ${left}`);
		const found = sections(listed.stdout);
		// Each object once, by the id its kind's `rm` takes, with the name the line gives it.
		const named = new Map<string, string>();
		for (const kind of KINDS)
			for (const row of found.get(kind) ?? []) {
				const tag = row.Tag === undefined || row.Tag === "<none>" ? row.ID : `${row.Repository}:${row.Tag}`;
				named.set(`${kind}:${kind === "volume" ? row.Name : row.ID}`, `${kind} ${kind === "container" ? row.Names : kind === "image" ? tag : row.Name}`);
			}
		const words = [...named.keys()];
		const containers = words.filter((word) => word.startsWith("container:")).map((word) => word.slice(10));
		const ran = await host.jobs.run(job.machine, ["sh", "-c", REMOVE, "docker", cache, `${host.jobs.home(job.machine)}/docker/jobs/${job.id}`, containers.join(" "), ...words], REMOVE_SECONDS);
		const lines = ran.stdout.split("\n");
		const removed = words.filter((word) => lines.includes(`removed ${word}`));
		const kept = words.flatMap((word) => lines.filter((line) => line.startsWith(`kept ${word} `)).map((line) => `kept ${named.get(word)}: ${line.slice(word.length + 6)}`));
		const counts = KINDS.flatMap((kind) => {
			const count = removed.filter((word) => word.startsWith(`${kind}:`)).length;
			return count === 0 ? [] : [`${count} ${kind}${count === 1 ? "" : "s"}`];
		});
		const went = counts.length === 0 ? "nothing of the job's in Docker" : `removed ${counts.join(", ")}`;
		if (ran.code !== 0) {
			const rest = words.filter((word) => !removed.includes(word)).map((word) => named.get(word));
			throw new Error(`${ran.code === 5 ? "Docker stopped answering" : `the removal ${why(ran, REMOVE_SECONDS)}`} half-way: ${went}${rest.length === 0 ? "" : `; left for the sweep: ${rest.join(", ")}`}`);
		}
		const uncut = lines.find((line) => line.startsWith("uncut "));
		const cut = cache === "0" ? [] : [uncut === undefined ? `build cache cut to ${cache}` : `build cache not cut: ${uncut.slice(6)}`];
		const freed = Math.max(0, bytes(found.get("system")) - bytes(sections(ran.stdout).get("system")));
		return [went, ...kept, ...cut, `${human(freed)} freed`].join("; ");
	};
}
