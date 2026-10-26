# AR0446 - Doctor's env-file fix text names the default place even when XDG_CONFIG_HOME sets another

```json
{
  "id": "AR0446",
  "title": "Doctor's env-file fix text names the default place even when XDG_CONFIG_HOME sets another",
  "date": "2026-10-26"
}
```

## Description

`arthur doctor`'s `core env` fix text (`packages/core/src/requirements.ts:95`) always names the default file under `~/.config/arthur`, though the real default lies under `$XDG_CONFIG_HOME/arthur` when that variable is set; with a relative `XDG_CONFIG_HOME` (which the XDG spec says to ignore) the file resolves inside the config's folder and the fix text does not name that cause. Found by AR0339's reviews 2 and 4 (non-blocking).

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: fix

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F2 of AR0339
