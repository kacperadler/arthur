# The develop plugin

Developing Arthur itself. Built so far: roadmap entry 66, `arthur plugin new <name> --budget <lines>`, a new plugin package in Arthur's repository with its `package.json`, plugin file, test against the fake host and doc page, its line budget in `test/structure.test.ts`, that passes `npm run check` and `npm test` as created (`arthur plugin --help`). The evals are entries 67 and 68.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "arthur", prefix: "AR", path: "." }] }),
	develop(),
],
```

It has no options but `enabled`; any other is refused at load (`develop.<key>: unknown option; develop has no options but enabled`). It needs the project list (the projects plugin): the command writes into a project's checkout, or, run by a job, into that job's own worktree, named with `--root`, so a worker on a new plugin's ticket makes the package on its own branch.
