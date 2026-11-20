# AR0730 - A survivor may stay only when it changes no behaviour

```json
{
  "id": "AR0730",
  "title": "A survivor may stay only when it changes no behaviour",
  "date": "2026-11-20"
}
```

## Description

The worker role lets a mutant survive only when it changes no behaviour; a guard that is hard to reach gets a test by another way in, never a reason. Fewer review rounds are spent on security guards a worker left untested.

## Goal

`worker.md` lets a worker keep any survivor if it gives a reason. Twice, on security guards, the reason was "hard to reach", and each time it cost a review round. A check cannot judge whether a mutant is equivalent, so the sentence has to narrow what counts as a reason. The worker reads it before its final message.

Evidence:
- AR0699 review-1.md, findings 1–3: the worker's own table listed the config refusal, `--refmap=` and the `GIT_*` guards as survivors and handed the branch in anyway. Dropping `--refmap=` loses a local branch's commits.
- AR0699 review-3.md, finding 1: the worker said "no test can reach" the URL redaction rule. The reviewer reached it with one origin URL and showed a credential leaking without the rule.

- Kind: chore

## Done means

- The "Each new behavior..." line of `packages/core/roles/worker.md` reads as the After in Scope.
- `npm run check && npm test` pass (the role tests included).

## Scope

In:
- `packages/core/roles/worker.md`, the "Each new behavior…" paragraph under "How you work"

Before:
> - Each new behavior, every refusal and limit included, has a test that fails when the behavior is removed: once your work is committed, run `npm run mutate` in a bash call of its own (where the project declares it; else break each condition you add by hand), and give each mutant it names as `survived:` a test, or say in the final message why it stays. A fake of an outside service answers in the shape its documentation shows, every field included, not only the one your code reads.

After:
> - Each new behavior, every refusal and limit included, has a test that fails when the behavior is removed: once your work is committed, run `npm run mutate` in a bash call of its own (where the project declares it; else break each condition you add by hand), and give each mutant it names as `survived:` a test. One stays only when it changes no behaviour (the same output for every input: say in the final message what makes it equal); a guard that is hard to reach gets a test by another way in (an input that reaches it, a fake, a smaller function), never a reason. A fake of an outside service answers in the shape its documentation shows, every field included, not only the one your code reads.

Out:
- Any other role, criteria or script change of the retro: its own ticket.

## Decisions

- 2026-11-20: Source: retro spec/retro/2026-11-20.md
