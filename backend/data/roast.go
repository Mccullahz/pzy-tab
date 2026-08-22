// stateful roast simulator.
//
// a Profile is an executable roast program, not just a label: it's an ordered
// list of Steps, each holding or ramping a target rate-of-rise while commanding
// a fan speed and drum rpm for its slice of the roast. the simulator walks the
// active profile's steps once per second, integrating the commanded ROR into the
// drum temperature, so temperature/ROR/stage/progress all stay consistent.
//
// the operator can override any commanded value mid-roast (see Override); an
// override wins over the profile until cleared. profiles + overrides are held in
// memory only -- no db yet (see example.md TODO).
package data

import (
	"math"
	"math/rand"
	"sync"
)

// step modes.
const (
	ModeHold = "hold"
	ModeRamp = "ramp"
)

// Step is one segment of a roast program.
type Step struct {
	DurationSec int     `json:"duration_sec"`
	Mode        string  `json:"mode"`    // "hold" | "ramp"
	ROR         float64 `json:"ror"`     // target ROR at step start, degrees C/min
	ROREnd      float64 `json:"ror_end"` // target ROR at step end; used when mode == "ramp"
	FanSpeed    int     `json:"fan_speed"`
	DrumRPM     int     `json:"drum_rpm"`
}

// Profile is a saved roast program.
type Profile struct {
	Name         string `json:"name"`
	RoastLevel   string `json:"roast_level"`   // e.g. "AG:70-75"
	TargetWeight string `json:"target_weight"` // e.g. "2.5KG"
	Steps        []Step `json:"steps"`
	DurationSec  int    `json:"duration_sec"` // derived: sum of step durations
}

// Overrides are operator-set values that take precedence over the profile.
// nil means "follow the profile".
type Overrides struct {
	ROR      *float64 `json:"ror"`
	FanSpeed *int     `json:"fan_speed"`
	DrumRPM  *int     `json:"drum_rpm"`
}

// Status is the live snapshot the frontend polls once per second.
type Status struct {
	Running        bool      `json:"running"`
	Temperature    float64   `json:"temperature"` // degrees C
	FanSpeed       int       `json:"fan_speed"`   // percent
	DrumRPM        int       `json:"drum_rpm"`
	HeatLevel      string    `json:"heat_level"` // Low / Medium / High
	ElapsedSeconds int       `json:"elapsed_seconds"`
	ROR            float64   `json:"ror"`        // observed rate of rise, degrees C/min
	TargetROR      float64   `json:"target_ror"` // what the program/override commands
	Stage          string    `json:"stage"`
	Progress       int       `json:"progress"`   // 0-100 percent
	StepIndex      int       `json:"step_index"` // active step, -1 when none
	Overrides      Overrides `json:"overrides"`
	ActiveProfile  *Profile  `json:"active_profile"`
}

const (
	ambientTemp     = 22.0  // drum resting temperature, degrees C
	maxTemp         = 260.0 // hard ceiling for the simulated probe
	defaultDuration = 720   // fallback when a profile has no steps
)

type roaster struct {
	mu        sync.Mutex
	running   bool
	elapsed   int
	temp      float64 // displayed drum temperature, degrees C
	base      float64 // integrated trend temperature (temp minus visual wobble)
	ror       float64 // observed rate of rise, degrees C per minute
	targetROR float64
	stepIndex int
	fan       int
	drum      int
	ov        Overrides
	active    *Profile
	profiles  []Profile
}

var state = newRoaster()

