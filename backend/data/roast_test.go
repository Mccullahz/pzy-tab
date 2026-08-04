package data

import (
	"math"
	"testing"
)

// tickTo advances the simulation to the given elapsed second.
func tickTo(sec int) {
	for Snapshot().ElapsedSeconds < sec {
		Tick()
	}
}

// The default profile (Colombia Huila) is:
//
//	step 0:   0-120s  hold ROR 26        fan 75 drum 62
//	step 1: 120-360s  ramp ROR 26 -> 14  fan 70 drum 60
//	step 2: 360-600s  ramp ROR 14 -> 8   fan 60 drum 58
//	step 3: 600-720s  hold ROR 8         fan 50 drum 55
func TestProgramExecution(t *testing.T) {
	Start()

	st := Snapshot()
	if st.ActiveProfile == nil {
		t.Fatal("expected an active profile")
	}
	if got := st.ActiveProfile.DurationSec; got != 720 {
		t.Fatalf("derived duration = %d, want 720 (sum of steps)", got)
	}

	// step 0: holds its ROR and commands its fan/drum.
	tickTo(60)
	st = Snapshot()
	if st.StepIndex != 0 {
		t.Errorf("at 60s step = %d, want 0", st.StepIndex)
	}
	if st.TargetROR != 26 {
		t.Errorf("at 60s target ROR = %v, want 26", st.TargetROR)
	}
	if st.FanSpeed != 75 || st.DrumRPM != 62 {
		t.Errorf("at 60s fan/drum = %d/%d, want 75/62", st.FanSpeed, st.DrumRPM)
	}

	// step 1 midpoint: ramp 26 -> 14 halfway is 20.
	tickTo(240)
	st = Snapshot()
	if st.StepIndex != 1 {
		t.Errorf("at 240s step = %d, want 1", st.StepIndex)
	}
	if math.Abs(st.TargetROR-20) > 0.01 {
		t.Errorf("at 240s target ROR = %v, want 20 (ramp midpoint)", st.TargetROR)
	}
	if st.FanSpeed != 70 || st.DrumRPM != 60 {
		t.Errorf("at 240s fan/drum = %d/%d, want 70/60", st.FanSpeed, st.DrumRPM)
	}

	// final step holds, and the roast auto-stops at the end of the program.
	tickTo(720)
	st = Snapshot()
	if st.Running {
		t.Error("roast should stop once the program completes")
	}
	if st.Progress != 100 {
		t.Errorf("progress = %d, want 100", st.Progress)
	}
	// integral of the program: 22 + 52 + 80 + 44 + 16 = 214C (plus wobble).
	if math.Abs(st.Temperature-214) > 3 {
		t.Errorf("final temp = %v, want ~214", st.Temperature)
	}
}

// The UI reads the commanded values back out of Status to compute its next
// adjustment (fan + 5, ROR - 1, ...). If a snapshot lagged a tick behind the
// command, a second tap inside that second would work off a stale number and
// silently drop the operator's adjustment.
func TestCommandIsVisibleImmediately(t *testing.T) {
	st := Start()
	if st.StepIndex != 0 {
		t.Errorf("step right after Start = %d, want 0", st.StepIndex)
	}
	if st.TargetROR != 26 || st.FanSpeed != 75 || st.DrumRPM != 62 {
		t.Errorf("Start snapshot = ror %v fan %d drum %d, want step 0's 26/75/62 without waiting a tick",
			st.TargetROR, st.FanSpeed, st.DrumRPM)
	}

	fan := 30
	if st := SetOverride(Overrides{FanSpeed: &fan}); st.FanSpeed != 30 {
		t.Errorf("fan right after override = %d, want 30 reflected immediately", st.FanSpeed)
	}
	if st := ClearOverride("fan_speed"); st.FanSpeed != 75 {
		t.Errorf("fan right after clearing = %d, want 75 back from the profile", st.FanSpeed)
	}
}

func TestOverridesBeatTheProfile(t *testing.T) {
	Start()
	tickTo(30)

	ror, fan := 5.0, 20
	SetOverride(Overrides{ROR: &ror, FanSpeed: &fan})
	Tick()

	st := Snapshot()
	if st.TargetROR != 5 {
		t.Errorf("target ROR = %v, want the override 5", st.TargetROR)
	}
	if st.FanSpeed != 20 {
		t.Errorf("fan = %d, want the override 20", st.FanSpeed)
	}
	// drum wasn't overridden, so it still follows step 0.
	if st.DrumRPM != 62 {
		t.Errorf("drum = %d, want 62 from the profile", st.DrumRPM)
	}

	ClearOverride("ror")
	Tick()
	if st := Snapshot(); st.TargetROR != 26 {
		t.Errorf("after clearing, target ROR = %v, want 26 from the profile", st.TargetROR)
	}

	ClearOverride("all")
	Tick()
	if st := Snapshot(); st.FanSpeed != 75 {
		t.Errorf("after clearing all, fan = %d, want 75 from the profile", st.FanSpeed)
	}

	// starting a fresh roast must clear any lingering overrides.
	SetOverride(Overrides{FanSpeed: &fan})
	Start()
	if ov := Snapshot().Overrides; ov.FanSpeed != nil {
		t.Error("Start should clear overrides")
	}
}

func TestNormalizeClampsAndDerivesDuration(t *testing.T) {
	p := normalize(Profile{
		Name:  "Bad Inputs",
		Steps: []Step{{DurationSec: 90, Mode: "nonsense", ROR: 999, FanSpeed: 250, DrumRPM: -5}},
	})
	s := p.Steps[0]
	if s.Mode != ModeHold {
		t.Errorf("mode = %q, want it coerced to hold", s.Mode)
	}
	if s.ROR != 60 || s.FanSpeed != 100 || s.DrumRPM != 0 {
		t.Errorf("values not clamped: %+v", s)
	}
	if s.ROREnd != s.ROR {
		t.Errorf("hold step ROREnd = %v, want it pinned to ROR %v", s.ROREnd, s.ROR)
	}
	if p.DurationSec != 90 {
		t.Errorf("duration = %d, want 90 derived from steps", p.DurationSec)
	}
}
