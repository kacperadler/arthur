# arthur machines

Usage: `arthur machines`; on a channel `/machines`. Comes with the `machines` plugin.

Every machine jobs may run on, `local` first, then the list in config order, each checked now (below), without the model; the shell and the channel get the same text. Each machine's line says online or why not, and under it its labels, its `maxJobs` and its jobs that have not ended, each with its state:

```
local: online (linux x64, arthur 3f9c2a1b7d4e)
  labels: os linux, arch x64, tools docker; maxJobs: 3; jobs: 2026-10-18-worker-1a2b3c4d (working)
mac (ssh mac-mini): offline: ssh mac-mini: arthur@mac-mini: Permission denied (publickey).; fix: ssh-copy-id mac-mini
  labels: os macos, arch arm64, tools xcodebuild; maxJobs: 2; no jobs
```

Any argument is wrong usage: `usage: arthur machines` and exit code 2 in the shell, `usage: /machines` on a channel. A config or a plugin that does not load: exit code 1.

## The list

The machines are declared in `arthur.config.ts`, as the options of the plugin:

```ts
machines({
	local: { labels: { tools: ["docker"] }, maxJobs: 3 },
	list: [
		{ name: "mac", ssh: "mac-mini", home: "/Users/arthur/.arthur", labels: { os: "macos", arch: "arm64", tools: ["xcodebuild"] }, maxJobs: 2 },
	],
	check: { everySeconds: 60 },
}),
```

