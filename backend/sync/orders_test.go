package sync

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

// newTestService builds a service with credentials but no peer, so emit applies
// locally and the outbound push is a no-op.
func newTestService() *Service {
	return NewService(Config{AuthToken: "t", SigningSecret: "s"})
}

func TestOrdersSortsMostAdvancedFirst(t *testing.T) {
	l := NewLog()
	l.Apply(created("e1", "o1"))
	l.Apply(created("e2", "o2"))
	l.Apply(event("e3", "o2", "fulfillment.transition", "roasting", SourceTab))

	orders := l.Orders()
	if len(orders) != 2 {
		t.Fatalf("want 2 orders, got %d", len(orders))
	}
	if orders[0].OrderID != "o2" || orders[0].Status != "roasting" {
		t.Fatalf("want o2/roasting first, got %s/%s", orders[0].OrderID, orders[0].Status)
	}

	// snapshots, not aliases: mutating the result must not touch the log
	orders[0].Status = "tampered"
	if l.Orders()[0].Status != "roasting" {
		t.Fatal("Orders() leaked a pointer into log state")
	}
}

func TestSelectClaimsOrder(t *testing.T) {
	s := newTestService()
	s.Log.Apply(created("e1", "o1"))

	rec := httptest.NewRecorder()
	s.handleSelect(rec, httptest.NewRequest("POST", "/orders/select", strings.NewReader(`{"order_id":"o1"}`)))

	if rec.Code != 200 {
		t.Fatalf("select: got %d", rec.Code)
	}
	if s.ActiveOrder() != "o1" {
		t.Fatalf("active order: got %q", s.ActiveOrder())
	}
	if st := s.Log.snapshotOf("o1"); st.Status != "in_progress" {
		t.Fatalf("claim should advance to in_progress, got %s", st.Status)
	}
}

func TestSelectUnknownOrderIs404(t *testing.T) {
	s := newTestService()

	rec := httptest.NewRecorder()
	s.handleSelect(rec, httptest.NewRequest("POST", "/orders/select", strings.NewReader(`{"order_id":"nope"}`)))

	if rec.Code != 404 {
		t.Fatalf("want 404 for unknown order, got %d", rec.Code)
	}
	if s.ActiveOrder() != "" {
		t.Fatalf("unknown order must not be claimed, got %q", s.ActiveOrder())
	}
}

// the drum must not be stranded on an order the ladder will never advance.
func TestSelectRefusesUnroastableOrders(t *testing.T) {
	cases := []struct {
		name  string
		setup func(*Service)
	}{
		{"canceled", func(s *Service) {
			s.Log.Apply(created("e1", "o1"))
			s.Log.Apply(event("e2", "o1", "order.canceled", "", SourceStore))
		}},
		{"held", func(s *Service) {
			s.Log.Apply(created("e1", "o1"))
			s.Log.Apply(event("e2", "o1", "fulfillment.hold", "", SourceStore))
		}},
		{"already roasted", func(s *Service) {
			s.Log.Apply(created("e1", "o1"))
			s.Log.Apply(event("e2", "o1", "fulfillment.transition", "roasted", SourceTab))
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := newTestService()
			tc.setup(s)

			rec := httptest.NewRecorder()
			s.handleSelect(rec, httptest.NewRequest("POST", "/orders/select", strings.NewReader(`{"order_id":"o1"}`)))

			if rec.Code != 409 {
				t.Fatalf("want 409, got %d", rec.Code)
			}
			if s.ActiveOrder() != "" {
				t.Fatalf("drum was claimed anyway: %q", s.ActiveOrder())
			}
		})
	}
}

func TestRoastEventsWalkTheLadder(t *testing.T) {
	s := newTestService()
	s.Log.Apply(created("e1", "o1"))
	s.activeOrder = "o1"

	s.HandleRoastEvent("started", "Colombia Huila")
	if st := s.Log.snapshotOf("o1"); st.Status != "roasting" {
		t.Fatalf("start: want roasting, got %s", st.Status)
	}

	s.HandleRoastEvent("completed", "Colombia Huila")
	if st := s.Log.snapshotOf("o1"); st.Status != "roasted" {
		t.Fatalf("complete: want roasted, got %s", st.Status)
	}
	// the drum is free again
	if s.ActiveOrder() != "" {
		t.Fatalf("completion should release the order, got %q", s.ActiveOrder())
	}
}

func TestRoastEventsWithoutClaimedOrderAreInert(t *testing.T) {
	s := newTestService()
	s.Log.Apply(created("e1", "o1"))

	s.HandleRoastEvent("started", "Colombia Huila")

	if st := s.Log.snapshotOf("o1"); st.Status != "new" {
		t.Fatalf("unclaimed order must not advance, got %s", st.Status)
	}
}

// an emit that the ladder rejects must leave state alone rather than force it.
func TestEmitRespectsForwardOnlyRule(t *testing.T) {
	s := newTestService()
	s.Log.Apply(created("e1", "o1"))
	s.Log.Apply(event("e2", "o1", "fulfillment.transition", "shipped", SourceStore))

	s.activeOrder = "o1"
	s.HandleRoastEvent("started", "")

	if st := s.Log.snapshotOf("o1"); st.Status != "shipped" {
		t.Fatalf("emit walked an order backwards: got %s", st.Status)
	}
}

func TestOrdersEndpointShape(t *testing.T) {
	s := newTestService()
	s.Log.Apply(created("e1", "o1"))
	s.activeOrder = "o1"

	rec := httptest.NewRecorder()
	s.handleOrders(rec, httptest.NewRequest("GET", "/orders", nil))

	var body struct {
		Orders        []OrderState `json:"orders"`
		ActiveOrderID string       `json:"active_order_id"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Orders) != 1 || body.ActiveOrderID != "o1" {
		t.Fatalf("got %d orders, active %q", len(body.Orders), body.ActiveOrderID)
	}
}

func TestEventIDsAreUnique(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		id := newEventID()
		if seen[id] {
			t.Fatalf("duplicate event id %s", id)
		}
		seen[id] = true
	}
}

// §5 requires UUID v4. peers store event_id in a UUID column, so a
// differently-shaped id is rejected on arrival -- and the peer answers 200
// while doing it, which is how this hid the first time.
func TestEventIDsAreUUIDv4(t *testing.T) {
	re := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	for i := 0; i < 200; i++ {
		if id := newEventID(); !re.MatchString(id) {
			t.Fatalf("not a uuid v4: %q", id)
		}
	}
}

// a peer that answers 200 while refusing the event must not read as delivered.
func TestPushSurfacesRejectedOutcomes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]string{{"event_id": "e1", "outcome": "error"}},
		})
	}))
	defer srv.Close()

	s := NewService(Config{AuthToken: "t", SigningSecret: "s", PeerURL: srv.URL})
	err := s.PushEvents(context.Background(), []Event{created("e1", "o1")})

	if err == nil {
		t.Fatal("a rejected event reported success")
	}
}

func TestPushAcceptsDuplicateAsDelivered(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]string{{"event_id": "e1", "outcome": "duplicate"}},
		})
	}))
	defer srv.Close()

	s := NewService(Config{AuthToken: "t", SigningSecret: "s", PeerURL: srv.URL})
	if err := s.PushEvents(context.Background(), []Event{created("e1", "o1")}); err != nil {
		t.Fatalf("duplicate should count as delivered: %v", err)
	}
}
