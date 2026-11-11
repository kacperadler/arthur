import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "@arthur/core/plugin";
import { dockerCleanup } from "./docker-cleanup.ts";
import { dockerDoctor } from "./docker-doctor.ts";
import { checkOptions, checkPiece, type DockerOptions } from "./docker-options.ts";
import { dockerPrepare } from "./docker-prepare.ts";

// The docker plugin (spec/roadmap.md, entries 70 and 71): on each machine whose labels, as the machines plugin gives them
// (`machines.labels`), hold `tools: docker`, a job's own `docker` script that labels what it creates (docker-prepare.ts), what
// the job made removed right before its worktree goes (docker-cleanup.ts), Docker's data root for the resources plugin's disk
// floor (`resources.disk`), and a doctor line per machine (docker-doctor.ts). docs/docker.md.

export type { DockerOptions };

// `docker info` on a machine, for its data root.
const LIMIT_SECONDS = 10;
// The data root a daemon on that machine's own Unix socket answers; nothing for a daemon reached over TCP or SSH.
const ROOT = `case $(docker context inspect --format '{{.Endpoints.docker.Host}}') in unix://*) exec docker info --format '{{.DockerRootDir}}';; esac`;

type Labels = { readonly os?: unknown; readonly tools?: unknown };
type Listed = { readonly name: string; readonly pieces?: { readonly docker?: unknown } };

export function docker(options: DockerOptions = {}): Plugin {
	return {
		name: "docker",
		module: import.meta.url,
		options,
		after: ["projects"],
		check: checkOptions,
		piece: checkPiece,
		setup(host) {
			// A machine's labels when they hold `tools: docker`; without the machines plugin, none has them.
			const labelled = (machine: string) => [host.collect<Labels | undefined>("machines.labels", machine)[0]].find((labels) => Array.isArray(labels?.tools) && labels.tools.includes("docker"));
			// A notice said once per key, ever: `<folder>/told` lists the keys said.
			const told = join(host.folder, "told");
			const once = (key: string, text: string) => {
				if (existsSync(told) && readFileSync(told, "utf8").split("\n").includes(key)) return;
				appendFileSync(told, `${key}\n`);
				host.events.emit("notice", { text });
			};
			const [list = []] = host.collect<readonly Listed[]>("projects");
			// A job of a project that has not set `docker.project(false)`, on a labelled machine.
			const ours = (job: { readonly project: string; readonly machine: string }) => list.find((project) => project.name === job.project)?.pieces?.docker !== false && labelled(job.machine) !== undefined;
			host.jobs.prepare(dockerPrepare(host, ours, once));
			host.jobs.cleanup(dockerCleanup(host, ours, String(options.buildCache ?? "10G")));
			// Asked at every machine check, so a root once read is kept for this process.
			const roots = new Map<string, string>();
			host.provide("resources.disk", async (machine: string) => {
				const labels = labelled(machine);
				if (labels === undefined) return [];
				if (labels.os === "macos") {
					once(`macos ${machine}`, `docker: machine ${machine} runs Docker Desktop, whose data lives in its own virtual machine, so keepFree.disk does not count it there`);
					return [];
				}
				const known = roots.get(machine);
				if (known !== undefined) return [known];
				const ran = await host.jobs.run(machine, ["sh", "-c", ROOT], LIMIT_SECONDS);
				const root = ran.stdout.trim();
				if (!root.startsWith("/")) return [];
				roots.set(machine, root);
				return [root];
			});
			host.provide("doctor", () => dockerDoctor(host, labelled));
		},
	};
}

// A project file's piece: `docker.project(false)`, its jobs get no docker script and no cleanup, so what they create is not labelled.
docker.project = (off: false) => ({ docker: off });
