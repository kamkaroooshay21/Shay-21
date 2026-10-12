const backendInput = document.getElementById('backend-url');
const statusBadge = document.getElementById('status-badge');
const responseTime = document.getElementById('response-time');
const responseOutput = document.getElementById('response-output');
const httpMethod = document.getElementById('http-method');
const endpointPath = document.getElementById('endpoint-path');
const requestBody = document.getElementById('request-body');
const actionGrid = document.querySelector('.action-grid');

const baseURL = () => backendInput.value.trim().replace(/\/$/, '');

function setStatus(type, text) {
  statusBadge.className = `status-badge ${type}`;
  statusBadge.textContent = text;
}

function prettyPrint(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

async function sendRequest(url, options = {}) {
  const started = performance.now();
  setStatus('idle', 'Loading');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json, text/html, text/plain, */*',
        ...(options.headers || {})
      },
      ...options
    });

    const elapsed = Math.round(performance.now() - started);
    responseTime.textContent = `${elapsed} ms`;

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    let parsed;
    if (contentType.includes('application/json')) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }
    } else if (contentType.includes('text/html')) {
      parsed = rawText; // keep HTML as string
    } else {
      parsed = rawText || '(empty response)';
    }

    const payload = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      data: parsed,
      rawText
    };

    responseOutput.textContent = prettyPrint(payload);
    setStatus(response.ok ? 'success' : 'error', response.ok ? 'Connected' : `HTTP ${response.status}`);
    return payload;
  } catch (error) {
    const elapsed = Math.round(performance.now() - started);
    responseTime.textContent = `${elapsed} ms`;
    responseOutput.textContent = `Request failed:\n${error.message}\n\nTip: make sure your backend is running and responding with CORS headers if the browser blocks the request.`;
    setStatus('error', 'Error');
    throw error;
  }
}

function addDiscoveredEndpoints(endpoints = []) {
  if (!endpoints || endpoints.length === 0) return;

  // normalize and dedupe
  const normalized = endpoints
    .map((e) => {
      if (!e) return null;
      // if full URL and same host as base, convert to path
      try {
        const u = new URL(e, baseURL());
        if (u.origin === new URL(baseURL()).origin) return u.pathname + (u.search || '');
        // otherwise keep absolute URL
        return u.href;
      } catch {
        return e;
      }
    })
    .filter(Boolean);

  const existing = new Set(Array.from(actionGrid.querySelectorAll('button')).map((b) => b.dataset.endpoint));

  let added = 0;
  for (const ep of normalized) {
    if (existing.has(ep)) continue;
    if (added >= 12) break; // don't overflow UI

    const btn = document.createElement('button');
    btn.className = 'secondary-btn';
    btn.dataset.method = 'GET';
    btn.dataset.endpoint = ep;
    btn.textContent = `GET ${ep}`;
    btn.addEventListener('click', async () => {
      const url = ep.startsWith('http') ? ep : `${baseURL()}${ep.startsWith('/') ? ep : `/${ep}`}`;
      await sendRequest(url, { method: 'GET' });
    });

    actionGrid.appendChild(btn);
    existing.add(ep);
    added += 1;
  }

  if (added > 0) {
    responseOutput.textContent = `Discovered ${added} endpoints. Click any new quick-action to run them, or view the full response below.\n\n` + responseOutput.textContent;
  }
}

async function loadRoot() {
  const url = `${baseURL()}/`;
  try {
    const res = await sendRequest(url, { method: 'GET' });

    // Try to discover endpoints from JSON responses
    const candidates = [];

    if (res && typeof res.data === 'object' && res.data !== null) {
      // common places APIs list routes
      if (Array.isArray(res.data.endpoints)) candidates.push(...res.data.endpoints);
      if (Array.isArray(res.data.routes)) candidates.push(...res.data.routes);
      if (Array.isArray(res.data.links)) candidates.push(...res.data.links);

      // HAL-like _links object
      if (res.data._links && typeof res.data._links === 'object') {
        for (const k of Object.keys(res.data._links)) {
          const v = res.data._links[k];
          if (typeof v === 'string') candidates.push(v);
          else if (v && typeof v.href === 'string') candidates.push(v.href);
          else if (Array.isArray(v)) v.forEach((x) => x && x.href && candidates.push(x.href));
        }
      }

      // JSON:API style
      if (Array.isArray(res.data.data)) {
        // look for relationships or links inside
        // nothing guaranteed, but attempt to find href-like strings
        const findStrings = (obj) => {
          if (!obj) return;
          if (typeof obj === 'string' && obj.startsWith('/')) candidates.push(obj);
          if (Array.isArray(obj)) obj.forEach(findStrings);
          if (typeof obj === 'object') Object.values(obj).forEach(findStrings);
        };
        findStrings(res.data);
      }
    }

    // If HTML returned, parse anchors to find likely endpoints
    if (res && typeof res.rawText === 'string' && res.rawText.includes('<')) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(res.rawText, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href'))
          .filter(Boolean)
          .filter((h) => !h.startsWith('mailto:') && !h.startsWith('tel:'));
        candidates.push(...anchors);
      } catch (e) {
        // ignore parsing errors
      }
    }

    // normalize candidate endpoints to short paths where possible
    const shortCandidates = candidates
      .map((c) => (typeof c === 'string' ? c.trim() : ''))
      .filter(Boolean)
      .map((c) => {
        // remove origin if present
        try {
          const u = new URL(c, baseURL());
          if (u.origin === new URL(baseURL()).origin) return u.pathname + (u.search || '');
          return u.href;
        } catch {
          return c;
        }
      });

    addDiscoveredEndpoints(Array.from(new Set(shortCandidates)));
  } catch (err) {
    // errors already handled in sendRequest
  }
}

async function submitRequest() {
  const method = httpMethod.value;
  const path = endpointPath.value.trim() || '/';
  const url = `${baseURL()}${path.startsWith('/') ? path : `/${path}`}`;

  const bodyText = requestBody.value.trim();
  const headers = {};

  let payload = undefined;
  if (bodyText) {
    try {
      payload = JSON.parse(bodyText);
      headers['Content-Type'] = 'application/json';
    } catch {
      payload = bodyText;
    }
  }

  await sendRequest(url, {
    method,
    headers,
    ...(payload !== undefined && method !== 'GET' && method !== 'DELETE' ? { body: JSON.stringify(payload) } : {})
  });
}

document.getElementById('load-root').addEventListener('click', loadRoot);
document.getElementById('send-request').addEventListener('click', submitRequest);

for (const button of document.querySelectorAll('.secondary-btn')) {
  button.addEventListener('click', async () => {
    const method = button.dataset.method;
    const endpoint = button.dataset.endpoint;
    const url = `${baseURL()}${endpoint}`;

    if (method === 'GET') {
      await sendRequest(url, { method: 'GET' });
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  responseOutput.textContent = 'Auto-fetching backend root...';
  try {
    await loadRoot();
  } catch (e) {
    // already reported
  }
});
