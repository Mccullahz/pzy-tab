# Order Fulfillment Contract

**Status:** Draft · **Contract version:** `0.1.0` · **Last updated:** 2026-07-18

This document is the shared agreement between two independently-deployed systems:

- **Store** — PZY Coffee (separate repo). Takes orders and payment; the system of
  record for orders, customers, and shipping.
- **PZY-Tab** — the roaster/production interface (this repo). The system of
  record for what happens on the roaster.

It defines the order identity, the fulfillment lifecycle, who may change what, and
how the two systems stay in sync **idempotently and without conflicts**. Both
codebases implement to this contract; neither reaches into the other's database.

> This is a design contract, not yet an implemented pipeline. Sections marked
> _(deferred)_ are agreed in principle but not required for the first cut.

---

## 1. Principles

1. **One system of record per fact.** Every field has exactly one owner that may
   change it (§3). The other side treats it as read-only.
2. **Forward-only lifecycle.** The roast/ship lifecycle is a ladder of stages with
   fixed numeric **ordinals** (§4). A transition applies only if it *advances* the
   ordinal. This makes concurrent and out-of-order updates **converge** with no
   locking.
3. **Idempotent everywhere.** Every state change is an **event** with a caller-minted
   `event_id`. Applying the same event twice — from either side, in any order — is a
   no-op (§5). Duplicate delivery is expected and harmless.
4. **Minimize shared data.** The production sync carries what is needed to roast and
   fulfill — order id, line items, weight, status. Customer PII is **not** shared by
   default (§9).
5. **Tolerant reading.** Unknown JSON fields are ignored, never rejected, so the
   contract can grow additively (§10).

---

## 2. Canonical identity

- An order is identified by the **Store's order UUID** (`order_id`). It is minted by
  the Store when a payment succeeds and never changes. PZY-Tab references this id and
  never mints its own order identity.
- Line items reference the Store's `product_id` (or `lab_id`). PZY-Tab maps a
  `product_id` to its own green-coffee/roast profile on its side.
- Every event has its own globally-unique `event_id` (UUID v4), independent of
  `order_id`, used purely for idempotency.

---

## 3. System-of-record split (ownership)

| Fact | Owner | Notes |
| --- | --- | --- |
| Order existence, `order_id`, line items, weights | **Store** | Created at payment. Immutable snapshot. |
| Payment status, totals, currency | **Store** | Stripe-driven. |
| Customer + shipping address | **Store** | Not shared by default (§9). |
| Lifecycle stage `new` | **Store** | Set when payment succeeds. |
| Lifecycle stages `in_progress`, `roasting`, `roasted` | **PZY-Tab** | The roast floor. |
| Lifecycle stage `shipped`, tracking number | **Store** | Store dispatches (ship-only for now). |
| `delivered` _(deferred)_ | **Store** | Carrier-driven later. |
| `on_hold` overlay | **Either** | Whoever pauses. |
| `canceled`, `refunded` | **Store** | Payment-side terminal states. |

A system **emits** transitions only for facts it owns, and **accepts** (applies)
events for any fact. Ownership is a rule about who *originates* a change; both sides
store the full picture.

---

## 4. Fulfillment lifecycle

The lifecycle is a **ladder** (`fulfillment_status`) plus two orthogonal overlays
(`held`, `terminal`). Keeping terminal/hold out of the ladder keeps the forward-only
rule pure.

### 4.1 Ladder stages

| status | ordinal | owner | meaning |
| --- | ---: | --- | --- |
| `new` | 0 | Store | Paid, awaiting production. |
| `in_progress` | 10 | PZY-Tab | Accepted into roast planning / queued. |
| `roasting` | 20 | PZY-Tab | On the roaster. |
| `roasted` | 30 | PZY-Tab | Roast complete, awaiting dispatch. |
| _(reserved: `packed` = 40)_ | 40 | — | Left free for a future packing step. |
| `shipped` | 50 | Store | Dispatched; tracking attached. |
| `delivered` _(deferred)_ | 60 | Store | Received by customer. |

Ordinals are gap-numbered by 10 so new stages can be inserted without renumbering.

### 4.2 Overlays

- **`held`** (`bool` + `hold_reason`): a pause that **retains** the ladder position.
  Owned by either side. While `held`, systems SHOULD not advance the ladder.
- **`terminal`** (`null | "canceled" | "refunded"`): once set, the ladder is
  **frozen**; further ladder transitions are ignored (recorded for audit, not
  applied). `canceled` is only valid before `shipped`. `refunded` is Store-owned and
  may follow `canceled`.

### 4.3 Transition application rule

Given an incoming event, each system applies it deterministically:

1. **Dedup:** if `event_id` was already applied → **no-op**, return current state.
2. **Terminal guard:** if `terminal` is set and the event is a ladder transition →
   record for audit, **do not** change status.
3. **Ownership check:** if the event's target is a ladder stage the `source` does not
   own → reject (`ignored`, logged). Defense in depth; forward-only already limits harm.
