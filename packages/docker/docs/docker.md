# The docker plugin

Roadmap entries 70 to 72: what a job creates with Docker is labelled `arthur.job=<id>`, its compose stacks get a project name of their own, all of it is removed right before the job's worktree goes, Docker's data root counts for the disk floor of the `resources` plugin, and a sweep removes the leftovers, daily, on `disk-low` and by hand. It acts on the machines whose labels hold `tools: docker`, as the `machines` plugin gives them (`machines.labels`, "Provided names" in `docs/plugin-api.md`); without the machines plugin no machine has labels, and the plugin does nothing. `arthur docker` shows what Docker holds on each (`arthur docker --help`).

```ts
plugins: [orchestration({}), machines({ local: { labels: { tools: ["docker"] } } }), projects({ folders: [...] }), docker({ buildCache: "10G", leftoverHours: 48, sweep: { at: "04:00" } })],
```

## Options

Each optional; checked at load (and by `arthur config check`). `buildCache` is used by each job's cleanup ("At each prune") and each sweep; `leftoverHours` and `sweep` by the sweep ("The sweep").

- `buildCache`: the size Docker's shared build cache is cut to after each job's cleanup and each sweep: bytes with K, M, G or T (`"10G"`), or `0` for no cap. Default `"10G"`.
- `leftoverHours`: the sweep removes unlabelled dangling images and unused networks, and the build cache unused, this many hours old or older; a number, 1 or more. Default 48.
- `sweep.at`: `"HH:MM"`, 00:00 to 23:59, in `core.timeZone`: the daily sweep, an entry the plugin registers with the `schedule` plugin (`arthur schedule` lists it as `docker.sweep`). Default none: no daily sweep. Refused at load without the schedule plugin: `sweep.at needs the schedule plugin, which runs the daily sweep; add schedule() to the config's plugins, or leave sweep out`.

Refused at load, naming the option: `leftoverHours` below 1 or not a number (`leftoverHours: expected a number of hours, 1 or more, got 0`); a `buildCache` that is not bytes with K, M, G or T or `0` (`10%`, `"0"`, `"10 GB"`); `sweep` that is not an object, or without `at`; `sweep.at` that is not `"HH:MM"` (`sweep.at: expected "HH:MM", 00:00 to 23:59, got "24:00"`); an option or key it does not take.

## A project's piece

`docker.project(false)` in a project's `project.config.ts` leaves its jobs without a docker script and without `COMPOSE_PROJECT_NAME`, so what they create is not labelled, and without the cleanup at each prune. `false` is the one value it takes; any other refuses the load, naming the project: `docker.project(...): expected false, the one value it takes (its jobs then get no docker script), got true`.

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

- Docker's own options before the command stay where they are: `docker --log-level debug run img` runs `docker --log-level debug run --label arthur.job=<id> img`. A leading `--` ends those options and Docker runs the command after it, so `docker -- run img` is labelled too.
- Every word that sets the `arthur.job` key is dropped, wherever it stands, before or after the image and before or after any `--`, so a job cannot label for another: `--label=arthur.job=X`, `-l=arthur.job=X`, `-larthur.job=X`, `--label` or `-l` followed by `arthur.job=X` (both words go; a group such as `-dl` keeps `-d`), and a bare `arthur.job=X` word. The script does not guess which word is an option's value: a literal `--label` or `--` given as one (`build --build-arg -- --label=arthur.job=x`, `volume create --label -- --label=arthur.job=x v`) shields nothing. A label with another key is kept, and so is every other word, the container's command and arguments after the image included. A `--label-file` stays, and Docker gives `--label` the last word over it.
- Unlabelled: `docker` called by its absolute path, Docker's API called from a library, and a compose stack under a `-p` of the job's own. The cleanup ("At each prune") does not find them, and the sweep takes of them only dangling images, unused networks and old build cache ("The sweep"); their containers and volumes stay, as the owner's own do.

A sandboxed job (Linux with Landlock, `arthur spawn --help`, "The sandbox"), whose sandbox hides Arthur's home, is shown its own script folder, `<home>/docker/jobs/<id>`, and no other job's nor the rest of the plugin's folder, so its shell runs the script (AR-D597). Such a job does not reach Docker's daemon: its sandbox opens no Unix socket but a datagram one, so the labelled command fails there as any `docker` command would.

## At each prune

Right before a job's worktree goes, wherever the removal comes from (`arthur prune`, the merge, a ticket set to dropped, manage's daily prune; `arthur prune --help`), the plugin's `jobs.cleanup` hook removes what the job made in Docker, for a job on a machine labelled `tools: docker` whose project has not set `docker.project(false)`. It runs on the job's machine through `host.jobs.run` (over SSH on another one), in two `sh -c` calls, the first cut after 30 s and the second after 85 s, so both end within the core's 2 minutes per hook:

