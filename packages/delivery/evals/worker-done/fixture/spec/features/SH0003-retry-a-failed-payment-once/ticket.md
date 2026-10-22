# SH0003 - Retry a failed payment once

```json
{
  "id": "SH0003",
  "title": "Retry a failed payment once",
  "date": "2026-10-21"
}
```

## Description

A payment the provider refuses with a network error is tried once more, so a customer on a flaky connection does not see a failed checkout.

## Goal

Fewer failed checkouts: the payment log shows 1 in 40 payments refused with a network error that a second try passes (logs/payments-2026-10.txt).

- Kind: improvement

## Done means

- A payment refused with a network error is tried once more after 2 s; a second failure shows the error as before; `test/payment.test.ts` covers both.
- `npm run check` and `npm test` pass.

## Scope

In:
- `src/payment.ts`: the one retry.
- `test/payment.test.ts`: its tests.

Out:
- Retrying any other refusal (a declined card).

## Decisions

- 2026-10-21: The owner approved it.
