# SH0014 - Email a receipt after checkout

```json
{
  "id": "SH0014",
  "title": "Email a receipt after checkout",
  "date": "2026-10-21"
}
```

## Description

Each order sends its receipt by email, the same one the checkout's last page shows.

## Goal

Customers ask for their receipt (4 mails in October).

- Kind: feat

## Done means

- An order sends one email with its receipt; `test/receipt.test.ts` covers it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/receipt.ts`: the email.

Out:
- Marketing emails.

## Decisions

- 2026-10-21: Asked for by the owner; it waits for his approval.
