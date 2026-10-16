# AR0058 - The styleguide forbids a plugin to read another plugin's folder, and voice reads the channel's saved file

```json
{
  "id": "AR0058",
  "title": "The styleguide forbids a plugin to read another plugin's folder, and voice reads the channel's saved file",
  "date": "2026-10-16"
}
```

## Description

AR0055 requires the channel to save files under `.arthur/<channel>/` and the voice plugin to convert that audio. Entry 81 words it as "reads only the file the part names", but a reviewer of the voice ticket can read the styleguide's rule as forbidding it.

## Goal

The rules let a media plugin read the file a channel saved for that part, which entry 49 hands to it, without opening any other plugin's state.

- Model: haiku
- Kind: risk

Evidence:
- `.agents/harness/criteria/styleguide.md` ("Each plugin keeps its own state in its own folder under `.arthur/`; it does not read or write another plugin's folder."), `spec/roadmap.md` entry 81
- Found by: 2026-10-16-ar0055-media-parts-and-v-0c085301 (worker), 2026-10-16

## Done means

- `.agents/harness/criteria/styleguide.md` line 16 and `review.md` line 20: add that a plugin may read a file whose path another plugin handed it in an event or a `collect` answer (a message part's `path`), and only that file; it still never lists, reads or writes another plugin's folder otherwise.
- `npm test` and `npm run check` pass. English only.

## Scope

In:
- `.agents/harness/criteria/styleguide.md`, `.agents/harness/criteria/review.md`.

## Decisions

- 2026-10-16: Source: F2 of AR0055
