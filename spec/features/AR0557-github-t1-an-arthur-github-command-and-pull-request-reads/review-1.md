# AR0557 - Review 1

- Job: 2026-10-29-review-2e1a9446
- Branch: arthur/2026-10-29-worker-915f655c
- Commit reviewed: 2ade2b44719ab30ae4b85e1d4115fe16df1c4cbe
- Verdict: FAIL

## Final message

The branch fails review on one Done means point: the fake GitHub's comment answer is missing a field that GitHub's docs show. Everything else holds and the checks pass.

## Findings

1. **`packages/github/test/fake-github.ts:89-91` (`shapedComment`): the fake's "List issue comments" answer is missing a field.** The docs example has `minimized: null`; the fake leaves it out. Done means asks for "the shape of the REST docs the plan names, every field", and the review criteria count a fake GitHub that answers in a shape its docs do not show as a FAIL. I checked GitHub's REST description (`github/rest-api-description`, `components.examples`):
   - **`issue-comment-items`:** keys `id node_id url html_url body user created_at updated_at issue_url author_association minimized`.
   - **What the fake has:** every key up to `author_association`, but not `minimized`.
   - **Field schema:** the "List issue comments" page on docs.github.com also lists `minimized`.

   The worker said it could not check these shapes and asked the reviewer to. The other new shapes match the docs examples key for key: `fullPull` (`pull-request`) and `shapedPull` (`pull-request-simple-items`). The fix is adding `minimized: null` to `shapedComment`.

## Notes (not blocking)

- **Ticket edit will conflict on merge.** The branch adds two lines under the ticket's Decisions. Main's ticket (`86b2a640`) adds its AR-D332 line at the same spot, so `ticket.md` will conflict; keep main's version. On your instruction I did not treat those two lines as decisions:
  - The code does need 870 and 6470. Github has 813 lines (`cat packages/github/src/*.ts | wc -l`), and the core needs +3 for `groupPage`. AR-D332 covers both.
  - Building `pr merge` here follows Done means, which asks for it to be refused with no request and refused inside a job. The plan put it in T2, and the worker's final message gives this reason.
- **Possible clash with other commands' pages.** `groupPage` looks up any `<doc>-<word>.md` beside a command's doc. So `arthur retro due --help` would print `retro-due.md`, and `arthur review needed --help` would print `review-needed.md`: those are the pages of other commands. The risk is low.
- **Mutation not caught, but harmless.** Letting the `groupPage` word regex accept uppercase (`[a-zA-Z]`) fails no test. On Linux the filesystem is case-sensitive, so `echo-PR.md` is never found and the page falls back anyway.
- **`text()` filtering.** It keeps `\n` and lets U+2028/U+2029 and bidi controls through, the same as youtrack's `text()`, which the plan says to follow. The unquoted fields (`head.ref`, `login`, `html_url`, review `state`) cannot hold a newline on GitHub.
- **Pagination header is partial.** The fake's `link` header holds only `rel="next"`. GitHub's pagination docs also show `prev`, `last` and `first`. No code reads the header.
- **Circular import.** `github-command.ts` and `github-pr.ts` import each other. It works, because the shared functions are function declarations.

## Checks run

- **`npm ci`, `npm run check`:** `tsc` clean.
- **`npm test`:** 1299 tests, 1237 passed, 0 failed, 62 skipped. This matches the worker's numbers, and no `limits.test.ts` timing test failed.
- **Fake vs docs:** compared the fake's shapes with the REST description examples and the docs.github.com pages ("Get a pull request", "List issue comments"), as listed in finding 1.
- **Mutations, each restored with `git checkout --` (tree clean at the end).** Every one below failed at least one test:
  - **Job refusal:** refusal disabled; `inJob` removed; `merge` added to `READS`.
  - **Control characters:** the filter narrowed to ESC only; the C1 range removed.
  - **`quoted()`:** `trimEnd` removed.
  - **Usage check:** `words.length` check loosened; `hasOwn` guard removed.
  - **`pr merge` and number checks:** the `pr merge` refusal disabled; number regex `^\d+$`.
  - **`pr get` and `pr list` output:** PENDING filter; draft; `merged_at`; `--all`.
  - **`pages()`:** `<` to `<=`; `<=` to `<` on the page limit; `cut` forced false; the non-list check removed.
  - **Cut lines:** the reviews cut line removed.
  - **Projects:** all projects resolved at load.
  - **`groupPage`:** regex removed; `existsSync` removed; `printDoc` given no word.
  - **`arthur ci`:** log `text()` removed; the step-name quoting together with the 300-character cut at `>=`.
- **Not caught:** only the uppercase regex mutation from the notes.

FAIL