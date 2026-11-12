# AR0686 - Plan

- Job: 2026-11-10-plan-85a290f9
- Planned at: ed1720e81f118ba9dbf609df3f1aff56490bc43a

## Approach

Every comment line of `packages/*/src/**` and `test/structure.ts` was read (3326 lines starting `//`, `/*` or `*` in 24148 lines of TypeScript at `ed1720e8`, plus the 17 trailing `// …` comments), each against the code under it. The result is small: this code's comments almost all carry something the code does not: a why, a decision id, an outside service's limit or quirk, a contract (what a function refuses, returns or writes), a constant's meaning, a trap. Eight comments restate the one-line body or the name right under them; those are removed, nothing else. No stale comment was found (every `<name>.ts` a comment names exists, checked with `comm` against `find`; no `TODO`/`FIXME`/`@ts-`/eslint marker; no reference to a function or file that is gone turned up while reading), and no commented-out block exists (no comment line ends in `;`, `{` or `=>`, or starts with `const`, `if (`, `return`, `import`, `}`). So the worker deletes 8 lines in 8 files, no code changes, and reports the counts.

Comments to remove, by file and line (line numbers of `ed1720e8`):

**Restates the code below it (6)**
- `packages/dokploy/src/dokploy-setup.ts:8` `// A list in Dokploy's answer, or none.` over `const listed = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);`.
- `packages/dokploy/src/dokploy-source.ts:8` the same line over the same one-liner.
- `packages/delivery/src/ci-wait.ts:31` `// The job ids with a wait.` over `const waiting = (host) => readdirSync(host.folder).filter((id) => ID.test(id) && existsSync(paths(host, id).wait));`.
- `packages/github/src/github-api.ts:37` `// A key of an answer's object, undefined when it is no object or lacks it.` over the one-line `field` (`typeof item === "object" && item !== null && key in item ? item[key] : undefined`).
- `packages/youtrack/src/youtrack-api.ts:78` `// A key of an item of YouTrack's JSON, undefined when the item is not an object or lacks it.` over the same one-line body.
- `packages/dokploy/src/dokploy-api.ts:62` `// A key of an item of Dokploy's JSON, undefined when the item is not an object or lacks it.` over the same one-line body.

**Names what the function's name already says (2)**
- `packages/orchestration/src/decision-class.ts:53` `// Records the owner's revoke of class \`id\`.` over `export function revoke(host, project, id, said)`, whose first line's error names "the owner's words" and whose body writes a `Revoke` record through `change`.
- `packages/core/src/job-records.ts:65` `// Returns the steer's number.` over `steer(id, text): string`, which only forwards to `steerJob` (job-control.ts:76 carries the same note) or `arthur remote-job steer` (remote-job.ts:66, "prints the steer's number").

**Stale (0)** and **commented-out block (0)**: none found, as above.

