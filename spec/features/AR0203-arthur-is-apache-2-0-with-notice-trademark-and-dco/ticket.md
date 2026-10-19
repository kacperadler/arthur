# AR0203 - Arthur is Apache-2.0, with NOTICE, trademark and DCO

```json
{
  "id": "AR0203",
  "title": "Arthur is Apache-2.0, with NOTICE, trademark and DCO",
  "date": "2026-10-19"
}
```

## Description

The owner (urgent, 2026-10-19) changes Arthur's licence from FSL-1.1-ALv2 to Apache-2.0. Arthur becomes open source; the name "Arthur" and its logo stay the owner's (Kacper Adler).

## Goal

Every place that states the licence says Apache-2.0, the name and logo are reserved, and contributions are signed off under the DCO.

- Kind: improvement
- Budget: 4

## Done means

- `LICENSE`: the unmodified Apache License 2.0 text from https://www.apache.org/licenses/LICENSE-2.0.txt.
- New `NOTICE`: "Arthur", Copyright 2026 Kacper Adler; a line that the name "Arthur" and the Arthur logo are trademarks of Kacper Adler, not licensed under Apache-2.0 (Apache-2.0 section 6 already says it grants no trademark rights).
- `"license": "Apache-2.0"` in the root `package.json` and every `packages/*/package.json`; `package-lock.json` matches (`npm install`).
- README: the opening bullet says open source (Apache-2.0), the Licence section says Apache-2.0, open source, with the name and logo reserved, and links `LICENSE`, `NOTICE`, `CONTRIBUTING.md`; no "FSL" or "source-available" anywhere in the repository except the git history (`git grep -i -e FSL -e source-available` prints nothing).
- `spec/vision.md`: its Licence section and point 7 of its list say Apache-2.0, open source, name and logo reserved. The owner asked for this edit himself.
- New `CONTRIBUTING.md`: contributions under Apache-2.0; every commit carries `Signed-off-by: Name <email>` (`git commit -s`) certifying the Developer Certificate of Origin 1.1, with its full text or a link to https://developercertificate.org; a commit without it is not merged.
- Any test that pins the licence text or the package fields is updated; `npm run check` and `npm test` pass.

## Scope

In: the files above. Out: a CI check of sign-offs (not asked).

## Decisions

- 2026-10-19: The owner, urgent: Apache-2.0 instead of FSL-1.1-ALv2; NOTICE; package.json license fields; README and vision.md licence sections (open source, the name and logo stay his); CONTRIBUTING.md with a DCO requirement.
- 2026-10-19: The coordinator decides: old tickets (AR0001 and this one) are records of what was decided and keep their wording; hash matches are not text. The grep point holds for every live document (LICENSE, NOTICE, README, vision, CONTRIBUTING, package files, docs).
