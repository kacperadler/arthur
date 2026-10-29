# Arthur: what repeats in decisions, what agents keep hitting, and two commands

Read-only audit of `the repository`, 2026-10-29. Sources: `spec/decisions.jsonl` (673 records), `npx arthur decisions --classes` and `npx arthur decisions <id>`, `spec/build.json` (560 tickets), every `spec/features/*/ticket.md` (`## Decisions`, `- Kind:`, `Source:` lines), `review-N.md`, `findings.md` and `outcome.md`, `git log` (3086 commits), `.arthur/events.jsonl` (4477 events, 2026-10-25T10:45Z to 2026-10-29T18:20Z), `.arthur/session/handoff.md`, `npx arthur retro-due`, `npx arthur stats`, and the docs/roles of manage, orchestration, delivery and core.

How the answers were classified (a script over the log; the coordinator records every answer, so "who answered" is read from the owner's words it recorded):

- **policy**: `words` = `by policy: <class>`.
- **standing**: the coordinator answered by quoting an earlier blanket grant ("go with your recommendation", "do not ask", "just merge", "ADD MORE LINES TO THE CORE"). The words do not name the question's own id.
- **owner, direct**: a fresh reply to this question (`AR-D45 - 1`, "Go with 1", or free text). 3 replies were direct and also set up a grant: AR-D28, AR-D29, AR-D216.
- **owner, batch**: one owner message approving a list of tickets, recorded once per ticket (for example AR-D124 to AR-D141, all from "apprvoed: AR0467, AR0466, …").
- **Agreement** counts a question only when it has both a numeric `recommend` and a `picked`. It is true when `picked == recommend`.

---

## 1. Decision statistics

### 1.1 Totals

- Asks: **335** (AR-D1 to AR-D335), from 2026-10-25 to 2026-10-29. Per day: 44, 68, 100, 70, 53, so about 75 a day.
- Records: 335 `ask`, 321 `answer`, 16 `close`, 1 `revoke`. 0 questions are open.
- Answered: 319. Two were answered twice (AR-D61, AR-D271; the later answer counts).
- Closed with no answer: 16:
  - 12 merges that went in before their answer ("ticket merged", AR-D145 to AR-D176).
  - AR-D182: "asked again in the policy class words (passed review)".
  - AR-D201: "worded wrongly".
  - AR-D256: replaced by AR-D257.
  - Class proposal AR-D62.

| Kind | Asks | By policy | Standing grant | Owner direct | Owner batch | Closed | Agreement on owner/standing answers |
|---|---:|---:|---:|---:|---:|---:|---|
| merge | 104 | 68 | 7 | 15 | 0 | 14 | 22/22 |
| question | 94 | 0 | 25 | 41 | 27 | 1 | 87/91 |
| budget | 55 | 17 | 28 | 10 | 0 | 0 | 37/37 |
| review | 38 | 0 | 17 | 21 | 0 | 0 | 38/38 |
| job | 30 | 0 | 9 | 20 | 1 | 0 | 19/23 (6 had no recommendation: jobs blocked on the owner) |
| plan | 10 | 0 | 0 | 10 | 0 | 0 | 9/9 |
| class | 4 | (never by policy) | | 3 answered | | 1 | |
| **Total (331 non-class)** | **331** | **85 (25.7%)** | **86 (26.0%)** | **117 (35.3%)** | **28 (8.5%)** | **15 (4.5%)** | **212/220 = 96.4%** |

- **By policy: 85.** Merge 68, budget 17. The classes that answered:
  - AR-D218: 45.
  - AR-D74: 23. Revoked 2026-10-28.
  - AR-D63: 17.
- **By the owner: 145 questions, from 108 distinct owner messages.** 117 direct and 28 in batch. Median reply time after the ask is 1.2 min and p90 is 17 min (computed over the 142 direct and batch answers). He answers live, in chat.
- **By recommendation: 86 questions** were answered under a standing "go with your recommendation / don't ask" grant (the standing column). Every one of the 81 scored ones took the recommended option. With policy, **171 of 331 questions (52%) were decided without a fresh reply from the owner.**
- **The owner picked the recommended option:**
  - Direct answers only: 103 of 111 (92.8%).
  - Direct plus batch: 131 of 139 (94.2%).
  - All non-policy answers: 212 of 220 (96.4%).

  The 8 disagreements show one pattern: the owner goes faster than the coordinator on throughput, and slower on safety and outside actions.
  - **Faster** (the coordinator said wait, or less):
    - AR-D199: start Q1 now at 94% weekly use.
    - AR-D300: start the 7 fixes past the 33% cap.
    - AR-D326: start the feature work past the cap.
    - AR-D13: maxAgents 3, not the recommended 2.
    - AR-D198: four groups, not group 1.
    - AR-D97: AR0463, not "move your other projects".
  - **Slower:**
    - AR-D2: waited for a real review rather than merge `--unreviewed`.
    - AR-D257: no whisper install until the plugin exists.
- **Owner grants of autonomy.** 11 owner messages told the coordinator not to ask. They are in `.arthur/events.jsonl` (`message-received`, regex "do not ask|always go with|just merge|by yourself"), plus the AR-D271 voice note. The 86 standing answers trace back to these grants:

| Grant (owner's words) | Answers recorded under it |
|---|---:|
| AR-D61 / AR-D29: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" | 19 |
| AR-D271 (voice note): "Idz z wszystkich rekomendacjow i nie pytaj mnie" | 17 |
| AR-D31: "always go with recommendation till the 8 am morning" (+AR-D28, AR-D11) | 15 |
| AR-D142: "keep going till 88% of Claude 7 Day limit, go silent and always go with recommendations" | 9 |
| AR-D98: "go up to 85% … always go with your recommendation" | 7 |
| AR-D6–AR-D11: "always go with your recommendations and do not ask me about them, go to 60% usage" | 6 |
| AR-D73: "If there is something that you can merge, just merge, do not ask me" | 6 |
| AR-D242: "today … do not ask me about decision for them, just go with recommendation till is done" | 5 |
| AR-D212, AR-D216 | 2 |

Each grant has a bound the code does not know:
- a time: "till the 8 am morning";
- a usage cap: "till 88%", "85%", "60%", "99%", "33%";
- or a scope: "till is done", "Q1-Q3".

The coordinator tracks expiry from memory. For example, the handoff says: "AR-D271 (by recommendation) covered Q1-Q3 only: now ask the owner for real decisions" (`.arthur/session/handoff.md:22`).

### 1.2 The classes, and what they show about the class mechanism

`npx arthur decisions --classes`:

| Class | State | Match | Backed by | Answered |
|---|---|---|---|---|
| AR-D62 | closed | budget "core line budget" (security) | AR-D61 | — (its decision named one ticket) |
| AR-D63 | approved 10-26 | budget "core line budget" (security tickets) → "Raise the core line budget by what the fix needs, without asking the owner" | AR-D61 | 17 |
| AR-D74 | revoked 10-28 | merge "passed review" (security tickets) | AR-D73 | 23 |
| AR-D218 | approved 10-28 | merge "passed review" (any kind) → "Merge a ticket once its review passed, without asking the owner" | AR-D217, AR-D73 | 45 (every merge ask since; 45 of 45) |

Four structural problems, each visible in the log:

1. **Classes are too narrow by construction.**
   - `class propose` adds the ticket kind when every backing decision's ticket shares it (decision.md:65). A class backed by one decision is therefore always scoped to one kind.
   - AR-D74, from AR-D73's security ticket AR0441, covered only security merges. Non-security merges went out "under AR-D73" by hand (AR-D80, AR-D88, AR-D90, AR-D91, AR-D93) until AR-D216/AR-D218 widened it two days later.
   - AR-D63 covers "core line budget" in security tickets only, while the owner's word was general: AR-D29 says "in the future if this is necessary … do it by yourself".
   - Since AR-D63 (2026-10-26 14:16), 47 line-budget asks were made. Only 17 went by policy; 24 were answered "under the owner standing word AR-D61" and 6 by the owner. These were mostly delivery, plus orchestration, develop and voice.
2. **Matching is a bag of words over free text the coordinator itself writes.** `decision-classes.ts:46-47` (`words(ask.question)` must hold every word of the match). This caused:
   - 12 merge asks phrased "Merge X after its PASS?" missed AR-D74 and were closed when the merge went in (AR-D145 to AR-D176, 2026-10-27 08:04–10:51).
   - AR-D182 was closed and re-asked as AR-D183 "in the policy class words".
   - AR-D205 is a **false match**: "Docs only, so no review ran; checks passed". The class needs only the words "passed" and "review", so AR-D74 answered "Merge a ticket once its review passed" for a branch that had no review.
3. **`--decided` must equal every backing decision's decided text** (decision.md:67, 95). The coordinator writes a specific line each time, so the shapes repeated most cannot back a class without a fresh owner answer:
   - 31 second-FAIL "another round" decisions;
   - 25 line-budget raises recorded under standing words;
   - 44 ticket approvals.
4. **Option texts are free too.** Grouping asks by kind plus normalised options gave these counts of distinct option phrasings:
   - merge: 6 phrasings;
   - budget: 14 groups (32 literal option lists over 55 asks).

   Only delivery's review-limit procedure fixes its option texts (`review-limit.md:10`: `--option 'Another round' --option 'Fix or split the ticket' --option 'Drop the branch'`). It is the cleanest group: 26 asks in one shape.

### 1.3 Top repeated decision shapes

| # | Shape (question pattern) | Count | How answered | Agreement | Example ids | Existing class | Make it… |
|---|---|---:|---|---|---|---|---|
| 1 | Merge `<ticket>` after a PASS ("passed review: merge it?") | 96 | policy 67, standing 7, owner 10, closed 12 | 17/17 | AR-D55, AR-D73, AR-D145, AR-D221, AR-D334 | **AR-D218** (since 10-28, 45/45) | Covered. Code fix: match the review verdict, not the words (fixes AR-D182, AR-D205) |
| 2 | Raise a package's line budget for `<ticket>` | 52 (49 budget, 3 job blocks) | policy 17, standing 25, owner 10 | 31/31 | AR-D29, AR-D61, AR-D66, AR-D159, AR-D306, AR-D321 | AR-D63 (core, security only) | **Class**: budget "raise line budget", any kind. Needs one fresh answer, since decided texts differ. A first budget for a new package stays with the owner (AR-D262: "too much lines", 300 refused → AR-D264: 246) |
| 3 | "Approve `<ticket>` as written?" | 44 | batch 26, standing 16, direct 2 | 44/44 | AR-D6, AR-D22, AR-D124–AR-D141 | none; autopilot excludes `security` and >3 Scope files | **Not a class.** 34 of 44 came from findings, and the owner cut that inflow twice (AR-D53, AR-D233). Fix the source (issue 2.1); allow one decision for a list of tickets |
| 4 | Second FAIL: another round / fix or split / drop | 31 (19 tickets) | owner 18, standing 13 | 31/31 (28 "another round") | AR-D14, AR-D157, AR-D245, AR-D265, AR-D316 | none | **Code default** in delivery's review limit. The owner said so in AR-D265: "and further rounds without asking until it is ready to merge". Auto round 3 when the FAIL is test-only or smaller; ask on the same finding twice or round 5+. A class cannot hold it: 3 of 31 were split or fix (AR-D17, AR-D19, AR-D243) |
| 5 | Approve and order the queue (which first, groups Q1–Q5) | 23 | owner 22, standing 1 | 20/22 | AR-D35, AR-D198, AR-D213–AR-D215, AR-D259, AR-D330 | none | **Keep human.** These are the owner's priorities; AR-D97, AR-D198 and AR-D199 overrode the coordinator |
| 6 | Autonomy bounds: work alone until X; usage window "start now or wait" | 12 | owner 6, standing 6 | 8/11 | AR-D11, AR-D31, AR-D142, AR-D199, AR-D270, AR-D300, AR-D326 | none | **Code**: a bounded delegation record (silent on + answer-by-recommendation + a usage %, time or ticket stop). It would replace the 86 standing answers |
| 7 | Plan approval | 10 (+2 budget re-asks of an approved plan: AR-D332, AR-D335) | owner 10 | 9/9 | AR-D64, AR-D203, AR-D327, AR-D328 | none | **Keep human** for the plan. **Code default**: a budget the approved plan names needs no new ask |
| 8 | Accept the worker's deviation from the Done means (stricter or different) | 10 | standing 10 | 9/9 | AR-D101, AR-D113, AR-D292, AR-D318, AR-D322 | none | **Prose** in review criteria: "stricter than asked and meets the point" passes without the owner |
| 9 | Merge a docs-only ticket that had no review | 7 | owner 4, closed 2, policy 1 (false match AR-D205) | 4/4 | AR-D179, AR-D180, AR-D202, AR-D204 | none (AR-D218 needs "passed review") | **Class** merge "docs only", or code: review-needed's `no review` counts as the PASS for AR-D218 |
| 10 | Provider refusal (cyber) or failure: hold, continue once, or replace | 7 | owner 4, standing 3 | 7/7 | AR-D152, AR-D177, AR-D185, AR-D246, AR-D299 | none | **Class** job "provider refusal" → "continue the worker once on the same task" (the owner's AR-D177, AR-D178, AR-D299). Second refusal goes to the owner |

Also repeated, below the top 10:
- **Restart around merges**: 7 asks (AR-D12, AR-D45, AR-D52, AR-D58 …). The owner ruled in AR-D12: use `--ignore-restart`, one restart when the work stops.
- **200-line file**: 4 asks. The owner always picks "split into files" (AR-D170, AR-D262, AR-D302: "remember to create a sepparated files to each group of functionallity").
- **Findings policy**: 4 asks (AR-D53, AR-D233, AR-D65, AR-D67).
- **A job's money budget**: 3 asks (AR-D4, AR-D303, AR-D312).
- **Ask before installing or pruning on the host**: AR-D256, AR-D257, AR-D263, AR-D309.
- **Report style**: AR-D298, kept as a standing rule in the handoff.

Before the log started (2026-10-16 to 10-24), ticket Decisions lines record the same owner rulings:
- "AR tickets need no approval (the owner, 2026-10-16)": AR0004–AR0025 and AR0094, 23 lines.
- "owner delegated Arthur calls", for budget raises: AR0122, AR0123, AR0153.
- "small findings in batches": AR0151, AR0154.

So **ticket approval and budget raises were delegated before the log and re-asked inside it**: 44 and 52 asks.

---

## 2. Top 10 recurring issues agents hit

| # | Issue | Count and examples | Layer that removes it |
|---|---|---|---|
| 1 | **Findings turn into tickets, in chains** | See 2.1 | **Codebase** |
| 2 | **Line budgets: conflicts, blocks and asks** | See 2.2 | **Codebase** (and a class) |
| 3 | **Second-FAIL loops on the shell guard, and missing test rows** | See 2.3 | **Codebase** for the guard; **static analysis** for missing tests |
| 4 | **Autonomy held in the coordinator's memory** | See 2.4 | **Codebase** |
| 5 | **Policy classes miss or match wrongly** | See 2.5 | **Codebase** |
| 6 | **Restart after every code merge** | See 2.6 | **Codebase** |
| 7 | **Jobs killed by the provider or the infrastructure** | See 2.7 | **Codebase** for connection errors; **human** for the second cyber refusal |
| 8 | **The review steer is re-sent by hand** | See 2.8 | **Prose → one role**, then **codebase** |
| 9 | **Usage windows set and overridden by hand** | See 2.9 | **Codebase** |
| 10 | **Coordinator bookkeeping dominates history** | See 2.10 | **Codebase** |

### 2.1 Findings turn into tickets, in chains

**Count and examples:**
- 374 of 560 tickets (67%) carry `Source: F<n> of <ticket>`.
- 198 of the 220 security tickets came from findings.
- Chains reach 4 deep: AR0304←AR0298←AR0274←AR0260←AR0256 and AR0400←AR0394←AR0382←AR0330←AR0320.
- 55 of 58 dropped tickets came from findings.
- 733 findings since the start (`arthur retro-due`).
- The owner ruled twice. AR-D53: "Ticket only real risks". AR-D233: "change the work so findings stop becoming new tickets". Finding tickets per day went 53 (10-27), 11 (10-28), 0 (10-29).

**Layer: codebase.** The findings plugin's `onMerge` should default to `deferred (client summary)` (61 findings already settled that way). A ticket would be made only on an explicit promote. Today the triage sits at the human-review tip.

### 2.2 Line budgets: conflicts, blocks and asks

**Count and examples:**
- 52 decision asks.
- 102 commits since 10-25 touch `test/structure.test.ts`, and 218 commit subjects mention a budget.
- Audit `spec/quality/2026-10-27.md` §2: "59 of 90 `Merge branch 'main'` commits had to resolve `test/structure.test.ts` by hand". AR0475 and AR0478 were fixed afterwards.
- 3 of the 6 workers that blocked on the owner since 10-25 asked for a budget (AR-D29, AR-D274, AR-D287). A fourth asked about the 200-line cap (AR-D169).

**Layer: codebase**, plus one class.
- `arthur merge` would record the raise in the branch's diff as the ticket's Decisions line ("a raise is a decision recorded in the ticket", styleguide:13). The ask would remain only for a new package's first budget.

### 2.3 Second-FAIL loops on the shell guard, and missing test rows

**Count and examples:**
- 31 second-FAIL escalations over 19 tickets.
- 19 of the 31 are guard or bash-parsing tickets:
  - AR0496: 6 FAILs, then a $5 and a $3 budget raise (AR-D303, AR-D312);
  - AR0333, AR0471, AR0493: 4 FAILs each;
  - AR0420, AR0335: 3 each.
- 17 of the 31 questions say the FAIL was only about untested code. Examples: AR-D219 "each time only because its test misses characters"; AR-D316 "on test coverage only (the code works)".
- `worker.md:20-21` already demands a test for each refusal, checked by breaking it.
- Security tickets took 75 of 108 FAILs (603 reviews).

**Layers:**
- **Codebase** for the guard. Refuse what is unknown rather than emulate bash; this is what ended the loops: AR-D157 "refusal instead of emulation", AR-D243, AR-D245 "allow-list".
- **Static analysis** for the missing tests: a mutation-style check of the new refusals in `npm run check`, today done by hand by reviewers ("I changed `/^[a-z]{2,3}$/` … and the voice tests still passed", AR0550 review-1).
- The prose already exists and is not followed. FailMiner covers the details.

### 2.4 Autonomy held in the coordinator's memory

**Count and examples:**
- 86 answers (26% of all) were recorded "under the owner's standing word".
- They come from 11 grant messages, each with a time, usage or scope bound (1.1).
- Expiry is tracked by hand: handoff:22.

**Layer: codebase.**
- A bounded delegation would answer an ask with its recommendation, by policy (`by recommendation: AR-D271`), until silent goes off or its stop condition is met.
- Silent already holds "the work; its stop condition" (`silent.md:8`) but answers nothing.

### 2.5 Policy classes miss or match wrongly

**Count and examples:**
- 12 merge asks closed unanswered, AR-D145–AR-D176.
- 1 re-ask in the class's words (AR-D182).
- 1 "worded wrongly" (AR-D201).
- 1 false match (AR-D205).
- 24 line-budget raises (6 more answered by the owner) and 6 non-security merges answered by standing words outside the classes (1.2).

**Layer: codebase.** Match a class on structured facts: the review verdict, the package, the `--what` flags, the ticket kind. Do not match on the coordinator's prose. Allow a class decision of "the recommended option".

### 2.6 Restart after every code merge

**Count and examples:**
- The session restart guard refuses spawns after a code merge.
- The coordinator spawns with `--ignore-restart` (AR-D12) and restarts through `systemd-run --user --on-active=10 --unit=arthur-day-restart-47 …` (handoff:29, "Next restart unit 47").
- 155 of 434 coordinator replies mention a restart.
- 75 `coordinator up on agent` notices in 4.5 days.
- Merge asks carried "(restart after)" (AR-D58, AR-D59, AR-D68).

**Layer: codebase.** Session restarts itself once a restart is due and no job runs. Today this is a human and coordinator chore.

### 2.7 Jobs killed by the provider or the infrastructure

**Count and examples:** events since 10-25:
- 16 jobs ended at their budget (13 workers, 3 reviews).
- 7 `Connection error.`.
- 4 `Refusal (cyber)`.
- 5 `agent exited`.
- 3 reviews with no verdict line.
- 1 aborted.

Handoff:26: "Provider connection errors kill jobs: continue workers, re-run reviews". Handoff:27: "A job end can arrive again after a restart".

Decisions: AR-D152, AR-D153, AR-D177, AR-D178, AR-D185, AR-D246, AR-D299.

**Layers:**
- **Codebase** for connection errors: one automatic continue or re-run.
- A **class** for the first cyber refusal ("continue once").
- **Human** for the second.

### 2.8 The review steer is re-sent by hand

**Count and examples:** handoff:24 is a fixed text the coordinator sends to every review:

> "Run npm run check and npm test in one bash call with the bash timeout set to 1800 seconds … If a timing test in packages/core/test/limits.test.ts fails, run that file alone … Never stop another job process (no pkill -f on npm test). Never end your turn before your verdict; the last line … PASS or FAIL alone."

- `worker.md:19` has the 1800 s rule; `reviewer.md` has no timeout line.
- 3 reviews failed with "no verdict".
- 32 replies mention flaky or timing tests (AR0423, AR0448 and AR0544 were flaky-test tickets).

**Layers:**
- **Prose → one role.** Move the text into `reviewer.md`.
- Then **codebase**: give the review the merge-check results; stabilise `limits.test.ts`.

### 2.9 Usage windows set and overridden by hand

**Count and examples:**
- 12 asks.
- Caps of 60, 85, 88, 99 and 33%.
- The owner overrode the "wait" recommendation 3 times (AR-D199, AR-D300, AR-D326).

**Layer: codebase.** Silent's stop condition gets a usage % read from the models plugin (`/usage`). The coordinator's recommendation defaults to "go on" inside the bound.

### 2.10 Coordinator bookkeeping dominates history

**Count and examples:**
- 584 of 956 non-merge commits since 10-25 (61%) touch only `spec/`: board, decisions, review filing, outcome, findings.
- The coordinator settles each merge with throwaway scripts (handoff:9: "`/tmp/settle557.py, /tmp/settle554.py`").
- One owner list approval became 18 decision records (AR-D124–AR-D141).

**Layer: codebase.** `arthur merge` settles findings by the AR-D233 rule. Add one decision for a list of tickets.

### 2.11 Side notes

- `[INFERENCE]` Since 2026-10-26, every `outcome.md` records `npm test: 1232/1300 passed`-style counts with status 0: 104 merges with about 68 tests not passing. `merge-checks.ts:104-106` prints `pass/total` and calls the step passed on exit 0, so these are most likely skipped tests in the merge environment. I did not run the suite to confirm. If they are skips, about 5% of the suite never guards a merge. That is a static-analysis gap: the merge check could fail on unexpected skips.
- **No retro has ever run.** There is no `spec/retro/`. `arthur retro-due` prints: "retro due: 417 merges, 108 FAIL reviews and 733 findings since the start (no retro yet)". The handoff says "retro only if he asks", and `arthur.config.ts:51` schedules Fridays 22:30 with a $5 budget. The first retro's prompt would list 417 ticket folders, so it needs the compressed digest that command B gives.
- **Pre-log prose the code now covers:**
  - Handoff:3: "Never write an at-sign directly before a file path in anything that reaches a job". AR0532 and AR0537–AR0539 now insert word joiners.
  - Handoff:3: "Never write the env file's dotted name in a bash line". The secrets guard refuses it.

  Both are dead prose candidates, which is exactly what a pyramid audit should flag.

---

## 3. Two commands

Shared ground. Both live in the **manage** plugin, which owns the look-back tools (`stats`, `retro-due`, `retro`, the `audit` kind, `report-file.ts`). Both reuse:
- `fileReport` and `page()` (`packages/manage/src/report-file.ts:10,17`), via a new `Reports` constant each;
- `registerRole`/`registerKind` with `readOnly: true`, and a `prompt` provider, exactly as `retro.ts:20-22` does;
- the `coordinator.wake` procedure pattern (`retro.ts:23-24`);
- the phone command registration (`retro.ts:41`).

They add no runtime dependency and no new workflow state: the board stays the one state, and reports are files under `spec/`.

### A) `arthur pyramid`: move each correction up the pyramid (codebase > static analysis > prose > human review)

**Invocation**
- CLI: `arthur pyramid [--project <name>] ['<focus>']`. It spawns one read-only job and prints `pyramid: started job <id>`. Refused, exit 1, for a project with no board (`arthur init <project>` first, as `coordinator.md:31` says) or one already running for that project. Wrong usage exits 2.
- Phone: `/pyramid [<project>] [<focus>]`. It answers the same line, and the page comes back when the job ends.
- From conversation: one line in `coordinator.md`. "When the owner asks how to make agents work better in a project, or for a pyramid / inverse-pyramid audit, run `arthur pyramid --project <p> '<his focus>'`. For the main project, add your handoff's Standing rules to the focus; they are your own corrections."

**What it spawns:** kind `pyramid`, role `pyramid` (`packages/manage/roles/pyramid.md`), criteria `pyramid` (`packages/manage/criteria/pyramid.md`, written by `arthur init` like `audit.md`). It runs in a detached checkout of HEAD; budget `pyramid.budgetUsd`, else `jobs.budgetUsd`.

**Inputs.** The prompt section is `## This pyramid audit`, built deterministically from the checkout:
1. **Corrections ledger**, the human-review and prose catches:
   - every FAIL `review-N.md` and the first line of each finding, reusing `stats.ts`'s FAIL-findings reader;
   - open and deferred `findings.md` entries;
   - the decision digest of command B (`call("decision.repeats")`): repeated shapes, owner overrides, standing grants;
   - each `blocked: user` question;
   - the steers still in job records. Steers live in `<home>/jobs/<id>/steer/done/` (`steer.md`) and go with the record at prune (`prune.keepJobsDays` 14), so only live ones show; the coordinator's focus carries the rest.
2. **Prose inventory**: the role, procedure and criteria files the plugins ship (reuse `retro.ts` `shipped()`), plus the project's own `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.claude/rules/`, `CONTRIBUTING.md` and styleguide when present, with line counts.
3. **Static inventory**: `package.json` scripts, `.github/workflows/*.yml`, lint and type configs (tsconfig `strict` flags), the structure test, test counts.
4. **Board digest**, so no proposal repeats a ticket.

For a codebase with no Arthur history, item 1 says `none recorded`. The job then audits prose against static analysis against code from the repository and its git log (fix-up commits, "address review" commits): this is the "any project" case of the owner's request.

**Output**
- The final message: first `## Layers`, how many corrections were caught at each layer today. Then up to 10 proposals, each:
  - `## <n>. <title>`
  - `Corrections:` ids or files, one per line
  - `Now at: human review|prose|static analysis`
  - `Move to: codebase|static analysis|prose`
  - `Change:` the type, invariant, test, lint or CI check, or code default
  - `Dead prose:` the sentence it makes removable (file:line)
  - `Before:` / `After:`
  - `Kind:`, `Scope:`
- Filing: `arthur ticket file <job>` writes `spec/pyramid/<date>.md` and `<date>.html`, the before/after page. The constant is `PYRAMIDS = { folder: "spec/pyramid", title: "Pyramid", commit: "Commit audited", page: true }`.
- Procedure `packages/manage/roles/coordinator/pyramid-ended.md`, as the owner asked ("prepare a task with all the suggestions"):
  1. File the report.
  2. Create **one** `planning` ticket, `Pyramid <date>: move <n> corrections up`, with every proposal in its Scope and `Source: pyramid spec/pyramid/<file>.md`. No autopilot.
  3. Make one commit, push, then `arthur send <page>`, `arthur prune <job>`.
  4. Reply `pyramid done: 1 ticket, <n> proposals`.

**Where and how big** (manage plugin):

| File | Size |
|---|---|
| `src/pyramid.ts` | ~95 lines: role, kind, prompt builder, command and phone |
| `src/report-file.ts` | +2 (PYRAMIDS) |
| `src/manage.ts` | +2 |
| `src/manage-options.ts` | +6 (`pyramid.budgetUsd`) |
| `roles/pyramid.md` | ~55 |
| `roles/coordinator/pyramid-ended.md` | ~12 |
| `criteria/pyramid.md` | ~35. The four layers; "a correction caught twice at a lower layer moves up"; "a prose line the code now enforces is dead" |
| `docs/commands/pyramid.md` | ~30 |
| `docs/manage.md` | +15 |
| `arthur init`'s criteria list | +1 |
| `coordinator.md` | +1 |
| `test/pyramid.test.ts` | ~100 |

Code totals about +105 lines on manage's budget (931 → ~1036). Roadmap: next free entry, 103.

**How it differs from audit and retro**
- The **audit** looks for bugs in commits since the last audit and ranks by the vision. It never reads decisions, steers or the prose inventory (`grep decision packages/manage/{src,roles,criteria}` finds nothing).
- The **retro** reads FAILs and findings, but its role forbids code ("Never propose a change to code", `roles/retro.md:54`). It can only move a correction *down* to prose.
- The pyramid is the inverse: it takes every correction and the prose itself, and proposes moving each *up* to a check or to the code, deleting the prose it replaces.

**Mode of audit, or its own kind? Recommendation: its own kind, sharing the helpers.** Four of the audit's five parts would have to branch:
1. **Role:** auditor.md versus pyramid.md.
2. **Criteria:** audit.md versus pyramid.md.
3. **Procedure:** the audit's procedure makes one ticket per proposal and autopilots bug and cleanup tickets; the pyramid makes one ticket and never autopilots.
4. **Report folder.** This one is concrete: the next audit's commit range starts at "the newest report in `spec/quality/` … with a `- Commit audited:` line" (manage.md:61). A pyramid filed there would make the nightly audit skip every commit before it.

A mode would be a second kind in disguise. What is shared is already a helper: `fileReport`, `registerKind`, `shipped()` and `stats()`. That makes this the third read-only lens kind, past the styleguide's "second example". The one stopgap available today, `arthur spawn --kind audit 'pyramid: …'`, has exactly that range bug and gets none of the corrections in its prompt.

### B) `arthur repeats`: the decisions retro (repeated decisions and recurring issues → classes and tickets)

**Invocation**
- CLI, deterministic: `arthur repeats [--project <name>] [--since <date|AR-D id>]`. Answered without the model, read-only, like `arthur stats` and `retro-due`. It prints the digest as Markdown.
- CLI, with a job: `arthur repeats --retro ['<focus>']`. It spawns the **existing** `retro` kind with the focus `decisions: <focus>`; the digest is in its prompt.
- Phone:
  - `/repeats`: the digest as an HTML page through the channel's `channel.send`, written only to manage's own folder (`.arthur/manage/repeats-<date>.html`, styleguide:16).
  - `/repeats retro [<focus>]`: spawns the retro and answers `retro: started job <id>`.
- From conversation: one line in `coordinator.md`. "When the owner asks what repeats, what his agents keep hitting, or for a decisions retro: `arthur repeats` and send its page. When he wants proposals: `arthur repeats --retro '<his focus>'`."
- The retro's weekly schedule also gets the digest by itself, through the prompt section below.

**What it computes** (deterministic, from project files in Git plus one provided name). orchestration provides `decision.entries`, the parsed log via `decision-log.ts`, about 5 lines, so manage does not parse a second time; this reuses the `call("delivery.alwaysReview")` pattern.
1. **Decisions by kind × source**: policy, owner, standing grant, closed. Standing means the owner's words equal an earlier answer's words, or name another id.
2. **Repeated shapes**: group by kind plus the normalised options (ids, numbers and parentheses stripped; the first 2 words of each option), then the question's first 4 words when there are no options. On this log that gives the shapes of §1.3: 46 + 28 + 21 + 7 merges, 27 + 18 approvals, 26 second-FAILs, 20 + 8 + 5 + 4 + 3 + 3 budget asks.

   For each shape with 3 or more asks, it prints:
   - the count, sources and picked-option split;
   - the agreement rate;
   - example ids;
   - the class that covers it, by `byPolicy`'s own rule;
   - a candidate, either a ready line `arthur decision class propose --kind <k> --match '<words common to every question>' --decided '<decided>' --backed-by <ids>` when 3 or more share the decided text, or `decided texts differ: one fresh owner answer backs a class` (shapes 2 and 9);
   - `code default` when the picks split, so no class fits (shape 4: 28 "another round", 3 other).
3. **Standing grants**: each grant, the answers under it, and their kinds (1.1's table).
4. **Owner overrides**: answers whose pick is not the recommended option (the 8 of §1.1).
5. **Recurring issues** from ticket history:
   - `Source: F<n> of` chains: share and maximum depth;
   - tickets with 2 or more FAIL reviews, and second-FAIL asks per ticket;
   - `blocked: user` questions by cause (budget, file size, wording);
   - budget raises per package;
   - drops by source.

   `[INFERENCE]` Job end reasons too, if manage may read the event stream through the host as health does; otherwise they are left out.

**Output**
- `arthur repeats`: stdout only.
- `/repeats`: the page.
- `--retro`: the existing retro filing, `spec/retro/<date>.md` and `.html` (`arthur retro` and `/retro` already send it), and planning tickets. The retro gets three small additions:
  - `retro.ts` `context()` gains `### Repeats`, the digest of the period (+4 lines).
  - `roles/retro.md` and `criteria/retro.md` each gain one paragraph: "a decision shape the owner or a grant answered the same way 3 or more times is a pattern. Propose a class (`Kind: class`, with the ready command from the digest), or, when no class fits, a code default as a ticket (`Kind: chore`, its Scope the file)". This lifts the "never code" rule for decision-backed defaults only.
  - `retro-ended.md` gains one step: a `Kind: class` proposal becomes `arthur decision class propose …` and an ask naming its id and agreement rate, never a ticket.

  On today's data, the first run would propose the classes for shapes 2, 9 and 10, and code defaults for 4, 6 and 7, plus the issues of §2.

**Where and how big:**

| File | Size |
|---|---|
| manage `src/repeats.ts` | ~120 lines: grouping, grants, overrides, chains |
| manage `src/repeats-command.ts` | ~60: command, phone, page, `--retro` spawn |
| manage `src/retro.ts` | +4 |
| `roles/retro.md`, `criteria/retro.md`, `roles/coordinator/retro-ended.md` | +1 paragraph or step each |
| `docs/commands/repeats.md` | ~40 |
| `docs/manage.md` | +10 |
| orchestration `decision-commands.ts` or `decision-hooks.ts` | +5 (`decision.entries`) |
| `coordinator.md` | +1 |
| `test/repeats.test.ts` | ~120, over a fixture log with the AR-D205 false match and a grant |

Code totals about +185 on manage (→ about 1120 with A as well) and +5 on orchestration. Roadmap: entry 104.

**How it differs from what exists**
- **`decision class propose`** needs the coordinator to notice a repeat by hand. In 335 decisions it made 4 proposals, each backed by 1–2 decisions and taken from the owner's explicit "don't ask" words, not mined. The 86 standing answers show where classes were missing.
- **`arthur decisions`** lists or searches one log. Its positional words are a search, so `arthur decisions repeats` would be a search for "repeats".
- **`arthur stats`** covers merged tickets' rounds and cost only.
- **The retro** never reads the log (no `decision` in manage), and has never run: its first period is 417 merges.
- **The audit** judges code since the last audit.

**Mode of retro? Recommendation: yes, the job part is a mode of the existing retro** (same kind, role, filing, page and procedure, one prompt section). Only the deterministic digest is new. It gets its own command name rather than a flag, because:
- `arthur retro` today prints the newest page's path and takes no words (`docs/commands/retro.md:12`). `/retro` sends the page, and tapping it must not start a $5 job.
- The digest needs the decision log *and* the ticket history, which neither `arthur decisions` (orchestration, one log) nor `arthur stats` (merged tickets) covers.

If the owner prefers fewer names, the fallback is `arthur decisions --repeats`, with `/retro start` for the job. The cost is a phone command for the digest that only orchestration could own, splitting history mining across two plugins.

### Summary of the recommendation

- **A (pyramid):** a new kind in manage. It is not an audit mode, because of the `spec/quality` commit-range clash plus a different role, criteria and procedure. It shares the report, kind and prompt helpers.
- **B (repeats):** a deterministic command in manage, plus a **mode of the existing retro** (one prompt section, one role and criteria paragraph, one procedure step for classes). It is not a new job kind.
- **Tickets worth filing regardless of the commands:**
  - class matching on structured facts (AR-D205, AR-D182);
  - bounded delegation (86 standing answers);
  - restart when idle;
  - line-budget raises recorded by merge;
  - findings deferred by default (374 tickets from findings);
  - the review steer moved into `reviewer.md`.
