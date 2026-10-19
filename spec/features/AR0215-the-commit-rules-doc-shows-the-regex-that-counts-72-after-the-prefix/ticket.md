# AR0215 - The commit-rules doc shows the regex that counts 72 after the prefix

```json
{
  "id": "AR0215",
  "title": "The commit-rules doc shows the regex that counts 72 after the prefix",
  "date": "2026-10-19"
}
```

## Description

Since AR0200 the example config's commit regex counts the whole subject, but the commit-rules doc still shows the old one, which lets a subject of about 90 characters through. A reader who copies the doc gets the wrong rule.

## Goal

The regex example in `packages/commit-rules/docs/commit-rules.md:7` refuses a subject over 72 characters in all, prefix included: `^(?=.{1,72}$)(feat|fix|docs)(\([\w-]+\))?!?: .+$`, as `arthur.config.example.ts` has.

- Kind: cleanup

## Done means

- The doc line shows the lookahead regex; a throwaway check shows a 72-character subject passes and a 73-character one is refused. Text only, no permanent test.

## Scope

- `packages/commit-rules/docs/commit-rules.md` only; `spec/vision.md` waits for the owner's word.

## Decisions

- 2026-10-19: Source: F1 of AR0200. Approved under the owner's word of the same day: findings are built in batches. The same line in spec/vision.md waits for the owner's word.
