# AR0342 - A project's `repo` URL is printed by the clone's refusals, with any credential it holds

```json
{
  "id": "AR0342",
  "title": "A project's `repo` URL is printed by the clone's refusals, with any credential it holds",
  "date": "2026-10-23"
}
```

## Description

a credential in the service's journal and on the terminal.

## Goal

A clone's refusal prints a project's `repo` URL without any credential it holds; tested.

- Kind: fix

Evidence:
- `packages/projects/src/clone.ts:34` (`holds ${url}, not ${repo}`), `packages/projects/src/clone.ts:43` (`git clone ${repo} failed: <git's last line>`)
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: print the URL with its userinfo removed (`new URL(repo)` when it parses, `username` and `password` set to `""`; a `git@host:path` form has none), and replace `\S+://\S+` in git's line as the push does; or refuse at the options check a `repo` with userinfo, telling the owner to use SSH or git's credential helper, as `arthur.config.example.ts:357` says pushes do. Test in `packages/projects/test`: a `repo` with userinfo that fails to clone; the refusal names the host and the path and never the credential.
- `npm test` and `npm run check` pass.

## Scope

In:
- print the URL with its userinfo removed (`new URL(repo)` when it parses, `username` and `password` set to `""`; a `git@host:path` form has none), and replace `\S+://\S+` in git's line as the push does; or refuse at the options check a `repo` with userinfo, telling the owner to use SSH or git's credential helper, as `arthur.config.example.ts:357` says pushes do. Test in `packages/projects/test`: a `repo` with userinfo that fails to clone; the refusal names the host and the path and never the credential.

## Decisions

- 2026-10-23: Source: F6 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
