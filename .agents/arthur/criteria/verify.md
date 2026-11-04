# Verify

How a worker proves its change and a reviewer checks the proof, in Arthur. Run each step in your own worktree or checkout, never in the main checkout, which holds a different tree; report each command beside its result.

1. Checks: `npm run check && npm test` in one bash call with a `timeout` of 1800 seconds. Wait for it; write nothing from memory.
2. A failing test in a file the diff does not touch: run that file alone, `node --import @arthur/core/testing --test <file>`. It counts against the branch only if it fails alone too; say which.
3. Mutations: once the work is committed, `npm run mutate` in a bash call of its own (`npm run mutate -- --max <n>` runs the first `<n>` mutants). Every `survived:` line is a missing test: add it (worker) or name it as a finding (reviewer). For a condition it does not reach: invert or remove it, run that package's test files that import it, see one fail, and restore it with `git checkout -- <file>`.
4. The Goal, the way a user meets it: run the changed command as its doc page says (`npx arthur <cmd> --help` prints it), then the command itself in a temporary folder; and run each command a line you wrote tells someone to run, exactly as written.
5. Report, in the final message, each command you ran, its result (the counts from its output) and the commit it ran on.
