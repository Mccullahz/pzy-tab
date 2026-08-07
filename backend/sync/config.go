// sync configuration. the fulfillment sync channel is OFF unless this deployment
// is explicitly given credentials -- open-source installs run standalone and
// never talk to anyone's storefront. see docs/SYNC.md.
package sync

import (
	"os"
	"strings"
)

type Config struct {
	// AuthToken is the shared bearer token peers must present (and we present outbound).
	AuthToken string
	// SigningSecret keys the HMAC-SHA256 signature over raw request bodies.
	SigningSecret string
	// PeerURL is the base URL of the peer's sync API. optional: without it we
	// accept inbound sync but never make outbound requests.
	PeerURL string
}

// Enabled reports whether sync should be wired up at all. both credentials are
// required; there is no partially-authenticated mode.
func (c Config) Enabled() bool {
	return c.AuthToken != "" && c.SigningSecret != ""
}

// LoadConfig reads sync settings from the environment. *_FILE variants point at
// a mounted secret file and win over the plain variable.
func LoadConfig() Config {
	return Config{
		AuthToken:     secretFromEnv("SYNC_AUTH_TOKEN"),
		SigningSecret: secretFromEnv("SYNC_SIGNING_SECRET"),
		PeerURL:       strings.TrimRight(os.Getenv("SYNC_PEER_URL"), "/"),
	}
}

func secretFromEnv(name string) string {
	if path := os.Getenv(name + "_FILE"); path != "" {
		b, err := os.ReadFile(path)
		if err == nil {
			return strings.TrimSpace(string(b))
		}
	}
	return strings.TrimSpace(os.Getenv(name))
}
