# Styleguide

> Project-owned coding practice for every harness role's turn. This file governs how code is written and organized here, not product scope and not speech.

## Shape

- Small, direct TypeScript. Capability in `src/`; judgment in `roles/` and project Markdown.
- One file, one job. Do not add `index.ts`, `types.ts`, `utils.ts`, barrels, enums, or a shared helper bag.
- Prefer plain functions, union types, and early returns over classes and frameworks.
- Keep runtime dependencies empty.
- `src/` stays under the total line budget in `test/structure.test.ts`, the one place that number lives; each file in `src/` and `hook/` stays at most 200 lines. The coordinator decides raises, recorded in the ticket's Decisions, once the worker shows what it cut first; the assertion message, which lists what the lines paid for, is updated in the same commit.
- Code that stops or deletes jobs, moves `main`, or holds a secret, is on the always-review list in `src/review-rules.ts`, whatever its directory. A branch that puts such code in a new file, or moves it out of a listed one, adds that file to the list in the same commit; a reviewer checks every new file in the diff against this and FAILs a branch that leaves one off.

## Simplest solution

From the ponytail skill. Stop at the first rung that holds: YAGNI (does it need to exist at all? skip a speculative need, say so in one line), then the standard library, then a native feature (Git, the shell, the platform), then one line; only then the least code that works.

- Fewest files; the shortest working diff wins.
- Delete before adding. No abstraction, option, or scaffold nobody asked for.
- Never simplify away input checks at a trust boundary, handling that prevents lost work, security, or what was asked for.
- A reviewer FAILs code beyond what the change needs.

## Prefer

- Exact names already used in the repo: job, worktree, pulse, wake, ticket, board.
- Readonly inputs. Local mutation is fine; shared mutable state is not.
- Inform, do not gate. Advisories and durable notes over new control flow.
- Tests that exercise real Git and real files. Assert observable behavior, not ceremony. A test of something asynchronous waits until the very state it asserts holds (the file gone, the request seen), never only for an earlier signal such as a reply or a send, or for a fixed time.
- A test never uses a resource under a name production uses: a socket (`tmux -S` with a path in the test's folder, never `-L h`), a systemd unit, the Telegram bot, a port, a fixed path in `/tmp`, the checkout's `.h/`. It gets its own, under an explicit path or name: the tests run on the server next to the coordinator, as the same user. A reviewer FAILs a break of this.

## Avoid

- Abstracting a second example. Duplicating a short function is cheaper than a helper bag.
- New workflow state, registries, or parsers for Markdown the human already owns. The one exception is the ticket board: `spec/build.json`, changed only through `h ticket`, is the one workflow state, and nothing else adds one. A ticket's JSON block is harness-owned, not free-form human Markdown.
- Style-lint packs, comment banners, and defensive try/catch around impossible cases.
- Rewriting working code to match a model's default taste.
