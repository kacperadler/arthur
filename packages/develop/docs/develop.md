# The develop plugin

Developing Arthur itself: roadmap entry 66, `arthur plugin new <name> --budget <lines>`, a new plugin package in Arthur's repository with its `package.json`, plugin file, test against the fake host and doc page, its line budget in `test/structure.test.ts`, that passes `npm run check` and `npm test` as created (`arthur plugin --help`); entry 67, `arthur eval`, coordinator turns replayed against the scenarios of the loaded packages, each run on a copy of its scenario's fixture with `arthur` a recording stub, scored by what it left behind, its pass rate against the baseline (`arthur eval --help`); and entry 68, the scenarios, each in `evals/<name>/` of the package whose procedure it tests, replayed against a fake agent by `packages/develop/test/scenarios.test.ts`, their rates on the coordinator's model in `evals/baseline.json`.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "arthur", prefix: "AR", path: "." }] }),
	develop({ evals: { runs: 3, baseline: "evals/baseline.json" } }),
],
```

It needs the project list (the projects plugin): `arthur plugin new` writes into a project's checkout, or, run by a job, into that job's own worktree, named with `--root`, so a worker on a new plugin's ticket makes the package on its own branch; in Arthur's repository the planner's and the worker's prompt carry the line that runs it from a job (`arthur plugin --help`). `arthur eval` keeps its baseline in the main project's checkout. `arthur eval` also needs orchestration, whose coordinator role and model it runs.

## Options

| Option | What it is | Default |
| --- | --- | --- |
| `evals.runs` | How many times each scenario runs per `arthur eval`, all at once; `--runs` overrides it. A whole number, 1 or more. | 3 |
| `evals.baseline` | The baseline, each scenario's pass rate, in the main project's checkout; `arthur eval --save-baseline` writes it. A path inside the checkout: neither absolute nor through `..`. | `evals/baseline.json` |

Any other option or key is refused at load: `develop.<key>: unknown option; options: evals`, `develop.evals.<key>: unknown key; keys: runs, baseline`, and a wrong value names what it should be.
