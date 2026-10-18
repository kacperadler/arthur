# arthur machines

Usage: `arthur machines`; on a channel `/machines`. Comes with the `machines` plugin.

Every machine jobs may run on, `local` first, then the list in config order, each checked now (below), without the model; the shell and the channel get the same text. Each machine's line says online or why not, and under it its labels, its `maxJobs` and its jobs that have not ended, each with its state:

```
local: online (linux x64, arthur 3f9c2a1b7d4e)
  labels: os linux, arch x64, tools docker; maxJobs: 3; jobs: 2026-10-18-worker-1a2b3c4d (working)
mac (ssh mac-mini): offline: ssh mac-mini: arthur@mac-mini: Permission denied (publickey).; fix: ssh-copy-id mac-mini
  labels: os macos, arch arm64, tools xcode; maxJobs: 2; no jobs
```

Any argument is wrong usage: `usage: arthur machines` and exit code 2 in the shell, `usage: /machines` on a channel. A config or a plugin that does not load: exit code 1.

## The list

The machines are declared in `arthur.config.ts`, as the options of the plugin:

```ts
machines({
	local: { labels: { tools: ["docker"] }, maxJobs: 3 },
	list: [
		{ name: "mac", ssh: "mac-mini", home: "/Users/arthur/.arthur", labels: { os: "macos", arch: "arm64", tools: ["xcode"] }, maxJobs: 2 },
	],
	check: { everySeconds: 60 },
}),
```

- `local`: the machine Arthur runs on, always there. Its `os` (`linux`, or `macos` on a Mac) and `arch` (Node's word: `x64`, `arm64`) are detected; `labels.tools` and `maxJobs` are given here, both optional.
- `list`: the other machines, optional. Each entry has `name` (lowercase letters, digits and dashes, from a letter), `ssh` (a `Host` of `~/.ssh/config` or a Tailscale name, never an ssh option), `home` (Arthur's home folder there, an absolute path: its job records, repositories and worktrees), all required; `labels`, each optional: `os` (`linux` or `macos`), `arch` (as `uname -m` says it in Node's words: `x86_64` is `x64`, `aarch64` is `arm64`) and `tools` (a list of names, such as `xcode` or `docker`); and `maxJobs`, a whole number of 1 or more. Left out, `maxJobs` sets no limit of the machine's own; `maxAgents` of orchestration still counts every job.
- `check.everySeconds`: how often `arthur run` checks every listed machine; default 60, at least 10.

Each listed machine is registered with the core's job runner, with its labels, so `arthur spawn --machine <name>` runs a job there (see `arthur spawn --help`); placing a job by labels is roadmap entry 31.

Refused at load, each refusal naming the machine and the option's path: a missing `name`, `ssh` or `home`; a name, ssh or home of another form; any other key; an `os` label other than `linux` or `macos`; a `tools` that is not a list of names; a `maxJobs` that is not a whole number of 1 or more; `os` or `arch` on `local`; a machine named `local`; two machines with one name; an `everySeconds` under 10. And a machine whose `ssh` resolves to a public address: the host name `ssh -G <ssh>` prints, or each address that name resolves to, must be private, which is loopback (`127.0.0.0/8`, `::1`), RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) or Tailscale (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`): Arthur reaches its machines only over the private network. A name that does not resolve at load (Tailscale down) does not refuse it: its check says so.

## The check

`arthur run` checks every listed machine at its start and every `check.everySeconds`; `arthur machines`, `/machines` and `arthur doctor` check them when asked. All machines are checked in parallel, and each check is cut after 10 seconds, its ssh killed, so ten machines that do not answer cost 10 seconds, not 100; a check asked while one runs waits for that one. A check:

1. The address, as at load: `ssh -G <ssh>` and the name it prints resolved here, each address private.
2. One command over the core's SSH, `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 <ssh> sh -c 'uname -sm && arthur version'`: ssh never asks for a password and never accepts a host key on its own.
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

## arthur doctor

The plugin gives `arthur doctor` (roadmap entry 80) one requirement per listed machine, never critical, so `arthur run` starts with a machine offline: `machines <name>: ok (linux x64, arthur <version>)`, or `machines <name>: missing: <reason>; without it: no job runs on <name>; fix: <fix>`, the reason and fix as above.
