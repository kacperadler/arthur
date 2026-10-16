# Styleguide

> How code is written and organized in Arthur, for every role's turn. Product scope is in `spec/vision.md`; the order of the work is in `spec/roadmap.md`.

## Shape

- Small, direct TypeScript that Node 24 runs as written (type stripping). Only erasable syntax: no `enum`, `namespace`, parameter properties or decorators. `tsc` only checks (`npm run check`); nothing is compiled.
- npm workspaces: the core is `packages/core/` (`@arthur/core`), each plugin is `packages/<plugin>/` (`@arthur/<plugin>`). A package holds its code in `src/` and its tests in `test/`; its public interface is the `exports` of its `package.json`, nothing else.
- Boundaries: a plugin imports only `@arthur/core` through its published exports (in tests also `@arthur/core/testing`), never another plugin and never a core file by path. The core never imports a plugin. Plugins reach each other only through the host: events, commands, and what the host API publishes.
- One file, one job. No `index.ts`, `types.ts`, `utils.ts`, barrels, or a shared helper bag.
- Plain functions, union types and early returns; no classes, no frameworks.
- No runtime dependencies: `dependencies` stays empty in every `package.json`. Dev dependencies are the toolchain only (`typescript`, `@types/node`).
- Each source file stays at most 200 lines. The core and each plugin get a line budget when the structure test that holds it exists; the number lives in that test only, and a raise is a decision recorded in the ticket.
- English only: code, comments, docs, messages, prompts, file keys.
- No secret in code, config or a test fixture: an option ending in `Env` names the variable that holds it, and an error never prints its value.
- Each plugin keeps its own state in its own folder under `.arthur/`; it does not read or write another plugin's folder. The one exception: a plugin may read a file whose path another plugin handed it in an event or a `collect` answer (a message part's `path`), and only that file. It never lists, reads or writes another plugin's folder otherwise.

## Simplest solution

Stop at the first rung that holds: does it need to exist at all (skip a speculative need, say so in one line), then the standard library, then a native feature (Git, the shell, the platform), then one line; only then the least code that works.

- Fewest files; the shortest working diff wins.
- Delete before adding. No abstraction, option, or scaffold nobody asked for.
- Never simplify away input checks at a trust boundary (config, env, a channel message, a tracker's text, a file a human edits), handling that prevents lost work, security, or what was asked for.
- A reviewer FAILs code beyond what the change needs.

## Prefer

- Arthur's words, the same everywhere: job, worktree, ticket, board, plugin, host, event, command, coordinator, channel.
- Readonly inputs. Local mutation is fine; shared mutable state is not.
- Plain files written so a reader never sees half a state: write to a temporary name and rename, and write a job's `state` last.
- Tests with `node:test` and `node:assert/strict`, in `packages/<package>/test/*.test.ts`, run by `npm test`. The core is tested against a fake plugin and a fake agent; a plugin against the fake host of `@arthur/core/testing`; never against another real plugin.
- Real Git and real files in a temporary folder. Only `omp` and outside services are faked; a fake of an outside service (Telegram, YouTrack, GitHub) answers in the shape its documentation shows, every field included, not only the one the code reads.
- Edge cases, never only the happy path: every refusal, empty and missing input, the values at each limit, a broken or hand-edited file, a repeated call, a second writer where there can be one. Each behavior has a test that fails when the behavior is removed.
- A test of something asynchronous waits until the very state it asserts holds (the file gone, the request seen), never for an earlier signal or a fixed time.
- A test never uses a resource under a name production uses: a tmux socket, a systemd unit, a bot, a port, a fixed path in `/tmp`, a checkout's `.arthur/`. It gets its own, under an explicit path or name, and removes it at the end.

## Avoid

- Abstracting before the second example. The plugin API is frozen only after three plugins (schedule, youtrack, telegram) use it; duplicating a short function is cheaper than a helper bag.
- New workflow state. The ticket board is the one workflow state, changed only through the core's own command.
- Parsers for Markdown the human owns, beyond the keys the board reads.
- Style-lint packs, comment banners, and defensive try/catch around impossible cases.
- Rewriting working code to match a model's default taste.
