# AR0215 - The commit-rules doc shows the regex that counts 72 after the prefix

```json
{
  "id": "AR0215",
  "title": "The commit-rules doc shows the regex that counts 72 after the prefix",
  "date": "2026-10-19"
}
```

## Description

Two or three sentences: what changes, and for whom.

## Goal

The regex example in `packages/commit-rules/docs/commit-rules.md:7` refuses a subject over 72 characters in all, prefix included: `^(?=.{1,72}$)(feat|fix|docs)(\([\w-]+\))?!?: .+$`, as `arthur.config.example.ts` has since AR0200.

- Kind: bug | risk | cleanup | improvement

## Done means

- Observable result, and the test that proves it.
- `npm test` and `npm run check` pass.

## Scope

In:
- `path/to/file.ts`: what changes there.

Out:
- What this ticket does not do, and which ticket does.

## Decisions

- YYYY-MM-DD: one decision the human made, in one line.
- 2026-10-19: Source: F1 of AR0200. Approved under the owner's word of the same day: findings are built in batches. The same line in spec/vision.md waits for the owner's word.
