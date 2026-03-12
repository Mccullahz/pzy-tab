package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("Backend running...")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	http.ListenAndServe(":8080", nil)
}

