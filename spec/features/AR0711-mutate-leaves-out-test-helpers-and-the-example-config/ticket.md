# AR0711 - Mutate leaves out test helpers and the example config

```json
{
  "id": "AR0711",
  "title": "Mutate leaves out test helpers and the example config",
  "date": "2026-11-13"
}
```

## Description

`npm run mutate` today mutates package test helpers (fakes, setups) and `arthur.config.example.ts`, whose survivors test the tests or are false, and they take up to half of a capped run. After this, mutate takes only the branch's own code, so its sample goes to the lines that matter.

## Goal

A capped run gives each changed file an equal share, so these files took about half of AR0671's sample and a quarter of AR0647's. Their survivors either test the tests or are false, yet every worker explains them and every reviewer checks them again.

Evidence:
- AR0671: 8 of the 17 files mutate took were test helpers (`fake-machine.ts`, `merge-setup.ts`, `review-setup.ts`, `fake-discord.ts`, `fake-github.ts`, `inbox-setup.ts`, `restart-setup.ts`, `session-setup.ts`; `git diff --name-only 68ff7073^1 68ff7073`). Review-1's survivor list includes `fake-discord.ts:273`.
- AR0647 review-1 and review-2: 2 of the 4 survivors were `fake-docker.ts:20` and `arthur.config.example.ts:418`.
- AR0553 review-1: 3 of the 5 survivors were in `arthur.config.example.ts`. The reviewer showed that deleting its `maxChars` line fails `packages/speak/test/speak.test.ts`, a test mutate never runs for that file (it runs only the root's `test/`), so the survivor was false.
- The AR0652, AR0653 and AR0530 merges each had `arthur.config.example.ts` among the files mutate takes.

- Kind: chore

## Done means

- A test builds a branch that changes a source file, a `packages/<p>/test/` helper and `arthur.config.example.ts`, runs mutate, and asserts that only the source file is mutated; it fails on main.
- `npm run check`, `npm test` and `npm run mutate` pass.

## Scope

In:
- `test/mutate.ts`: the `files` line and its comment.
- The test file that tests `test/mutate.ts`: the test of Done means.

Before:
> ```ts
> const files = git(root, "diff", "--name-only", "--diff-filter=d", base, "HEAD", "--", "*.ts").split("\n").filter((file) => file !== "" && !/\.(test|d)\.ts$/.test(file));
> ```

After:
> ```ts
> // The branch's own code: no test, declaration or package test helper (a fake, a setup: mutating it tests the tests), and not
> // the example config, which package tests check and its root tier never runs (AR0553 review-1).
> const files = git(root, "diff", "--name-only", "--diff-filter=d", base, "HEAD", "--", "*.ts").split("\n").filter((file) => file !== "" && !/\.(test|d)\.ts$/.test(file) && !/^packages\/[^/]+\/test\//.test(file) && file !== "arthur.config.example.ts");
> ```

Out:
- Any other change to mutate's sampling, its cap or its time limit.
- Proposal 1's spread of the sample: AR0710, which this ticket follows.

## Decisions

- 2026-11-13: Source: retro spec/retro/2026-11-13.md
