package sync

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func event(id, orderID, typ, toStatus, source string) Event {
	e := Event{
		EventID:         id,
		OrderID:         orderID,
		Type:            typ,
		ToStatus:        toStatus,
		Source:          source,
		ContractVersion: ContractVersion,
	}
	if ord, ok := ladderOrdinals[toStatus]; ok {
		e.ToOrdinal = &ord
	}
	return e
}

func created(id, orderID string) Event {
	return event(id, orderID, "order.created", "", SourceStore)
}

func TestApplyRules(t *testing.T) {
	l := NewLog()

	// order.created applies once, duplicates on replay (by event_id)
	if out, _ := l.Apply(created("e1", "o1")); out != OutcomeApplied {
		t.Fatalf("create: got %s", out)
	}
	if out, _ := l.Apply(created("e1", "o1")); out != OutcomeDuplicate {
		t.Fatalf("replay: got %s", out)
	}

	// forward transition by the owner applies
	if out, st := l.Apply(event("e2", "o1", "fulfillment.transition", "roasting", SourceTab)); out != OutcomeApplied || st.Ordinal != 20 {
		t.Fatalf("roasting: got %s ordinal %d", out, st.Ordinal)
	}

	// stale backward transition is ignored, state unchanged
	if out, st := l.Apply(event("e3", "o1", "fulfillment.transition", "in_progress", SourceTab)); out != OutcomeIgnored || st.Status != "roasting" {
		t.Fatalf("backward: got %s status %s", out, st.Status)
	}

	// wrong owner is ignored (pzy-tab may not claim shipped)
	if out, _ := l.Apply(event("e4", "o1", "fulfillment.transition", "shipped", SourceTab)); out != OutcomeIgnored {
		t.Fatalf("wrong owner: got %s", out)
	}

	// wrong ordinal for the stage is ignored
	bad := event("e5", "o1", "fulfillment.transition", "roasted", SourceTab)
	wrong := 99
	bad.ToOrdinal = &wrong
	if out, _ := l.Apply(bad); out != OutcomeIgnored {
		t.Fatalf("ordinal mismatch: got %s", out)
	}

	// cancel freezes the ladder (terminal guard)
	if out, _ := l.Apply(event("e6", "o1", "order.canceled", "", SourceStore)); out != OutcomeApplied {
		t.Fatalf("cancel: got %s", out)
	}
	if out, st := l.Apply(event("e7", "o1", "fulfillment.transition", "roasted", SourceTab)); out != OutcomeIgnored || st.Status != "roasting" {
		t.Fatalf("after terminal: got %s status %s", out, st.Status)
	}

	// unknown order and unsupported major version are ignored
	if out, _ := l.Apply(event("e8", "o-unknown", "fulfillment.transition", "roasting", SourceTab)); out != OutcomeIgnored {
		t.Fatalf("unknown order: got %s", out)
	}
	v2 := created("e9", "o2")
	v2.ContractVersion = "2.0.0"
	if out, _ := l.Apply(v2); out != OutcomeIgnored {
		t.Fatalf("major version: got %s", out)
	}
}

func TestChangesFeed(t *testing.T) {
	l := NewLog()
	l.Apply(created("e1", "o1"))
	l.Apply(event("e2", "o1", "fulfillment.transition", "in_progress", SourceTab))
	l.Apply(event("e3", "o1", "fulfillment.transition", "roasting", SourceTab))

	events, next, hasMore := l.Changes(0, 2)
	if len(events) != 2 || next != 2 || !hasMore {
		t.Fatalf("page 1: len=%d next=%d hasMore=%v", len(events), next, hasMore)
	}
	events, next, hasMore = l.Changes(next, 2)
	if len(events) != 1 || next != 3 || hasMore {
		t.Fatalf("page 2: len=%d next=%d hasMore=%v", len(events), next, hasMore)
	}
}

func TestAuth(t *testing.T) {
	svc := NewService(Config{AuthToken: "tok", SigningSecret: "sec"})
	mux := http.NewServeMux()
	svc.Register(mux)

	body, _ := json.Marshal(created("a1", "o1"))

	post := func(auth, sig string) int {
		req := httptest.NewRequest(http.MethodPost, "/sync/fulfillment/events", bytes.NewReader(body))
		if auth != "" {
			req.Header.Set("Authorization", auth)
		}
		if sig != "" {
			req.Header.Set(signatureHeader, sig)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := post("", ""); code != http.StatusUnauthorized {
		t.Fatalf("no auth: got %d", code)
	}
	if code := post("Bearer wrong", sign("sec", body)); code != http.StatusUnauthorized {
		t.Fatalf("bad token: got %d", code)
	}
	if code := post("Bearer tok", "deadbeef"); code != http.StatusUnauthorized {
		t.Fatalf("bad signature: got %d", code)
	}
	if code := post("Bearer tok", sign("sec", body)); code != http.StatusOK {
		t.Fatalf("valid: got %d", code)
	}
	// same body again: authorized, event deduped not re-applied
	req := httptest.NewRequest(http.MethodPost, "/sync/fulfillment/events", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer tok")
	req.Header.Set(signatureHeader, sign("sec", body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var resp struct {
		Results []struct {
			Outcome string `json:"outcome"`
		} `json:"results"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil || len(resp.Results) != 1 {
		t.Fatalf("replay decode: %v", err)
	}
	if resp.Results[0].Outcome != OutcomeDuplicate {
		t.Fatalf("replay outcome: got %s", resp.Results[0].Outcome)
	}
}
