# Fulfillment Sync — setup & security

PZY-Tab can optionally sync order fulfillment with a storefront that implements
the contract in [`ORDER_FULFILLMENT.md`](./ORDER_FULFILLMENT.md). This document
covers how the channel is locked down and how to turn it on.

## Off by default

PZY-Tab is roaster software first. It never needs a storefront/CRM to operate:

- With **no sync configuration**, the `/sync/*` endpoints are **not registered** (requests 404) and no outbound requests are ever made.
- No peer URLs, tokens, or secrets are baked into the code or images. PZY Coffee's own deployment is configured the same way any other roaster's would
  be — via private deployment config.
- Connecting to a given storefront requires credentials **issued by that storefront's operator**. The store side verifies the same two factors below, so an arbitrary PZY-Tab install cannot talk to systems it wasn't paired with.

## Enabling sync

Sync activates only when **both** credentials are present at startup:

| Env var | Meaning |
| --- | --- |
| `SYNC_AUTH_TOKEN` (or `SYNC_AUTH_TOKEN_FILE`) | Shared bearer token for service-to-service auth. Sent on outbound requests; required on inbound ones. |
| `SYNC_SIGNING_SECRET` (or `SYNC_SIGNING_SECRET_FILE`) | Key for HMAC-SHA256 body signatures. |
| `SYNC_PEER_URL` | Base URL of the peer's sync API (e.g. `https://store.example.com`). Optional — without it, inbound sync still works but PZY-Tab never pushes/pulls outbound. |

`*_FILE` variants point at a mounted secret file and take precedence over the plain variable (matching the store repo's secret convention). Generate both values with something like `openssl rand -hex 32`; they are independent secrets and should be rotated independently.

## What verification looks like on the wire

Per §9 of the contract, every sync request carries two things:

1. `Authorization: Bearer <token>` — compared in constant time against the configured token.
2. `X-Pzy-Signature: <hex>` — HMAC-SHA256 over the **raw request body** using the signing secret. Because every event embeds a unique `event_id` and application is idempotent (§4.3), a replayed body is inert: it verifies, but applying it is a no-op.

Requests failing either check are rejected with `401` before any parsing. Bodies are capped at 1 MiB. These endpoints are service-to-service only — they are intentionally **outside** the CORS middleware the browser-facing endpoints use, and should not be exposed to browsers.

## Endpoints (when enabled)

| Route | Purpose |
| --- | --- |
| `POST /sync/fulfillment/events` | Ingest events pushed by the peer (single event or `{"events": [...]}`). Idempotent on `event_id`. |
| `GET /sync/fulfillment/changes?since=<cursor>&limit=<n>` | Changes feed the peer pulls to reconcile. Cursor is this publisher's monotonic `seq`. |

Both follow the shapes in §6 of the contract. Events PZY-Tab originates (`in_progress`, `roasting`, `roasted`, holds) are recorded to the local log and, when `SYNC_PEER_URL` is set, pushed to the peer with the same auth + signature (`Service.PushEvents` / `Service.PullChanges` in `backend/sync`).

Two further routes are **browser-facing** — they serve the tablet's order queue and so, unlike `/sync/*`, they do sit behind the app's CORS middleware. They are a read/claim surface for the operator, not a second ingest path:

| Route | Purpose |
| --- | --- |
| `GET /orders` | The order board plus `active_order_id`. Registered only when sync is enabled. |
| `POST /orders/select` | Claim an order for this roaster (advances it to `in_progress`), or release with `""`. |
| `GET /capabilities` | Always registered. Reports `sync_enabled` so a standalone install can hide the Orders tab. |

## What the roast floor reports

Claiming an order attaches this roaster's subsequent roast events to it:

| Roast-floor action | Event emitted |
| --- | --- |
| Claim an order (`POST /orders/select`) | `fulfillment.transition → in_progress` |
| Start a roast | `fulfillment.transition → roasting` |
| Program runs to the end of its last step | `fulfillment.transition → roasted`, and the drum is released |
| Operator stops the roast by hand | **nothing** — an aborted roast hasn't produced roasted coffee |

Emitted events go through the same `Log.Apply` as anything inbound, so they obey the ownership and forward-only rules rather than bypassing them: an emit that isn't legal for the order's current state is logged and dropped, never forced. The push to the peer happens in the background — the roast floor never waits on the network, and a failed push is reconciled when the peer pulls `/changes`.

`backend/data` has no knowledge of any of this. It announces roast lifecycle events via `data.OnRoastEvent` and `main` translates them, so a roaster with no sync credentials has no subscriber and the whole path is inert.

## Reconciliation

PZY-Tab polls the peer's changes feed every 30s (`Service.StartReconcile`), pulling from a cursor and paging until the peer says there's no more. This is what puts orders on the board — and it's the §6.3 backfill path, so a lifecycle event for an order we never saw created stops being permanently lost.

The cursor is deliberately **not** persisted. The event log is in-memory, so a restarted roaster has to replay the peer's whole feed to rebuild its board anyway; application is idempotent, so replaying is free of side effects.

## Pairing with the PZY storefront

The storefront (`coffeeco`) implements the other half of the contract. To pair a roaster with it:

| PZY-Tab | Storefront | Must match? |
| --- | --- | --- |
| `SYNC_AUTH_TOKEN` | `FULFILLMENT_SYNC_SECRET` | **Yes** — identical values |
| `SYNC_SIGNING_SECRET` | `FULFILLMENT_SYNC_SIGNING_SECRET` | **Yes** — the store signs its polls of our feed |
| `SYNC_PEER_URL` → the store's API | `PZYTAB_SYNC_URL` → our API | Each points at the other |

Both projects publish their backend on the host, so they cannot share a port: the storefront keeps **8080** and PZY-Tab's compose publishes **8081**. On one machine, `http://host.docker.internal:<port>` lets each container reach the other across compose projects (both sides declare `extra_hosts: host.docker.internal:host-gateway`).

Known asymmetries with that storefront, handled on our side:

- **It nests the contract's top-level extras under `payload`.** We read either placement, so items and weights reach the board (§10 tolerant reading).
- **It is bearer-only inbound** — it neither sends nor verifies signatures on its own ingest. Our outbound requests carry a signature regardless; its extra header is ignored. Tighten this before syncing across an untrusted network.
- **It knows `packed` (ordinal 40); we don't.** Those transitions are ignored here, so an order jumps from `roasted` to `shipped` on the board. Harmless — the ladder is forward-only either way.
- **`event_id` must be a UUID v4** (§5). The store stores it in a `UUID` column and rejects anything else — while still answering `200`, so `PushEvents` inspects per-event outcomes rather than trusting the status code.

## Not yet wired

- **The event log is in-memory.** A restart loses the log, the order board, and the `event_id` dedup set. The peer's feed is replayed on boot, which rebuilds order state, but events *we* originated and already pushed are gone from our own `/changes` feed.
- **Holds are consumed but never originated.** The roast floor has no way to flag a problem back to the store.

## Threat model summary

| Concern | Mitigation |
| --- | --- |
| Random installs connecting to PZY Coffee (or any store) | Store requires its own issued token + signature; nothing to connect with ships in this repo. |
| Unverified parties pushing fake orders/status into a roaster | Bearer + HMAC required before parsing; unauthenticated `/sync/*` is 404/401. |
| Replayed requests | `event_id` dedup makes replays no-ops; signatures prevent tampering. |
| Stale/out-of-order updates | Forward-only ordinal ladder (§4) converges regardless of delivery order. |
| Customer PII exposure on the roast floor | Contract sends order id, items, weights, status — no names/addresses by default (§9). |
