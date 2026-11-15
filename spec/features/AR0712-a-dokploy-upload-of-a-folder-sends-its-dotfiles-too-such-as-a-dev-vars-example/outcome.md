# AR0712 - Outcome

- Merged: 2026-11-14, `08e52551`
- Branch: arthur/2026-11-14-worker-51369211
- Reviews: review-1.md PASS
- Cost: worker $1.85, reviews $0.46; review rounds 1

## What went in

- packages/dokploy/src/dokploy-zip.ts: a folder upload leaves out every path with a part starting with a dot, counts the dot-path files in `said` (`, leaving out N dot-path files`) and in the refusal of a folder with dot-paths only.
- packages/dokploy/test/dokploy.test.ts: new test. It covers dotfiles, `.git/`, a nested `.cache/`, a symlink in a dot-folder, the singular count, a dot-named top folder, a dotfile given by its own path, and a folder of dot-paths only that is refused with nothing sent.
- packages/dokploy/docs/commands/dokploy.md: the upload line says what a folder upload leaves out and how the line reports it; the refusals list has the dot-paths-only refusal.
- spec/roadmap.md: entry 113 lists AR0712 and says a folder's dot-paths are left out.
- spec/features/AR0712-a-dokploy-upload-of-a-folder-sends-its-dotfiles-too-such-as-a-dev-vars-example/findings.md: F1, an unreadable dot-folder still refuses a folder upload.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1778/1849 passed.

## Left open

- Deferred (client summary): F1. An unreadable dot-folder still refuses a folder upload it would leave out
