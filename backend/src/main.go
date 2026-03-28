// should be super simple here, running on port 8080 and just responding to /health with "ok" for now.
// next step is to get mock data in place and then we can start building out from there.
package main

import (
	"fmt"
	"net/http"
	"os"

	"pzy-backend/handlers"
)

func main() {
	fmt.Println("Backend running...")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	http.HandleFunc("/mock", handlers.MockDataHandler) 

	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	http.ListenAndServe(addr, nil)
}

