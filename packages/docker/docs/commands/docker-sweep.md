# arthur docker sweep

Usage: `arthur docker sweep [--machine <name>] [--dry-run]`. The shared rules (the machines, the refusal inside a job) are `arthur docker --help`.

The sweep of Docker's leftovers by hand, on each machine labelled `tools: docker`, or on `<name>` alone. It is the sweep `sweep.at` runs daily and a `disk-low` runs on its machine (`packages/docker/docs/docker.md`, "The sweep"), which says what goes and what stays; by hand it prints its lines instead of sending a notice.

Run `--dry-run` first: it removes nothing and lists, on each machine, what a real run would remove and why, then a count:

```
local: would remove container old-web (its job 2026-11-01-worker-99999999 no longer exists)
local: would remove network old_net (unused, 48 h old)
local: would remove image 5e5e5e5e5e5e (dangling, 50 h old)
local: would remove script folder /home/arthur/.arthur/docker/jobs/2026-11-01-worker-99999999
local: would prune the build cache unused for 48 h, then cut it to 10G
local: --dry-run: 4 would be removed; nothing removed
```

To keep something of your own a sweep would remove, label it `arthur.keep` when you create it (`docker network create --label arthur.keep ...`): the sweep never removes it, at any age.

Without `--dry-run`, one line per machine, the same line as in the sweep's notice:

```
local: removed 1 container, 1 network, 1 image, 1 script folder; build cache cut to 10G; 1.25GB reclaimed; 38.2 GB free on /var/lib/docker
gpu: offline: ssh: connect to host gpu port 22: Connection refused; not swept
```

Exit 0, or 1 when a machine was not swept or its sweep failed half-way: run it again once the machine or Docker answers. A sweep on a machine waits for the one running there, the daily one or a `disk-low`'s, and the next one finds what that one left.

Refused, exit 2, nothing swept: `arthur docker sweep: unknown machine <name>; machines: <names>`; `arthur docker sweep: machine <name> is not labelled tools: docker; labelled: <names>`; a flag it does not take, one given twice, or `--machine` without a name: `usage: arthur docker [sweep [--machine <name>] [--dry-run]]`.
