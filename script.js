/*
  script.js - dynamic API explorer
  - auto-fetches root on load
  - discovers endpoints
  - renders list/detail views for array/object responses
  - auto-generates forms for POST/PUT when object shape is known
  - hash-based simple routing
*/

const backendInput = document.getElementById('backend-url');
const backendDisplay = document.getElementById('backend-display');
const endpointsList = document.getElementById('endpoints-list');
const content = document.getElementById('content');
const rootResponseEl = document.getElementById('root-response');
const refreshBtn = document.getElementById('refresh-root');
const rootOpenBtn = document.getElementById('root-open');
const clearBtn = document.getElementById('clear-cache');

const listTemplate = document.getElementById('list-template');
const detailTemplate = document.getElementById('detail-template');
const formTemplate = document.getElementById('form-template');

const state = { endpoints: [], cache: {} };

const baseURL = () => backendInput.value.trim().replace(/\/$/, '');

function safeLog(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

async function sendRequest(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${baseURL()}${url.startsWith('/') ? url : '/' + url}`;
  const opts = { headers: { Accept: 'application/json, text/html, */*', ...(options.headers||{}) }, ...options };
  const start = performance.now();
  try {
    const res = await fetch(fullUrl, opts);
    const elapsed = Math.round(performance.now() - start);
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    let data = text;
    if (ct.includes('application/json')) {
      try { data = JSON.parse(text); } catch(e) { data = text; }
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, url: fullUrl, data, rawText: text, time: elapsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function inferEndpointsFromRoot(root) {
  const candidates = new Set();
  if (!root) return [];
  if (typeof root === 'string') {
    // maybe HTML: find hrefs
    const m = root.match(/href=\"([^\"]+)\"/g);
    if (m) m.forEach(s => { const href = s.split('=')[1].replace(/\"/g,''); candidates.add(href); });
  }
  if (typeof root === 'object') {
    if (Array.isArray(root.endpoints)) root.endpoints.forEach(e => candidates.add(e));
    if (Array.isArray(root.routes)) root.routes.forEach(e => candidates.add(e));
    if (Array.isArray(root.links)) root.links.forEach(e => candidates.add(e));
    if (root._links) Object.values(root._links).forEach(v => {
      if (typeof v === 'string') candidates.add(v);
      else if (v && v.href) candidates.add(v.href);
    });

    // look for top-level arrays that look like resources
    for (const [k,v] of Object.entries(root)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        candidates.add('/' + k);
      }
    }

    // search for strings starting with /
    const visit = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string' && obj.startsWith('/')) candidates.add(obj);
      if (Array.isArray(obj)) obj.forEach(visit);
      if (typeof obj === 'object') Object.values(obj).forEach(visit);
    };
    visit(root);
  }

  return Array.from(candidates).map(c => c.toString());
}

function clearEndpointsUI() {
  endpointsList.innerHTML = '';
}

function addEndpointToUI(path) {
  const ep = document.createElement('div');
  ep.className = 'ep-item';
  const left = document.createElement('div');
  left.innerHTML = `<div class="path">${path}</div>`;
  const right = document.createElement('div');
  const open = document.createElement('button');
  open.className = 'secondary-btn';
  open.textContent = 'Open';
  open.addEventListener('click', () => { navigateToList(path); });
  right.appendChild(open);
  ep.appendChild(left); ep.appendChild(right);
  endpointsList.appendChild(ep);
}

function renderRaw(obj, el) {
  el.textContent = safeLog(obj);
}

function detectIdKey(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = ['id', '_id', 'uuid', 'uid'];
  for (const c of candidates) if (c in obj) return c;
  // fallback: numeric key named like *Id
  for (const k of Object.keys(obj)) if (/id$/i.test(k)) return k;
  return null;
}

function navigateToHash() {
  const hash = location.hash || '';
  if (!hash || hash === '#/' || hash === '#') { showHome(); return; }
  if (hash.startsWith('#/about')) { showAbout(); return; }
  // custom: #/list/<encodedPath>
  if (hash.startsWith('#/list/')) {
    const path = decodeURIComponent(hash.replace('#/list/', ''));
    navigateToList(path);
    return;
  }
  if (hash.startsWith('#/detail/')) {
    const q = decodeURIComponent(hash.replace('#/detail/', ''));
    try {
      const p = JSON.parse(q);
      navigateToDetail(p.path, p.id, p.raw);
    } catch(e) { showHome(); }
    return;
  }
  showHome();
}

function showHome() {
  content.querySelectorAll('div,template').forEach(n => { if (n.id && n.id !== 'home-view') n.style.display = ''; });
  const home = document.getElementById('home-view');
  if (home) { home.style.display = ''; }
  const about = document.getElementById('about-view'); if (about) about.style.display = 'none';
}

function showAbout() {
  content.querySelectorAll('div,template').forEach(n => { if (n.id && n.id !== 'about-view') n.style.display = 'none'; });
  const about = document.getElementById('about-view'); if (about) { about.style.display = ''; }
}

async function navigateToList(path) {
  // render list template
  const tpl = listTemplate.content.cloneNode(true);
  const title = tpl.getElementById('list-title');
  const tableWrap = tpl.getElementById('list-table-wrap');
  const listRaw = tpl.getElementById('list-raw');
  const createBtn = tpl.getElementById('create-item');
  const backBtn = tpl.getElementById('back-home');

  title.textContent = `List: ${path}`;
  tableWrap.textContent = 'Loading...';
  content.innerHTML = '';
  content.appendChild(tpl);

  backBtn.addEventListener('click', () => { location.hash = '#/'; });

  const res = await sendRequest(path, { method: 'GET' });
  renderRaw(res, listRaw);
  if (!res.ok) {
    tableWrap.textContent = `Request failed: ${res.error || res.status}`;
    return;
  }

  const data = res.data;
  if (!Array.isArray(data)) {
    // if object, show as detail
    navigateToDetail(path, null, data);
    return;
  }

  // array -> table
  if (data.length === 0) {
    tableWrap.textContent = '(empty array)';
  } else {
    const columns = Array.from(new Set(data.flatMap(d => Object.keys(d || {}))));
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    columns.forEach(c => { const th = document.createElement('th'); th.textContent = c; tr.appendChild(th); });
    thead.appendChild(tr); table.appendChild(thead);
    const tb = document.createElement('tbody');
    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      columns.forEach(c => {
        const td = document.createElement('td'); td.textContent = item[c] === undefined ? '' : String(item[c]); tr.appendChild(td);
      });
      tr.addEventListener('click', () => {
        const idKey = detectIdKey(item);
        const id = idKey ? item[idKey] : null;
        navigateToDetail(path, id, item);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    tableWrap.innerHTML = ''; tableWrap.appendChild(table);
  }

  createBtn.addEventListener('click', () => { renderFormFor(path, null); });
}

async function navigateToDetail(path, id = null, raw = null) {
  const tpl = detailTemplate.content.cloneNode(true);
  const title = tpl.getElementById('detail-title');
  const body = tpl.getElementById('detail-body');
  const rawEl = tpl.getElementById('detail-raw');
  const editBtn = tpl.getElementById('edit-item');
  const deleteBtn = tpl.getElementById('delete-item');
  const backBtn = tpl.getElementById('detail-back');

  title.textContent = `Detail: ${path}${id ? ' #' + id : ''}`;
  content.innerHTML = ''; content.appendChild(tpl);
  backBtn.addEventListener('click', () => { location.hash = '#/'; });

  let res;
  if (id !== null) {
    const target = path.endsWith('/') ? `${path}${id}` : `${path}/${id}`;
    res = await sendRequest(target, { method: 'GET' });
  } else if (raw) {
    res = { ok: true, data: raw, rawText: safeLog(raw) };
  } else {
    res = await sendRequest(path, { method: 'GET' });
  }

  renderRaw(res, rawEl);
  if (!res.ok) {
    body.textContent = `Request failed: ${res.error || res.status}`; return;
  }

  const data = res.data;
  if (typeof data === 'object') {
    const ul = document.createElement('div');
    ul.style.whiteSpace = 'pre-wrap';
    ul.textContent = safeLog(data);
    body.appendChild(ul);
  } else {
    body.textContent = String(data);
  }

  // wire edit/delete
  editBtn.addEventListener('click', () => renderFormFor(path, data, id));
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this resource?')) return;
    const target = id ? (path.endsWith('/') ? `${path}${id}` : `${path}/${id}`) : path;
    const del = await sendRequest(target, { method: 'DELETE' });
    if (del.ok) { alert('Deleted'); location.hash = `#/list/${encodeURIComponent(path)}`; }
    else alert('Delete failed');
  });
}

