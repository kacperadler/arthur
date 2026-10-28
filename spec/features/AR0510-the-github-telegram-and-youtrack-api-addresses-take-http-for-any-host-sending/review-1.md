# AR0510 - Review 1

- Job: 2026-10-29-review-401ad53a
- Branch: arthur/2026-10-29-worker-1d174632
- Commit reviewed: d3eb288bca8a02d2f82b5392e2126455d150a24c
- Verdict: PASS

## Final message

Verdict: PASS. GitHub, Telegram and YouTrack now refuse an `http://` API address unless the host is loopback, and the refusal names the option's path. `npm run check` and `npm test` pass, and the worker's numbers match mine exactly.

## Findings

None that block the merge.

- **What the ticket asked for is there.**
  - `packages/github/src/github-options.ts:31`, `packages/telegram/src/telegram-options.ts:21` and `packages/youtrack/src/youtrack.ts:58` accept `https:` on any host. They accept `http:` only when the parsed `url.hostname` matches `^(localhost|127(\.\d+){3}|\[::1\])$`.
  - Each refusal names the path: `instances[<n>].apiUrl`, `apiUrl`, or `instances[<n>].urlEnv`. The YouTrack one still never prints the value.
  - The three tests the ticket names are there: `http://api.github.com`, `http://api.telegram.org` and a YouTrack `http://` URL on a public host are refused, and `http://127.0.0.1:4567` is accepted.
- **Tried to get past the check; nothing got through.** I ran the forms through `URL.parse` and the new regex in node:
  - `http://127.1`, `http://0x7f.1`, `http://2130706433` and `http://127.0.0.1.` are accepted. Node rewrites each to `127.0.0.1`, so they really are loopback.
  - `[0:0:0:0:0:0:0:1]` becomes `[::1]`, and fullwidth `ｌocalhost` becomes `localhost`; both accepted.
  - `http://127.0.0.1:80@evil.com`, `http://evil.com#@127.0.0.1`, `http://evil.com\@127.0.0.1`, `http://127.0.0.1<TAB>.evil.com`, `localhost.`, `localhost%2e` and `[::ffff:127.0.0.1]` are all refused.
  - Joining a request path onto `apiUrl` (`github-api.ts:45`, `bot-api.ts:43` and `:57`) can't move the host: the added text starts with `/`.
- **No rule broken.** The changed files have 81, 51 and 63 lines. No boundary is crossed and no dependency is added. Repeating the short regex in three plugins follows the styleguide's "no helper before a second example" rule.

## Notes (not blocking)

- **Stale help page:** `packages/youtrack/docs/commands/youtrack.md:72` is the page `arthur youtrack --help` prints, and it lists "every refusal in full". It still says the refusal is for "a URL variable that does not hold an `http` or `https` URL", which now reads as if `http` is fine on any host. The branch did not touch this file; `docs/youtrack.md` was updated. Worth a one-line follow-up.
- **One weaker change the tests don't catch:** I changed `protocol === "http:" &&` to `protocol !== "ftp:" &&` in telegram and youtrack. That would accept something like `ws://localhost`, and their tests still pass. The github tests do catch it. It doesn't affect what this ticket fixes: fetch refuses those schemes and the host is still loopback.
- **Two changes that survive but can't change behaviour:** `127(\.\d+){2,3}` and a case-insensitive `/i` flag, in all three plugins. Node always writes an IPv4 address as four parts and lowercases the host before the check runs, so neither matters.

## Checks run

- `npm ci`: ok. `npm run check`: exit 0.
- `npm test`, with output to a file in my worktree that I deleted afterwards: 1264 tests, 1202 pass, 0 fail, 0 cancelled, 62 skipped, exit 0.
- Mutations, each followed by that plugin's test file and a `git checkout -- <file>`:
  - **Caught in all three plugins:**
    - the regex replaced by `true` (http allowed on any host, the old behaviour);
    - `localhost` removed;
    - `[::1]` removed;
    - the `^` anchor removed;
    - the `$` anchor removed;
    - `127` widened to `12\d`.
  - **Caught only in github:** `=== "http:"` replaced by `!== "ftp:"`.
  - **Survived everywhere, but can't change behaviour:** `{2,3}` and the `/i` flag.
- `git status --short` after the restores: clean.

PASS