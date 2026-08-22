// event model + local event log implementing the fulfillment contract
// (docs/ORDER_FULFILLMENT.md). the log is in-memory for now; swap for sqlite
// when logging lands. application rules follow §4.3: dedup by event_id,
// terminal guard, ownership check, forward-only ladder -- commutative and
// idempotent, so replays and out-of-order delivery are harmless.
package sync

import (
	"encoding/json"
	"strconv"
	"strings"
	"sync"
)

const ContractVersion = "0.1.0"

const (
	SourceStore = "store"
	SourceTab   = "pzy-tab"
)

// ladder stages (§4.1). ordinal 40 (packed) is reserved.
var ladderOrdinals = map[string]int{
	"new":         0,
	"in_progress": 10,
	"roasting":    20,
	"roasted":     30,
	"shipped":     50,
	"delivered":   60,
}

// who may originate a transition to each stage (§3).
var ladderOwners = map[string]string{
	"new":         SourceStore,
	"in_progress": SourceTab,
	"roasting":    SourceTab,
	"roasted":     SourceTab,
	"shipped":     SourceStore,
	"delivered":   SourceStore,
}

type Event struct {
	EventID         string          `json:"event_id"`
	OrderID         string          `json:"order_id"`
	Type            string          `json:"type"`
	ToStatus        string          `json:"to_status,omitempty"`
	ToOrdinal       *int            `json:"to_ordinal,omitempty"`
	Source          string          `json:"source"`
	Actor           string          `json:"actor,omitempty"`
	Note            string          `json:"note,omitempty"`
	OccurredAt      string          `json:"occurred_at,omitempty"`
	ContractVersion string          `json:"contract_version"`
	Items           json.RawMessage `json:"items,omitempty"`
	TotalWeightG    int             `json:"total_weight_grams,omitempty"`
	PlacedAt        string          `json:"placed_at,omitempty"`
	HoldReason      string          `json:"hold_reason,omitempty"`
	Reason          string          `json:"reason,omitempty"`
	TrackingNumber  string          `json:"tracking_number,omitempty"`
	Carrier         string          `json:"carrier,omitempty"`

	// Payload is the type-specific envelope some publishers nest the fields
	// above inside. §6.2 puts them at the top level and that is what we emit,
	// but the PZY storefront carries them here (its `payload` JSONB column
	// reaches the wire as-is). See UnmarshalJSON.
	Payload json.RawMessage `json:"payload,omitempty"`
}

// UnmarshalJSON reads tolerantly (§10): fields the contract puts at the top
// level are also accepted nested under `payload`. Top level always wins; the
// fallback only fills what a publisher left empty. Applied at every decode
// path, so nothing downstream has to know a peer nests its extras.
func (e *Event) UnmarshalJSON(b []byte) error {
	type plain Event // shed the method to avoid recursing into ourselves
	var v plain
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	*e = Event(v)

	if len(e.Payload) == 0 {
		return nil
	}
	var nested struct {
		Items          json.RawMessage `json:"items"`
		TotalWeightG   int             `json:"total_weight_grams"`
		PlacedAt       string          `json:"placed_at"`
		HoldReason     string          `json:"hold_reason"`
		Reason         string          `json:"reason"`
		TrackingNumber string          `json:"tracking_number"`
		Carrier        string          `json:"carrier"`
	}
	// a payload we can't read is not an error: the event's own fields still
	// carry everything the ladder needs.
	if err := json.Unmarshal(e.Payload, &nested); err != nil {
		return nil
	}
	if len(e.Items) == 0 {
		e.Items = nested.Items
	}
	if e.TotalWeightG == 0 {
		e.TotalWeightG = nested.TotalWeightG
	}
	if e.PlacedAt == "" {
		e.PlacedAt = nested.PlacedAt
	}
	if e.HoldReason == "" {
		e.HoldReason = nested.HoldReason
	}
	if e.Reason == "" {
		e.Reason = nested.Reason
	}
	if e.TrackingNumber == "" {
		e.TrackingNumber = nested.TrackingNumber
	}
	if e.Carrier == "" {
		e.Carrier = nested.Carrier
	}
	return nil
}

type StoredEvent struct {
	Seq int64 `json:"seq"`
	Event
	Outcome string `json:"outcome"`
}

type OrderState struct {
	OrderID string `json:"order_id"`
	Status  string `json:"fulfillment_status"`
	Ordinal int    `json:"fulfillment_ordinal"`
	Held    bool   `json:"held"`
	// PlacedAt is when the customer ordered, carried on order.created. the roast
	// floor sorts by it to work the oldest order first.
	PlacedAt       string          `json:"placed_at,omitempty"`
	HoldReason     string          `json:"hold_reason,omitempty"`
	Terminal       string          `json:"terminal,omitempty"` // "" | canceled | refunded
	Items          json.RawMessage `json:"items,omitempty"`
	TotalWeightG   int             `json:"total_weight_grams,omitempty"`
	TrackingNumber string          `json:"tracking_number,omitempty"`
	Carrier        string          `json:"carrier,omitempty"`
}

