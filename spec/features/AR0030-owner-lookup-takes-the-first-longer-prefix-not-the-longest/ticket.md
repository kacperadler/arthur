# AR0030 - Owner lookup takes the first longer prefix, not the longest

```json
{
  "id": "AR0030",
  "title": "Owner lookup takes the first longer prefix, not the longest",
  "date": "2026-10-16"
}
```

## Description

Two or three sentences: what changes, and for whom.

## Goal

A variable name is always attributed to the owner with the longest matching prefix, so a refusal names the right plugin or instance at any nesting depth.

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

- 2026-10-16: Source: F1 of AR0028
