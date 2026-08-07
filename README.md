# Pzy Tab
This project aims to create the Tablet interface for the Pzy Roaster. In creating this interface, my goal is to have a simple, intuitive web based interface that will be compatible with a variety of hardware options but targetting a touch screen "tablet" form factor. My testing device is a Lenovo Tab M11 4GB model. 

Currently, I am still in the early stages of development. We have a very simple HTTP server tied in with our Typescript React frontend (Port 8000). Docker containers and compose are setup and staged for development purposes.

The development stack for this project is as follows:

On the device we will be running a Go backend and a React + tailwind "frontend". Breaking this down further, the backend should handle:

    - Go (goroutines) async server

    - Serial handler task to communicate with arduino. 

    - WebSocket broadcast

    - SQLite(potentially) logging

-REST endpoints:

    - /start-roast

    - /stop-roast

    - /load & /unload-profile

    - /status

    - /health

    - /more as needed

The frontend should handle:

    - React TS + Tailwind 

    - Charting

    - WebSocket client

    - Kiosk Chromium

This approach provides clear separation of logic and allows for flexibility when it comes to hardware choices. The backend can run virtually anywhere and allows for a variety of options when it comes to different devices as well.

## Storefront sync (optional)

PZY-Tab can optionally sync orders and roast status with a storefront implementing the contract in [docs/ORDER_FULFILLMENT.md](docs/ORDER_FULFILLMENT.md). This is **off by default** — the software is fully functional standalone, and the `/sync` endpoints only exist when a deployment is explicitly configured with credentials issued by the storefront it pairs with. See [docs/SYNC.md](docs/SYNC.md) for configuration and the security model.

