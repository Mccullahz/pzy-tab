// the roast floor's view of fulfillment: which orders are on the board, which
// one is on the drum right now, and the events this roaster originates as it
// works them (§3 -- pzy-tab owns in_progress/roasting/roasted).
//
// the handlers here are BROWSER-facing and belong behind the app's CORS
// middleware, unlike the /sync/* peer endpoints in service.go. they expose only
// what the tablet needs to draw a queue; they are not a second ingest path.
package sync

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"time"
)

// Orders returns a snapshot of every known order, most recently advanced first
// so the roast floor sees what's moving at the top.
func (l *Log) Orders() []OrderState {
	l.mu.Lock()
	defer l.mu.Unlock()

	out := make([]OrderState, 0, len(l.orders))
	for _, o := range l.orders {
		out = append(out, *o)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Ordinal != out[j].Ordinal {
			return out[i].Ordinal > out[j].Ordinal
		}
		return out[i].OrderID < out[j].OrderID
	})
	return out
}

// ActiveOrder is the order currently claimed by this roaster. "" when idle.
func (s *Service) ActiveOrder() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.activeOrder
}

// RegisterBrowser mounts the tablet-facing order routes. wrap is the app's CORS
// middleware -- passed in rather than imported so this package stays unaware of
// the http surface around it.
func (s *Service) RegisterBrowser(mux *http.ServeMux, wrap func(http.HandlerFunc) http.HandlerFunc) {
	mux.HandleFunc("GET /orders", wrap(s.handleOrders))
	mux.HandleFunc("POST /orders/select", wrap(s.handleSelect))
}

func (s *Service) handleOrders(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"orders":          s.Log.Orders(),
		"active_order_id": s.ActiveOrder(),
	})
}

// handleSelect claims an order for this roaster: it becomes the order that roast
// start/finish events attach to, and the claim itself advances it to
// in_progress. selecting "" releases without advancing anything.
func (s *Service) handleSelect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OrderID string `json:"order_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "malformed request", http.StatusBadRequest)
		return
	}

	if body.OrderID == "" {
		s.mu.Lock()
		s.activeOrder = ""
		s.mu.Unlock()
		writeJSON(w, map[string]any{"orders": s.Log.Orders(), "active_order_id": ""})
		return
	}

	// only claim orders we actually know about; an unknown id here means the
	// tablet is looking at a stale board.
	st := s.Log.snapshotOf(body.OrderID)
	if st == nil {
		http.Error(w, "unknown order", http.StatusNotFound)
		return
	}
	// refuse orders the ladder would never advance. the UI hides these, but a
	// stale board can still ask -- and silently claiming an order that can't be
	// roasted would strand the drum on it.
	switch {
	case st.Terminal != "":
		http.Error(w, "order was "+st.Terminal, http.StatusConflict)
		return
	case st.Held:
		http.Error(w, "order is on hold", http.StatusConflict)
		return
	case st.Ordinal >= ladderOrdinals["roasted"]:
		http.Error(w, "order is already roasted", http.StatusConflict)
		return
	}

	s.mu.Lock()
	s.activeOrder = body.OrderID
	s.mu.Unlock()

	s.emit(Event{OrderID: body.OrderID, Type: "fulfillment.transition", ToStatus: "in_progress"})
	writeJSON(w, map[string]any{"orders": s.Log.Orders(), "active_order_id": body.OrderID})
}

// HandleRoastEvent maps roast-floor activity onto the fulfillment ladder. wired
// to data.OnRoastEvent in main, which is what makes the roaster's actions
// visible to the storefront.
func (s *Service) HandleRoastEvent(kind, profile string) {
	orderID := s.ActiveOrder()
	if orderID == "" {
		return // roasting without a claimed order is fine -- nothing to report
	}

	switch kind {
	case "started":
		s.emit(Event{OrderID: orderID, Type: "fulfillment.transition", ToStatus: "roasting", Note: profile})
	case "completed":
		s.emit(Event{OrderID: orderID, Type: "fulfillment.transition", ToStatus: "roasted", Note: profile})
		// the drum is free; the operator picks the next order off the board.
		s.mu.Lock()
		if s.activeOrder == orderID {
			s.activeOrder = ""
		}
		s.mu.Unlock()
	}
}

// emit stamps, applies, and forwards an event this roaster originates. it goes
// through the same Log.Apply as anything inbound, so our own events obey the
// ownership and forward-only rules rather than bypassing them -- an emit that
// isn't legal for the order's current state is ignored and logged, not forced.
func (s *Service) emit(e Event) {
	e.EventID = newEventID()
	e.Source = SourceTab
	e.ContractVersion = ContractVersion
	e.OccurredAt = time.Now().UTC().Format(time.RFC3339)
	if ord, ok := ladderOrdinals[e.ToStatus]; ok {
		e.ToOrdinal = &ord
	}

	outcome, _ := s.Log.Apply(e)
	if outcome != OutcomeApplied {
		log.Printf("sync: local event %s not applied (outcome=%s type=%s order=%s to=%s)",
			e.EventID, outcome, e.Type, e.OrderID, e.ToStatus)
		return
	}

	// push in the background: the roast floor must never wait on the network,
	// and a failed push is reconciled by the peer pulling our /changes feed.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := s.PushEvents(ctx, []Event{e}); err != nil {
			log.Printf("sync: push failed for %s (peer will reconcile via /changes): %v", e.EventID, err)
		}
	}()
}

func (l *Log) snapshotOf(orderID string) *OrderState {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.snapshot(orderID)
}

// newEventID mints a UUID v4, which §5 of the contract requires. This is not
// cosmetic: peers store event_id in a UUID column, and anything else is
// rejected on arrival.
func newEventID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand failing is not recoverable here. fall back to the clock
		// so we still emit a well-formed, near-certainly unique id rather than
		// something a peer will refuse.
		binary.BigEndian.PutUint64(b[0:8], uint64(time.Now().UnixNano()))
		binary.BigEndian.PutUint64(b[8:16], uint64(time.Now().UnixNano())*2654435761)
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10x
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
