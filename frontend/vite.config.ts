import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the roaster backend, as reachable from wherever the dev server runs. under
// docker compose this is the service name; bare `npm run dev` falls back to the
// published port on localhost.
const backend = process.env.BACKEND_ORIGIN ?? 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    // bind all interfaces so tablets and phones on the LAN can load the app.
    host: true,
    port: 8000,
    strictPort: true,
    // vite's DNS-rebinding guard already allows bare IPs; this additionally
    // permits the mDNS/router hostnames a LAN device might be reached by.
    allowedHosts: ['.local', '.lan', '.home', '.internal'],
    // the app calls the backend at /api on its own origin, and we forward that
    // here. this is what makes LAN access work without every device having to
    // be told the roaster's IP: whatever host served the page also serves /api.
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
