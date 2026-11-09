# The docker plugin

Roadmap entry 70: what a job creates with Docker is labelled `arthur.job=<id>`, its compose stacks get a project name of their own, and Docker's data root counts for the disk floor of the `resources` plugin. It acts on the machines whose labels hold `tools: docker`, as the `machines` plugin gives them (`machines.labels`, "Provided names" in `docs/plugin-api.md`); without the machines plugin no machine has labels, and the plugin does nothing. The cleanup of a job's resources with its worktree (entry 71) and the sweep of leftovers (entry 72) are not built yet.

```ts
plugins: [orchestration({}), machines({ local: { labels: { tools: ["docker"] } } }), projects({ folders: [...] }), docker({ buildCache: "10G", leftoverHours: 48, sweep: { at: "04:00" } })],
```

## Options

Each optional; checked at load (and by `arthur config check`). Their cleanup and sweep come with entries 71 and 72; until then they are only checked.

- `buildCache`: the size Docker's shared build cache is cut to after each job's cleanup and each sweep: bytes with K, M, G or T (`"10G"`), or `0` for no cap. Default `"10G"`.
- `leftoverHours`: the sweep removes unlabelled leftovers older than this many hours (stopped containers, unused networks, dangling images, unused anonymous volumes, build cache); a number, 1 or more. Default 48.
- `sweep.at`: `"HH:MM"`, 00:00 to 23:59, in `core.timeZone`: the daily sweep, a schedule entry. Default none: no daily sweep.

Refused at load, naming the option: `leftoverHours` below 1 or not a number (`leftoverHours: expected a number of hours, 1 or more, got 0`); a `buildCache` that is not bytes with K, M, G or T or `0` (`10%`, `"0"`, `"10 GB"`); `sweep` that is not an object, or without `at`; `sweep.at` that is not `"HH:MM"` (`sweep.at: expected "HH:MM", 00:00 to 23:59, got "24:00"`); an option or key it does not take.

## A project's piece

`docker.project(false)` in a project's `project.config.ts` leaves its jobs without a docker script and without `COMPOSE_PROJECT_NAME`, so what they create is not labelled. `false` is the one value it takes; any other refuses the load, naming the project: `docker.project(...): expected false, the one value it takes (its jobs then get no docker script), got true`.

## At each spawn

For a job on a machine labelled `tools: docker` whose project has not set `docker.project(false)`, the plugin's `prepare` runs one `sh -c` on the job's machine through `host.jobs.run` (over SSH on another machine), cut after 30 s:

1. `command -v docker` and `command -v node` there, outside the job's PATH: the real `docker`, and Arthur's own Node, which strips the types of the script's TypeScript whatever Node the project's `.nvmrc` names.
2. Into `<Arthur's home there>/docker/jobs/<id>/`: `docker-label.ts`, a copy of the plugin's own sent on the call's stdin, then `docker`, a shell script that runs `<node> <that copy> <real docker> <id> "$@"`; each written under another name and renamed, so a job never runs half of one.
3. The job gets two variables, in its environment only, never its record: `PATH=<that folder>:<the PATH before>`, the PATH before being the one a prepare before docker's returned (nvm's), else the machine's own as a command there sees it; and `COMPOSE_PROJECT_NAME=arthur-<the last 8 hex digits of its id>`, so compose labels its stack with `com.docker.compose.project` itself and two jobs never share one. A compose `-p <name>` the job gives wins, and that stack is not the job's.

`arthur continue` runs the prepare again and writes the script anew.

Machines labelled but without `docker`: no script and no variable; one `notice`, said once per machine, ever (`<home>/docker/told` lists the machines told): `docker: machine <machine> is labelled tools: docker, but command -v finds no docker there; its jobs get no docker script, so what they create is not labelled`.

Refused, the spawn ending with `plugin docker: prepare failed: <reason>; the job's worktree and record were removed`: `writing the docker script of <id> on machine <machine> exited <code>: <its last line>`, for no `node` there, a path holding a `'`, a folder it cannot write, or ssh failing (exit 255); `... timed out after 30 s`.

## What the script labels

`--label arthur.job=<id>` goes right after the words of each command that creates something: `run`, `create`, `build`, `buildx build`, `container run`, `container create`, `image build`, `network create` and `volume create`. Every other command passes unchanged, and so do Docker's output and exit code.

- Docker's own options before the command stay where they are: `docker --log-level debug run img` runs `docker --log-level debug run --label arthur.job=<id> img`.
- Every `arthur.job` label the job gives itself is taken out, in each spelling (`--label k=v`, `--label=k=v`, and for `run` and `create` `-l k=v`, `-lk=v`, `-dl k=v`), so a job cannot label for another; a label with another key is kept. A `--label-file` stays, and Docker gives `--label` the last word over it.
- For `run` and `create`, what follows the image belongs to the container and is left alone (`docker run img --label x`); so is everything after `--`. The options there that take no value (`--rm`, `-it`, `-d`, ...) are told from those that take one, as docker/cli v29 declares them.
- Unlabelled, and left to the sweep: `docker` called by its absolute path, Docker's API called from a library, and a compose stack under a `-p` of the job's own.

In a job whose sandbox hides Arthur's home (Linux with Landlock, `arthur spawn --help`, "The sandbox"), the job cannot read the script: `sh` and `node` then run the next `docker` on its PATH, unlabelled, and `bash` stops with `Permission denied` (exit 126). Such a job does not reach Docker's daemon either: its sandbox opens no Unix socket but a datagram one.

## The disk floor

With the `resources` plugin's `keepFree.disk`, each machine check asks `resources.disk` for the paths its jobs write; the plugin names Docker's data root on a labelled machine, `docker info --format '{{.DockerRootDir}}'` there (`/var/lib/docker`; rootless Docker's under the user's home), read once per process. Nothing is named when Docker is not running there (asked again at the next check), for a daemon the machine's Docker context reaches over TCP or SSH, whose data lies on another machine, or on a machine labelled `os: macos`: Docker Desktop keeps its data in its own virtual machine, said once in a `notice`, `docker: machine <machine> runs Docker Desktop, whose data lives in its own virtual machine, so keepFree.disk does not count it there`.

## `arthur doctor`

One line per machine labelled `tools: docker`, never critical, from one `sh -c` there cut after 10 s:

- `docker <machine>: ok (Docker <version>)`, `ok (Docker <version>, rootless)` for rootless Docker (`name=rootless` in `docker info`'s `SecurityOptions`): Docker answers as the user Arthur runs as, without `sudo`.
- `missing: command -v finds no docker on <machine>`.
- `missing: docker info failed on <machine>: <its last line>`: Docker not running there, or ssh failing.
- Refused as unsafe: `missing: unsafe: Arthur runs as root on <machine>, so each job's docker would be root's`; `missing: unsafe: the Docker socket <path> on <machine> is reachable only through sudo` (`docker info` fails and the Unix socket of the context is there but not writable); `missing: unsafe: the Docker daemon on <machine> listens on TCP without TLS (<Docker's warning>)` (the daemon's own warning in `docker info`'s `Warnings`, `API is accessible on http://...`).

Each line's fix names the step for its reason: install Docker or drop the label, start Docker (`sudo systemctl start docker`), `sudo usermod -aG docker "$USER"` or rootless Docker, or the daemon's TCP host removed or given TLS.
