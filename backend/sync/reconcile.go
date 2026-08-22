// background reconciliation: pull the peer's changes feed on a timer so this
// roaster learns about orders it was never pushed (§6.3). without this a
// lifecycle event for an unknown order is ignored with nothing to trigger the
// backfill the contract calls for -- and against a store that never pushes at
// all, it is the only way orders reach the roast floor.
package sync

import (
	"context"
	"log"
	"time"
)

// DefaultReconcileInterval is a compromise: a roast lasts minutes, so an order
// appearing on the board within half a minute is not felt by the operator,
// while the poll costs one small request against the store.
const DefaultReconcileInterval = 30 * time.Second

// StartReconcile polls the peer until ctx is done. No-op without a peer URL.
//
// The cursor is deliberately NOT persisted across restarts: the event log is
// in-memory, so a fresh process has to replay the peer's whole feed to rebuild
// its order board anyway. Application is idempotent, so replaying is safe --
// duplicates apply as no-ops.
func (s *Service) StartReconcile(ctx context.Context, interval time.Duration) {
	if !s.canReachPeer() {
		return
	}
	if interval <= 0 {
		interval = DefaultReconcileInterval
	}

	go func() {
		// pull once at startup rather than waiting out the first interval --
		// a roaster that just booted should show the board immediately.
		s.reconcileOnce(ctx)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.reconcileOnce(ctx)
			}
		}
	}()
}

// reconcileOnce drains the feed from the current cursor. Pages until the peer
// says there's no more, so a long backlog catches up in one pass instead of one
// page per tick.
func (s *Service) reconcileOnce(ctx context.Context) {
	const maxPages = 100 // bounds a single pass; the next tick resumes

	for range maxPages {
		s.mu.Lock()
		cursor := s.cursor
		s.mu.Unlock()

		next, hasMore, err := s.PullChanges(ctx, cursor)
		if err != nil {
			// transient by assumption: the peer may be down or restarting.
			// we keep the cursor and try again on the next tick.
			log.Printf("sync: reconcile from cursor %d failed: %v", cursor, err)
			return
		}

		s.mu.Lock()
		// only ever move forward. a peer that answers with a smaller cursor
		// (rebuilt database, misconfigured pairing) must not make us rewind
		// and re-pull its feed forever.
		if next > s.cursor {
			s.cursor = next
		}
		s.mu.Unlock()

		if !hasMore || next <= cursor {
			return
		}
	}
	log.Printf("sync: reconcile hit the page limit; resuming on the next tick")
}
