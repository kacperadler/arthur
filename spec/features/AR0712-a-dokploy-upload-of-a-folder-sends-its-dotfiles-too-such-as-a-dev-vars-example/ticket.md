# AR0712 - A Dokploy upload of a folder sends its dotfiles too, such as a .dev.vars.example that holds a token

```json
{
  "id": "AR0712",
  "title": "A Dokploy upload of a folder sends its dotfiles too, such as a .dev.vars.example that holds a token",
  "date": "2026-11-14"
}
```

## Description

`arthur dokploy upload <folder>` zips every regular file under the folder, dotfiles and dot-folders included, so a file such as `.dev.vars.example`, `.env.local` or anything under `.git/` goes to the Dokploy server with the build. The owner decides what an upload leaves out; the worker then makes the zip follow that and say what it left out.

## Goal

A token in a dotfile beside the code reaches the Dokploy server and every build log of it, against the vision's rule that a secret stays with the process that needs it. Evidence: `packages/dokploy/src/dokploy-zip.ts:23` lists the folder with `readdirSync(path, { recursive: true })` and `:26` keeps every regular file it finds, with no filter on a leading dot; a starter folder of one of the owner's projects held a `.dev.vars.example` with a token.

- Kind: security

## Done means

- A folder upload leaves out every path with a segment that starts with a dot (a dotfile or anything under a dot-folder), as the owner decided below, and its `said` line names how many files it left out.
- A test in `packages/dokploy/test/dokploy.test.ts`, beside "upload zips a folder's regular files at the zip's root", uploads a folder holding `.dev.vars.example`, `.git/config` and `index.html`, and fails before the change because the zip holds the dotfiles.
- A file upload of one dotfile named on purpose, and a ready `.zip`, are sent as before.
- `npm run check`, `npm test` and `npm run mutate` pass.

## Scope

In:
- `packages/dokploy/src/dokploy-zip.ts`: the filter on the folder's files and the count in `said`.
- `packages/dokploy/test/dokploy.test.ts`: the test above.
- `packages/dokploy/docs/dokploy.md`: one line on what an upload leaves out.

Out:
- A `.dokployignore` or any ignore file: not asked for.

## Decisions

- 2026-11-14: AR0712 approved: an upload of a folder leaves out every dot-path (option a); the owner: "AR-D679 1 a" (AR-D679)
