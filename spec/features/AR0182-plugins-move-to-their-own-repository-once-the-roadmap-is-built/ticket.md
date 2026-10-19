# AR0182 - Plugins move to their own repository once the roadmap is built

```json
{
  "id": "AR0182",
  "title": "Plugins move to their own repository once the roadmap is built",
  "date": "2026-10-19"
}
```

## Description

The plugins (`packages/*` except `core`) move out of the Arthur repository into their own repository, or into published `@arthur/*` packages. Arthur then installs them like any npm package, and later they could be offered as a marketplace of plugins.

## Goal

The core repository holds only the core. Plugins live, are versioned, and are installed apart from it, so that adding a plugin never touches the core's repository.

- Kind: improvement

## Done means

- The plugins build, test and release from their own repository, and their CI is green there.
- `arthur run` and `arthur setup` load them from installed `@arthur/*` packages, exactly as today.
- The core repository's tests pass without any plugin source.
- A plugin states the core version it needs, and an incompatible version is refused at start with a message that names both versions.

## Scope

In: the repository split, package publishing, and the version check.
Out: the marketplace itself (listing, search); it gets its own ticket.

## Decisions

- 2026-10-19: The owner asked whether plugins could live in a separate repository. He decided to do it at the end, once the roadmap is built, so that it does not slow the switch from the harness to Arthur. Not started before then.