func newRoaster() *roaster {
	r := &roaster{
		temp:      ambientTemp,
		base:      ambientTemp,
		fan:       75,
		drum:      62,
		stepIndex: -1,
		profiles: []Profile{
			{
				Name: "Colombia Huila", RoastLevel: "AG:70-75", TargetWeight: "2.5KG",
				Steps: []Step{
					{DurationSec: 120, Mode: ModeHold, ROR: 26, FanSpeed: 75, DrumRPM: 62},
					{DurationSec: 240, Mode: ModeRamp, ROR: 26, ROREnd: 14, FanSpeed: 70, DrumRPM: 60},
					{DurationSec: 240, Mode: ModeRamp, ROR: 14, ROREnd: 8, FanSpeed: 60, DrumRPM: 58},
					{DurationSec: 120, Mode: ModeHold, ROR: 8, FanSpeed: 50, DrumRPM: 55},
				},
			},
			{
				Name: "Ethiopia Yirgacheffe", RoastLevel: "AG:80-85", TargetWeight: "1.0KG",
				Steps: []Step{
					{DurationSec: 120, Mode: ModeHold, ROR: 28, FanSpeed: 80, DrumRPM: 64},
					{DurationSec: 180, Mode: ModeRamp, ROR: 28, ROREnd: 16, FanSpeed: 75, DrumRPM: 62},
					{DurationSec: 180, Mode: ModeRamp, ROR: 16, ROREnd: 8, FanSpeed: 65, DrumRPM: 60},
					{DurationSec: 120, Mode: ModeHold, ROR: 8, FanSpeed: 55, DrumRPM: 58},
				},
			},
			{
				Name: "Brazil Cerrado", RoastLevel: "AG:55-60", TargetWeight: "3.0KG",
				Steps: []Step{
					{DurationSec: 120, Mode: ModeHold, ROR: 24, FanSpeed: 70, DrumRPM: 60},
					{DurationSec: 300, Mode: ModeRamp, ROR: 24, ROREnd: 14, FanSpeed: 65, DrumRPM: 58},
					{DurationSec: 240, Mode: ModeRamp, ROR: 14, ROREnd: 8, FanSpeed: 58, DrumRPM: 56},
					{DurationSec: 120, Mode: ModeHold, ROR: 6, FanSpeed: 50, DrumRPM: 54},
				},
			},
		},
	}
	for i := range r.profiles {
		r.profiles[i] = normalize(r.profiles[i])
	}
	active := r.profiles[0]
	r.active = &active
	return r
}

// Tick advances the simulation by one second. Called from a background ticker.
func Tick() {
	// registered before the unlock below so it runs after it (defers are LIFO):
	// the observer must never see the roaster lock held.
	completed := false
	profile := ""
	defer func() {
		if completed {
			notify(RoastEvent{Kind: RoastCompleted, Profile: profile})
		}
	}()

	state.mu.Lock()
	defer state.mu.Unlock()

	if !state.running {
		// idle: ease back toward ambient so a stopped drum still reads "alive".
		if state.temp > ambientTemp+0.2 {
			prev := state.temp
			state.temp += (ambientTemp - state.temp) * 0.02
			state.base = state.temp
			state.ror = (state.temp - prev) * 60.0
		} else {
			state.ror = 0
		}
		return
	}

	state.elapsed++
	state.applyCommandLocked()

	// integrate the commanded rate into the trend temperature.
	state.base = clamp(state.base+state.targetROR/60.0, ambientTemp, maxTemp)

	// the observed ROR tracks the command with a little sensor noise, and the
	// displayed temperature carries a gentle undulation over the trend so the
	// graph reads like a live probe rather than a perfect equation.
	state.ror = state.targetROR + (rand.Float64() - 0.5)
	state.temp = clamp(state.base+1.5*math.Sin(float64(state.elapsed)/15.0), ambientTemp, maxTemp)

	if state.elapsed >= state.durationLocked() {
		state.running = false
		completed = true
		if state.active != nil {
			profile = state.active.Name
		}
	}
}

// applyCommandLocked refreshes the commanded values from the program + overrides
// without advancing the roast. Called whenever the command can change (start,
// override, profile load) so a Snapshot taken immediately after is already
// coherent rather than a tick behind -- the UI steppers read these values back,
// so a stale one would lose the operator's adjustment. Caller holds mu.
func (r *roaster) applyCommandLocked() {
	r.targetROR, r.fan, r.drum, r.stepIndex = r.commandLocked()
}

