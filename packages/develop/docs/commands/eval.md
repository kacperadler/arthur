# arthur eval

Usage: `arthur eval [<scenario>...] [--runs <n>] [--save-baseline]`. Comes with the `develop` plugin (roadmap entry 67).

Measures the coordinator: replays one coordinator turn per run against each scenario of the loaded packages (or only those named), `--runs` times each (default `evals.runs`, 3), the runs of one scenario at once, the scenarios one after another. A run costs what a coordinator turn costs: it runs the real agent.

```
$ arthur eval delivery/review-pass delivery/worker-done
arthur eval: model anthropic/claude-opus-5-5, thinking high, 3 runs each; transcripts in /home/arthur/arthur/.arthur/develop/evals/2026-10-22T08-00-00-000Z
delivery/review-pass: 3/3 (baseline 2/3, up)
delivery/worker-done: 1/3 (baseline 3/3, down)
  run 1: no call matches /^arthur review (\S+-)?3c1f9a20$/
  run 3: the turn ran past its timeout of 900 s and was stopped
passed 4/6 runs; moved against the baseline: delivery/review-pass (up, 2/3 to 3/3), delivery/worker-done (down, 3/3 to 1/3)
```

## Scenarios

The scenarios Arthur ships (roadmap entry 68), run by `npm test` against a fake agent in `packages/develop/test/scenarios.test.ts`: in delivery, `worker-done`, `condition-before-review`, `review-pass`, `review-pass-hook`, `review-fail-handed-back`, `review-fail-continue`, `merge` and `check-failed`; in orchestration, `later-is-a-ticket`, `no-sleep`, `night-one-line`, `morning-report` and `env-refusal`; in manage, `audit-autopilot` and `retro`; in session, `after-restart-plan` and `unblocked-after-restart`; in github, `ci-failed`; in projects, `onboarding-questions`. A new scenario gets its right and wrong turn in that test.

A scenario is a folder `evals/<name>/` in a package the load runs (the core's, each enabled plugin's), named `<package folder>/<name>`, kept in the package whose procedure it tests: its `fixture/`, the repository the turn runs on, and its `scenario.json`:

```json
{
	"turn": { "ended": { "id": "2026-10-22-worker-0a1b2c3d", "kind": "worker", "state": "ended", "reason": "finished" }, "result": "Done: the login is fixed." },
	"hour": 23,
	"context": { "session": "Restart: none due; no commit changed Arthur's code since arthur run started 2026-10-22 08:41 at 0a41782." },
	"timeoutSeconds": 900,
	"stub": [{ "match": "^arthur review ", "output": "started review 2026-10-22-review-1a2b3c4d" }],
	"expect": {
		"files": { "spec/build.json": ["\"AR0001\""] },
		"missing": ["notes.md"],
		"refs": { "refs/heads/main": "kept", "origin:refs/heads/main": "kept" },
		"calls": ["^arthur review 2026-10-22-worker-0a1b2c3d$"],
		"never": ["^arthur merge "],
		"reply": { "lines": 3, "match": ["AR0001"], "never": ["\\bsorry\\b"] },
		"tools": ["^bash [\\s\\S]*\\bsleep\\b"]
	}
}
```

