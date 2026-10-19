# AR0181 - Roadmap 42: Onboarding a repository

```json
{
  "id": "AR0181",
  "title": "Roadmap 42: Onboarding a repository",
  "date": "2026-10-19"
}
```

## Description

This ticket builds roadmap entry 42, onboarding a repository:
- `arthur init <project>` gives a project's repository what Arthur reads: the `spec/` skeleton, the criteria files, an empty board and an `.nvmrc`.
- The kind `onboarding` reads the repository, asks the owner up to 10 questions, then drafts the vision and criteria.

## Goal

The specification is roadmap entry 42 in `spec/roadmap.md`: its Delivers, its Done means with every edge case, and its `doctor` requirement. It depends on entries 41 (the project list) and 10 (roles), and both are merged. With this entry built, the projects plugin is complete, and Arthur can take on a new repository without the harness (vision, direction A).

- Kind: improvement
- Budget: 10

## Done means

- Everything that entry 42's Delivers and Done means list, with each refusal and edge case in its own test:
  - `init` on a project that is not in the config is refused;
  - `init` over an existing board is refused;
  - an empty repository gets what `init` gives;
  - an existing `.nvmrc` stays unchanged;
  - a repository without `package.json` still gets an `.nvmrc`;
  - an onboarding that asks more than 10 questions is cut at 10;
  - a draft that touches another file is refused at merge.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed time.
- README's table and `arthur.mmd` show 42 as built.
- `npm test` and `npm run check` pass, and GitHub `ci` is green on the branch tip.

## Scope

In:
- `packages/projects`: `init`, the onboarding kind with its role and procedure, the docs and the tests.
- `README.md`, `arthur.mmd`.
- `test/structure.test.ts`: a budget raise, only after naming the lines cut first.

Out:
- The nvm plugin (84) and the merge command (54): use only what exists, and name in findings.md what waits for them.

## Decisions

- 2026-10-19: The coordinator starts this under the owner's 80% usage ceiling. The next roadmap entry in order after 94 is 42, the only unbuilt entry of a plugin already in progress.
- 2026-10-19: The coordinator accepts the projects budget raise from 325 to 473 (+148, init.ts and onboarding.ts; requirement merged into requirements first). It also accepts merge.check as the place of the refusal at merge, until entry 54 calls it (F1).
