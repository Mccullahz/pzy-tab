package sync

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"
)

// storeStub stands in for the peer's changes feed, paging like the real one.
func storeStub(t *testing.T, events []Event, pageSize int) (*httptest.Server, *int64) {
	t.Helper()
	var calls int64

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&calls, 1)
		since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)

		var page []Event
		var next = since
		for i, e := range events {
			seq := int64(i + 1)
			if seq <= since {
				continue
			}
			if len(page) >= pageSize {
				break
			}
			page = append(page, e)
			next = seq
		}
		json.NewEncoder(w).Encode(map[string]any{
			"events":      page,
			"next_cursor": next,
			"has_more":    next < int64(len(events)),
		})
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func TestReconcilePagesThroughBacklog(t *testing.T) {
	events := []Event{
		created("s1", "o1"),
		event("s2", "o1", "fulfillment.transition", "shipped", SourceStore),
		created("s3", "o2"),
	}
	srv, _ := storeStub(t, events, 1) // one per page: forces paging

	s := NewService(Config{AuthToken: "t", SigningSecret: "s", PeerURL: srv.URL})
	s.reconcileOnce(context.Background())

	if got := len(s.Log.Orders()); got != 2 {
		t.Fatalf("want both orders pulled, got %d", got)
	}
	if st := s.Log.snapshotOf("o1"); st.Status != "shipped" {
		t.Fatalf("want o1 shipped, got %s", st.Status)
	}
	if s.cursor != 3 {
		t.Fatalf("cursor should end at 3, got %d", s.cursor)
	}
}

func TestReconcileIsIdempotent(t *testing.T) {
	srv, calls := storeStub(t, []Event{created("s1", "o1")}, 100)
	s := NewService(Config{AuthToken: "t", SigningSecret: "s", PeerURL: srv.URL})

	s.reconcileOnce(context.Background())
	before := atomic.LoadInt64(calls)
	s.reconcileOnce(context.Background())

	if got := len(s.Log.Orders()); got != 1 {
		t.Fatalf("replay duplicated state: %d orders", got)
	}
	// a second pass still asks (that's the point of polling) but shouldn't
	// re-walk the whole feed from zero.
	if atomic.LoadInt64(calls) != before+1 {
		t.Fatalf("second pass made %d calls, want 1", atomic.LoadInt64(calls)-before)
	}
}

// a peer that rewinds (rebuilt db, wrong pairing) must not put us in a loop.
func TestReconcileNeverRewindsCursor(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"events": []Event{}, "next_cursor": 0, "has_more": false,
		})
	}))
	defer srv.Close()

	s := NewService(Config{AuthToken: "t", SigningSecret: "s", PeerURL: srv.URL})
	s.cursor = 42
	s.reconcileOnce(context.Background())

	if s.cursor != 42 {
		t.Fatalf("cursor rewound to %d", s.cursor)
	}
}

func TestReconcileSurvivesPeerFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	s := NewService(Config{AuthToken: "t", SigningSecret: "s", PeerURL: srv.URL})
	s.cursor = 7
	s.reconcileOnce(context.Background()) // must return, not panic or spin

	if s.cursor != 7 {
		t.Fatalf("failed pull moved the cursor to %d", s.cursor)
	}
}

func TestReconcileWithoutPeerIsNoOp(t *testing.T) {
	s := NewService(Config{AuthToken: "t", SigningSecret: "s"})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	s.StartReconcile(ctx, time.Millisecond)
	s.reconcileOnce(ctx)

	if len(s.Log.Orders()) != 0 {
		t.Fatal("no peer configured, yet state appeared")
	}
}