// commandLocked resolves what the roaster should be doing right now: the active
// profile's step values, with any operator override taking precedence.
// Caller holds mu.
func (r *roaster) commandLocked() (ror float64, fan int, drum int, idx int) {
	ror, fan, drum, idx = 0, 75, 62, -1

	steps := r.stepsLocked()
	acc := 0
	for i, s := range steps {
		if r.elapsed < acc+s.DurationSec {
			ror, fan, drum, idx = s.ROR, s.FanSpeed, s.DrumRPM, i
			if s.Mode == ModeRamp && s.DurationSec > 0 {
				f := float64(r.elapsed-acc) / float64(s.DurationSec)
				ror = s.ROR + (s.ROREnd-s.ROR)*f
			}
			break
		}
		acc += s.DurationSec
	}
	// past the last step (or no steps): hold the final commanded values.
	if idx == -1 && len(steps) > 0 {
		last := steps[len(steps)-1]
		ror, fan, drum, idx = last.ROR, last.FanSpeed, last.DrumRPM, len(steps)-1
		if last.Mode == ModeRamp {
			ror = last.ROREnd
		}
	}

	if r.ov.ROR != nil {
		ror = *r.ov.ROR
	}
	if r.ov.FanSpeed != nil {
		fan = *r.ov.FanSpeed
	}
	if r.ov.DrumRPM != nil {
		drum = *r.ov.DrumRPM
	}
	return ror, fan, drum, idx
}

// Start resets the session and begins a new roast. Overrides are cleared so a
// fresh roast always starts on-program.
func Start() Status {
	state.mu.Lock()
	state.running = true
	state.elapsed = 0
	state.temp = ambientTemp
	state.base = ambientTemp
	state.ror = 0
	state.ov = Overrides{}
	state.applyCommandLocked() // commanded from step 0 immediately, not after the first tick
	profile := ""
	if state.active != nil {
		profile = state.active.Name
	}
	state.mu.Unlock()

	notify(RoastEvent{Kind: RoastStarted, Profile: profile})
	return Snapshot()
}

// Stop halts the roast; temperature then cools toward ambient on subsequent ticks.
func Stop() Status {
	state.mu.Lock()
	state.running = false
	state.mu.Unlock()
	return Snapshot()
}

// SetOverride sets operator overrides. Only non-nil fields are applied.
func SetOverride(o Overrides) Status {
	state.mu.Lock()
	if o.ROR != nil {
		v := clamp(*o.ROR, -50, 60)
		state.ov.ROR = &v
	}
	if o.FanSpeed != nil {
		v := clampInt(*o.FanSpeed, 0, 100)
		state.ov.FanSpeed = &v
	}
	if o.DrumRPM != nil {
		v := clampInt(*o.DrumRPM, 0, 200)
		state.ov.DrumRPM = &v
	}
	if state.running {
		state.applyCommandLocked()
	}
	state.mu.Unlock()
	return Snapshot()
}

// ClearOverride drops one override ("ror", "fan_speed", "drum_rpm") or all.
func ClearOverride(param string) Status {
	state.mu.Lock()
	switch param {
	case "ror":
		state.ov.ROR = nil
	case "fan_speed":
		state.ov.FanSpeed = nil
	case "drum_rpm":
		state.ov.DrumRPM = nil
	default:
		state.ov = Overrides{}
	}
	if state.running {
		state.applyCommandLocked()
	}
	state.mu.Unlock()
	return Snapshot()
}

// Snapshot returns the current live status.
func Snapshot() Status {
	state.mu.Lock()
	defer state.mu.Unlock()

	dur := state.durationLocked()
	prog := clampInt(int(math.Round(float64(state.elapsed)/float64(dur)*100)), 0, 100)

	var active *Profile
	if state.active != nil {
		c := *state.active
		c.Steps = append([]Step(nil), c.Steps...)
		active = &c
	}

	return Status{
		Running:        state.running,
		Temperature:    round1(state.temp),
		FanSpeed:       state.fan,
		DrumRPM:        state.drum,
		HeatLevel:      heatLevel(state.ror),
		ElapsedSeconds: state.elapsed,
		ROR:            round1(state.ror),
		TargetROR:      round1(state.targetROR),
		Stage:          stageFor(state.running, state.temp),
		Progress:       prog,
		StepIndex:      state.stepIndex,
		Overrides:      state.ov,
		ActiveProfile:  active,
	}
}

