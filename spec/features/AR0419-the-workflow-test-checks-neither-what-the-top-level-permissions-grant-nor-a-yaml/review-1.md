# AR0419 - Review 1

- Job: 2026-10-25-review-b7c12d56
- Branch: arthur/2026-10-25-worker-37272db5
- Commit reviewed: d3a16681a65b658bd78b66243f037e145a0137c8
- Verdict: FAIL

## Final message

I can't recommend merging this branch yet. The two mutations the ticket names now fail the test, and `.yaml` files are read. But the test still passes when the top-level permissions grant more than `contents: read`, as long as the extra grant comes after a blank line or a comment. The ticket's Done means says the block must be exactly `permissions:` followed by `  contents: read`, and its Goal says a wider top-level grant must fail. This bypass breaks both.

## Findings

1. **`test/structure.test.ts:698`: a blank line or comment line lets an extra grant through.**
   - The regex `/^permissions:\n {2}contents: read\n(?![ \t])/m` only looks at the one line after `contents: read`. When that line is blank or a column-0 comment, the check passes, and YAML still reads the indented line below it as part of the same `permissions` block.
   - I added `\n  pull-requests: write` after `  contents: read` in `.github/workflows/ci.yml`. The test passed (pass 1, fail 0), and PyYAML parses that `permissions` as `{'contents': 'read', 'pull-requests': 'write'}`.
   - Run against the regex alone, both of these pass:
     - `"permissions:\n  contents: read\n\n  pull-requests: write\n…"`
     - `"permissions:\n  contents: read\n# note\n  id-token: write\n…"`
   - A blank line between keys is ordinary YAML style, so this is how a wider grant could actually get in.
   - The worker's message says "a second grant line indented under the block" fails. That is only true when the line comes right after `contents: read`.
   - A fix has to skip blank and comment lines before checking the next line's indent. In JavaScript, a plain `(?:…)*` before the lookahead can backtrack and let the same input through again, so isolating the top-level block first (up to the next column-0 key) is more reliable.

## Notes
- Other bypasses I checked are caught:
  - a grant listed before `contents`
  - `contents: write`
  - `write-all`
  - an extra grant on the line right after `contents: read`
  - a line holding only spaces before an extra grant
- Duplicate top-level `permissions:` keys might also get past a regex check. [INFERENCE] GitHub rejects workflows with duplicate keys, so I didn't count that as a finding.
- A trailing comment on the `contents: read` line, or a file that ends without a newline right after it, fails the test. That is stricter than needed but safe.
- The diff only touches the workflow test, which matches the ticket's scope. No Shape rules are broken.

## Checks run
- `npm ci`: added 22 packages.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1108 tests, 1050 pass, 0 fail.
- Mutations, each run with `node --test --test-name-pattern="CI workflow" test/structure.test.ts`; I restored every one, and `git status --short` was empty afterwards:
  - `contents: read` changed to `contents: write` in `ci.yml`: caught (fail 1, "not exactly contents: read").
  - New `extra.yaml` with `uses: actions/checkout@v4`: caught (fail 1, `extra.yaml: uses: actions/checkout@v4`).
  - Same `extra.yaml` with the file filter put back to `/\.yml$/`: not caught (pass 1). This confirms the `.yaml` change is what the test relies on.
  - A blank line, then `  pull-requests: write`, after `contents: read` in `ci.yml`: **not caught** (pass 1). This is the finding above.

FAIL