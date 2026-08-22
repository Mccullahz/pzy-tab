// HTTP server for the roaster tablet backend (port 8080).
// exposes the roast control + profile endpoints and a live /status snapshot,
// backed by an in-memory session that a background ticker advances once a second.
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"pzy-backend/data"
	"pzy-backend/handlers"
	"pzy-backend/sync"
)

// withCORS allows the frontend (served from a different port in dev/kiosk) to
// call these endpoints directly from the browser.
func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func main() {
	fmt.Println("Backend running...")

	// advance the roast simulation once per second.
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for range ticker.C {
			data.Tick()
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	}))
	mux.HandleFunc("/mock", withCORS(handlers.MockDataHandler))
	mux.HandleFunc("/status", withCORS(handlers.StatusHandler))
	mux.HandleFunc("/start-roast", withCORS(handlers.StartRoastHandler))
	mux.HandleFunc("/stop-roast", withCORS(handlers.StopRoastHandler))
	mux.HandleFunc("/profiles", withCORS(handlers.ProfilesHandler))
	mux.HandleFunc("/load-profile", withCORS(handlers.LoadProfileHandler))
	mux.HandleFunc("/override", withCORS(handlers.OverrideHandler))
	mux.HandleFunc("/marketplace", withCORS(handlers.MarketplaceHandler))

	// fulfillment sync is opt-in: without configured credentials the /sync
	// routes are never registered and no outbound calls happen (docs/SYNC.md).
	syncEnabled := false
	if cfg := sync.LoadConfig(); cfg.Enabled() {
		syncEnabled = true
		svc := sync.NewService(cfg)

		// peer-facing ingest + changes feed. deliberately not wrapped in
		// withCORS -- service-to-service only, never called from the browser
		// (contract §9).
		svc.Register(mux)

		// tablet-facing order board. browser-facing, so it does get CORS.
		svc.RegisterBrowser(mux, withCORS)

		// roast-floor actions become fulfillment events. the data package
		// doesn't know sync exists; it just announces and we translate.
		data.OnRoastEvent(func(e data.RoastEvent) {
			svc.HandleRoastEvent(string(e.Kind), e.Profile)
		})

		// pull the peer's feed on a timer. this is how orders reach the board:
		// without it a roaster only ever learns what it was pushed, and the
		// backfill the contract calls for (§6.3) has nothing to trigger it.
		svc.StartReconcile(context.Background(), sync.DefaultReconcileInterval)

		fmt.Println("fulfillment sync: enabled")
	} else {
		fmt.Println("fulfillment sync: disabled (no credentials configured)")
	}

	// lets the tablet know whether to show the order queue at all. always
	// registered: a standalone install answers honestly rather than 404ing.
	mux.HandleFunc("/capabilities", withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"sync_enabled":%t}`, syncEnabled)
	}))

	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	http.ListenAndServe(addr, mux)
}
