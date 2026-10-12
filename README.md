# Shay-21 Local Host Mirror

This repository contains a lightweight website that mirrors the backend running on the local machine at:

- http://192.168.60.103:8080/

It gives you a simple dashboard to:

- check whether the backend is responding
- inspect JSON responses from the API
- fire quick GET requests to common routes
- send custom requests to any endpoint

## Automatic root fetch and endpoint discovery

On page load the frontend will automatically fetch the backend root (`/`) and attempt to discover API routes from the response. It uses heuristics:

- If the root returns JSON and includes keys such as `endpoints`, `routes`, `links`, or `_links`, those entries will be converted to quick-action buttons.
- If the root returns HTML, the frontend parses anchor (`<a>`) tags and adds discovered hrefs as quick actions.

Discovered endpoints become clickable quick-action buttons (up to a limit) so you can explore the API without manually typing paths.

If you want the UI to wire specific API routes (for example, to render lists or forms), share one or two sample JSON responses from your backend endpoints (for example `/api/items` and `/api/items/:id`) and I will:

- add route-specific UI components (list/detail) to display the data
- add typed parsing for known response shapes
- add forms for POST/PUT with appropriate fields

## Files

- `index.html` – main page layout
- `styles.css` – styling for the dashboard
- `script.js` – request logic and automatic root fetch & discovery

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
