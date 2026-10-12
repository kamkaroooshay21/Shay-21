# Shay-21 API Explorer — Complete Website

This repository now contains a single-page static website that functions as a complete API explorer and local mirror for the backend at:

- http://192.168.60.103:8080/

What I added
- A full single-page app (HTML/CSS/JS) that:
  - auto-fetches the backend root on load
  - discovers endpoints and lists them in a sidebar
  - renders list views for array endpoints (click a row to view details)
  - auto-generates create (POST) and edit (PUT) forms based on returned object shape
  - supports delete operations (DELETE)
  - basic hash-based navigation for list/detail views
- Improved styling and clearer UX
- Updated README and instructions to run locally

How to run locally

1. Clone or pull the repository
2. From the repo root run:

```bash
python3 -m http.server 3000
```

3. Open the explorer in your browser:

http://localhost:3000

Using the explorer

- The app will automatically fetch the root path and try to find endpoints. You can also enter a different backend URL in the header input and press "Refresh & Discover".
- Click an endpoint in the sidebar to open its list view. If the endpoint returns an array of objects the app shows a table, otherwise it shows the raw response.
- From a list view you can click an item to open the detail view. Use Edit to open an auto-generated form and Submit to PUT, or use Create to POST a new resource.

CORS and network notes

- This is a client-side app that makes requests from the browser. If your backend does not allow cross-origin requests, the browser will block calls. Add CORS headers on the backend (for example Access-Control-Allow-Origin: *) or host the frontend on the same host network as the backend.

Next steps I can do for you

- Wire custom UI for known endpoints if you provide 1–3 sample JSON responses (e.g. /api/items and /api/items/:id) so I can build richer list/detail layouts and typed forms.
- Add a deployment workflow (GitHub Pages or Netlify) and instructions.
- Add authentication handling (login form + token storage) if your API requires it.
- Persist favorites or history in localStorage.

If you want me to proceed wiring specific API routes, paste 1–3 sample JSON responses (the actual JSON returned by your backend). I will then add dedicated pages for those resources with nicer forms and validation.
