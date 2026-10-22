# AR0280 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The coordinator's role has no rule for a night answer, which orchestration/night-one-line measures

- Kind: gap
- Found by: 2026-10-22-ar0280-eval-scenarios-4e8abbcc (worker), 2026-10-22
- Where: `packages/orchestration/roles/coordinator.md` ("Final message"); `arthur.config.example.ts` (`quietHours`: "the coordinator answers in one line")
- What: the predecessor's role said "Keep night replies to one line"; Arthur's role says nothing about night replies, though the example config promises it. The scenario `orchestration/night-one-line` (roadmap 68) expects a one-line reply at night, so it measures a rule the coordinator is never given.
- Suggestion: one line in the role's Final message: at night (the context's `## Time` says so), the reply is one line. Out: the context's time in an eval run (AR0279).
- Status: open

## F2. A plugin's wake lines for a review or an onboarding cannot reach an eval's turn, even once AR0277 words it

- Kind: gap
- Found by: 2026-10-22-ar0280-eval-scenarios-4e8abbcc (worker), 2026-10-22
- Where: `packages/delivery/src/delivery.ts` (`coordinator.wake`, from `readReview`), `packages/projects/src/onboarding.ts` (`questions`, from `host.jobs.result`)
- What: these providers build their line from the job's records in the live home (delivery's review record, the job's result). An eval's job exists in no home, so `review-pass`, `review-pass-hook`, `review-fail-handed-back` and `onboarding-questions` get no verdict line, no `arthur merge --auto` hint, no hand-back line and no `Its questions to send the owner` line. AR0277 (one wording of the turn, from orchestration) would still ask the same providers.
- Suggestion: the providers take what they need from the wake's data (the verdict, the branch, the result), or a scenario names the records its fixture holds for them; then drop those scenarios' `needs`.
- Status: open

## F3. The eval stub answers a command's --help with that command's scripted result

- Kind: bug
- Found by: 2026-10-22-ar0280-eval-scenarios-4e8abbcc (worker), 2026-10-22
- Where: `packages/develop/src/eval-stub.ts`
- What: in the real run of `delivery/check-failed`, the coordinator ran `arthur merge --help` and the stub's `^arthur merge ` answer printed the failed merge, so it never ran the merge itself (3 of 3 runs). This branch keeps every shipped answer off `--help` (`^arthur (?!.*--help)…`), but a new scenario can fall into it again.
- Suggestion: the stub never answers a call with `--help` or `help <command>` from the scenario's answers; with AR0278 it prints the command's page.
- Status: open
