# arthur restart

Usage: `arthur restart [fresh]`, and on a channel the phone commands `/restart` and `/restart fresh`, answered without the model. Comes with the `session` plugin; the restart itself is `arthur run`'s, so it needs `arthur run` running.

`/restart` ends the coordinator's conversation and starts it again with `--continue`; `/restart fresh` starts a fresh conversation, without `--continue`. Only the coordinator's agent restarts, not `arthur run`, so a restart due of the restart guard stays until `arthur run` starts again (`packages/session/docs/session.md`, "The restart guard"). Both first ask the coordinator for its handoff, `<home>/session/handoff.md`, and the next conversation starts by reading it (`arthur restart` and the fresh start at night: `packages/session/docs/session.md`):

1. Refused while any job runs, of any kind: `error: <n> job(s) running: <short ids>; run /stopall first`, exit code 1. Nothing is asked and nothing restarts.
2. Refused while a restart is already on its way (another `/restart`, or the fresh start's try): `error: a restart is already on its way, asked by /restart` or `..., asked by freshAt <time>`, exit code 1. A compaction still asked for gives way to the restart.
3. With no coordinator running (no agent with the session's extension alive), no handoff is asked: the restart is made at once, `no coordinator is running, so no handoff is asked; its next start is a fresh conversation` (or `goes on with --continue`).
4. Otherwise the reply is `restarting[ in a fresh conversation]: the coordinator writes its handoff first, for at most 120 s; Restarted. follows`, and `arthur run` asks the coordinator for the handoff once it is idle with nothing queued, as before a compaction. Once that turn has ended, or 120 s after the command, the coordinator's session is ended through orchestration (`coordinator.restart`, `arthur coordinator --help`) and started again. A handoff not written in time does not stop the restart.
5. A job started meanwhile stops it: the restart is not made, and the channels get the notice `restart: not done, <n> job(s) running: <short ids>; run /stopall first`.

`arthur run` prints `session: restart: done; the coordinator restarts[ in a fresh conversation], which starts by reading the handoff`, or `..., with no handoff (<reason>)`, or `..., with no handoff: no coordinator was running`.

Once the next coordinator is up, one `notice` goes to every channel:

```
Restarted. (fresh session; handoff not written)

After the restart:
<the steps in <home>/session/after-restart.md>

Health:
- <each line another plugin answers to collect("health")>
```

`(fresh session)` after a fresh conversation, `(handoff not written)` when no new handoff was written; plain `Restarted.` otherwise. `after-restart.md` holds the steps for the human after a restart (not the handoff), written by the coordinator; it is sent once and then removed, and a file of only blanks is not sent. A health answer is a line or a list of lines; a plugin whose answer throws gives `<plugin>: health failed: <first line>`.

The command's message is answered here and never reaches the coordinator's inbox, so the next conversation does not read it again.

`arthur restart` prints the same lines, a refusal on stderr; more than one argument, or one that is not `fresh`, prints `usage: arthur restart [fresh]` (`usage: /restart [fresh]` on a channel) and exits 2.
