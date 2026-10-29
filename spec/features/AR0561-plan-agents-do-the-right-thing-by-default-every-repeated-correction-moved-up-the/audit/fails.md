# Audit: why reviews FAIL, and what to push up the pyramid (FailMiner)

Repository `the repository`, read-only. Sources: `spec/features/*/review-*.md` (605 reviews, the `_template` copy not counted), `spec/features/*/findings.md` (301 files, 766 entries), `outcome.md` (cost lines), `spec/decisions.jsonl` (335 asks), `git log`, role/criteria files.

## Method

- Verdict: the `- Verdict:` line of every review file → 495 PASS, 109 FAIL, 1 `none` (AR0120 review-2).
- Each of the 109 FAIL reviews (its whole final message) was classified once by a model into one **primary** root cause (what made the verdict FAIL) plus **secondary** classes for its other blocking findings, with a verbatim quote. All 109 quotes were checked by script against the file text (109/109 match). I read 6 of them in full by hand (AR0401, AR0517 r2, AR0541, AR0280, AR0014, AR0439); each class held. Primary counts are firm; secondary counts are softer.
- The surviving mutations in the 71 FAILs that name one were extracted the same way (147 mutants, operator + file).
- "Guard FAIL" here means the review text names `worktree-guard.ts` or `shell-words.ts` (36 FAILs).
- Findings: the `- Kind:`, `- Found by:` and `- Status:` lines of each `## F<n>` entry.

## Headline numbers

| | |
|---|---|
| FAIL reviews | 109 of 605 (18%); 75 of 370 reviewed tickets had at least one; 20 tickets had 2 or more (AR0496: 6 FAILs in 9 reviews) |
| FAIL rate by reviewer | harness era (branch `h/…`): 18 of 355 (5%); Arthur's own delivery reviews (branch `arthur/…`, from 2026-10-25): **91 of 251 (36%)** |
| Mutation named as uncaught | 71 of 109 FAILs (65%); 64 of the 91 Arthur-era FAILs |
| FAILs whose every blocking cause could be caught before a reviewer runs (mutation, claim, check, budget, flaky) | **49 of 109 (45%)**; 41 of them are uncaught mutation alone (plus a claim about it) |
| Upper bound with F1–F5 below (also counts guard-bypass FAILs and tests reaching production paths) | 79 of 109 (72%) [INFERENCE: the operator set covers about 80–85% of the named mutants, so the real figure is lower] |
| Cost | median ticket cost $8.44 with a FAIL vs $3.46 without one (40 and 292 tickets that have a `- Cost:` line) |
| Hand mutation in reviews that PASSed | 384 of 495 PASS reviews describe their own mutations |

## Counts by root-cause class

