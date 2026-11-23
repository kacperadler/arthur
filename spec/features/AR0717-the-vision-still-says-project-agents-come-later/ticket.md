# AR0717 - The vision still says project agents come later

```json
{
  "id": "AR0717",
  "title": "The vision still says project agents come later",
  "date": "2026-11-17"
}
```

## Description

The vision says an agent per project comes later, though AR0705 to AR0708 (roadmap 85 to 88) built it and the README describes it as built. After this, the two lines say project agents are built. It changes the owner's document, so it needs his word.

## Goal

Audits and plans rank work against the vision; it now says a feature already in the first version is still to come.

Evidence (audit 2026-11-17):
- `spec/vision.md:66`: the orchestration row says "Later, an agent per project with a `chat` … (roadmap 85 to 88)".
- `spec/vision.md:97`: "Project agents (roadmap 85 to 88) come before all of them, once the other projects have moved to Arthur."
- AR0705 to AR0708 are merged, and `README.md:32,34` describe project agents as built.

- Kind: docs

## Done means

- The orchestration row and the line on the order of the later plugins say project agents are built, matching the README.
- Nothing else in `spec/vision.md` changes.

## Scope

In:
- `spec/vision.md`: those two lines.

Out:
- The rest of the vision.

## Decisions

- 2026-11-17: Source: audit spec/quality/2026-11-17.md
- 2026-11-17: Source: F4 of AR0705
- 2026-11-23: AR0717 approved: the vision says project agents are built, budget $10; the owner: "PG-D177 PG-D178 AR-D703 AR-D704 AR-D705 AR-D706 AR-D707 KA-D37 yes" (AR-D707)
- 2026-11-23: Project agents are a later version, already built: vision row 66 says "Later, built", the diagrams and the roadmap keep them as the first later item, marked built; the owner: "AR-D712 1 arthur-ci-oom.sh - done KA-D39 1" (AR-D712)
