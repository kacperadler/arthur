# arthur docker

Usage: `arthur docker`; `arthur docker sweep [--machine <name>] [--dry-run]` (`arthur docker sweep --help`). Comes with the `docker` plugin, `docker({ ... })` in `arthur.config.ts` (`packages/docker/docs/docker.md`).

What Docker holds on each machine labelled `tools: docker` (the `machines` plugin's labels), and what each job made there. Both commands run outside a job only: inside one the CLI refuses them before they run (`arthur help --help`), and a job's sandbox does not reach Docker's daemon anyway.

## `arthur docker`

For each machine labelled `tools: docker`, `local` first, then the others as registered, one `sh -c` there through the core's `run` (over SSH on another machine), cut after 60 s, the same listing the sweep reads: `docker info` (its clock and data root), `docker container ls --all`, `network ls`, `volume ls` and `image ls`, each with `--format '{{json .}}'`, `docker image inspect` for the images' labels, `docker system df`, and the jobs' script folders. Then, per machine:

```
local: Docker's data root /var/lib/docker
  Images: 4 (0 active), 1.4GB, 1.4GB reclaimable
  Containers: 3 (0 active), 155MB, 155MB reclaimable
  Local Volumes: 3 (0 active), 1.21GB, 1.21GB reclaimable
  Build Cache: 0 (0 active), 11.74GB, 11.74GB reclaimable
  2026-11-11-worker-0a1b2c3d: 1 container, 1 volume
  2026-11-01-worker-99999999 (no longer exists, so the sweep removes them): 2 containers, 1 network, 1 volume, 1 image
gpu: offline: ssh: connect to host gpu port 22: Connection refused
```

- The lines under the machine are `docker system df`'s, as Docker prints its sizes: `<type>: <count> (<active> active), <size>, <reclaimable> reclaimable`. They count everything there, the owner's own containers and named volumes too, which no job labelled and the sweep never removes.
- Then one line per job that labelled something there (`arthur.job=<id>`, or a compose project named `arthur-<the last 8 hex digits of its id>`): the job's id, or the compose project's name when no record matches it, and what it holds, by kind. A job whose record no longer exists is marked `(no longer exists, so the sweep removes them)`.
- A machine that cannot be read is one line: `<machine>: offline: <ssh's line>` (ssh exit 255), `Docker does not answer: <Docker's line>`, `listing what Docker holds exited <code>: <its first line>` or `timed out after 60 s`, or `command -v finds no docker there`.

With no machine labelled: `no machine is labelled tools: docker (the machines plugin's labels), so the docker plugin acts on none`. Exit 0, or 1 when a machine could not be read (no docker there is no failure). Any argument but `sweep` prints `usage: arthur docker [sweep [--machine <name>] [--dry-run]]`, exit 2.
