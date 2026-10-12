# Shay-21 Local Host Mirror

This repository contains a lightweight website that mirrors the backend running on the local machine at:

- http://192.168.60.103:8080/

It gives you a simple dashboard to:

- check whether the backend is responding
- inspect JSON responses from the API
- fire quick GET requests to common routes
- send custom requests to any endpoint

## Files

- `index.html` – main page layout
- `styles.css` – styling for the dashboard
- `script.js` – request logic and API interaction

## Local preview

From the repository root, run:

```bash
python3 -m http.server 3000
```

Then open in the browser:

```text
http://localhost:3000
```

## Notes

This frontend calls the backend directly from the browser. If the backend does not allow cross-origin requests, you may need to add CORS headers on the server side (for example, `Access-Control-Allow-Origin: *`) or run the frontend from the same local network environment as the backend.

This is a static mirror/dashboard for local development and testing.
