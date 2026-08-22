package data

import "testing"

func TestRoastEventsFireOnStartAndCompletion(t *testing.T) {
	var got []RoastEvent
	OnRoastEvent(func(e RoastEvent) { got = append(got, e) })
	defer OnRoastEvent(nil)

	Start()
	if len(got) != 1 || got[0].Kind != RoastStarted {
		t.Fatalf("start: got %v", got)
	}
	if got[0].Profile == "" {
		t.Fatal("start event should carry the active profile name")
	}

	// run the program out; completion fires exactly once, at the end.
	tickTo(Snapshot().ActiveProfile.DurationSec)
	if len(got) != 2 || got[1].Kind != RoastCompleted {
		t.Fatalf("completion: got %v", got)
	}

	// further ticks on a finished roast must not re-fire
	Tick()
	Tick()
	if len(got) != 2 {
		t.Fatalf("completion fired more than once: got %v", got)
	}
}

// a roast the operator stops by hand hasn't produced roasted coffee, so it must
// not report completion.
func TestManualStopDoesNotReportCompletion(t *testing.T) {
	var got []RoastEvent
	OnRoastEvent(func(e RoastEvent) { got = append(got, e) })
	defer OnRoastEvent(nil)

	Start()
	tickTo(60)
	Stop()

	for _, e := range got {
		if e.Kind == RoastCompleted {
			t.Fatal("manual stop reported the roast as completed")
		}
	}
}

// the observer runs outside the roaster lock, so reading state back from inside
// it must not deadlock. this test hangs rather than fails if that regresses.
func TestObserverCanReadStateWithoutDeadlock(t *testing.T) {
	OnRoastEvent(func(e RoastEvent) { _ = Snapshot() })
	defer OnRoastEvent(nil)

	Start()
	tickTo(Snapshot().ActiveProfile.DurationSec)
}
