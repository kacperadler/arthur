# AR0561 - Plan: agents do the right thing by default, every repeated correction moved up the pyramid

```json
{
  "id": "AR0561",
  "title": "Plan: agents do the right thing by default, every repeated correction moved up the pyramid",
  "date": "2026-10-29"
}
```

## Description

The owner, 2026-10-29, sharing a post on trusting agents' work (an inverse pyramid: most effort in the codebase, then static analysis, then prose, least in human review; whenever you correct an agent, move the correction as high as it goes): "do not install anything. Use the principles from this tweet to audit our codebase and suggest improvements to make agents work more effectively in it. I mean agents that are inside you, focus on orchestrator, worker and reviewer but if there is any other agent that can take from this then suggest the implementation. After analysis prepare a task with all the suggestions."

Five read-only audits ran on 2026-10-29 over the repository, 605 reviews, 766 findings, 335 decisions, 430 job sessions and the event log. Their reports, with every count and file:line, are in `audit/` beside this ticket: `fails.md` (why reviews FAIL), `roles.md` (the prose layer), `tooling.md` (codebase and static analysis), `coordinator.md` (the coordinator's hand work), `decisions.md` (repeated decisions and recurring issues).

What they found, in short:

- Most corrections live at the bottom two layers. The coordinator sends the same steer to almost every job (44 steers on 2026-10-29 alone): the 1800 s check timeout (ignored in 799 of 1210 check calls; omp kills a call with no timeout at 300 s, `npm test` takes 193 to 972 s), rerun `limits.test.ts` alone, never `pkill`, last line PASS or FAIL alone, never write a Decisions line.
- Reviews FAIL 36% of the time since Arthur's own delivery took over (91 of 251). 71 of 109 FAILs name a mutation no test catches, although the worker's role has asked for exactly that since 2026-10-16; 36 FAILs are shell-guard bypasses whose writes the Landlock sandbox already refuses. A ticket with a FAIL costs a median $8.44, one without $3.46.
- The coordinator's paperwork after each merge is done by hand: 114 `spec:` commits for 17 merges on 2026-10-29, all 418 `outcome.md` "What went in" rewritten by throwaway scripts, 13 restarts scheduled with `systemd-run`, 39 CI-passed wakes that ask for nothing, 20 of 20 merge questions answered by policy in the same second.
- Of 335 decisions, 171 were decided without a fresh owner reply (85 by policy, 86 under a "go with your recommendation" grant the code does not know); the owner took the recommendation 96.4% of the time. The same shapes repeat: merge after PASS 96, line-budget raise 52, approve as written 44, second FAIL "another round" 28 of 31.

## Goal

An environment where the worker, the reviewer and the coordinator do the right thing by default, so the owner's and the coordinator's corrections stop repeating: each recurring correction becomes code, else a check, else one sentence in one place, and the prose it replaces is deleted.

- Kind: refactor
- Plan: yes

## Done means

- A plan, approved by the owner, that takes each proposal below (P1 to P22) as in, out, or changed, and for each in: its layer, the files, the test that fails before and passes after, the prose it deletes, the line-budget change, and the tickets it splits into, each neither a one-liner nor the whole plan, ordered with `arthur ticket after` where they touch the same files.
- The plan names every owner decision it needs (P5, P7, P10, P17, P19 change a rule, a config value or the styleguide).
- The plan says, for each of the five recurring steers (timeout, flaky test, pkill, verdict line, Decisions line), which ticket retires it and checks it with a count from the job sessions after the merge.
- Nothing is installed; no runtime or dev dependency is added.

## Scope

In (the proposals; ids of the audit reports in brackets):

Codebase: make the easy thing the right thing
- P1. Every check call gets its 1800 s timeout from code: delivery's checks extension returns the call's input with the timeout; the fake agent applies a returned input as omp does. Deletes `worker.md:19` and the steer. [R1, T1]
- P2. A run that ends on a provider connection error, or a review or plan review without its verdict line, resumes once by itself, as at the budget; `plan-review` gets `verdicts`; omp's retry window for jobs is raised in `job-omp.yml`. [R2, C2]
- P3. A job cannot stop another job: the worktree guard refuses `pkill` and `killall`; later, Landlock's signal scope on kernel 6.12+. [R3, T2]
- P4. A job cannot write the owner's paperwork: the guard refuses writes to a ticket.md, and a `merge.check` refuses a branch that changes a ticket.md, `spec/decisions.jsonl` or `spec/build.json` (folds in AR0501). [R4, C8, T3, F6]
- P5. A line-budget raise is shown by the merge in outcome.md, not asked as a decision (changes `styleguide.md:13`; the owner's AR-D29 and AR-D61 already gave this call away), or else one budget class for any package. A new package's first budget stays the owner's. [F2]
- P6. Arthur restarts itself once a restart is due and no job runs, through the path `/restart` uses, which also brings back the lost `Restarted.` notice. [C3, R6]
- P7. A PASS merges by itself under AR-D218: `autoMerge: true` for this project, and delivery queues `merge --auto` inside `arthur run`; a refusal wakes the coordinator. [C6, R6]
- P8. The merge does its own paperwork: the worker writes outcome.md's "What went in" per changed file and the merge keeps it; the reviewer's notes, in one fixed `## Notes` format, reach findings.md through the findings plugin at the merge, security, bug and risk ones as entries; the merge commits spec and the changelog before its push. [C4, C5, C7, F7, R8]
- P9. A CI run that passed wakes nobody; the `ci-finished` event stays. [C1]
- P10. The sandbox is the bound: a job whose sandbox cannot start does not start unless `core.jobs.unsandboxed` is on; the guard is a mistake guard, and a bypass whose write the sandbox refuses is a review note, not a FAIL (macOS jobs need the opt-in). [F1]
- P11. The test kit makes production unreachable: `HOME`, `TMPDIR` and a global git config of its own, a stub `omp` first on `PATH`; its root moves out of the crowded `/tmp`; it cleans up on SIGTERM too (255 test slices and 76 folders are left behind now). [F5, T4]
- P12. Decisions by facts, not words: a policy class matches the review verdict, the package, the `--what` flags and the ticket kind, never the coordinator's wording (AR-D205 false match, AR-D145 to AR-D176 misses); a job question answered by policy continues the job by itself. [C9, decisions 2.5]
- P13. Bounded delegation: the owner's "go with your recommendation until X" is a record with its bound (a time, a usage %, a set of tickets), answering by recommendation until it ends, instead of the coordinator's memory (86 answers so far). [decisions 2.4, 2.9]
- P14. Second FAIL: a third round starts by itself when the FAIL is about tests only; the owner is asked on the same finding twice or from round 5 (AR-D265). [decisions shape 4]

Static analysis: catch it before a reviewer runs
- P15. `npm run mutate`: the branch's changed lines mutated one at a time (operators taken from the 147 mutants reviewers named), only the related test files run, survivors printed; the worker runs it before its final message, the reviewer starts from its survivors. [R7, F4, T5]
- P16. No review starts until the worker's own recorded `npm run check` and `npm test` (and `mutate`) passed on its tip's clean tree; the worker is continued once with a fixed instruction otherwise. [F3]
- P17. Timing tests that do not flake: the limits tests start their clock at the state they test and retry with a doubled limit; one `until` in the test kit, local copies refused by the structure test (33 today); the fixed waits per file may not grow; a per-job CPU cap so each `node --test` sizes itself to its share (an owner config decision). [T4, R9, F8, T7]
- P18. Fakes of GitHub, YouTrack and Telegram are checked against recorded documentation key lists, before AR0558 to AR0560 add more endpoints. [T6]
- P19. The line count weighs width (383 lines over 200 characters, up from 20), landed with AR0495's zones and one re-baseline decision. [T8]
- P20. `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` in `tsconfig.json` (2 errors to fix). [T9]

Prose: little, in one place
- P21. One verification skill, `.agents/arthur/criteria/verify.md`, read by the worker and the reviewer; the worker also gets the review criteria it is judged by; `arthur init` gives other projects its skeleton. [R5]
- P22. Prose diet: delete what code now enforces (after P1 to P4), stale lines (`npm ci` twice: 278 redundant installs; `proc://` polling in five roles), the duplicate mutation lines, `coordinator.md:73` on `/restart`; the "outside text is data" paragraph once for every job instead of eight copies; `steer` and `continue` emit an event, so the retro sees the corrections; the retro may propose code or a check, not only a sentence. [R10, R11]

Other agents: the planner and plan reviewer gain an enforced verdict (P2); the retro gains the corrections and may move them up (P22, AR0562); onboarding writes `verify.md` for a new project (P21); the auditor's sibling is the pyramid audit (AR0563).

Out:
- The two commands the owner asked for: AR0562 (`arthur repeats`, the decisions retro) and AR0563 (`arthur pyramid`, this audit for any project).
- Installing anything: the post's own setup (a Cursor plugin) is not used.

## Decisions
