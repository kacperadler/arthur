# SH0011 - Warn when a product has no image

```json
{
  "id": "SH0011",
  "title": "Warn when a product has no image",
  "date": "2026-10-21"
}
```

## Description

A product without an image is easy to miss in the admin and looks broken in the store; the admin list and the product's page say so.

## Goal

Every product shown with an image: 6 of 212 products have none today (`npm run catalog:audit`).

- Kind: improvement

## Done means

- A product without an image shows `no image` in the admin list and a warning on its page; `test/catalog.test.ts` covers it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/catalog.ts`: the check.
- `src/admin-list.ts`: the column.

Out:
- Uploading images from the admin.

## Decisions

- 2026-10-21: The owner approved it.
