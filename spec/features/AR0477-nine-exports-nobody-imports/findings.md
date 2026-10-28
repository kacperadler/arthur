# AR0477 - Findings

## F1. Nothing but tsc and the audit catches an export put back

- What: review 1 notes that putting one of the nine `export` keywords back fails no test; the structure test does not look for unused exports.
- Status: dropped (the audit already finds unused exports; a test for it is new scope nobody asked for)