1. `command -v docker`, then `docker info`. No `docker` there: nothing to clean, and no line.
2. What the job made, by its label `arthur.job=<id>` or its compose project's, `com.docker.compose.project=arthur-<the last 8 hex digits of its id>` (compose labels the images it builds with it too): `docker container ls --all`, `network ls`, `volume ls` and `image ls`, each with `--filter label=...`; and `docker system df`.
3. Its containers stopped together, each with a 10-second grace (`docker container stop --timeout 10`), then each removed with its anonymous volumes (`docker container rm --volumes`); then each of its networks, volumes and images (`docker <kind> rm`). An image with neither label (a pulled base, a shared or another job's image) is never listed, so never removed. What Docker refuses while `docker info` still answers is kept and named with Docker's first line: a network another job's container is attached to, a volume it mounts, an image it runs. It goes at a later prune of the job once unused, or with the sweep.
4. Docker's shared build cache cut to `buildCache` (`docker builder prune --force --max-used-space <buildCache>`, which buildx gives `docker builder`); not with `buildCache: 0`. A refusal is named in the line, the rest done: `build cache not cut: unknown flag: --max-used-space` from the legacy builder, without buildx.
5. The job's script folder, `<Arthur's home there>/docker/jobs/<id>/`, removed; then `docker system df` again.

The job's line in the prune's output gets one part, `docker: <what went>; <each one kept>; <the cache>; <space> freed`:

```
2026-11-11-worker-0a1b2c3d: docker: removed 2 containers, 1 network, 1 volume, 1 image; kept volume cache: Error response from daemon: remove cache: volume is in use - [c0000000000c]; build cache cut to 10G; 2.65GB freed; worktree <path> removed; branch arthur/2026-11-11-worker-0a1b2c3d deleted; record deleted
```

`nothing of the job's in Docker` in place of what went: a job that made nothing, or a later prune of the same job, where only the cut of the cache runs. The space freed is the sum of `docker system df`'s sizes before less the sum after, in Docker's units, so what other jobs on the machine add or remove meanwhile counts in it; never below `0B`.

The hook gives up with one core `notice`, `prune of job <id> on machine <machine>: docker's cleanup gave up: <reason>; the prune went on without it`, and the worktree goes all the same (on another machine, unless that machine does not answer: then the worktree stays too, and the next prune tries both):

- `Docker does not answer: <Docker's line>; what the job made there is left for the sweep`: `docker info` failed, Docker not running. Nothing is touched.
- `listing what the job made exited <code>: <its first line>` or `timed out after 30 s`, then `; what the job made there is left for the sweep`: ssh failing (exit 255) included.
- `Docker stopped answering half-way: <what went>; left for the sweep: <each one not removed>`, or `the removal timed out after 85 s half-way: ...` or `the removal exited <code>: <its first line> half-way: ...`: what went stays gone.

A label `arthur.keep` matters to the sweep only: the cleanup removes a job's own resource whatever its other labels.

## The sweep

What the cleanup at each prune could not remove, and what no job labelled, swept on each machine labelled `tools: docker`, whatever its projects' pieces say:

- daily at `sweep.at`, the schedule entry `docker.sweep`, every labelled machine in turn;
- on `disk-low`, the event the `resources` plugin emits when a machine falls under `keepFree.disk`: that machine at once, while `arthur run` runs, which also delivers the `disk-low` another process logged;
- by hand, `arthur docker sweep [--machine <name>] [--dry-run]` (`arthur docker sweep --help`); `--dry-run` removes nothing and lists what a real run would remove, and why.

One sweep at a time per machine, across processes too: a sweep waits for the one running there (a lock, `<home>/docker/sweep.<machine>.lock`, waited for up to 12 minutes), then finds only what that one left. On each machine two `sh -c` calls run through `host.jobs.run` (over SSH on another one): the listing, cut after 60 s (`docker info` for Docker's clock and data root, `docker container ls --all`, `network ls`, `volume ls` and `image ls` with `--format '{{json .}}'`, `docker image inspect` for the images' labels, `docker system df`, and the script folders under `<home there>/docker/jobs/`), then the removal, cut after 600 s. The job records are read after the listing: a job's record exists before anything it makes, so the resources of a live job always find it. It removes:

1. What a job labelled whose record no longer exists (`arthur.job=<id>`, or the compose project `arthur-<8 hex digits>` that no record's id ends in), at any age: what a cleanup gave up on, a volume kept while in use, a job pruned while Docker was down. Its stopped containers (`created`, `exited` or `dead`) with their anonymous volumes (`docker container rm --volumes`), then its networks, volumes and images (`docker <kind> rm`).
2. Unlabelled, `leftoverHours` old or older by Docker's clock (`docker info`'s `SystemTime`) against the resource's `CreatedAt`, so one exactly that old goes and one a minute younger stays: dangling images (`<none>:<none>`), and networks that no container lists, running or stopped, other than `bridge`, `host` and `none`.
3. The build cache unused that long (`docker builder prune --force --filter until=<leftoverHours>h`), then cut to `buildCache` as at each prune; not cut with `buildCache: 0`.
4. The script folders `<home there>/docker/jobs/<id>/` of jobs that no longer exist.

It never removes anything labelled `arthur.keep` (any value; `docker volume create --label arthur.keep ...`), a container that is running, paused or restarting, a resource labelled by a job whose record exists, and of the unlabelled ones a container, a volume (named or anonymous), a tagged image, or a network a container lists: the owner's own stopped stacks keep their containers and their data (AR-D520). Run `arthur docker sweep --dry-run` first on a machine you share. What Docker refuses while `docker info` still answers is kept and named, `kept <kind> <name>: <Docker's first line>`, such as a network a running container is attached to.

One `notice` per sweep, daily or on `disk-low` (by hand the same lines are printed instead): `docker: the sweep (daily):` or `docker: the sweep (disk-low on <machine>):`, then a line per machine:

```
- local: removed 1 container, 2 networks, 1 image, 1 script folder; build cache cut to 10G; 1.25GB reclaimed; 38.2 GB free on /var/lib/docker
- build: removed 3 images; build cache cut to 10G; 3.1GB reclaimed; 12.3 GB free on /var/lib/docker; still under the floor: 12.3 GB free on /var/lib/docker, floor 20 GB
- gpu: offline: ssh: connect to host gpu port 22: Connection refused; not swept
- mac: Docker does not answer: Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?; not swept
```

- A machine swept: what went, by kind, or `nothing to remove`; each one kept; `build cache not pruned: <Docker's line>` or `build cache not cut: <Docker's line>` (`unknown flag: --max-used-space` from the legacy builder); the space reclaimed, `docker system df`'s sizes before less after as at each prune, never below `0B`; the free disk on Docker's data root after, `df -Pk` there, in GB of 2^30 cut to one decimal.
- `still under the floor: <free> free on <path>, floor <floor>`: the path and floor of the last `disk-low` seen for that machine, kept in `<home>/docker/floors.json` so a sweep by hand knows them too, measured with `df -Pk` after the sweep.
- A machine not swept: `offline: <ssh's line>` (exit 255), `Docker does not answer: <Docker's line>`, `listing what Docker holds exited <code>: <its first line>` or `timed out after 60 s`, each with `; not swept`; the others are swept all the same. Half-way: `Docker stopped answering half-way: <what went>; left: <each one not removed>`, or `the removal timed out after 600 s half-way: ...`; what went stays gone. A labelled machine without `docker` says `command -v finds no docker there` and is no failure.

No notice when nothing was reclaimed, nothing failed and no machine is under its floor. In quiet hours (`core.quietHours`) the notice goes as every notice does: each channel sends it without a notification.

## The disk floor

With the `resources` plugin's `keepFree.disk`, each machine check asks `resources.disk` for the paths its jobs write; the plugin names Docker's data root on a labelled machine, `docker info --format '{{.DockerRootDir}}'` there (`/var/lib/docker`; rootless Docker's under the user's home), read once per process, the call cut after 10 s. Nothing is named when Docker is not running there (asked again at the next check), for a daemon the machine's Docker context reaches over TCP or SSH, whose data lies on another machine, or on a machine labelled `os: macos`: Docker Desktop keeps its data in its own virtual machine, said once in a `notice`, `docker: machine <machine> runs Docker Desktop, whose data lives in its own virtual machine, so keepFree.disk does not count it there`.

## `arthur doctor`

One line per machine labelled `tools: docker`, never critical, from one `sh -c` there cut after 5 s, before the doctor's own 10 s (`missing: docker info on <machine> timed out after 5 s`):

- `docker <machine>: ok (Docker <version>)`, `ok (Docker <version>, rootless)` for rootless Docker (`name=rootless` in `docker info`'s `SecurityOptions`): Docker answers as the user Arthur runs as, without `sudo`.
- `missing: command -v finds no docker on <machine>`.
- `missing: docker info failed on <machine>: <its last line>`: Docker not running there, or ssh failing.
- `missing: docker info on <machine> answered "...", not its JSON`: security options or warnings that are no list; a line that is no JSON at all fails the check, `missing: check failed: <error>` (`arthur doctor --help`).
- Refused as unsafe: `missing: unsafe: Arthur runs as root on <machine>, so each job's docker would be root's`; `missing: unsafe: the Docker socket <path> on <machine> is reachable only through sudo` (`docker info` fails and the Unix socket of the context is there but not writable); `missing: unsafe: the Docker daemon on <machine> listens on TCP without TLS (<Docker's warning>)` (the daemon's own warning in `docker info`'s `Warnings`, `API is accessible on http://...`).

Each line's fix names the step for its reason: install Docker or drop the label, start Docker (`sudo systemctl start docker`), `sudo usermod -aG docker "$USER"` or rootless Docker, or the daemon's TCP host removed or given TLS.
