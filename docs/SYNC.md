# Fulfillment Sync — setup & security

PZY-Tab can optionally sync order fulfillment with a storefront that implements
the contract in [`ORDER_FULFILLMENT.md`](./ORDER_FULFILLMENT.md). This document
covers how the channel is locked down and how to turn it on.

## Off by default

PZY-Tab is roaster software first. It never needs a storefront/CRM to operate:

- With **no sync configuration**, the `/sync/*` endpoints are **not registered**
  (requests 404) and no outbound requests are ever made.
- No peer URLs, tokens, or secrets are baked into the code or images. PZY
  Coffee's own deployment is configured the same way any other roaster's would
  be — via private deployment config.
- Connecting to a given storefront requires credentials **issued by that
  storefront's operator**. The store side verifies the same two factors below,
  so an arbitrary PZY-Tab install cannot talk to systems it wasn't paired with.

## Enabling sync

Sync activates only when **both** credentials are present at startup:

| Env var | Meaning |
| --- | --- |
| `SYNC_AUTH_TOKEN` (or `SYNC_AUTH_TOKEN_FILE`) | Shared bearer token for service-to-service auth. Sent on outbound requests; required on inbound ones. |
| `SYNC_SIGNING_SECRET` (or `SYNC_SIGNING_SECRET_FILE`) | Key for HMAC-SHA256 body signatures. |
| `SYNC_PEER_URL` | Base URL of the peer's sync API (e.g. `https://store.example.com`). Optional — without it, inbound sync still works but PZY-Tab never pushes/pulls outbound. |

`*_FILE` variants point at a mounted secret file and take precedence over the
plain variable (matching the store repo's secret convention). Generate both
values with something like `openssl rand -hex 32`; they are independent secrets
and should be rotated independently.

## What verification looks like on the wire

Per §9 of the contract, every sync request carries two things:

1. `Authorization: Bearer <token>` — compared in constant time against the
   configured token.
2. `X-Pzy-Signature: <hex>` — HMAC-SHA256 over the **raw request body** using
   the signing secret. Because every event embeds a unique `event_id` and
   application is idempotent (§4.3), a replayed body is inert: it verifies, but
   applying it is a no-op.

Requests failing either check are rejected with `401` before any parsing.
Bodies are capped at 1 MiB. These endpoints are service-to-service only — they
are intentionally **outside** the CORS middleware the browser-facing endpoints
use, and should not be exposed to browsers.

## Endpoints (when enabled)

| Route | Purpose |
| --- | --- |
| `POST /sync/fulfillment/events` | Ingest events pushed by the peer (single event or `{"events": [...]}`). Idempotent on `event_id`. |
| `GET /sync/fulfillment/changes?since=<cursor>&limit=<n>` | Changes feed the peer pulls to reconcile. Cursor is this publisher's monotonic `seq`. |

Both follow the shapes in §6 of the contract. Events PZY-Tab originates
(`in_progress`, `roasting`, `roasted`, holds) are recorded to the local log
and, when `SYNC_PEER_URL` is set, pushed to the peer with the same auth +
signature (`Service.PushEvents` / `Service.PullChanges` in `backend/sync`).
Wiring roast-floor actions to those events lands with the order-queue UI.

## Threat model summary

| Concern | Mitigation |
| --- | --- |
| Random installs connecting to PZY Coffee (or any store) | Store requires its own issued token + signature; nothing to connect with ships in this repo. |
| Unverified parties pushing fake orders/status into a roaster | Bearer + HMAC required before parsing; unauthenticated `/sync/*` is 404/401. |
| Replayed requests | `event_id` dedup makes replays no-ops; signatures prevent tampering. |
| Stale/out-of-order updates | Forward-only ordinal ladder (§4) converges regardless of delivery order. |
| Customer PII exposure on the roast floor | Contract sends order id, items, weights, status — no names/addresses by default (§9). |
