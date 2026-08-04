// handlers for the roast control + profile endpoints. these read/write the
// in-memory session held in the data package.
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"pzy-backend/data"
)

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// StatusHandler returns the live roast snapshot (GET /status).
func StatusHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, data.Snapshot())
}

// StartRoastHandler begins a new roast (POST /start-roast).
func StartRoastHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, data.Start())
}

// StopRoastHandler halts the current roast (POST /stop-roast).
func StopRoastHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, data.Stop())
}

// ProfilesHandler lists (GET), saves (POST) or deletes (DELETE ?name=) profiles.
func ProfilesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, data.Profiles())
	case http.MethodPost:
		var p data.Profile
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil || strings.TrimSpace(p.Name) == "" {
			http.Error(w, "invalid profile", http.StatusBadRequest)
			return
		}
		if len(p.Steps) == 0 {
			http.Error(w, "profile requires at least one step", http.StatusBadRequest)
			return
		}
		writeJSON(w, data.SaveProfile(p))
	case http.MethodDelete:
		name := strings.TrimSpace(r.URL.Query().Get("name"))
		if name == "" {
			http.Error(w, "missing name", http.StatusBadRequest)
			return
		}
		writeJSON(w, data.DeleteProfile(name))
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// OverrideHandler sets operator overrides (POST /override) or clears them
// (DELETE /override?param=ror|fan_speed|drum_rpm, omit param to clear all).
func OverrideHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var o data.Overrides
		if err := json.NewDecoder(r.Body).Decode(&o); err != nil {
			http.Error(w, "invalid override", http.StatusBadRequest)
			return
		}
		writeJSON(w, data.SetOverride(o))
	case http.MethodDelete:
		writeJSON(w, data.ClearOverride(strings.TrimSpace(r.URL.Query().Get("param"))))
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// MarketplaceHandler returns the stub profile catalog (GET /marketplace).
func MarketplaceHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, data.Marketplace())
}

// LoadProfileHandler selects a profile as active (POST /load-profile {name}).
func LoadProfileHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		http.Error(w, "missing name", http.StatusBadRequest)
		return
	}
	status, ok := data.LoadProfile(body.Name)
	if !ok {
		http.Error(w, "profile not found", http.StatusNotFound)
		return
	}
	writeJSON(w, status)
}