function buildFormFieldsForObject(obj) {
  const fields = [];
  if (!obj || typeof obj !== 'object') return fields;
  for (const [k, v] of Object.entries(obj)) {
    const type = typeof v;
    fields.push({ name: k, type, example: v });
  }
  return fields;
}

function renderFormFor(path, sampleObj = null, id = null) {
  const tpl = formTemplate.content.cloneNode(true);
  const title = tpl.getElementById('form-title');
  const form = tpl.getElementById('dynamic-form');
  const rawEl = tpl.getElementById('form-raw');
  const submitBtn = tpl.getElementById('submit-form');
  const cancelBtn = tpl.getElementById('cancel-form');

  title.textContent = id ? `Edit: ${path}` : `Create: ${path}`;
  content.innerHTML = ''; content.appendChild(tpl);

  const example = sampleObj || {};
  const fields = buildFormFieldsForObject(example);
  // if no sample fields, provide a generic json textarea
  if (fields.length === 0) {
    const row = document.createElement('div'); row.className = 'form-row';
    const label = document.createElement('label'); label.textContent = 'JSON body';
    const ta = document.createElement('textarea'); ta.style.minHeight = '160px'; ta.id = 'generic-json'; row.appendChild(label); row.appendChild(ta); form.appendChild(row);
  } else {
    fields.forEach(f => {
      const row = document.createElement('div'); row.className = 'form-row';
      const label = document.createElement('label'); label.textContent = f.name;
      let input;
      if (f.type === 'boolean') {
        input = document.createElement('select'); input.innerHTML = '<option value="true">true</option><option value="false">false</option>';
        input.value = String(f.example);
      } else if (typeof f.example === 'string' && f.example.length > 120) {
        input = document.createElement('textarea'); input.value = String(f.example);
      } else {
        input = document.createElement('input'); input.type = 'text'; input.value = f.example === undefined ? '' : String(f.example);
      }
      input.name = f.name; row.appendChild(label); row.appendChild(input); form.appendChild(row);
    });
  }

  cancelBtn.addEventListener('click', () => { location.hash = '#/'; });

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    let payload;
    if (fields.length === 0) {
      const ta = document.getElementById('generic-json');
      try { payload = JSON.parse(ta.value); } catch { alert('JSON invalid'); return; }
    } else {
      payload = {};
      const inputs = form.querySelectorAll('[name]');
      inputs.forEach(inp => {
        let val = inp.value;
        if (inp.tagName.toLowerCase() === 'select' && (val === 'true' || val === 'false')) val = (val === 'true');
        // try number
        if (/^\d+$/.test(val)) val = Number(val);
        payload[inp.name] = val;
      });
    }

    if (id) {
      const target = path.endsWith('/') ? `${path}${id}` : `${path}/${id}`;
      const res = await sendRequest(target, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      renderRaw(res, rawEl);
      if (res.ok) { alert('Updated'); location.hash = `#/list/${encodeURIComponent(path)}`; }
      else alert('Update failed');
    } else {
      const res = await sendRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      renderRaw(res, rawEl);
      if (res.ok) { alert('Created'); location.hash = `#/list/${encodeURIComponent(path)}`; }
      else alert('Create failed');
    }
  });
}