const (
	OutcomeApplied   = "applied"
	OutcomeDuplicate = "duplicate"
	OutcomeIgnored   = "ignored"
)

type Log struct {
	mu      sync.Mutex
	seq     int64
	events  []StoredEvent
	applied map[string]bool
	orders  map[string]*OrderState
}

func NewLog() *Log {
	return &Log{
		applied: make(map[string]bool),
		orders:  make(map[string]*OrderState),
	}
}

// Apply runs the §4.3 transition rule and records the event (every delivery is
// kept for audit, including ignored ones -- only dedup skips recording).
func (l *Log) Apply(e Event) (outcome string, state *OrderState) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// 1. dedup on event_id
	if e.EventID == "" || l.applied[e.EventID] {
		return OutcomeDuplicate, l.snapshot(e.OrderID)
	}

	outcome = l.applyLocked(e)

	l.applied[e.EventID] = true
	l.seq++
	l.events = append(l.events, StoredEvent{Seq: l.seq, Event: e, Outcome: outcome})
	return outcome, l.snapshot(e.OrderID)
}

func (l *Log) applyLocked(e Event) string {
	// consumers must reject events from an unsupported major version (§10)
	if major(e.ContractVersion) != major(ContractVersion) {
		return OutcomeIgnored
	}

	order := l.orders[e.OrderID]

	switch e.Type {
	case "order.created":
		if order != nil {
			return OutcomeDuplicate
		}
		l.orders[e.OrderID] = &OrderState{
			OrderID:      e.OrderID,
			Status:       "new",
			Ordinal:      0,
			PlacedAt:     e.PlacedAt,
			Items:        e.Items,
			TotalWeightG: e.TotalWeightG,
		}
		return OutcomeApplied

	case "fulfillment.transition":
		if order == nil {
			return OutcomeIgnored // unknown order: caller should backfill via /changes (§6.3)
		}
		// 2. terminal guard
		if order.Terminal != "" {
			return OutcomeIgnored
		}
		target, ok := ladderOrdinals[e.ToStatus]
		if !ok || (e.ToOrdinal != nil && *e.ToOrdinal != target) {
			return OutcomeIgnored
		}
		// 3. ownership check
		if ladderOwners[e.ToStatus] != e.Source {
			return OutcomeIgnored
		}
		// 4. forward-only
		if target <= order.Ordinal {
			return OutcomeIgnored
		}
		order.Status = e.ToStatus
		order.Ordinal = target
		return OutcomeApplied

	case "fulfillment.hold":
		if order == nil || order.Terminal != "" || order.Held {
			return OutcomeIgnored
		}
		order.Held = true
		order.HoldReason = e.HoldReason
		return OutcomeApplied

	case "fulfillment.unhold":
		if order == nil || order.Terminal != "" || !order.Held {
			return OutcomeIgnored
		}
		order.Held = false
		order.HoldReason = ""
		return OutcomeApplied

	case "order.canceled":
		// store-owned; only valid before shipped (§4.2)
		if order == nil || e.Source != SourceStore || order.Terminal != "" || order.Ordinal >= ladderOrdinals["shipped"] {
			return OutcomeIgnored
		}
		order.Terminal = "canceled"
		return OutcomeApplied

	case "order.refunded":
		if order == nil || e.Source != SourceStore || order.Terminal == "refunded" {
			return OutcomeIgnored
		}
		order.Terminal = "refunded"
		return OutcomeApplied

	case "shipment.updated":
		if order == nil || e.Source != SourceStore {
			return OutcomeIgnored
		}
		order.TrackingNumber = e.TrackingNumber
		order.Carrier = e.Carrier
		return OutcomeApplied
	}

	// unknown event type: log + skip (§10 tolerant reading)
	return OutcomeIgnored
}

// Changes returns events with seq > since, ascending, up to limit (§6.1).
func (l *Log) Changes(since int64, limit int) (events []StoredEvent, nextCursor int64, hasMore bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	nextCursor = since
	for _, ev := range l.events {
		if ev.Seq <= since {
			continue
		}
		if len(events) >= limit {
			return events, nextCursor, true
		}
		events = append(events, ev)
		nextCursor = ev.Seq
	}
	return events, nextCursor, false
}

func (l *Log) snapshot(orderID string) *OrderState {
	if o, ok := l.orders[orderID]; ok {
		copy := *o
		return &copy
	}
	return nil
}

func major(version string) string {
	if i := strings.Index(version, "."); i > 0 {
		if _, err := strconv.Atoi(version[:i]); err == nil {
			return version[:i]
		}
	}
	return ""
}