- `turn`, one of four, its text the one orchestration's inbox hands the coordinator for its event, asked of orchestration (`coordinator.turn`, `arthur coordinator --help`), so a change of that wording reaches every scenario: `{ message, channel? }`, the owner's message, a `message-received` of one text part (`telegram` when the channel is left out), `[via <channel>] <message>`; `{ scheduled, message, procedure? }`, a schedule entry due, a `coordinator-message` as the schedule plugin words it, asked of schedule (`schedule.message`, `arthur schedule --help`): `[scheduled <id>] <message>` with, after a blank line, the text of `procedure`, a file's path from the scenario's folder (`../../roles/coordinator/morning-report.md` reads the package's own procedure), marked `[Arthur]`; `{ arthur }`, a plugin's message to the coordinator, a `coordinator-message` of its text as the plugin words it (`[github] CI run …`), marked `[Arthur]`; `{ ended, result? }`, a job's end, `ended` its `{ id, kind, state, reason?, project?, records? }` (`state` `ended` or `blocked`, `project` the main one when left out), `result` its final message: the wake, with what the loaded plugins add for its kind (`coordinator.wake`: the procedure of an audit, a retro, a plan, an onboarding with its questions, a review's verdict), each asked with that final message; `records`, `{ <plugin>: <its record> }`, stands for what a plugin's own records would hold of the job, which no home holds, as the plugin's docs name it (delivery's review: `arthur review --help`). Arthur's own turns end with the line that `[Arthur]` marks them. A turn orchestration or schedule refuses (an id that is not an entry's, schedule not loaded) fails the scenario, naming why.
- `hour`: the hour of the owner's day the turn is played at, a whole hour 0 to 23, noon (12) when left out, so no scenario hangs on when the eval runs: the context's `## Time` says that hour in `core.timeZone` (the instant within 12 hours of now that shows it, its minutes now's), night or day by `core.quietHours`, and the session's `TZ` is the zone `Etc/GMT±<n>` whose local hour now is that one, so `date` there reads it too.
- `context`: `{ <plugin>: <text> }`, the lines each plugin adds to the coordinator's context in this turn, instead of what the live plugin answers: a plugin left out adds none, so the run measures the fixture, not the machine the eval runs on. The name is the plugin's (`session`, `projects`, `manage`, ...); one that answers no context there fails the run (`coordinator.checkoutContext: context names <name>: no such plugin answers coordinator.context; those that do: <names>`). No lines when left out.
- `timeoutSeconds`: how long the turn may run, 900 when left out; past it the agent's process group is killed and the run fails.
- `stub`: what `arthur` answers. Each call is `arthur <arguments joined by spaces>`, without the quotes the shell took off; the first answer whose `match` (a regex) matches it and has not answered yet answers, else the last that matches; none answers with nothing and exit code 0. An answer writes its `files` (`{ <path>: <text> }`, from the repository's root) as the real command would change the repository, then prints its `output` and exits with its `exit` (0 when left out).
- Help needs no `stub`, and no answer ever takes a help call: `arthur <command> ... --help` and `arthur help [<command>]` print what the live CLI prints, with the commands the load registers (the core's and each enabled plugin's, `commands.docs()`), `--project <name>` ignored as there. A registered command's page; `arthur help`, `arthur --help` and `arthur` alone, the usage line and every command's name; a command the load does not register, `arthur: unknown command <name>` and every name, exit code 2; `arthur help` of two words, the usage, exit code 2. Such a call is noted `{ call, help: true }` in the stub's log, and no `calls` or `never` regex counts it; the agent's tool call that ran it stays in `tools`. Any other call of a command the load does not register goes to the `stub` answers as any call.
- `expect`, what the run must leave behind, all of it optional: `files`, each file in the working tree after the turn, every regex matching it (multiline); `missing`, paths that must not exist; `refs`, each ref of the repository, or of its remote as `origin:<ref>`, `kept` (where it was before the turn) or `moved` (somewhere else, not gone); `calls`, regexes each matching a call of the stub's log, in this order; `never`, regexes no call may match; `reply`, the reply, the text of the agent's last assistant message that has any: at most `lines` lines that are not blank, every regex of `match` matching it and none of `never` (multiline); `tools`, regexes none of the agent's tool calls may match, each `bash <command>` or `<tool> <its arguments as JSON>`.
- `needs`, a list the runner does not read: each line a ticket the scenario waits for, `<id>: what the turn lacks without it`, or a finding of a ticket that becomes one at its merge, `<id> F<n>: ...`, where the run cannot give the coordinator what it sees live (the wake a plugin builds from its own records). The scenario runs all the same, its rate measured without it.

## A run

- The scenario's `fixture/` copied into a new folder `arthur-eval-*` of the system's temporary folder, made a Git repository on `main` with one commit, and pushed to a bare `origin` beside it.
- `arthur` replaced by the recording stub, first on the agent's `PATH`: it notes each call in its log and writes only in the run's repository; a file of an answer outside it, an absolute path or one through `..`, is refused (exit 1, noted in the log) and nothing of that answer is written. No `ARTHUR_` variable of Arthur's process reaches the turn, so nothing in it names Arthur's home; `ARTHUR_EVAL` names the stub, and the real `arthur`, reached by its path, refuses every command there: `arthur: refused inside an eval session (ARTHUR_EVAL is set): arthur there is the eval's recording stub, <path>` (exit code 1).
- The agent is `core.agent.command` run once, headless, in the repository: `<agent> -p --mode json --no-session --auto-approve -e <env guard> [--model <model>] [--thinking <level>] --append-system-prompt <the coordinator's context> @<the turn>`, the model and thinking level the coordinator's (orchestration's `coordinator` options, through `roles.model`). The context is orchestration's for the run's copy of the fixture at the scenario's `hour` (`coordinator.checkoutContext`, `arthur coordinator --help`): the role and criteria of the main project (`arthur roles`), the copy's vision and board, the time, and the plugins' lines the scenario's `context` sets, none of the live plugins' (the session plugin's `Restart:` line among them); no jobs, open decisions or silent mode, which are the live Arthur's, so `arthur jobs` and the like answer through the `stub`.
- It is scored only by what it left behind: the files, the refs, the stub's log, and the agent's reply and tool calls from its output, against `expect`. A turn that ran past its timeout, or an agent that did not start or exited with another code than 0, fails the run.
- Its folder is removed once scored; the turn, the agent's output (`stream.jsonl`, `stderr`), the stub's log (`arthur.log`) and the run's failures go to `<home>/develop/evals/<time>/<package>-<name>-<run>/`, and the output to that folder's `report`.

A scenario without its `fixture/` folder, or whose `scenario.json` is missing, does not parse or is wrong, fails each of its runs, naming why, and the others run.

## The baseline

`evals.baseline` (default `evals/baseline.json`) in the main project's checkout holds a pass rate per scenario, `{ "<scenario>": { "passed": 2, "runs": 3 } }`. Each scenario's line compares its rate with the baseline's, `up`, `down` or `same`, or says `no baseline`; the last line names every scenario that moved. `--save-baseline` writes this eval's rates into it, whole; the scenarios left out keep theirs. The baseline is the checkout's: commit it.

## Refused

- Wrong usage, an unknown flag or a `--runs` that is not a whole number of 1 or more: exit code 2, with the usage line.
- No scenario in any loaded package; a scenario name no package has, naming the scenarios there are; no project in the project list; a baseline that does not parse or holds a rate that is not `{ passed, runs }` with `passed` 0 to `runs` (a hand edit), naming it; no coordinator role (orchestration not enabled): exit code 1, before any run.

Exit code: 0 once every run was scored, whatever the rates.
