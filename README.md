# Pzy Tab
This project aims to create the Tablet interface for the Pzy Roaster. In creating this interface, my goal is to have a simple, intuitive web based interface that will be compatible with a variety of hardware options but targetting a touch screen "tablet" form factor. My testing device is a Lenovo Tab M11 4GB model. 

Currently, I am still in the early stages of development. We have a very simple HTTP server tied in with our PHP frontend. Docker containers and compose are setup and staged for development purposes.

The development stack for this project is as follows:

On the device we will be running a Go backend and a PHP + tailwind "frontend". Breaking this down further, the backend should handle:

    - Go (goroutines) async server

    - Serial handler task to communicate with arduino. 

    - WebSocket broadcast

    - SQLite(potentially) logging

-REST endpoints:

    - /start-roast

    - /stop-roast

    - /load/unload-profile

    - /status

    - /health

    - /more as needed

The frontend should handle:

    - PHP + Tailwind (Ngnix + PHP-FPM)

    - Charting - want to avoid js where possible

    - WebSocket client

    - Kiosk Chromium

This approach provides clear separation of logic and allows for flexibility when it comes to hardware choices. The backend can run virtually anywhere and allows for a variety of options when it comes to different devices as well.

