import { readFileSync } from "node:fs";
import type { Host, Prepare } from "@arthur/core/plugin";

// The docker plugin's prepare (spec/roadmap.md, entry 70): for a job on a machine labelled `tools: docker`, unless its project's
// piece is `docker.project(false)`, the job's `docker` script, written on that machine through `host.jobs.run`, first on its PATH,
// and its own compose project name. docs/docker.md, "At each spawn".

type Listed = { readonly name: string; readonly pieces?: { readonly docker?: unknown } };

// One call on the job's machine.
const LIMIT_SECONDS = 30;
// What the script runs: this file's text goes to the machine on the call's stdin.
const LABEL = new URL("./docker-label.ts", import.meta.url);

// With `$1` the job's script folder there and `$2` its id: docker and node as a command there finds them, outside the job's PATH;
// the copy of docker-label.ts read from stdin, then the script, each written under another name and renamed, so a job never
// runs half of one; last, the PATH it saw. Exit 3: no docker there; 4: no node, or a path the script could not quote.
const WRITE = `docker=$(command -v docker) || exit 3
node=$(command -v node) || { echo "command -v finds no node, which runs the script" >&2; exit 4; }
case "$1$node$docker" in *"'"*) echo "a path with a ' in it: $1, $node or $docker" >&2; exit 4;; esac
mkdir -p "$1" && cat > "$1/docker-label.ts.new" && mv "$1/docker-label.ts.new" "$1/docker-label.ts" &&
printf "#!/bin/sh\\nexec '%s' '%s' '%s' '%s' \\"\\$@\\"\\n" "$node" "$1/docker-label.ts" "$docker" "$2" > "$1/docker.new" &&
chmod 755 "$1/docker.new" && mv "$1/docker.new" "$1/docker" && printf '%s\\n' "$PATH"`;

// `docker(machine)`: whether the machine has the label; `once(key, text)`: a notice said once per key.
export function dockerPrepare(host: Host, docker: (machine: string) => unknown, once: (key: string, text: string) => void): Prepare {
	const label = readFileSync(LABEL, "utf8");
	const [list = []] = host.collect<readonly Listed[]>("projects");
	return async (job, env) => {
		if (list.find((project) => project.name === job.project)?.pieces?.docker === false || docker(job.machine) === undefined) return undefined;
		const folder = `${host.jobs.home(job.machine)}/docker/jobs/${job.id}`;
		const ran = await host.jobs.run(job.machine, ["sh", "-c", WRITE, "docker", folder, job.id], LIMIT_SECONDS, label);
		if (ran.code === 3) return once(`no-docker ${job.machine}`, `docker: machine ${job.machine} is labelled tools: docker, but command -v finds no docker there; its jobs get no docker script, so what they create is not labelled`);
		const said = ran.code === null ? `timed out after ${LIMIT_SECONDS} s` : `exited ${ran.code}: ${ran.stderr.trim().split("\n").at(-1)}`;
		if (ran.code !== 0) throw new Error(`writing the docker script of ${job.id} on machine ${job.machine} ${said}`);
		return { PATH: `${folder}:${env.PATH ?? ran.stdout.trim().split("\n").at(-1)}`, COMPOSE_PROJECT_NAME: `arthur-${job.id.slice(-8)}` };
	};
}
