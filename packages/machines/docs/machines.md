# The machines plugin

The machines jobs run on: `local`, where Arthur and the coordinator run, and others reached with `ssh` over a private network (Tailscale), with the user's own keys and `~/.ssh/config`: no secret in the config, no password prompt, no host key accepted on its own, and a machine whose address is not private is refused. Each machine has labels (os, arch, tools); a job goes to a machine that has the labels its project's piece, `machines.project({ ... })`, or its ticket's `requires` names. Every machine is checked at the start of `arthur run` and then at a set interval, and a change is `machine-online` or `machine-offline`. Nothing listens for Arthur on any of them.

```ts
machines({
	local: { labels: { tools: ["docker"] }, maxJobs: 3 },
	list: [{ name: "mac", ssh: "mac-mini", home: "/Users/arthur/.arthur", labels: { os: "macos", arch: "arm64", tools: ["xcodebuild"] }, maxJobs: 2 }],
	check: { everySeconds: 60 },
}),
```

## Options

- `local.labels.tools`: the tools on this machine a job may need, such as `docker`; its `os` and `arch` are detected, never set.
- `local.maxJobs`, `list[].maxJobs`: the most jobs at once on the machine. Default no limit of its own; orchestration's `maxAgents` counts every job.
- `list`: the other machines, each `{ name, ssh, home, labels?, maxJobs? }`: `name`, which `--machine` and a job's record use, never `local`; `ssh`, a `Host` of `~/.ssh/config` or a host name such as a Tailscale name; `home`, Arthur's home folder there for its jobs and repositories; `labels.os` (`linux` or `macos`), `labels.arch` (Node's word: `x64`, `arm64`) and `labels.tools`, what `requires` is matched against. An `os` or `arch` that disagrees with the machine keeps it offline.
- `check.everySeconds`: seconds between the checks of every machine over `ssh`: its address private, `arthur version`, its os and arch, its free CPU and memory. Default 60.

`arthur machines` (`/machines` on a channel) shows each machine, online or why not, with its jobs; its page, what `arthur machines --help` prints, is [`commands/machines.md`](commands/machines.md).
