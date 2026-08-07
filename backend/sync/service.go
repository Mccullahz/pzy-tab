// http surface of the sync channel (contract §6): an ingest endpoint the peer
// pushes to and a changes feed the peer pulls. registered only when credentials
// are configured -- a standalone install has no /sync routes at all.
package sync

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
)

type Service struct {
	cfg Config
	Log *Log
}

func NewService(cfg Config) *Service {
	return &Service{cfg: cfg, Log: NewLog()}
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /sync/fulfillment/events", s.requireAuth(s.handleIngest))
	mux.HandleFunc("GET /sync/fulfillment/changes", s.requireAuth(s.handleChanges))
}

type ingestResult struct {
	EventID string      `json:"event_id"`
	Outcome string      `json:"outcome"`
	Order   *OrderState `json:"order,omitempty"`
}

// handleIngest accepts a single event or {"events": [...]} (§6.2). idempotent
// on event_id; duplicates are the normal case and never 4xx.
func (s *Service) handleIngest(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	var batch struct {
		Events []Event `json:"events"`
	}
	if err := json.Unmarshal(body, &batch); err != nil || len(batch.Events) == 0 {
		// not a batch envelope -- try as a single event
		var single Event
		if err := json.Unmarshal(body, &single); err != nil || single.EventID == "" {
			http.Error(w, "malformed event", http.StatusBadRequest)
			return
		}
		batch.Events = []Event{single}
	}

	results := make([]ingestResult, 0, len(batch.Events))
	for _, e := range batch.Events {
		outcome, order := s.Log.Apply(e)
		if outcome == OutcomeIgnored {
			log.Printf("sync: ignored event %s (type=%s order=%s)", e.EventID, e.Type, e.OrderID)
		}
		results = append(results, ingestResult{EventID: e.EventID, Outcome: outcome, Order: order})
	}

	writeJSON(w, map[string]any{"results": results})
}

// handleChanges serves the pull/reconcile feed (§6.1).
func (s *Service) handleChanges(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 || limit > 500 {
		limit = 100
	}

	events, next, hasMore := s.Log.Changes(since, limit)
	if events == nil {
		events = []StoredEvent{}
	}
	writeJSON(w, map[string]any{"events": events, "next_cursor": next, "has_more": hasMore})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
