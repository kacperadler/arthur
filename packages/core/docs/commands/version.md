# arthur version

Usage: `arthur version`

Prints the version of Arthur, `<release> <hash>`, such as `0.1.0 8b0c9ebef9ca`. It needs no config.

- `<release>` is the `version` of the core's `package.json`. One release is the version of the core and every first-party plugin, in every `package.json` and the lockfile, all set at once by `npm version <version> --workspaces --include-workspace-root --no-git-tag-version`. It follows semver; on 0.x the minor goes up for a breaking change (the host API, an option removed or renamed, a file format that needs a manual step), the patch for anything else. Only a release ticket, merged through `arthur merge`, changes it: a `package.json` changed by hand on main counts as code there, and refuses the next merge (`arthur merge --help`).
- `<hash>` is the first 12 hex digits of a SHA-256 over the names and contents of the core's source files (`packages/core/src/`), so two checkouts of one commit print the same and any change to the core prints another.

A release is a ticket, `Release <version>`, kind `chore`, whose worker runs only that `npm version` command, merged through `arthur merge` like any ticket. Its merge writes the release's section, `## <version> (<date>)`, in `CHANGELOG.md` (`arthur changelog --help`, "Releases"), and its push to `main` changes `package.json`, which runs `.github/workflows/release.yml`: when origin has no tag `v<version>` yet, it runs `npm ci`, `npm run check` and `npm test`, then `gh release create v<version> --target <the pushed commit>` with that section as the notes, with the workflow's own `GITHUB_TOKEN` (`contents: write`), so there is no secret to keep. A version whose tag exists, a step that fails, or a `CHANGELOG.md` without the section makes no release (`test/release.ts`). Nothing is published on npm.

A spawn on another machine runs `arthur version` there first, and so does the `machines` plugin's check; each compares the hash alone, the last word, so two releases of one core agree. A line of a hash alone, as Arthur printed before its releases, or another hash, is refused before any record exists, naming both whole lines: `machine <name> runs arthur <theirs>, this one is <ours>; both need the same version` (see `arthur spawn --help`).
