// service-to-service auth for the sync channel (contract §9): bearer token
// compared in constant time + HMAC-SHA256 signature over the raw body. both
// must pass before any parsing happens. replays verify but are inert thanks to
// event_id dedup. note: deliberately NOT wrapped in the app's CORS middleware --
// these endpoints are for the peer service, never the browser.
package sync

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
)

const (
	signatureHeader = "X-Pzy-Signature"
	maxBodyBytes    = 1 << 20 // 1 MiB
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// requireAuth wraps a sync handler. on success the request body has been fully
// read, verified, and restored for the handler to consume.
func (s *Service) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.AuthToken)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
		if err != nil || len(body) > maxBodyBytes {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		want := sign(s.cfg.SigningSecret, body)
		got := r.Header.Get(signatureHeader)
		if subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		r.Body = io.NopCloser(bytes.NewReader(body))
		next(w, r)
	}
}
