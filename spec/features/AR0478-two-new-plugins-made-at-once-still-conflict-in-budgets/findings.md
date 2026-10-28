# AR0478 - Findings

## F1. An open branch that raises a budget may conflict once in `BUDGETS` after the sort

- What: review 2 and the worker: the one-time sort moves most lines of `BUDGETS`, so a branch opened before it that changes a budget line may hit one merge conflict.
- Status: dropped (once only; no branch open at the merge touches `BUDGETS`)

## F2. Two new plugins still conflict when no existing name sorts between theirs

- What: review 2: a plain text merge cannot avoid it; `plugin.md:30` says so.
- Status: dropped (the documented limit of the approach)
