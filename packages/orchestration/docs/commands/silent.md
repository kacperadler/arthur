# arthur silent

Usage: `arthur silent`; `arthur silent on ['<the work; its stop condition>']`; `arthur silent on '<the work>' [--until <HH:MM>] [--usage <percent>] [--tickets <id>,...] --recommend`; `arthur silent off`; `arthur silent ask`. On a channel: `/silent`, and `/silent on <the work>` or `/silent off`. Comes with the `orchestration` plugin.

The silent mode (roadmap entry 47): for work the owner delegates and wants to hear of only at its end. While it is on, the owner gets the reply to his own message, the end of the work, its stop condition met, and a decision only he can make; the rest waits, and is summed up when it goes off.

- `arthur silent` (and `/silent`) toggles it, answering the new state.
- `on` turns it on, `silent: on`, with the work and its stop condition when given (a limit of time, money or tickets). While it is on already, it keeps since when and replaces the work, and a grant (below) given before goes unless this `on` gives one.
- `off` turns it off: `silent: off, meanwhile: <what happened>`, built without the model from the events since it went on: the jobs that ended, by state (the first word of the reason: `finished`, `failed`, `stopped`, `limit`, or `blocked`), with their ids; the tickets merged; each notice held, one line each. `silent: off, nothing happened meanwhile` when there was none. While it is off already, it answers `silent: off` and changes nothing.
- `ask` lets the reply of the turn that runs it reach the owner (a decision), and silent stays on: `silent: on; the reply of this turn goes to the owner`. While it is off: `silent: off`.
- Anything else prints the usage line and exits 2; on a channel the reply is that line.

The coordinator runs `arthur silent on '<the work; its stop condition>'` by itself when the owner delegates work with a stop condition, `arthur silent off` when that work is done or its stop condition met, and `arthur silent ask` for a decision; its role says what counts as each.

## Go with my recommendation

`--recommend` records the owner's grant (AR0583), for when he delegates work saying "go with your recommendation": while it holds, an `arthur decision ask` with `--recommend` is answered in the same write by that recommendation, the option it numbers or its words, instead of waiting for him. The answer's words are `by recommendation: <grant id>`, it carries no `--picked`, and the ask prints a second line, `<id> answered by recommendation (<grant id>): <decided>; act on it as on the owner's answer, and say so in your reply` (`arthur decision --help`).

- The grant carries at least one bound, and holds while every bound given holds: `--until <HH:MM>`, a time of day in `core.timeZone`, until its next occurrence (exclusive); `--usage <percent>`, a whole percent from 1 to 100, while the highest used window of the agent's usage report (`models.usage`, the models plugin, `arthur usage --help`) is under it, never with no report or when its last fetch failed; `--tickets <id>,...`, only an ask whose `--ticket` is one of them.
- It never answers a merge question (kind `merge`: `--what --unreviewed` or `--no-ci`, or `arthur take-main`, each the owner's own decision), a budget question (kind `budget`, which `--budget 0` takes), a class's proposal, or an ask without `--recommend`. A question an approved class answers by policy, or that two classes match, is not answered by it.
- `on` answers `silent: on; the owner's grant G<n>: ...`, the grant in words; the context names it as long as it holds. Its id, `G<n>`, is the number of the event `silent-grant` `{ work, until?, usage?, tickets? }` that records it in the event log. `off`, an `on` without `--recommend` and `/silent on` end it.
- Refused (`arthur silent: refused: <why>`, exit 1, nothing written): no bound; an `--until` other than `HH:MM`; a `--usage` other than a whole percent from 1 to 100, or one with no plugin providing `models.usage`; a `--tickets` that is not ticket ids, comma-separated. A bound without `--recommend`, or a flag without its value or given twice, prints the usage and exits 2.

## The state

`<home>/orchestration/silent.json`: `{ since, seq, work, grant? }`, since when (an ISO time), the number of the last event when it went on, the work, and the grant, `{ id, until?, usage?, tickets? }` (`until` an ISO time). It is written to a temporary name and renamed, so a reader never sees half of it, and it survives a restart of `arthur run` and of the coordinator. No file means off. A file that does not parse, or holds anything else (a grant without its id, or a bound of another type, included), counts as on with no grant: the context says so, naming the file, and `arthur silent off` removes it, answering `silent: off, <file> did not parse, so what happened meanwhile is unknown`.

## What it holds

- A reply of a turn holding no owner message (a job's end, a review, a schedule entry, only messages from Arthur, `[Arthur]` or `[Arthur: <plugin>]`) is not emitted: `arthur run` moves it to `<home>/orchestration/outbox/held/` instead of sending it, where it stays, like `outbox/sent/`, for 7 days. It is sent when that turn ran `arthur silent off` (the mode is off by the time the reply is written) or `arthur silent ask` (which writes the time to `<home>/orchestration/silent-ask`; the first reply written after it is sent, and the mark goes). `on` from off and `off` remove a mark left behind.
- The reply of a turn holding an owner message is sent as always; the coordinator's role has it answer that message only, not the wakes beside it.
- A notice: each channel asks `call("coordinator.silent", notice)` before it sends one, and sends it only when the answer is not `true`. While silent is on, every notice is held but the one of a job blocked on the owner (`blocked: "<job id>"` in it), which is a decision. Held notices are not kept apart: `off` reads them from the event log.
- What it lets through goes as every send: in quiet hours without a notification.

## The context

While it is on, the coordinator's context (`arthur coordinator context`) has a `## Silent` section after `## Time`: `On since <HH:MM> on <day> <date>, for: <the work; its stop condition>.`, or `for: nothing named; the owner turned it on.` when no work was given, and with a grant a second line, `While it holds, the owner's grant G<n>: ...`; with a broken state file, `On: <file> does not parse, so it counts as on; arthur silent off removes it.`
