const backendInput = document.getElementById('backend-url');
const statusBadge = document.getElementById('status-badge');
const responseTime = document.getElementById('response-time');
const responseOutput = document.getElementById('response-output');
const httpMethod = document.getElementById('http-method');
const endpointPath = document.getElementById('endpoint-path');
const requestBody = document.getElementById('request-body');

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
        Accept: 'application/json, text/plain, */*',
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
    } else {
      parsed = rawText || '(empty response)';
    }

    const payload = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      data: parsed
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

async function loadRoot() {
  const url = `${baseURL()}/`;
  await sendRequest(url, { method: 'GET' });
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

window.addEventListener('DOMContentLoaded', () => {
  responseOutput.textContent = 'Ready. Click “Load API” or run a custom request.';
});
