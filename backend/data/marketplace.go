// stub profile marketplace.
//
// the real marketplace service doesn't exist yet. this serves a small static
// catalog in the same shape the real one is expected to return, so the tablet's
// browse/import flow can be built and demoed end to end. the frontend points at
// this via a configurable marketplace URL -- swap that to the real host and this
// file can go away.
package data

// MarketProfile is a catalog entry: a roast program plus its listing metadata.
type MarketProfile struct {
	Profile
	Author      string `json:"author"`
	Description string `json:"description"`
	Downloads   int    `json:"downloads"`
}

var catalog = []MarketProfile{
	{
		Profile: Profile{
			Name: "Kenya AA Nyeri", RoastLevel: "AG:75-80", TargetWeight: "2.0KG",
			Steps: []Step{
				{DurationSec: 120, Mode: ModeHold, ROR: 27, FanSpeed: 78, DrumRPM: 63},
				{DurationSec: 240, Mode: ModeRamp, ROR: 27, ROREnd: 15, FanSpeed: 72, DrumRPM: 61},
				{DurationSec: 210, Mode: ModeRamp, ROR: 15, ROREnd: 7, FanSpeed: 62, DrumRPM: 58},
				{DurationSec: 90, Mode: ModeHold, ROR: 7, FanSpeed: 52, DrumRPM: 56},
			},
		},
		Author:      "nyeri_roastworks",
		Description: "Bright and juicy. Long Maillard for blackcurrant clarity.",
		Downloads:   1284,
	},
	{
		Profile: Profile{
			Name: "Sumatra Mandheling", RoastLevel: "AG:50-55", TargetWeight: "3.0KG",
			Steps: []Step{
				{DurationSec: 150, Mode: ModeHold, ROR: 22, FanSpeed: 68, DrumRPM: 58},
				{DurationSec: 300, Mode: ModeRamp, ROR: 22, ROREnd: 13, FanSpeed: 63, DrumRPM: 57},
				{DurationSec: 270, Mode: ModeRamp, ROR: 13, ROREnd: 7, FanSpeed: 56, DrumRPM: 55},
				{DurationSec: 150, Mode: ModeHold, ROR: 5, FanSpeed: 48, DrumRPM: 53},
			},
		},
		Author:      "hearth_and_ember",
		Description: "Low and slow into a dark finish. Earthy, syrupy body.",
		Downloads:   902,
	},
	{
		Profile: Profile{
			Name: "Guatemala Antigua", RoastLevel: "AG:68-72", TargetWeight: "2.5KG",
			Steps: []Step{
				{DurationSec: 120, Mode: ModeHold, ROR: 25, FanSpeed: 74, DrumRPM: 61},
				{DurationSec: 270, Mode: ModeRamp, ROR: 25, ROREnd: 14, FanSpeed: 68, DrumRPM: 59},
				{DurationSec: 210, Mode: ModeRamp, ROR: 14, ROREnd: 8, FanSpeed: 60, DrumRPM: 57},
				{DurationSec: 120, Mode: ModeHold, ROR: 7, FanSpeed: 50, DrumRPM: 55},
			},
		},
		Author:      "altiplano_coffee",
		Description: "Balanced city-plus. Cocoa and toasted almond.",
		Downloads:   2317,
	},
	{
		Profile: Profile{
			Name: "Espresso Base Blend", RoastLevel: "AG:60-65", TargetWeight: "5.0KG",
			Steps: []Step{
				{DurationSec: 180, Mode: ModeHold, ROR: 23, FanSpeed: 72, DrumRPM: 60},
				{DurationSec: 300, Mode: ModeRamp, ROR: 23, ROREnd: 12, FanSpeed: 66, DrumRPM: 58},
				{DurationSec: 240, Mode: ModeRamp, ROR: 12, ROREnd: 6, FanSpeed: 58, DrumRPM: 56},
				{DurationSec: 180, Mode: ModeHold, ROR: 5, FanSpeed: 50, DrumRPM: 54},
			},
		},
		Author:      "pzy_coffee",
		Description: "Big-batch espresso workhorse. Long, even development.",
		Downloads:   4106,
	},
}

// Marketplace returns the stub catalog.
func Marketplace() []MarketProfile {
	out := make([]MarketProfile, len(catalog))
	for i, m := range catalog {
		m.Profile = normalize(m.Profile)
		out[i] = m
	}
	return out
}