- `local`: the machine Arthur runs on, always there. Its `os` (`linux`, or `macos` on a Mac) and `arch` (Node's word: `x64`, `arm64`) are detected; `labels.tools` and `maxJobs` are given here, both optional.
- `list`: the other machines, optional. Each entry has `name` (lowercase letters, digits and dashes, from a letter), `ssh` (a `Host` of `~/.ssh/config` or a Tailscale name, never an ssh option), `home` (Arthur's home folder there, an absolute path: its job records, repositories and worktrees), all required; `labels`, each optional: `os` (`linux` or `macos`), `arch` (as `uname -m` says it in Node's words: `x86_64` is `x64`, `aarch64` is `arm64`) and `tools` (a list of command names, such as `xcodebuild` or `docker`, each one `command -v` finds there: `arthur doctor` checks them, below); and `maxJobs`, a whole number of 1 or more. Left out, `maxJobs` sets no limit of the machine's own; `maxAgents` of orchestration still counts every job.
- `check.everySeconds`: how often `arthur run` checks every listed machine; default 60, at least 10.

Each listed machine is registered with the core's job runner, with its labels, so `arthur spawn --machine <name>` runs a job there (see `arthur spawn --help`), and each job is placed by its labels (below).

Refused at load, each refusal naming the machine and the option's path: a missing `name`, `ssh` or `home`; a name, ssh or home of another form; any other key; an `os` label other than `linux` or `macos`; a `tools` that is not a list of names; a `maxJobs` that is not a whole number of 1 or more; `os` or `arch` on `local`; a machine named `local`; two machines with one name; an `everySeconds` under 10. And a machine whose `ssh` resolves to a public address: the host name `ssh -G <ssh>` prints, or each address that name resolves to, must be private, which is loopback (`127.0.0.0/8`, `::1`), RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) or Tailscale (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`): Arthur reaches its machines only over the private network. A name that does not resolve at load (Tailscale down) does not refuse it: its check says so.

## The check

`arthur run` checks every listed machine at its start and every `check.everySeconds`; `arthur machines`, `/machines` and `arthur doctor` check them when asked. All machines are checked in parallel, and each check is cut after 10 seconds, its ssh killed, so ten machines that do not answer cost 10 seconds, not 100; a check asked while one runs waits for that one. A check:

1. The address, as at load: `ssh -G <ssh>` and the name it prints resolved here, each address private.
2. One command over the core's SSH, `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 <ssh> sh -c 'uname -sm && arthur version && for tool do command -v "$tool" >/dev/null || echo "missing $tool"; done' sh <tools>`, `<tools>` the machine's `tools` labels: ssh never asks for a password and never accepts a host key on its own.
3. What the machine says compared with its labels (`os`, `arch`, where given) and with this core's version.

The machine is online when all three pass. Otherwise it is offline, the reason one of:

- `ssh <ssh> resolves to <address>, not a private address`, or `ssh -G <ssh>: <error>` and a name that does not resolve.
- `ssh <ssh>: <ssh's line>`: ssh's own failure (its exit code 255), such as a key the machine refuses (`Permission denied (publickey).`), a host key that is not known or has changed (`Host key verification failed.`), or a machine that does not answer. Each check tries again the same way, never with a password and never accepting a key.
- `arthur is not there (<its line>)`: no `arthur` on the `PATH` of a command over ssh there.
- `its labels say os macos; the machine says linux x64`: a label that disagrees with the machine, both named.
- `it runs arthur <version>, this one is <version>; both need the same version`.
- `uname -sm && arthur version failed there: <its line>`, or `check timed out after 10 s`.

Each offline reason comes with its fix: `ssh-copy-id <ssh>` for a refused key; for a host key, compare `ssh-keyscan <ssh>` with the key the machine itself shows, then add it to `~/.ssh/known_hosts`; Arthur's core at this commit there (`docs/deploy.md`) when `arthur` is missing or of another version; the labels in `arthur.config.ts` set to what the machine is; the machine on the private network (`tailscale up` there) when it does not answer.

In `arthur run`, each change is an event, once: `machine-online` with `machine`, `os`, `arch` and `version`, or `machine-offline` with `machine` and `reason`. The first check after the start tells each machine's state; after that only a change does, so a machine that stays offline is told once, and one that goes offline and comes back is told twice. A reason that changes while the machine stays offline is no event. `arthur machines` from a shell checks, but emits nothing: the events are `arthur run`'s.

## Placing a job

The plugin answers the core's `jobs.place` for every spawn, `arthur spawn` and a plugin's `host.jobs.spawn` alike, so each job runs on a machine that has what it needs. The labels a job needs come from the first of these that is there:

1. `arthur spawn --requires os=macos,tools=xcodebuild` (a plugin's spawn: `requires: { os: "macos", tools: ["xcodebuild"] }`).
2. The `requires` key of its ticket's JSON block, the `json` block at the top of the ticket's `ticket.md`, such as `"requires": { "os": "macos", "tools": ["xcodebuild"] }`. The ticket is the first `Ticket:` of the task that lies in a ticket folder (`spec/features/<id>-<slug>/`), read in the project's main checkout. The ticket's `requires` replaces the project's as a whole; an empty one, `"requires": {}`, clears it.
3. The project's `requires` in the `projects` plugin's list (see `arthur projects --help`).
4. None: the job may go to any machine.

The ticket and the project come from the list the `projects` plugin provides; without it (projects off), neither requires anything. Every job of a ticket, worker, review or plan, whose task names the ticket, is placed by the same labels, so its checks run where it was built.

A machine has the labels when its `os` and `arch` are the ones asked (a machine without that label has not) and its `tools` hold each tool asked. Without `--machine`, the job goes to one of the machines that have the labels, are online and are under their `maxJobs` (the jobs counted are those in a run on it: working, idle, or held; `local` is always online, the others are checked now as above, in parallel): the one with the most room. The room is what the resources plugin answers when it provides `resources.free` (called with the machine's name, the jobs it has room for, roadmap entry 34), else the fewest jobs in a run; on a tie `local`, then the list's order. With `--machine`, the named machine must have the labels and is not checked, so a job goes there as before; an unknown name is the core's to refuse.

Refused before any worktree or record exists, naming the labels, where they come from (`--requires`, `ticket <id>` or `project <name>`), and every machine with its labels and its state (`online, <n> jobs`, `online, full: <n> of <maxJobs> jobs`, or `offline: <reason>`):

```
no machine has the labels; the job needs tools gpu (--requires); machines: local (os linux, arch x64, tools docker): online, 0 of 3 jobs; mac (os macos, arch arm64, tools xcodebuild): online, 1 of 2 jobs
every machine with the labels is offline or full; the job needs os macos, tools xcodebuild (ticket AR0003); machines: local (os linux, arch x64, tools docker): online, 0 of 3 jobs; mac (os macos, arch arm64, tools xcodebuild): offline: ssh mac-mini: arthur@mac-mini: Permission denied (publickey).
machine local lacks os macos, tools xcodebuild; the job needs os macos, tools xcodebuild (project shop); machines: ...
```

Also refused, naming where: a `requires` that is not `{ os?, arch?, tools? }` with `os` and `arch` non-empty strings and `tools` a list of them (`<where>: requires must be ...`), and a ticket whose JSON block is not JSON (`<file>: its JSON block is not JSON (<error>); fix it by hand`).

## arthur doctor

The plugin gives `arthur doctor` (roadmap entry 80) one requirement per listed machine, never critical, so `arthur run` starts with a machine offline: `machines <name>: ok (linux x64, arthur <version>)`, or `machines <name>: missing: <reason>; without it: no job runs on <name>; fix: <fix>`, the reason and fix as above.

The same check asks `command -v` there for each of the machine's `tools` labels, each a command name, on the `PATH` a command over ssh gets. A machine online with one not found stays online (placement goes by the labels as written), and its line names each: `machines gpu: missing: command -v finds no nvidia-smi, xcodebuild there (linux x64, arthur <version>); without it: no job that needs nvidia-smi, xcodebuild runs on gpu; fix: install nvidia-smi, xcodebuild on gpu, on the PATH of a command over ssh (docs/deploy.md), or drop what it does not need from its tools label`. The tools labels of `local` are checked the same, by the same loop run here on the `PATH` of `arthur run`, its line first and only when `local.labels.tools` is set: `machines local: missing: command -v finds no docker here (linux x64, arthur <version>); without it: no job that needs docker runs on local; fix: install docker on the PATH of arthur run, or drop what it does not need from local's tools label`. Placement still goes by the labels as written.
