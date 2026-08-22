// roast lifecycle notifications. the roaster is standalone software: it must not
// know that fulfillment sync exists, let alone import it. instead it announces
// what happened on the drum and whoever cares subscribes -- with no subscriber
// (the default, and the only case for an install without sync credentials) these
// are inert.
package data

import "sync"

// RoastEventKind is what just happened to the roast.
type RoastEventKind string

const (
	// RoastStarted -- an operator began a roast.
	RoastStarted RoastEventKind = "started"
	// RoastCompleted -- the program ran to the end of its last step. a roast the
	// operator stopped by hand does NOT produce this: an aborted roast hasn't
	// produced roasted coffee, and saying otherwise would advance an order.
	RoastCompleted RoastEventKind = "completed"
)

type RoastEvent struct {
	Kind    RoastEventKind
	Profile string // active profile name, "" if none
}

var (
	hookMu    sync.RWMutex
	roastHook func(RoastEvent)
)

// OnRoastEvent registers the observer. Passing nil clears it.
func OnRoastEvent(fn func(RoastEvent)) {
	hookMu.Lock()
	defer hookMu.Unlock()
	roastHook = fn
}

// notify fires the observer. MUST be called without the roaster lock held: the
// observer runs synchronously and may call back in to read a Snapshot.
func notify(e RoastEvent) {
	hookMu.RLock()
	fn := roastHook
	hookMu.RUnlock()
	if fn != nil {
		fn(e)
	}
}
