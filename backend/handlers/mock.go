// handler for mock data

package handlers

import (
	"encoding/json"
	"net/http"

	"pzy-backend/data"
)

func MockDataHandler(w http.ResponseWriter, r *http.Request) {
	mockData := data.GenerateMockData()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mockData)
}
