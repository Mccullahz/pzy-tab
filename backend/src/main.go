// HTTP server for the roaster tablet backend (port 8080).
// exposes the roast control + profile endpoints and a live /status snapshot,
// backed by an in-memory session that a background ticker advances once a second.
package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"pzy-backend/data"
	"pzy-backend/handlers"
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

	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	http.ListenAndServe(addr, mux)
}