| Class | Primary | Any (primary + secondary) | Caught before the reviewer? | By what (proposal) |
|---|---:|---:|---|---|
| Uncaught mutation / behaviour without a test that fails | 45 | 71 | **Yes, by a check** | diff-scoped mutation run (F4), gated before review (F3) |
| Security: worktree-guard shell-parser bypass | 26 | 28 | **Yes, by code**: the sandbox already refuses those writes | sandbox fail-closed; guard demoted to a mistake guard (F1); differential oracle (F9) |
| Security: other guard/redaction/permission gap | 12 | 14 | Mostly no (judgment); 1 (owner's real name in a fixture, AR0280) can be found by grep | stays with the reviewer |
| Worker's claim does not reproduce | 2 | 23 | Yes, for test counts and mutation claims | machine records in the review task (F3, F4) |
| Logic bug (wrong behaviour, race) | 8 | 9 | No | reviewer |
| Doc drift | 1 | 9 | No (judgment) | reviewer |
| Done means not met | 2 | 8 | No | reviewer |
| `npm run check` / `npm test` fails on the branch | 4 | 6 | **Yes, by a check** | gate on the recorded checks (F3) |
| Flaky / timing-dependent test | 1 | 3 | Partly | serial lane and fixed-wait ratchet (F8) |
| Test reaches a production resource (real `/tmp`, real env file) | 3 | 3 | **Yes, by code** | test kit (F5) |
| Line budget / budget "decision" missing | 3 | 3 | **Yes, by code**: the rule is ceremony now | the merge records the raise (F2) |
| Fake not matching reality (real `omp` started, fake field missing) | 2 | 2 | Partly (the real-`omp` case by code, F5) | F5; reviewer |
| Leftover files | 0 | 1 | Yes | — |

Two example quotes per class (verbatim):

- **Uncaught mutation**
  - `AR0025-…/review-1.md`: "I mutated this to `skip < bytes.length` (a "limit moved by one," exactly the family the review guide names) and reran `packages/core/test/machine.test.ts`: **all 17 tests still pass**"
  - `AR0550-…/review-1.md`: "I changed `/^[a-z]{2,3}$/` to `/^[a-z]{2,4}$/` and the voice tests still passed (12 pass, 0 fail)."
- **Guard bypass**
  - `AR0333-…/review-3.md`: "In each one the guard approves the call and real bash deletes the main checkout's `README.md`."
  - `AR0471-…/review-4.md`: "This is a regression that lets a job delete the main checkout's README with no link at all, only a `~` folder in its own worktree (`mkdir '~'`)."
- **Other security**
  - `AR0158-…/review-1.md`: "the procedure-path symlink refusal only checks the leaf file, not intermediate directory components."
  - `AR0418-…/review-1.md`: "a password containing a space still gets printed."
- **Claim does not reproduce**
  - `AR0019-…/review-1.md`: "Removed `now.hold === "" &&` from … → ran `npm test`: **287/287 pass, 0 failures** (claimed: 4 fail)."
  - `AR0111-…/review-1.md`: "The *processes* claim holds (no live pid, no tmux server on that socket), but the *removed* claim is false — the files are still there."
- **Logic bug**
  - `AR0014-…/review-1.md`: "`stopAgent = () => void child.kill("SIGTERM")` signals only the agent's own pid, never its process group."
  - `AR0044-…/review-1.md`: "an event emitted by the daemon itself before its first `follow()` tick can be delivered twice across a restart, violating the ticket's "never twice" Done-means"
- **Doc drift**
  - `AR0478-…/review-1.md`: "the doc it changed says something false about when Git still conflicts"
  - `AR0518-…/review-2.md`: "a job on another machine still writes raw env values into its record and log under the local home." (the code differs from what its ticket and doc promise)
- **Done means not met**
  - `AR0167-…/review-1.md`: "The ticket's first Done-means bullet is: *"The failing test or tests are named, with how they were found…"* — this is not satisfied for any of the four fixes that were applied."
  - `AR0541-…/review-1.md`: "the Done means is still not met for the full `npm test`."
- **Check or test fails**
  - `AR0355-…/review-1.md`: "`npm test` fails, and the ticket's Done means requires it to pass."
  - `AR0375-…/review-1.md`: "the branch's new test breaks an existing test, so `npm test` fails."
- **Flaky test**
  - `AR0224-…/review-1.md`: "Running `node --test packages/telegram/test/commands.test.ts` 8× concurrently (mild CPU contention, no fault injection) failed **8/8 times**"
  - `AR0014-…/review-1.md`: "`packages/core/test/wrapper.test.ts:91-92` — waits for `tool-calls === "4"` (an earlier/different signal) then asserts `activity === "think"` on the same read."
- **Test reaches production**
  - `AR0254-…/review-1.md`: "two tests run the production cleanup against the real system `/tmp`, not a test-owned folder."
  - `AR0339-…/review-1.md`: "tests now open the real user's env file."
- **Budget**
  - `AR0439-…/review-1.md`: "I'm failing this branch on one blocking problem: it raises the core's line budget without a decision recorded in the ticket. The feature itself works and is well tested."
  - `AR0384-…/review-1.md`: "The styleguide (Shape) is explicit: "the number [budget] lives in that test only, and a raise is a decision recorded in the ticket.""
- **Fake not matching reality**
  - `AR0517-…/review-2.md`: "The new socket-folder test starts the owner's real `omp` agent instead of a fake."
  - `AR0557-…/review-1.md`: "the fake's "List issue comments" answer is missing a field."

### The 147 surviving mutants, by operator

| Operator | Count | Mechanical? |
|---|---:|---|
| Regex edit (drop a char-class member, change a quantifier) | 25 | yes |
| Drop one element of a list/set/alternation | 25 | yes |
| Other (`lastIndexOf`→`indexOf`, `.some`→`.every`, `\|\|`→`??`, "put back main's code" ×6) | 23 | about half (hunk revert, method swap) |
| Drop one operand of `&&`/`\|\|`, or a condition | 20 | yes |
| Delete a statement or call | 18 | yes |
| Boundary or number change (`<=`→`<`, `>= 8`→`>= 9`) | 15 | yes |
| Replace an expression with a constant | 15 | yes |
| Move a statement (out of a lock or an `if`) | 4 | no |
| Swap an argument or variable | 2 | partly |

Files: `worktree-guard.ts` 32, `site-check.ts` 15, `shell-words.ts` 12, `merge-command.ts` 11, `shell-join.ts` 9, `hand-over.ts` 6. The test file the reviewer ran had the same base name as the mutated file for 58 of 147 mutants. Following the `src/` import graph from each test file reaches the mutated file in 118 of 139 cases; most misses are `wrapper.ts`, which tests start as a process instead of importing.

The prose to prevent this has been there since the first days: `packages/core/roles/worker.md:20` (AR0013, 2026-10-16) and `:21` ("break each condition your change adds… on purpose", AR0116, 2026-10-18), and `packages/delivery/roles/reviewer.md:18`. 67 of the 71 mutation FAILs came after 2026-10-18. Prose did not move this class.

### The guard cluster

- 36 FAILs name `worktree-guard.ts` or `shell-words.ts`. **35 of them came after the Landlock sandbox merged** (AR0376 outcome: "Merged: 2026-10-25"). Its own ticket says "Out: the guard's parser stays the mistake guard it is", and `docs/deploy.md:36` says "The bound is the sandbox each job's agent runs in". **None of the 36 reviews mentions the sandbox.**
- The bypasses are writes into the main checkout. The sandbox refuses those (`packages/core/docs/commands/spawn.md:110-118`: a job writes only in its worktree, its record, the repository's `objects`/`refs`/`logs`, the temporary folder, `/dev`…).
- Rounds: AR0496 had 9 reviews (6 FAIL), 7 owner decisions (AR-D239…AR-D312) and cost $27; AR0333, AR0471 and AR0493 each had 4 FAILs. In AR-D19 the coordinator wrote: "Each review finds new bash forms. What comes next?"
- 10 guard FAILs were regressions: the base refused the command and the tip let it through. The 36 reviews quote 131 distinct bypass-like commands.
- Findings: 85 entries name a guard file (11% of 766); 65 of them came after the sandbox, and 28 of those became new tickets. Each guard ticket produces the next.
- The guard file is the densest code in the repository: `worktree-guard.ts` has 30 lines over 200 characters, one of 1631.

## findings.md sample (all 766 entries)

| | Count | Settled ticket | dropped | deferred | fixed | open |
|---|---:|---:|---:|---:|---:|---:|
| All | 766 | 370 | 278 | 62 | 35 | 18 |
| Found by a review (copied in by the coordinator, `after-merge.md:6`) | 349 | 61 | **229 (66%)** | 35 | 6 | 18 |
| … kinds other than security/risk/bug | 236 | 20 (8%) | **189 (80%)** | 25 | | |
| … kinds security/risk/bug | 113 | 41 | 40 | | | |
| Found by a worker | 417 | **309 (74%)** | 49 | 27 | 29 | |

- Most common kinds: security 162, risk 143, test 82, improvement 66, fix 56, cleanup 50, bug 46, docs 39, ux 33.
- Review findings of kind `test` (mostly "this mutation also survives, not key"): 72, of which 61 were dropped.
- Drop reasons, review-found, matched by regex: harmless/minor/cosmetic/wording 41; documented or by design 18; fixed elsewhere or a duplicate 15; cannot happen 8; other 146.
- Deferred: 62 in total (35 found by reviews).
- Flaky or timing findings: 24 (8 fixed, 8 tickets).

## Proposals (ranked by leverage: FAILs and recurring corrections removed per line changed)

| Rank | Id | Layer | Est. lines | Removes (from the data) |
|---|---|---|---:|---|
| 1 | F1 | codebase | ~20 + 1 criteria line | ~26 guard-bypass FAILs, a ticket loop (28 tickets since the sandbox) |
| 2 | F2 | codebase | ~15 | 3 FAILs, ~52 decision records, 34 worker-written Decisions lines; correction e (mostly), i (one policy id) |
| 3 | F5 | codebase | ~8 | 4 FAILs |
| 4 | F3 | codebase | ~40 | correction a for workers; 6 check FAILs; claims about test counts |
| 5 | F4 | static analysis | ~200 | **largest absolute**: up to 41 FAILs outright, part of 30 more; correction f; hand mutation in 384 PASS reviews |
| 6 | F6 | static analysis | ~20 | correction e (what F2 leaves) |
| 7 | F7 | codebase | ~60 | ~190 of 229 hand-dropped review findings (correction h) |
| 8 | F8 | static analysis | ~30 | correction b; 3 FAILs; reruns in 53 reviews |
| 9 | F9 | static analysis | ~150 | 10 guard regression FAILs (needed only if F1 is not taken) |
| 10 | F10 | static analysis | ~20 | indirect: squeezed lines in the top FAIL files |

---

### F1. The sandbox is the bound: a job without one does not start, and the guard is a mistake guard in code

- **Layer:** codebase.
- **Helps:** reviewer, worker, coordinator (no more round decisions on guard tickets), owner.
- **BEFORE:**
  - 26 primary FAILs (28 any) are guard bypasses, all after the Landlock sandbox landed.
  - In every one, the "attack" is a file write the sandbox already refuses (`spawn.md:110-118`). AR0376's scope said the parser stays "the mistake guard it is", but no reviewer or ticket writer reads that: 0 of 36 guard FAIL reviews mention the sandbox.
  - Review criteria `review.md:27` ("A secret can leak…") and `reviewer.md:19` ("For code that blocks, validates or protects something … list every bypass you find") send the reviewer after every bash form.
  - The guard is the only bound only where the sandbox cannot start. In that case the wrapper runs the agent bare (`spawn.md:126`, "Where the sandbox cannot be set up, the agent runs as before"; `job-sandbox.ts:90-101`). The guard therefore has to stay "security" in principle.
  - Cost: AR0496 alone took 9 reviews and 7 owner decisions. 65 guard findings since the sandbox produced 28 new tickets.
- **AFTER:**
  1. `job-sandbox.ts`/`wrapper.ts:123,129`: when `sandboxed()` reports `no sandbox: <why>`, the wrapper ends the job `failed: no sandbox: <why>; set core.jobs.unsandboxed: true to run jobs without one`. The opt-in is a core option, so `arthur doctor` can name it. This removes the case where the guard is the only bound.
  2. The guard's header comment (`worktree-guard.ts:9-13`) and `deploy.md:35` state its contract: plain commands, honest mistakes. The git-ref checks (`refs` stay writable in the sandbox, `spawn.md:113`) remain its security job.
  3. One line in `.agents/arthur/criteria/review.md` (prose companion): "A guard bypass by a shell form whose write the sandbox refuses is a note, not a FAIL. A plain command the base refused and the tip lets through is a FAIL."
- **Files:** `packages/core/src/job-sandbox.ts`, `packages/core/src/wrapper.ts`, `packages/core/test/sandbox.test.ts` (the "without python3 … runs as it is" test changes to "refuses unless opted in"), `packages/core/docs/commands/spawn.md`, `docs/deploy.md`, `.agents/arthur/criteria/review.md`.
- **Size:** S. A later, optional L: shrink `shell-words.ts`/`worktree-guard.ts` back to plain forms.
- **Removes:** the guard-bypass FAIL class (~26 of 109) and the guard findings→tickets loop; correction (i) in part (fewer round and policy decisions to remember).
- **Styleguide:** compliant.
- **Tradeoff for the owner:** a job on macOS (no Landlock) needs the opt-in or a `sandbox-exec` profile.

### F2. A line-budget raise is recorded by the merge, not written as a ticket decision

- **Layer:** codebase.
- **Helps:** worker, reviewer, coordinator, owner.
- **BEFORE:**
  - `styleguide.md:13` and `test/structure.test.ts:8`: "a raise is a decision recorded in its ticket".
  - 130 `ticket.md` files carry a dated budget line.
  - 53 decision-log asks are line-budget raises, and 52 of them came after the owner delegated the call. AR-D29 (2026-10-25): "from now on the coordinator raises a package's budget itself when a fix needs it". AR-D61 (2026-10-26): "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS". Policy AR-D63 then answered 17 more.
  - Three FAILs were for this ceremony alone: AR0439 r1 (filed on the same day as AR-D61), AR0384 r1, AR0442 r1.
  - Workers write the line themselves. Of the 51 dated lines that worker branches added to `ticket.md` (33 merges), **34 are budget raises**. AR0498 r1 finding 3: "the Decisions line the worker added is not a decision record". The two lines AR0557's branch added conflicted with main.
  - `test/structure.test.ts` changed in 362 commits on main.
- **AFTER:**
  - Delivery's merge writes `- Budgets: core 6448 → 6460 (+12)` into `outcome.md`, from the `BUDGETS` diff of base..tip (`merge-outcome.ts`).
  - `structure.test.ts:8` reads "a raise shows in the merge's outcome.md".
  - `styleguide.md:13` drops "and a raise is a decision recorded in the ticket". The 200-line cap and the per-package budgets stay.
  - The reviewer judges a raise only by "Code beyond what the change needs" (`review.md:29`).
- **Files:** `packages/delivery/src/merge-outcome.ts` and its test, `packages/delivery/docs/commands/merge.md`, `test/structure.test.ts:8`, `.agents/arthur/criteria/styleguide.md:13`.
- **Size:** S.
- **Removes:** the budget FAIL class; ~2/3 of the motive behind correction (e); a decision record per raise; one policy id (i).
- **Styleguide:** **changes a Shape clause.** Justified because the owner has already given this decision away twice; the record moves from text an agent writes to a line the merge computes.

### F5. The test kit makes production paths unreachable

- **Layer:** codebase.
- **Helps:** worker, reviewer.
- **BEFORE:**
  - `packages/core/src/testing.ts:26-27` moves `XDG_CONFIG_HOME` and `TMUX_TMPDIR` into a temporary folder for every test process (`--import`). `HOME`, `TMPDIR` and a real `omp` reached through a test's own `PATH` are not covered.
  - 4 FAILs: AR0254 r1 (real `/tmp`), AR0339 r1 and r3 (real env file), AR0517 r2 ("starts the owner's real `omp` agent instead of a fake").
  - Ticket AR0461: "test/readme.test.ts reads the real env file and fails inside a job".
  - The rule already exists as prose (`review.md:24`, `styleguide.md:36`).
- **AFTER:**
  - `testing.ts` also sets `HOME` and `TMPDIR` to its root, and `GIT_CONFIG_GLOBAL` to a kit file with `user.name`/`user.email` so commits still work.
  - It prepends a bin folder whose `omp` exits 1 with "real omp is not reachable from a test", the way the fake agent's PATH already works for jobs.
  - A test that wants production must name the path explicitly, which a reviewer sees.
- **Files:** `packages/core/src/testing.ts` (at exactly 200 lines: free a line, or raise the `core/testing` budget per F2), `packages/core/test/testing.test.ts`.
- **Size:** S. [INFERENCE: some tests may read `HOME` on purpose; the first run lists them.]
- **Removes:** the test-reaches-production class (4 FAILs).

### F3. No review starts until the worker's own record shows passing checks on its tip

- **Layer:** codebase (a gate over existing static checks).
- **Helps:** worker, reviewer, coordinator.
- **BEFORE:**
  - Correction (a) is given by hand to every job (`.arthur/session/handoff.md:24`).
  - 6 FAILs had `npm test`/`npm run check` failing on the branch (AR0355, AR0375, AR0442, AR0443 ×2, AR0224). 23 FAILs had a final-message claim that did not reproduce. AR0541 r1 measured a full `npm test` at 561–577 s against omp's 300 s default bash timeout. 15 reviews show runs that were killed, exited 143 or were backgrounded.
  - Delivery already records every `npm run check`/`npm test` a job runs, with the commit and `clean|dirty` (`packages/delivery/src/checks-extension.ts:24-37`). It skips backgrounded calls (`:68`).
  - `review-needed.ts:79-85` already finds the latest line on the tip's clean tree, but only uses it to waive the review of a branch of 30 lines or fewer.
  - The hand-back starts the next review as soon as the worker's run ends `finished` (`hand-back.ts:111-112`), whatever the record says.
- **AFTER:**
  1. Extract `review-needed.ts:79-85` into one exported function, `tipChecks(checks, tip, scripts)`.
  2. `arthur review` (`review-command.ts`) and the hand-back step at `hand-back.ts:112` call it. Without `check pass` and `test pass` (and `mutate pass` once F4 exists) on the tip's clean tree, no review starts. The worker is continued once with a fixed instruction: "Your tip <sha> has no passing `npm run check` and `npm test` of yours on a clean tree (record: <lines>). Run `npm run check && npm test` in one foreground bash call with timeout 1800, fix what fails, commit, end." A second miss goes to the coordinator.
  3. The review task (`docs/commands/review.md:12-21`) gains a `## The worker's recorded checks` section, so the reviewer compares claims with the record, not the prose.
- **Files:** `packages/delivery/src/review-needed.ts`, `hand-back.ts`, `review-command.ts`, their tests, `packages/delivery/docs/commands/review.md`, `review-needed.md`.
- **Size:** S–M.
- **Removes:** correction (a) for workers; the check-fails class; claims about test counts (part of the 23).
- **Styleguide:** compliant. The record is "the job's own word" (`review-needed.md:37`); that is enough for a gate against careless runs, which is the failure in the data.

### F4. `npm run mutate`: a diff-scoped mutation run the worker does and the reviewer starts from

- **Layer:** static analysis.
- **Helps:** worker (finds the gap before ending), reviewer (judges survivors instead of hand-mutating), coordinator (fewer hand-backs and round decisions).
- **BEFORE:**
  - 71 FAILs (65%) name an uncaught mutation; 45 are primary; 41 FAILs had no other blocking cause (or only a claim about mutations).
  - Reviewers named 147 survivors, about 80% from the mechanical operators in the table above.
  - The worker prose (`worker.md:20-21`) and the reviewer prose (`reviewer.md:18`) predate 67 of these FAILs.
  - 78 reviews check a worker's mutation claim (17 FAIL).
  - 384 PASS reviews also mutated by hand.
  - 72 review findings of kind `test` (61 dropped) are the leftovers of the same activity.
- **AFTER:**
  - New `test/mutate.ts`: plain functions, `node:child_process`, no dependency, at most 200 lines; the root `test/` folder already holds `structure.ts` and `github-annotations.ts`. Root `package.json` gets `"mutate": "node test/mutate.ts"`.
  - It works on the changed hunks of `packages/*/src/*.ts` against the merge base:
    1. Revert each hunk alone to the base (catches "put back main's code").
    2. On each changed line, apply the operators from the data: delete the statement; drop one operand of `&&`/`||`; flip `===`/`!==`, `<`/`<=`, `>`/`>=`; ±1 on a number; `true`↔`false`; `.some`↔`.every`; drop one array-literal element; drop one regex alternative or char-class member; widen a regex `{m,n}`.
  - Test selection, cheapest first: the same-name test, then tests importing the file; only a survivor is re-run against every test that reaches it through the `src/` import graph (118 of 139 cases measured); the package's `test/` folder is the fallback. Never the full suite per mutant: a full run takes ~10 min under load (AR0541).
  - It restores from the original bytes in memory and prints `mutate: <n> mutants, <k> killed, <s> survived` plus `file:line <operator>` per survivor. Exit 1 on any survivor.
  - `checks-extension.ts` records `mutate pass|fail <s>` (`Script` gains `"mutate"`), which F3 gates on.
  - `worker.md:20-21` become one line: "Run `npm run mutate`; give each survivor a test, or name it in the final message and why it is equivalent."
  - `reviewer.md:18` becomes: "Start from `npm run mutate`'s survivors and judge each one named equivalent; mutate by hand only behaviour its operators do not reach (a moved statement, a swapped argument)."
- **Files:** `test/mutate.ts` (new), `package.json`, `packages/delivery/src/checks-extension.ts` and `docs/commands/review-needed.md`, `packages/core/roles/worker.md`, `packages/delivery/roles/reviewer.md`.
- **Size:** M.
- **Removes:** correction (f); the largest FAIL class, up to 41 FAILs outright and the mutation part of 30 more; most hand-mutation work in reviews.
- **Styleguide:** compliant (no deps, dev tooling, one file, one job). For projects Arthur manages in other languages, the hunk-revert mode does not depend on the language [later].

### F6. The merge refuses a worker branch that edits a ticket's Decisions, the decision log or the board

- **Layer:** static analysis (merge check).
- **Helps:** worker, coordinator, owner.
- **BEFORE:**
  - Correction (e), and AR0557 this week.
  - 33 merged worker branches added 51 dated lines to `ticket.md`.
  - AR0501 (on the board, `planning`) already proposes an orchestration `merge.check` refusing a worker's change to `spec/decisions.jsonl` and `spec/build.json` (forged owner answers: its "Probes P2 and P2b … gets `no review`"). It does not cover the Decisions section of `ticket.md`, which is what workers actually write.
- **AFTER:** AR0501's check also refuses a worker branch whose diff changes any line under `## Decisions` of a `spec/features/*/ticket.md`: `refused: arthur/<id> changes <ticket>'s Decisions (line <n>); a decision goes through arthur decision; put the proposal in your final message`. `review-needed` puts the same paths on its always-review list. `worker.md:39` ("Never change a ticket's status") gains "or its Decisions".
- **Files:** the AR0501 check (orchestration) and its test, `packages/delivery/src/delivery-options.ts` (always-review list), `packages/core/roles/worker.md:39`.
- **Size:** S.
- **Removes:** correction (e), by code, for whatever F2 leaves.

### F7. Review notes become findings by kind, in code

- **Layer:** codebase (takes over coordinator hand-work).
- **Helps:** coordinator, owner.
- **BEFORE:**
  - `packages/delivery/roles/coordinator/after-merge.md:6`: "Copy the reviews' non-blocking notes into the ticket's `findings.md` as new entries, and settle each".
  - 349 of the 766 findings came from that copying; 229 were then dropped (66%).
  - Of the 236 with a kind other than security/risk/bug, 189 were dropped (80%) and 20 became tickets (8%).
  - This is correction (h): every finding settled by hand.
- **AFTER:**
  - `reviewer.md:24` asks each note to start with `Note (<kind>):`, using the kinds of the findings template.
  - Delivery's filing (`arthur ticket file`, `review-file.ts`) appends only notes of kind security, bug or risk to `findings.md` as `open` entries. The findings plugin turns those into tickets at the merge, as it does today.
  - Every other note stays in the filed `review-N.md`.
  - `after-merge.md` step 2 becomes "settle the open entries the filing added".
- **Files:** `packages/delivery/src/review-file.ts` and its test, `packages/delivery/roles/reviewer.md:24`, `packages/delivery/roles/coordinator/after-merge.md:6-7`, `packages/findings/docs/findings.md`.
- **Size:** M.
- **Removes:** about 190 of 229 hand-dropped entries (going by the data); part of correction (h).
- **Styleguide:** the parser reads the reviewer's own final message, agent text, not "Markdown the human owns" (`styleguide.md`, Avoid).

### F8. Timing tests: a serial lane and a ratchet on fixed waits

- **Layer:** static analysis.
- **Helps:** reviewer, worker.
- **BEFORE:**
  - Correction (b).
  - 53 reviews (9%) re-ran a test alone or under load; `limits.test.ts` is named in 36 reviews (9 of them FAIL); 3 FAILs are in the flaky class; 24 flaky findings.
  - 110 fixed-time waits (`setTimeout(…, N)`, `sleep(N)`, `timeoutMinutes: 0.0x`) sit in 51 test files, although `styleguide.md:35` forbids fixed waits.
  - Parallel jobs load the host: AR0541 measured a full run at 561–577 s with two runs side by side.
- **AFTER:**
  1. Root `package.json` `test` runs the timing-sensitive files, listed in one place, in a second `node --test --test-concurrency=1` pass after the parallel one.
  2. `test/structure.test.ts` counts fixed waits per test file against a baseline map (as `BUDGETS` does) and fails when a file's count grows.
- **Files:** `package.json`, `test/structure.test.ts`.
- **Size:** S–M.
- **Removes:** correction (b); reruns in reviews; new fixed-time waits.

### F9. Guard differential oracle: the guard against real bash, base against tip

- **Layer:** static analysis.
- **Helps:** worker, reviewer.
- **BEFORE:**
  - Reviewers find bypasses by running real bash ("real bash deletes the main checkout's README"); 131 such commands are quoted in the guard FAIL reviews.
  - 10 guard FAILs were regressions. AR0420 r2: "Each of these was refused before the branch and passes now, so each is a regression."
- **AFTER:**
  - New `packages/core/test/guard-oracle.test.ts`. It builds a fixture (main checkout, worktree, home) and generates commands from the forms in the data:
    - assignments of `HOME`/`PWD`/`OLDPWD`/`ARTHUR_JOB`, `export`/`declare`/`local`/`readonly`;
    - `env`/`sudo` with long options;
    - carriers `bash -c`, `eval`, heredoc, function, trap;
    - moves `cd -`, `pushd`, `~-`, `~+`;
    - quoting `'`, `"`, `$''`, backslash-newline;
    - then a write to main's sentinel file.
  - The 131 quoted commands seed it.
  - It asserts: if bash changed the sentinel, `worktreeRefusal` refused.
  - A base-vs-tip pass fails on any command the base refused and the tip lets through.
- **Size:** M.
- **Removes:** guard regressions and most bypass finds before review. **Worth building only if F1 is not taken**, or for the git-ref half of the guard.

### F10. A line-width ratchet, so the 200-line cap is not met by squeezing

- **Layer:** static analysis.
- **Helps:** worker, reviewer; F4's line-level operators.
- **BEFORE:**
  - 383 `src` lines are over 200 characters and 27 over 400; `worktree-guard.ts` has 30 over 200, one of 1631.
  - 7 source files sit at exactly 200 lines; 14 feature files mention squeezing or freeing a line.
  - The owner turned down squeezing in AR-D29 ("squeeze 4 lines … makes the code hard").
  - The densest file is also where the most mutants survive (`worktree-guard.ts`, 32 of 147) [INFERENCE: dense lines are copied and are harder to mutate one condition at a time].
- **AFTER:** `test/structure.test.ts` fails on a source line over 160 characters, except in files listed with their current maximum; the list may only shrink.
- **Size:** S.
- **Removes:** the squeezing route around the 200-line rule. Indirect effect on FAILs.

## What stays with the reviewer (the judgment layer)

30 FAILs (28%) had a cause no check here removes: 13 non-guard security gaps (symlink hops, redaction, permission bits, the owner's real name in a fixture), 8 logic bugs, 2 unmet Done-means, 1 doc drift, 1 fake shape, 4 mutations beyond the mechanical operators, 1 check failure. F1–F4 free the reviewer's turn for these.

## Appendix: each FAIL review, primary class (+ secondary); G = names a guard file

```
AR0014 r1 logic +flaky,claim         AR0420 r1 security +mutation G   AR0490 r1 security
AR0018 r1 mutation                   AR0420 r2 security +mutation G   AR0490 r2 security
AR0019 r1 claim +mutation            AR0420 r3 mutation G             AR0490 r3 mutation
AR0023 r1 security +claim G          AR0424 r1 mutation +security     AR0493 r1 security +mutation G
AR0025 r1 mutation                   AR0424 r2 mutation               AR0493 r2 security +mutation
AR0044 r1 logic                      AR0429 r1 mutation +security G   AR0493 r3 security +mutation G
AR0070 r1 mutation                   AR0429 r2 mutation +claim G      AR0493 r4 security +done,claim G
AR0111 r1 claim +leftover            AR0431 r1 mutation               AR0494 r1 mutation G
AR0158 r1 security                   AR0436 r1 mutation +claim        AR0494 r2 mutation G
AR0167 r1 done +claim                AR0439 r1 budget                 AR0496 r1 mutation G
AR0188 r1 logic                      AR0442 r1 budget +check,mut,claim AR0496 r3 security +done G
AR0224 r1 flaky +claim,check         AR0443 r1 check +claim           AR0496 r4 security G
AR0237 r1 mutation                   AR0443 r2 check +logic,claim     AR0496 r5 security G
AR0254 r1 test-prod                  AR0454 r1 mutation               AR0496 r6 security +done G
AR0271 r1 mutation                   AR0463 r1 security +mutation     AR0496 r7 security +mut,claim G
AR0275 r1 mutation                   AR0465 r1 mutation               AR0498 r1 mutation G
AR0280 r1 security                   AR0466 r1 logic +mutation        AR0505 r1 mutation +done,claim
AR0333 r1-r4 security +mutation G    AR0467 r1 security +doc          AR0508 r1 mutation
AR0335 r1 mutation +security,doc G   AR0469 r1 security +claim,mut    AR0509 r1 logic +flaky
AR0335 r2 security +done G           AR0469 r2 mutation               AR0517 r1 mutation
AR0335 r3 security +mutation G       AR0470 r1 logic +mutation        AR0517 r2 fake
AR0337 r1, r2 mutation               AR0470 r2 mutation               AR0518 r1 security +mut,done,doc
AR0339 r1 test-prod +mutation,doc    AR0471 r1 security G             AR0518 r2 security +doc
AR0339 r3 test-prod                  AR0471 r2 security +mutation G   AR0518 r3 mutation +claim
AR0340 r1 mutation +security         AR0471 r3 security G             AR0526 r1 mutation
AR0341 r1 mutation                   AR0471 r4 security +mutation G   AR0532 r1, r2 mutation
AR0343 r1 mutation                   AR0472 r1 mutation G             AR0534 r1 mutation
AR0344 r1 mutation                   AR0473 r1 security +doc G        AR0537 r1 mutation
AR0355 r1 check +mutation,claim      AR0474 r1 mutation               AR0541 r1 done +doc
AR0361 r1 mutation                   AR0478 r1 doc +claim,mutation    AR0545 r1 security +claim G
AR0367 r1 mutation                   AR0384 r1 budget G               AR0545 r2 security G
AR0373 r1 logic +doc,claim           AR0401 r1 logic +claim           AR0546 r1 security G
AR0375 r1 check +claim               AR0418 r1 security +mutation     AR0547 r1 security +mutation G
                                     AR0419 r1 security +mut,claim    AR0550 r1, r2 mutation
                                                                      AR0555 r1 mutation
                                                                      AR0557 r1 fake
```