Kinds kept, with examples, so the owner can widen the bar if he wants:
- A why or a decision id: `packages/core/src/board.ts:45-47` (the `spec/.board` folder and AR0371), every `No hook or fsmonitor … (AR0330, AR0384)` line over a git call.
- An outside service's limit or quirk: `packages/discord/src/media-out.ts:12-13` (Discord's upload limits), `packages/discord/src/gateway.ts:14` (`INTENTS = 33281` as its three bits), `packages/telegram/src/media-in.ts:23` (the 20 MB download cap), `packages/dokploy/src/dokploy-api.ts:29`.
- A constant's meaning or default: `packages/uptime/src/uptime.ts:22-25` (`TICK_MS`, `FAILS`), `packages/discord/src/menu.ts:14` (`DESCRIBED = 100`), `packages/discord/src/discord.ts:26` and `packages/telegram/src/telegram.ts:22` (`API_URL` is the `apiUrl` default), `packages/models/src/models.ts:17`.
- A contract the signature does not show: `packages/core/src/job-control.ts:76` (the returned string is the steer's number; kept as the one place `steerJob` says it), `packages/core/src/run-record.ts:33` (`clearStop` runs before a resume), `packages/youtrack/src/youtrack-api.ts:33` (DELETE answers without a body), `packages/herdr/src/herdr.ts:39`.
- The reason of an empty or swallowing catch: `packages/core/src/job-scope.ts:92` and `:175`, `packages/develop/src/eval-run.ts:41`, `packages/delivery/src/review-command.ts:118`, `packages/core/src/doctor.ts:102`.
- A file's header (what it is, its roadmap entry, its doc page) and a type field's meaning: every file's first comment block, `packages/core/src/board.ts:20-40`.
- Lines inside template strings that start with `//` (`packages/develop/src/plugin-template.ts:12-14,40`, `packages/commit-rules/src/hook.ts:79`): data a command writes, not this file's comments; left alone.
- Trailing comments (17, e.g. `packages/core/src/wrapper.ts:110`, `packages/core/src/roles.ts:46`): each adds a why or a when; left alone.

## Not available directly
- none

## Files
- `packages/dokploy/src/dokploy-setup.ts`: line 8 removed.
- `packages/dokploy/src/dokploy-source.ts`: line 8 removed.
- `packages/delivery/src/ci-wait.ts`: line 31 removed.
- `packages/github/src/github-api.ts`: line 37 removed.
- `packages/youtrack/src/youtrack-api.ts`: line 78 removed.
- `packages/dokploy/src/dokploy-api.ts`: line 62 removed.
- `packages/orchestration/src/decision-class.ts`: line 53 removed.
- `packages/core/src/job-records.ts`: line 65 removed.
- `spec/features/AR0686-…/outcome.md`: the comment lines and each package's lines before and after (before, at `ed1720e8`: 3326 comment lines in 24148; per package: core 7465/1120, delivery 2096/331, orchestration 2710/360, github 1210/172, manage 1459/180, discord 937/127, session 920/127, youtrack 672/92, develop 710/82, dokploy 626/87, resources 617/98, telegram 641/86, schedule 596/58, projects 565/68, models 519/54, machines 502/67, uptime 354/42, findings 264/29, listen 248/25, activity 222/20, video 186/22, herdr 182/20, commit-rules 178/20, stats 173/24, nvm 96/15; `test/structure.ts` 163/12), and the mutate summary on main and on the tip.
- Nothing else: no test, doc or `test/structure.ts` change (its 12 comments each state a rule or an AR id).

## Risks
- Line-number drift: the numbers are `ed1720e8`'s; the worker finds each comment by its text, which is unique in its file.
- A reviewer may hold a kept comment redundant or a removed one useful: the list above is the whole change, so the owner's word on it is the bar; the eight removed lines add nothing a reader of the next line does not see.
- `git diff -w` must show comment lines only: the worker touches no other line; a blank line is not left behind where none was (each removed comment sits directly over its declaration, so the deletion leaves the blank line before it as it is).
- The structure test's zones do not move (every file loses at most one line); the line budgets only go down. `npm run check` passes on HEAD now (run here, exit 0).

## How to test
- The plan lists the comments by file and line in groups with a reason each, and names the kinds it keeps: the sections above.
- The worker removes exactly what the plan lists, no code changes: `git diff -w main --stat` names the 8 files above and nothing else; `git diff -w main -- packages | grep -E '^[-+]' | grep -vE '^(\+\+\+|---)'` prints exactly 8 lines, each a `-` line that starts with `//` after its indent, and no `+` line; `git diff -w main --numstat` sums to 0 added, 8 removed.
- The outcome gives the comment lines and each package's lines before and after: `for p in packages/*/src; do echo "$p $(cat $(find $p -name '*.ts') | wc -l) $(grep -hE '^\s*(//|/\*|\*)' $(find $p -name '*.ts') | wc -l)"; done` on main and on the tip, in outcome.md; expected 3326 → 3318 comment lines, 24148 → 24140 lines, each listed package down by its removed lines (dokploy −3, core, delivery, github, youtrack, orchestration −1 each).
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip, each in one call with `timeout 1800`; the mutate summary's caught count equals main's (comments are not mutated, so no mutant changes).

## Open questions
- `packages/github/src/github-pulls.ts:6` holds a plan's hedge inside a source comment, `[INFERENCE: GitHub's lists sort a pull request reviewed a moment ago first]`. It is not one of the ticket's four kinds (it states a why, with its uncertainty), so the plan leaves it. Should the worker drop the `[INFERENCE: …]` bracket and keep the sentence?
- The bar used is the ticket's: "says nothing the code beside them does not already say". If the owner wants a wider one (e.g. the one-line API notes over short forwarding functions, as `job-control.ts:76` or `run-record.ts:33`), the "kinds kept" list above is where to point; the plan removes none of those.