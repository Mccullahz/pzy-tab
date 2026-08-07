// outbound side of the sync channel: push events we originate to the peer's
// ingest and pull its changes feed to reconcile (§6.3). every request carries
// the bearer token and an hmac signature over the raw body -- the same checks
// we enforce inbound. no-ops entirely when no peer url is configured.
package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

var httpClient = &http.Client{Timeout: 10 * time.Second}

func (s *Service) canReachPeer() bool {
	return s.cfg.PeerURL != ""
}

// PushEvents delivers events to the peer's ingest endpoint. failures are safe
// to ignore transiently -- the peer's periodic pull of our /changes feed
// reconciles anything missed.
func (s *Service) PushEvents(ctx context.Context, events []Event) error {
	if !s.canReachPeer() || len(events) == 0 {
		return nil
	}

	body, err := json.Marshal(map[string]any{"events": events})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.PeerURL+"/sync/fulfillment/events", bytes.NewReader(body))
	if err != nil {
		return err
	}
	s.authorize(req, body)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("peer ingest returned %s", resp.Status)
	}
	return nil
}

// PullChanges fetches one page of the peer's changes feed and applies it
// locally. returns the cursor to persist once the batch is applied.
func (s *Service) PullChanges(ctx context.Context, since int64) (next int64, hasMore bool, err error) {
	if !s.canReachPeer() {
		return since, false, nil
	}

	url := fmt.Sprintf("%s/sync/fulfillment/changes?since=%s&limit=100", s.cfg.PeerURL, strconv.FormatInt(since, 10))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return since, false, err
	}
	s.authorize(req, nil)

	resp, err := httpClient.Do(req)
	if err != nil {
		return since, false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return since, false, fmt.Errorf("peer changes returned %s", resp.Status)
	}

	var page struct {
		Events     []Event `json:"events"`
		NextCursor int64   `json:"next_cursor"`
		HasMore    bool    `json:"has_more"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&page); err != nil {
		return since, false, err
	}
	for _, e := range page.Events {
		s.Log.Apply(e)
	}
	return page.NextCursor, page.HasMore, nil
}

func (s *Service) authorize(req *http.Request, body []byte) {
	req.Header.Set("Authorization", "Bearer "+s.cfg.AuthToken)
	req.Header.Set(signatureHeader, sign(s.cfg.SigningSecret, body))
}
