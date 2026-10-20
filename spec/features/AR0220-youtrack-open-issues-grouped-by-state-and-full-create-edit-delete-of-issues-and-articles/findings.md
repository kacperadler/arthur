# AR0220 - Findings

## F1. `youtrack-attachments.ts` now saves, adds and deletes attachments

- Kind: cleanup
- Found by: 2026-10-20-review-ar0220-youtrack-g-8b4e72c1 (review), 2026-10-20
- Where: `packages/youtrack/src/youtrack-attachments.ts`
- What: the file holds both saving an issue's attachments and adding or deleting one; one topic, a slightly broader responsibility.
- Suggestion: none; one file, one topic.
- Status: dropped (one topic, within the Shape rule)

## F2. README's command line changed though the Scope did not name it

- Kind: cleanup
- Found by: 2026-10-20-review-ar0220-youtrack-g-8b4e72c1 (review), 2026-10-20
- Where: `README.md`
- What: the one-line command summary gained the new verbs; a direct consequence of them.
- Suggestion: none.
- Status: dropped (a needed consequence of the new verbs)
