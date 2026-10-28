# AR0414 - Findings

## F1. Restored changes all come back unstaged

- What: review 1: after `git apply`, staged and unstaged changes are no longer kept apart; nothing is lost.
- Status: dropped (nothing lost; the worker's message says so)

## F2. Untracked files are not saved

- What: review 1: the patch holds tracked changes only.
- Status: dropped (the same as `git stash` by default)

## F3. Run from a subfolder, the patch lands in that subfolder

- What: review 1: the advice's relative paths follow the folder it runs in (AR0372's F2).
- Status: dropped (already dropped in AR0372; the apply runs from the same folder)