// Profiles returns a copy of the stored profiles.
func Profiles() []Profile {
	state.mu.Lock()
	defer state.mu.Unlock()
	return copyProfiles(state.profiles)
}

// SaveProfile inserts or overwrites the profile with the matching name.
func SaveProfile(p Profile) []Profile {
	p = normalize(p)
	state.mu.Lock()
	defer state.mu.Unlock()

	for i := range state.profiles {
		if state.profiles[i].Name == p.Name {
			state.profiles[i] = p
			if state.active != nil && state.active.Name == p.Name {
				c := p
				state.active = &c
			}
			return copyProfiles(state.profiles)
		}
	}
	state.profiles = append(state.profiles, p)
	return copyProfiles(state.profiles)
}

// DeleteProfile removes the named profile (and clears it as active if selected).
func DeleteProfile(name string) []Profile {
	state.mu.Lock()
	defer state.mu.Unlock()

	next := make([]Profile, 0, len(state.profiles))
	for _, p := range state.profiles {
		if p.Name != name {
			next = append(next, p)
		}
	}
	state.profiles = next
	if state.active != nil && state.active.Name == name {
		state.active = nil
	}
	return copyProfiles(state.profiles)
}

// LoadProfile selects the named profile as active. Returns false if not found.
func LoadProfile(name string) (Status, bool) {
	state.mu.Lock()
	found := false
	for _, p := range state.profiles {
		if p.Name == name {
			c := p
			c.Steps = append([]Step(nil), c.Steps...)
			state.active = &c
			found = true
			break
		}
	}
	if found && state.running {
		state.applyCommandLocked()
	}
	state.mu.Unlock()
	return Snapshot(), found
}

// stepsLocked returns the active profile's steps. Caller holds mu.
func (r *roaster) stepsLocked() []Step {
	if r.active == nil {
		return nil
	}
	return r.active.Steps
}

// durationLocked returns the active program's total length. Caller holds mu.
func (r *roaster) durationLocked() int {
	total := 0
	for _, s := range r.stepsLocked() {
		total += s.DurationSec
	}
	if total <= 0 {
		return defaultDuration
	}
	return total
}

// normalize clamps a profile's steps into sane ranges and recomputes the derived
// total duration, so DurationSec is always the sum of the steps.
func normalize(p Profile) Profile {
	steps := make([]Step, 0, len(p.Steps))
	total := 0
	for _, s := range p.Steps {
		if s.Mode != ModeRamp {
			s.Mode = ModeHold
		}
		s.DurationSec = clampInt(s.DurationSec, 1, 3600)
		s.ROR = clamp(s.ROR, -50, 60)
		if s.Mode == ModeRamp {
			s.ROREnd = clamp(s.ROREnd, -50, 60)
		} else {
			s.ROREnd = s.ROR
		}
		s.FanSpeed = clampInt(s.FanSpeed, 0, 100)
		s.DrumRPM = clampInt(s.DrumRPM, 0, 200)
		steps = append(steps, s)
		total += s.DurationSec
	}
	p.Steps = steps
	p.DurationSec = total
	return p
}

func copyProfiles(in []Profile) []Profile {
	out := make([]Profile, len(in))
	for i, p := range in {
		p.Steps = append([]Step(nil), p.Steps...)
		out[i] = p
	}
	return out
}

func stageFor(running bool, temp float64) string {
	if !running {
		if temp <= ambientTemp+2 {
			return "Idle"
		}
		return "Cooling"
	}
	switch {
	case temp < 150:
		return "Drying"
	case temp < 196:
		return "Maillard"
	case temp < 205:
		return "First Crack"
	case temp < 215:
		return "Development"
	default:
		return "Finish"
	}
}

func heatLevel(ror float64) string {
	switch {
	case ror >= 12:
		return "High"
	case ror >= 5:
		return "Medium"
	default:
		return "Low"
	}
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