4. **Forward-only:** for a ladder transition to ordinal `T`, apply iff
   `T > current_ordinal`. Otherwise **no-op** (stale/duplicate/out-of-order), still
   recorded for audit.
5. `hold` / `unhold` / `canceled` / `refunded` are their own event types with the
   rules in §4.2.

This rule is **commutative and idempotent**: replaying the same set of events in any
order yields the same final state.

---

## 5. Event model

Every change is an append-only event. The Store persists them in `order_events`
(§7.2); PZY-Tab keeps an equivalent log. The log is the audit trail **and** the sync
source.

```json
{
  "event_id": "1f2e3d4c-...-uuid",      // idempotency key, unique, caller-minted
  "order_id": "9a8b7c6d-...-uuid",      // canonical Store order id
  "type": "fulfillment.transition",     // see event types below
  "to_status": "roasting",              // for fulfillment.transition
  "to_ordinal": 20,                     // MUST match the table in §4.1
  "source": "pzy-tab",                  // "store" | "pzy-tab"
  "actor": "roaster:alex",              // free-form: who/what triggered it
  "note": "batch #7",                   // optional
  "occurred_at": "2026-07-18T15:04:05Z",// event time at the source (RFC 3339, UTC)
  "contract_version": "0.1.0"
}
```

### Event types

| `type` | Payload adds | Emitted by |
| --- | --- | --- |
| `order.created` | `items[]`, `total_weight_grams`, `placed_at` (§6.2) | Store |
| `fulfillment.transition` | `to_status`, `to_ordinal` | owner of that stage |
| `fulfillment.hold` / `fulfillment.unhold` | `hold_reason?` | either |
| `order.canceled` | `reason?` | Store |
| `order.refunded` | `reason?` | Store |
| `shipment.updated` | `tracking_number`, `carrier?` | Store |

`occurred_at` is informational (source clock). Ordering for sync is by the
**publisher's `seq`** (§6.1), never by wall-clock.

---

## 6. Sync protocol

Transport is HTTP + JSON. Delivery is **push-then-pull**: emit on change for low
latency, and periodically pull to reconcile anything missed. Because every event is
idempotent, doing both is safe and overlap is a no-op.

Each system exposes two endpoints to its peer, behind service-to-service auth (§9):

### 6.1 Changes feed (pull / reconcile)

```
GET /sync/fulfillment/changes?since=<cursor>&limit=<n>
→ 200 { "events": [ <event>, ... ], "next_cursor": <int>, "has_more": <bool> }
```

- `<cursor>` is the publisher's monotonic **`seq`** — a per-publisher integer assigned
  when it records an event. Start from `0`.
- Returns events with `seq > since`, ascending, up to `limit`. The consumer applies
  each via §4.3 and persists `next_cursor` only after the batch is durably applied
  (at-least-once; re-applying on crash is safe).

### 6.2 Event ingest (push)

```
POST /sync/fulfillment/events
Body: <event>            // single event, or { "events": [ ... ] } for a batch
→ 200 { "results": [ { "event_id": "...", "outcome": "applied|duplicate|ignored", "order": <snapshot?> } ] }
```

- Idempotent on `event_id`. `applied` = state changed; `duplicate` = already seen;
  `ignored` = rejected by a rule (§4.3) — the body says which.
- Never 4xx for a duplicate; duplicates are the normal case.

### 6.3 Flows

- **New paid order → PZY-Tab.** On payment success the Store records `order.created`
  (with line items + weights) and `fulfillment.transition → new`, then pushes to
  PZY-Tab's ingest. PZY-Tab also pulls the Store's `/changes` on a timer to backfill.
- **Roast progress → Store.** PZY-Tab emits `in_progress` / `roasting` / `roasted`
  and pushes them to the Store's ingest; the Store also pulls PZY-Tab's `/changes`.
- **Ship → PZY-Tab.** Store emits `shipped` + `shipment.updated`; PZY-Tab consumes
  for its own display/close-out.

`order.created` is the only message carrying line items; lifecycle messages carry
only status. A consumer that receives a lifecycle event for an unknown `order_id`
SHOULD pull `/changes` (or request the order) to backfill, then apply.

---

## 7. Store data model (Postgres)

Additive to the current schema. PZY-Tab keeps an equivalent local model; only the
wire shapes above are contractual.

