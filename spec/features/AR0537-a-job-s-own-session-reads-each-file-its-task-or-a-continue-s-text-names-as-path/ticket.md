# AR0537 - A job's own session reads each file its task or a continue's text names as `@<path>`

```json
{
  "id": "AR0537",
  "title": "A job's own session reads each file its task or a continue's text names as `@<path>`",
  "date": "2026-10-28"
}
```

## Description

F2 of AR0532 (spec/features/AR0532-a-job-final-message-naming-path-makes-the-coordinator-read-that-file-into-its/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-96067971 (worker), 2026-10-27
- Where: `packages/core/src/wrapper.ts:89`; `packages/delivery/src/review-command.ts:83`; `packages/delivery/src/hand-back.ts:144`
- What: the wrapper starts a job as `omp -p ... @<record>/task`, and a continue as `omp --continue ... '<message>'`. omp 18.3.0's CLI (`processFileArguments`) puts the task file's content into the first message as `<file name="<path>">\n<content>\n</file>`, and print mode sends it with `session.prompt(text, { images })`, so the same `extractFileMentions` as in F1 runs over the task's whole text (read from the bundled source, not run: without an API key `#So` throws before it reads mentions). A review's task quotes the worker's final message under `## The worker's final message`, and a hand-back's continue quotes the review's final message, so an `@/etc/passwd` a worker or a reviewer writes makes the next job's omp read that file with the owner's rights, outside the job's sandbox. This is the case the reviewer of AR0487 reported. It is not this ticket's code path: the task and a continue's text go from the core's wrapper to omp's CLI, not through the coordinator's inbox; `steer.ts`'s `deliverAs: "steer"` takes `#Rs` and reads no mention. Seen once: `spec/features/AR0487-an-arthur-continue-instruction-that-starts-with-is-an-option-of-omp/review-1.md:26` says the reviewer's session had `/etc/passwd` attached, from the worker's final message its task quoted. Seen again on 2026-10-28 through a continue: the hand-back of review 2026-10-28-review-08853e13 quoted its findings, whose text named `/etc/passwd` as a mention right after a double quote, and this worker's continued session got the whole file attached after that message.
- Suggestion: escape as `hand-over.ts` does in the text the core hands to omp, once, in the core: the `task` file as the wrapper's spawn writes it and the message of `arthur continue` (`host.jobs.continue`), so every plugin's task is covered; a test runs the fake agent and checks the exact task and continue text. The escape would be a second copy of that pattern, as the styleguide allows before a third use; the core cannot import the orchestration plugin.

## Goal

A job's own session never reads a file because its task or a continue's text names it after an at-sign. Evidence: on 2026-10-28 the AR0532 worker's session got `/etc/passwd` attached when its continue quoted review 1's text; the wrapper (`packages/core/src/wrapper.ts:89`) hands the task file and a continue's message to omp, whose prompt path expands every at-sign path in it (F2 of AR0532).

- Kind: security

## Done means

- The core puts a word joiner before each at-sign omp would expand, once, in the task file the spawn writes and in the message of `arthur continue`, with the same pattern as `packages/orchestration/src/hand-over.ts`; a test with the fake agent checks the exact task and continue text, and fails without the escape.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/wrapper.ts` (or the spawn and continue code that writes the task and the message), a test in `packages/core/test/`.

Out:
- The coordinator's inbox (AR0532, done) and its handoff (AR0538).

## Decisions

- 2026-10-28: Source: F2 of AR0532