async function fetchRootAndDiscover() {
  backendDisplay.textContent = baseURL() + '/';
  rootResponseEl.textContent = 'Loading...';
  clearEndpointsUI();
  const res = await sendRequest('/', { method: 'GET' });
  renderRaw(res, rootResponseEl);
  if (!res.ok) { rootResponseEl.textContent = `Failed to fetch root: ${res.error || res.status}`; return; }
  const rootData = res.data;
  const discovered = inferEndpointsFromRoot(rootData || res.rawText);
  // add defaults
  const defaults = ['/', '/api', '/health', '/status'];
  const final = Array.from(new Set([...defaults, ...discovered]));
  state.endpoints = final;
  state.endpoints.forEach(ep => addEndpointToUI(ep));
}

refreshBtn.addEventListener('click', async () => { await fetchRootAndDiscover(); });
rootOpenBtn.addEventListener('click', async () => { await sendRequest('/'); });
clearBtn.addEventListener('click', () => { state.endpoints = []; clearEndpointsUI(); rootResponseEl.textContent = ''; });

window.addEventListener('hashchange', navigateToHash);
window.addEventListener('DOMContentLoaded', async () => {
  await fetchRootAndDiscover();
  navigateToHash();
});

// helper navigation functions used by UI
function navigateToList(path) { location.hash = '#/list/' + encodeURIComponent(path); }
function navigateToDetailHash(path, id) { const payload = JSON.stringify({ path, id }); location.hash = '#/detail/' + encodeURIComponent(payload); }

