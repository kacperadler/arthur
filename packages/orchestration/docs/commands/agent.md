# arthur agent

Usage: `arthur agent tell <project|coordinator> '<text>'`. Comes with the `orchestration` plugin, which every config holds.

Puts one message in another session's inbox: the coordinator's, or the agent of `<project>` (`arthur coordinator --help`, "Project agents"). It is how work across projects passes through the coordinator: the coordinator hands a project with an agent its work with `arthur agent tell <project> '<the work>'`, and a project agent hands the coordinator what is not its own project's with `arthur agent tell coordinator '<what>'`. The words after the name are the text, joined by spaces.

It emits `agent-told` `{ to, from, text }`, `to` and `from` the sessions' names (`coordinator`, `agent:<project>`); every process that gets the event writes the message into the inbox of `to` once, as it does for every message (`arthur coordinator --help`, "The coordinator's inbox"), and a session removed since gets it in the coordinator's. It reaches that session's agent marked `[from <the sender's session>]`, as Arthur's own messages are, never as the owner's word: it never joins a running turn, and `arthur decision answer` never takes it as the owner's answer. A session that is down gets it once it is up again. It prints `arthur agent tell: queued for <session>, marked [from <session>]`.

Refused, exit code 1:

- Outside a session, from a terminal: `arthur agent tell: refused: only a session of Arthur's tells another: the coordinator or a project agent, in its own omp`. Inside a job the CLI refuses it before it runs (`arthur help --help`).
- A name that is no session: `arthur agent tell: refused: no agent <name>; agents: coordinator, <each project with an agent>`.
- The session it runs in: `arthur agent tell: refused: <name> is this session; tell another: coordinator, <each project with an agent>`.

Anything but `tell`, or no text, prints `usage: arthur agent tell <project|coordinator> '<text>'` and exits 2.
