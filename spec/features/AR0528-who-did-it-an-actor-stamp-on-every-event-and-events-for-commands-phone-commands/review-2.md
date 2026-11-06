# AR0528 - Review 2

- Job: 2026-11-06-review-90b5f89e
- Branch: arthur/2026-11-06-worker-8dfeac5d
- Commit reviewed: 3a1097cfffaeb69fe6e1c970548d1223dcec21d2
- Verdict: PASS

## Final message

The merge resolution in 3a1097cf is correct. Per your instruction I reviewed only the merge, against its two parents: b5476e1e (this branch, which already passed review) and 70ef86ee (main).

**`docs/plugin-api.md`:** both entries are kept under "Changes since entry 51", in order: AR0528's, then AR0649's. The rest of each side's text is untouched:
- From the branch: the "Who acted" section, the four events, the `actor` row under "Provided names", the `by?` field on `Event`, and `holds` in `@arthur/core/lock`.
- From main: AR0649's `usage` field in the `JobRecord` row.
- Nothing was lost or duplicated.

**`test/structure.test.ts`:** each budget is main's value plus this branch's approved raise.

| Budget | Merge base 6674f03e | Branch b5476e1e | Main 70ef86ee | Merged 3a1097cf |
| --- | --- | --- | --- | --- |
| core | 7239 | 7307 (+68, AR-D533) | 7273 (+34) | 7341 = 7273 + 68 |
| orchestration | 2745 | 2761 | 2745 | 2761, as approved |
| schedule | 619 | 621 | 619 | 621, as approved |
| core/testing | 403 | 403 | 405 | 405, main's value |

No raise beyond what was approved.

**Main since 70ef86ee:** `git diff --name-only 70ef86ee 86b265df` lists only `spec/` files. The merge is not stale for code.

## Notes
- (minor) 3a1097cf: the worker merged from a local `origin/main` because fetching failed. Main has only moved in `spec/` since, so the merge does not need redoing.

## Checks
- On 3a1097cf, `node --test test/structure.test.ts`: 20 tests, 20 pass, 0 fail. This covers the merged budgets and the size zones.
- I did not rerun the full suite or mutate, as you asked. The worker's results for check, test and mutate on 3a1097cf are recorded in delivery.

PASS