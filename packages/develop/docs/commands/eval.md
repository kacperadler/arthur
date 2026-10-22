# arthur eval

Usage: `arthur eval [<scenario>...] [--runs <n>] [--save-baseline]`. Comes with the `develop` plugin (roadmap entry 67).

Measures the coordinator: replays one coordinator turn per run against each scenario of the loaded packages (or only those named), `--runs` times each (default `evals.runs`, 3), the runs of one scenario at once, the scenarios one after another. A run costs what a coordinator turn costs: it runs the real agent.

```
$ arthur eval
arthur eval: model anthropic/claude-opus-5-5, thinking high, 3 runs each; transcripts in /home/arthur/arthur/.arthur/develop/evals/2026-10-22T08-00-00-000Z
delivery/review-pass: 3/3 (baseline 2/3, up)
orchestration/worker-done: 1/3 (baseline 3/3, down)
  run 1: no call matches /^arthur review /
  run 3: the turn ran past its timeout of 900 s and was stopped
passed 4/6 runs; moved against the baseline: delivery/review-pass (up, 2/3 to 3/3), orchestration/worker-done (down, 3/3 to 1/3)
```

## Scenarios

A scenario is a folder `evals/<name>/` in a package the load runs (the core's, each enabled plugin's), named `<package folder>/<name>`: its `fixture/`, the repository the turn runs on, and its `scenario.json`:

```json
{
	"turn": { "ended": { "id": "2026-10-22-worker-0a1b2c3d", "kind": "worker", "state": "ended", "reason": "finished" }, "result": "Done: the login is fixed." },
	"timeoutSeconds": 900,
	"stub": [{ "match": "^arthur review ", "output": "started review 2026-10-22-review-1a2b3c4d" }],
	"expect": {
		"files": { "spec/build.json": ["\"AR0001\""] },
		"missing": ["notes.md"],
		"refs": { "refs/heads/main": "kept", "origin:refs/heads/main": "kept" },
		"calls": ["^arthur review 2026-10-22-worker-0a1b2c3d$"],
		"never": ["^arthur merge "]
	}
}
```

- `turn`, one of three, as the coordinator's inbox hands it over (`arthur coordinator --help`): `{ message, channel? }`, the owner's message, `[via <channel>] <message>` (`telegram` when left out); `{ scheduled, message, procedure? }`, a schedule entry due, `[Arthur] [scheduled <id>] <message>` with, after a blank line, the text of `procedure`, a file's path from the scenario's folder; `{ ended, result? }`, a job's end, `ended` its `{ id, kind, state, reason?, project? }` (`state` `ended` or `blocked`), `result` its final message: the wake as orchestration words it, with what the loaded plugins add for its kind (`coordinator.wake`: the procedure of an audit, a retro, a plan, an onboarding). Arthur's own turns end with the line that `[Arthur]` marks them.
- `timeoutSeconds`: how long the turn may run, 900 when left out; past it the agent's process group is killed and the run fails.
- `stub`: what `arthur` answers. Each call is `arthur <arguments joined by spaces>`; the first answer whose `match` (a regex) matches it and has not answered yet answers, else the last that matches; none answers with nothing and exit code 0. An answer writes its `files` (`{ <path>: <text> }`, from the repository's root) as the real command would change the repository, then prints its `output` and exits with its `exit` (0 when left out).
- `expect`, what the run must leave behind, all of it optional: `files`, each file in the working tree after the turn, every regex matching it (multiline); `missing`, paths that must not exist; `refs`, each ref of the repository, or of its remote as `origin:<ref>`, `kept` (where it was before the turn) or `moved` (somewhere else, not gone); `calls`, regexes each matching a call of the stub's log, in this order; `never`, regexes no call may match.

## A run

- The scenario's `fixture/` copied into a new folder `arthur-eval-*` of the system's temporary folder, made a Git repository on `main` with one commit, and pushed to a bare `origin` beside it.
- `arthur` replaced by the recording stub, first on the agent's `PATH`: it notes each call in its log and writes only in the run's repository; a file of an answer outside it, an absolute path or one through `..`, is refused (exit 1, noted in the log) and nothing of that answer is written. No `ARTHUR_` variable of Arthur's process reaches the turn, so nothing in it names Arthur's home; `ARTHUR_EVAL` names the stub, and the real `arthur`, reached by its path, refuses every command there: `arthur: refused inside an eval session (ARTHUR_EVAL is set): arthur there is the eval's recording stub, <path>` (exit code 1).
- The agent is `core.agent.command` run once, headless, in the repository: `<agent> -p --mode json --no-session --auto-approve -e <env guard> [--model <model>] [--thinking <level>] --append-system-prompt <the coordinator's prompt> @<the turn>`, the model and thinking level the coordinator's (orchestration's `coordinator` options, through `roles.model`), the prompt its role and criteria for the main project (`arthur roles`), without the live context of `arthur coordinator context`.
- It is scored only by what it left behind: the files, the refs and the stub's log, against `expect`. A turn that ran past its timeout, or an agent that did not start or exited with another code than 0, fails the run.
- Its folder is removed once scored; the turn, the agent's output (`stream.jsonl`, `stderr`), the stub's log (`arthur.log`) and the run's failures go to `<home>/develop/evals/<time>/<package>-<name>-<run>/`, and the output to that folder's `report`.

A scenario without its `fixture/` folder, or whose `scenario.json` is missing, does not parse or is wrong, fails each of its runs, naming why, and the others run.

## The baseline

`evals.baseline` (default `evals/baseline.json`) in the main project's checkout holds a pass rate per scenario, `{ "<scenario>": { "passed": 2, "runs": 3 } }`. Each scenario's line compares its rate with the baseline's, `up`, `down` or `same`, or says `no baseline`; the last line names every scenario that moved. `--save-baseline` writes this eval's rates into it, whole; the scenarios left out keep theirs. The baseline is the checkout's: commit it.

## Refused

- Wrong usage, an unknown flag or a `--runs` that is not a whole number of 1 or more: exit code 2, with the usage line.
- No scenario in any loaded package; a scenario name no package has, naming the scenarios there are; no project in the project list; a baseline that does not parse or holds a rate that is not `{ passed, runs }` with `passed` 0 to `runs` (a hand edit), naming it; no coordinator role (orchestration not enabled): exit code 1, before any run.

Exit code: 0 once every run was scored, whatever the rates.