### 7.1 `orders` (extend)

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_ordinal INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS held BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS terminal TEXT;            -- null | canceled | refunded
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NOT NULL DEFAULT 'ship'; -- ship | pickup(deferred)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_address_id UUID REFERENCES addresses(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_address_snapshot JSONB;  -- frozen at order time
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_phone TEXT;
```

`status` (payment: `pending|paid|failed|canceled`) stays as-is and is **separate**
from `fulfillment_status`.

### 7.2 `order_events` (new, append-only)

```sql
CREATE TABLE order_events (
  seq         BIGSERIAL PRIMARY KEY,            -- publisher cursor (§6.1)
  event_id    UUID NOT NULL UNIQUE,             -- idempotency key (§5)
  order_id    UUID NOT NULL REFERENCES orders(id),
  type        TEXT NOT NULL,
  to_status   TEXT,
  to_ordinal  INT,
  source      TEXT NOT NULL,                    -- store | pzy-tab
  actor       TEXT,
  note        TEXT,
  payload     JSONB,                            -- type-specific extras
  outcome     TEXT NOT NULL,                    -- applied | duplicate | ignored
  occurred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON order_events (order_id, seq);
```

### 7.3 Line-item snapshot (extend `orders.items`)

Each item MUST carry enough to roast and to compute volume:

```json
{ "product_id": "uuid", "name": "Ethiopia Guji", "roast": 2,
  "quantity": 2, "net_weight_grams": 340, "unit_cents": 1800, "kind": "product" }
```

`total_weight_grams = Σ(quantity · net_weight_grams)`. This requires a new
`products.net_weight_grams` column (the label's `12 OZ / 340 G` is a constant today).

### 7.4 `addresses` + accounts — see §8.

---

## 8. Accounts & guest→account merge

Builds on the existing guest model (`users.is_guest`, `CreateGuestUser`,
`MergeGuestCart`).

### 8.1 Identity resolution at checkout

Given a checkout email (and optional phone):

1. A **real** account with that email exists → attach the order to it. (Placing an
   order does not authenticate; sensitive account access still requires sign-in.)
2. Else a **guest** with that email exists → reuse it.
3. Else → `CreateGuestUser` and record `email` / `phone`.

Add `users.phone TEXT` and allow guests to carry `email`/`phone` (already nullable).

### 8.2 Addresses

```sql
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT, line1 TEXT, line2 TEXT, city TEXT, region TEXT,
  postal_code TEXT, country TEXT, phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The **account** holds a reusable address book; the **order** freezes a copy in
`ship_address_snapshot` (addresses change; an order must record where it actually
shipped).

### 8.3 Merge rules

Generalize `MergeGuestCart` → `MergeGuestInto(guestID, realID)`, run in one
transaction and **idempotently**:

- Reassign `orders.user_id`, `addresses.user_id`, and cart rows from guest → real.
- Fold the cart (existing behavior).
- Mark the guest row merged: `merged_into_user_id UUID` (and exclude merged rows from
  normal queries), preserving an audit trail.

**Match on identity, not address.** The merge key is a **verified email** (or phone);
a shared shipping address MUST NOT trigger a merge (families/roommates/offices cause
false merges). Address is delivery data, not identity.

**Security prerequisite.** Auto-claiming a guest's past orders at signup is only safe
if signup **verifies email ownership**. Until email verification exists, either (a)
require verification before merging historical orders, or (b) merge only the cart/
session, and let a customer explicitly "claim" past orders via a verification step.
_(Email verification is not yet implemented — tracked as a prerequisite.)_

---

## 9. Security & privacy of the channel

- **Service-to-service auth**, distinct from customer sessions: a shared bearer secret
  (via `_FILE`/mounted secret, per the repo's secret convention) or mTLS. Rotate-able.
- **Signed bodies:** HMAC over the raw body (including `event_id`) so a replayed body
  can't be forged; combined with `event_id` dedup, replays are inert.
- **TLS** in transit; endpoints are not exposed to the public browser origin (not in
  CORS allowlist).
- **PII minimization:** the production sync sends `order_id`, line items, weights, and
  status — **no** customer name/email/phone/address by default. Shipping/PII fields are
  shared only if PZY-Tab takes over label printing/shipping _(deferred; renegotiate
  ownership in §3 if so)_.
- **Least data on PZY-Tab:** it needs "what to roast, how much, for which order" — not
  who the customer is.

---

## 10. Contract versioning

- `contract_version` (semver) travels on every payload.
- **Additive, backward-compatible** changes (new optional fields, new event types,
  new reserved ordinals) bump the **minor** version; both sides ignore unknown fields
  and unknown event types (log + skip).
- **Breaking** changes (renamed/removed fields, changed ordinals, changed ownership)
  bump the **major** version and require coordinated deploys.
- Consumers MUST reject an event whose **major** version they don't support.

---

## 11. Open questions / deferred

- **Email verification** at signup — prerequisite for safe historical-order merge (§8.3).
- **Pickup** as a second `fulfillment_method` (workforce-dependent; ship-only for now).
- **`delivered`** stage — needs carrier tracking integration.
- **`packed`** stage (ordinal 40) — reserved; add if packing becomes a distinct step.
- **Push vs. pull only** — start with pull reconciliation if standing up ingest on both
  sides is not yet worth it; the model supports either.
- **Reconciliation cadence** and **retry/backoff** for push failures — implementation
  detail, not contractual, but both sides should pull at least periodically.

---

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 0.1.0 | 2026-07-18 | Initial draft. |
