import { Hono } from 'hono'
import type { Cube } from './GreenCube.ts'

const CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; padding: 24px; }
.container { max-width: 1024px; margin: 0 auto; }
h1 { font-size: 1.4rem; margin-bottom: 8px; }
h1 span { color: #2a7; }
.tab-bar { display: flex; gap: 0; border-bottom: 2px solid #ddd; margin-bottom: 12px; }
.tab-btn { padding: 8px 16px; background: none; border: none; cursor: pointer; font-size: 0.85rem; color: #666; border-radius: 0; }
.tab-btn.active { color: #2a7; border-bottom: 2px solid #2a7; margin-bottom: -2px; font-weight: 600; }
.tab-content { display: none; }
.tab-content.active { display: block; }
textarea { width: 100%; font-family: 'SF Mono', Monaco, monospace; font-size: 0.75rem; padding: 8px; border: 1px solid #ccc; border-radius: 6px; resize: vertical; }
.button-row { display: flex; gap: 8px; margin: 8px 0; }
button { padding: 7px 18px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
button.primary { background: #2a7; color: #fff; }
button.primary:hover { background: #238; }
button.secondary { background: #e0e0e0; color: #333; }
button.secondary:hover { background: #ccc; }
button.small { font-size: 0.75rem; padding: 4px 10px; }
.input-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.input-row input { flex: 1; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; }
pre { background: #f0f0f0; color: #444; padding: 8px 12px; border-radius: 6px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.75rem; white-space: pre-wrap; overflow-x: auto; border: 1px solid #ddd; margin: 4px 0 16px; }
#query-explain-content { padding: 0; }
details > summary { cursor: pointer; font-size: 0.9rem; font-weight: 600; margin: 12px 0 4px; user-select: none; }
details > summary:hover { color: #2a7; }
details > pre { margin-top: 0; }
table.meta { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 8px; }
table.meta th, table.meta td { text-align: left; padding: 4px 8px; border: 1px solid #ddd; vertical-align: top; }
table.meta th { background: #f5f5f5; font-weight: 600; }
table.meta td ul { margin: 0; padding-left: 16px; list-style: none; }
table.meta td ul li::before { content: '\\2022 '; color: #2a7; }
table.data { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; overflow: hidden; }
table.data th, table.data td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
table.data tr:last-child td { border-bottom: none; }
table.data th { background: #f0f0f0; font-weight: 600; }
table.data tr:nth-child(even) { background: #fafafa; }
.error { color: #c62828; padding: 8px; background: #ffebee; border-radius: 6px; }
.placeholder { color: #999; font-size: 0.85rem; }
.section-heading { font-size: 0.9rem; font-weight: 600; margin: 12px 0 4px; }
.section-heading:first-child { margin-top: 0; }
.label { font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px; }
code { background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
.role-btn-group { display: flex; gap: 4px; }`

const SCRIPT = `function switchTab(name) {
  var tabs = document.querySelectorAll('.tab-btn')
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active')
  var conts = document.querySelectorAll('.tab-content')
  for (var i = 0; i < conts.length; i++) conts[i].classList.remove('active')
  var btn = document.querySelector('.tab-btn[data-tab="' + name + '"]')
  if (btn) btn.classList.add('active')
  var el = document.getElementById('tab-' + name)
  if (el) el.classList.add('active')
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function setQuery(v) {
  var ed = document.getElementById('query-editor')
  try { ed.value = JSON.stringify(JSON.parse(v), null, 2) } catch (e) { ed.value = v }
}

function setMutation(v) {
  var ed = document.getElementById('mutation-editor')
  try { ed.value = JSON.stringify(JSON.parse(v), null, 2) } catch (e) { ed.value = v }
}

function postJSON(url, body, token) {
  var headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
  return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }).then(function (r) { return r.json() })
}

function renderTable(rows, container) {
  if (!rows || rows.length === 0) { container.innerHTML = '<div class="placeholder">No results.</div>'; return }
  var cols = Object.keys(rows[0])
  var h = '<table class="data"><thead><tr>'
  for (var i = 0; i < cols.length; i++) h += '<th>' + esc(cols[i]) + '</th>'
  h += '</tr></thead><tbody>'
  for (var r = 0; r < rows.length; r++) { h += '<tr>'
    for (var c = 0; c < cols.length; c++) {
      var v = rows[r][cols[c]]
      h += '<td>' + (v == null ? '<em>NULL</em>' : esc(String(v))) + '</td>'
    }
    h += '</tr>'
  }
  h += '</tbody></table>'
  container.innerHTML = h
}

function getToken() {
  return document.getElementById('auth-token').value.trim() || null
}

// ── Auth helpers ──

function b64(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '') }

function makeToken(role) {
  return b64({alg:'none',typ:'JWT'}) + '.' + b64({role:role}) + '.'
}

function setAuthRole(role) {
  document.getElementById('auth-token').value = makeToken(role)
}

// ── Query tab ──

document.getElementById('query-btn').addEventListener('click', function () {
  var ed = document.getElementById('query-editor'), q
  try { q = JSON.parse(ed.value) } catch (e) { document.getElementById('query-results').innerHTML = '<div class="error">Invalid JSON</div>'; return }
  document.getElementById('query-results').innerHTML = '<div class="placeholder">Querying...</div>'
  document.getElementById('query-sql').querySelector('pre').textContent = 'Compiling...'
  document.getElementById('query-explain-content').innerHTML = '<div class="placeholder">Explaining...</div>'
  var token = getToken()
  postJSON('query', q, token).then(function (b) {
    var el = document.getElementById('query-results')
    if (b.error) { el.innerHTML = '<div class="error">' + esc(b.error) + '</div>'; return }
    renderTable(b.data, el)
  }).catch(function (e) {
    document.getElementById('query-results').innerHTML = '<div class="error">' + esc(e.message) + '</div>'
  })
  postJSON('explain', q, token).then(function (b) {
    var el = document.getElementById('query-sql')
    if (b.data && b.data.sql) {
      var sql = b.data.sql.trim()
      if (b.data.params && b.data.params.length > 0) {
        sql += '\\n\\n-- bind: ' + JSON.stringify(b.data.params)
      }
      el.querySelector('pre').textContent = sql
    } else {
      el.querySelector('pre').textContent = b.error || '\u2014'
    }
    var text = (b.data && b.data.text) ? b.data.text : (b.error || '\u2014')
    document.getElementById('query-explain-content').innerHTML = '<pre>' + esc(text) + '</pre>'
  }).catch(function (e) {
    document.getElementById('query-sql').querySelector('pre').textContent = e.message
    document.getElementById('query-explain-content').innerHTML = '<pre>' + esc(e.message) + '</pre>'
  })
})

document.getElementById('query-editor').addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') document.getElementById('query-btn').click()
})

document.getElementById('query-sample-select').addEventListener('change', function () {
  var val = this.value;
  if (!val) return;
  setQuery(val);
  switchTab('query');
});

// ── Mutate tab ──

document.getElementById('mutate-btn').addEventListener('click', function () {
  var ed = document.getElementById('mutation-editor'), m
  try { m = JSON.parse(ed.value) } catch (e) { document.getElementById('mutate-results').innerHTML = '<div class="error">Invalid JSON</div>'; return }
  document.getElementById('mutate-results').innerHTML = '<div class="placeholder">Mutating...</div>'
  document.getElementById('mutate-sql').querySelector('pre').textContent = 'Sending...'
  var token = getToken()
  postJSON('mutate', m, token).then(function (b) {
    var el = document.getElementById('mutate-results')
    if (b.error) { el.innerHTML = '<div class="error">' + esc(b.error) + '</div>'; return }
    renderTable(b.data, el)
    document.getElementById('mutate-sql').querySelector('pre').textContent = 'Mutation succeeded.'
  }).catch(function (e) {
    document.getElementById('mutate-results').innerHTML = '<div class="error">' + esc(e.message) + '</div>'
    document.getElementById('mutate-sql').querySelector('pre').textContent = e.message
  })
})

document.getElementById('mutation-editor').addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') document.getElementById('mutate-btn').click()
})

document.getElementById('mutate-sample-select').addEventListener('change', function () {
  var val = this.value;
  if (!val) return;
  setMutation(val);
  switchTab('mutate');
});

// ── Init ──

window.addEventListener('DOMContentLoaded', function () {
  fetch('meta').then(function (r) { return r.json() }).then(function (data) {
    var cubes = data.cubes || [];
    var routes = data.routes || [];
    var samples = data.samples || [];

    document.getElementById('cubes-count').textContent = cubes.length;

    var html = '';
    for (var ci = 0; ci < cubes.length; ci++) {
      var c = cubes[ci];
      html += '<tr><td style="font-weight:600">' + esc(c.name) + '</td>';
      html += '<td><ul>' + (c.measures || []).map(function (f) { return '<li>' + esc(f.name) + '</li>' }).join('') + '</ul></td>';
      html += '<td><ul>' + (c.dimensions || []).map(function (f) { return '<li>' + esc(f.name) + '</li>' }).join('') + '</ul></td>';
      html += '<td><ul>' + (c.timeDimensions || []).map(function (f) { return '<li>' + esc(f.name) + '</li>' }).join('') + '</ul></td></tr>';
    }
    document.getElementById('cubes-table-body').innerHTML = html || '<tr><td colspan="4" class="placeholder">No cubes.</td></tr>';

    var rh = '';
    for (var ri = 0; ri < routes.length; ri++) {
      var r = routes[ri];
      rh += '<tr><td>' + esc(r.method) + '</td><td>' + esc(r.path) + '</td><td>' + esc(r.description) + '</td></tr>';
    }
    document.getElementById('routes-table-body').innerHTML = rh || '<tr><td colspan="3" class="placeholder">No routes.</td></tr>';

    // Separate query vs mutation samples
    var querySamples = samples.filter(function(s) { return !s.json.cube });
    var mutateSamples = samples.filter(function(s) { return s.json.cube });

    var sel = document.getElementById('query-sample-select');
    if (querySamples.length > 0) {
      sel.innerHTML = querySamples.map(function (s) {
        var val = JSON.stringify(s.json).replace(/"/g, '&quot;');
        return '<option value="' + val + '">' + esc(s.name) + '</option>';
      }).join('');
      sel.selectedIndex = 0;
      var evt = new Event('change');
      sel.dispatchEvent(evt);
    } else {
      sel.innerHTML = '<option value="">No query samples</option>';
    }

    var msel = document.getElementById('mutate-sample-select');
    if (mutateSamples.length > 0) {
      msel.innerHTML = mutateSamples.map(function (s) {
        var val = JSON.stringify(s.json).replace(/"/g, '&quot;');
        return '<option value="' + val + '">' + esc(s.name) + '</option>';
      }).join('');
      msel.selectedIndex = 0;
      var mevt = new Event('change');
      msel.dispatchEvent(mevt);
    } else {
      msel.innerHTML = '<option value="">No mutation samples</option>';
    }

    // Default query with first cube's first measure
    if (cubes.length > 0) {
      var c = cubes[0];
      var firstMeasure = c.measures[0];
      var firstDim = c.dimensions[0] || c.timeDimensions[0];
      if (firstMeasure) {
        var dq = { measures: [firstMeasure.name] };
        if (firstDim) dq.dimensions = [firstDim.name];
        document.getElementById('query-editor').value = JSON.stringify(dq, null, 2);
      }
    }
  }).catch(function () {});
});
`

const PRETTY_SQL = `
const RE = '(--.*)|(\\'(?:\\'\\'|[^\\'])\\*\\')|(\\\\b(?:sum|avg|count|min|max)(?=\\\\s*\\\\())|(\\\\b(?:select|insert|update|delete|from|where|join|on|and|or|group|by|order|limit|as)\\\\b)|(\\\\b\\\\d+\\\\b)';

const hl = el => el.innerHTML = el.innerText.replace(new RegExp(RE, 'gi'), (m, c, s, f, k) => 
  \`<b style="color:#\${c ? '7a7' : s ? 'd44' : f ? 'b20' : k ? '26a' : 'd70'}">\${f || k ? m.toUpperCase() : m}</b>\`
);

document.querySelectorAll('pre.highlight').forEach(el => {
  const obs = new MutationObserver(() => {
    obs.disconnect();
    hl(el);
    run();
  });
  const run = () => obs.observe(el, { characterData: true, subtree: true, childList: true });
  
  hl(el);
  run();
});`

const REQUEST_EXAMPLE = `{
  "measures": ["Orders.count"],           // required: array of Cube.measure
  "dimensions": ["Orders.status"],        // optional: group-by fields
  "timeDimensions": [{                    // optional: time-based grouping
    "dimension": "Orders.ordered_at",
    "granularity": "day|week|month|quarter|year"
  }],
  "filters": [{                           // optional: conditions
    "member": "Orders.status",
    "operator": "equals|notEquals|contains|gt|gte|lt|lte|set|notSet",
    "values": ["completed"]
  }],
  "order": { "Orders.count": "asc|desc" }, // optional
  "limit": 10,                            // optional
  "offset": 0                             // optional
}`

const RESPONSE_EXAMPLE = `// /cube/query response
{ "data": [{ "Orders.count": 42, "Orders.status": "completed" }, ...] }

// /cube/explain response
{ "data": { "text": "TABLE SCAN ...", "sql": "SELECT ...", "params": [] } }

// All endpoints return { "error": "..." } on failure (HTTP 400)`

const MUTATION_REQUEST_EXAMPLE = `{
  // ── Create ──
  "cube": "Employees",
  "operation": "create",              // "create" | "update" | "delete"
  "values": {                         // required for create/update
    "name": "Jane Doe",
    "band": "E2",
    "email": "jane@greencube.io",
    "officeId": 1,
    "departmentId": 1
  }
  // ── Update (requires filters) ──
  // "operation": "update",
  // "filters": [{ "member": "Employees.id", "operator": "equals", "values": ["1"] }]
  //
  // ── Delete (requires filters) ──
  // "operation": "delete",
  // "filters": [{ "member": "Employees.id", "operator": "equals", "values": ["250"] }]
}`

const AUTHORIZATION_DOCS = `// GreenCube uses JWT-based authorization for mutations.
//
// Roles:
//   admin   — all cubes, all operations (create/update/delete)
//   editor  — Employees and Productivity, create/update only
//   viewer  — no mutation access
//
// Include the token as a Bearer header:
//   Authorization: Bearer <token>
//
// The playground automatically attaches the auth token
// (above) to all requests. Tokens are NOT verified —
// any well-formed JWT is accepted (internal tool).`

export function createTryApp(_cubes: ReadonlyMap<string, Cube>): Hono {
  const app = new Hono()

  app.get('/', (c) => c.redirect('/cube/try'))

  app.get('/try', (c) => {
    return c.html(`
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GreenCube Playground</title>
        <style>${CSS}</style>
      </head>
      <body>
        <div class="container">
          <h1><span>GreenCube</span> Playground</h1>

          <div class="tab-bar">
            <button type="button" class="tab-btn active" data-tab="query" onclick="switchTab('query')">Query</button>
            <button type="button" class="tab-btn" data-tab="mutate" onclick="switchTab('mutate')">Mutate</button>
            <button type="button" class="tab-btn" data-tab="docs" onclick="switchTab('docs')">Docs</button>
          </div>

          <details style="margin-bottom:8px">
            <summary style="font-size:0.85rem;font-weight:400;color:#888">Authorization</summary>
            <div class="input-row" style="margin-top:6px">
              <input id="auth-token" type="text" placeholder="Paste JWT token, or click a role to generate one..." style="flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:0.82rem">
              <span class="role-btn-group">
                <button class="secondary small" onclick="setAuthRole('admin')">admin</button>
                <button class="secondary small" onclick="setAuthRole('editor')">editor</button>
                <button class="secondary small" onclick="setAuthRole('viewer')">viewer</button>
              </span>
            </div>
            <p style="font-size:0.72rem;color:#999;margin:0">Select a role to auto-generate an unsigned JWT. Without a token, mutations are denied.</p>
          </details>

          <div id="tab-query" class="tab-content active">
            <div style="display:flex;align-items:center;gap:20px;margin-bottom:6px">
              <label class="label" style="margin-bottom:0;white-space:nowrap">Samples</label>
              <select id="query-sample-select" style="width:min-content;font-size:0.82rem;padding:4px 6px;border:1px solid #ccc;border-radius:4px"><option value="">Loading...</option></select>
            </div>
            <label class="label" for="query-editor">Query JSON</label>
            <textarea id="query-editor" rows="7">{\n  "measures": []\n}</textarea>
            <div class="button-row">
              <button class="primary" id="query-btn">&#9654; Run</button>
            </div>
            <h3 class="section-heading">Results</h3>
            <div id="query-results" class="placeholder">Run a query to see results.</div>
            <h3 class="section-heading">SQL</h3>
            <div id="query-sql"><pre class="highlight">&mdash;</pre></div>
            <details>
              <summary>Explain</summary>
              <div id="query-explain-content" class="placeholder">&mdash;</div>
            </details>
          </div>

          <div id="tab-mutate" class="tab-content">
            <div style="display:flex;align-items:center;gap:20px;margin-bottom:6px">
              <label class="label" style="margin-bottom:0;white-space:nowrap">Samples</label>
              <select id="mutate-sample-select" style="width:max-content;font-size:0.82rem;padding:4px 6px;border:1px solid #ccc;border-radius:4px"><option value="">Loading...</option></select>
            </div>
            <label class="label" for="mutation-editor">Mutation JSON</label>
            <textarea id="mutation-editor" rows="10">{\n  "cube": "Employees",\n  "operation": "create",\n  "values": {}\n}</textarea>
            <div class="button-row">
              <button class="primary" id="mutate-btn">&#9654; Run Mutation</button>
            </div>
            <h3 class="section-heading">Results</h3>
            <div id="mutate-results" class="placeholder">Run a mutation to see results.</div>
            <h3 class="section-heading">Status</h3>
            <div id="mutate-sql"><pre class="highlight">&mdash;</pre></div>
          </div>

          <div id="tab-docs" class="tab-content">
            <h3 class="section-heading">Cubes (<span id="cubes-count">...</span>)</h3>
            <table class="meta">
              <thead><tr><th>Cube</th><th>Measures</th><th>Dimensions</th><th>Time Dimensions</th></tr></thead>
              <tbody id="cubes-table-body"><tr><td colspan="4" class="placeholder">Loading...</td></tr></tbody>
            </table>

            <h3 class="section-heading">API Reference</h3>
            <table class="meta">
              <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
              <tbody id="routes-table-body"><tr><td colspan="3" class="placeholder">Loading...</td></tr></tbody>
            </table>

            <h3 class="section-heading">POST /cube/query — Request</h3>
            <pre>${REQUEST_EXAMPLE}</pre>

            <h3 class="section-heading">POST /cube/query — Response</h3>
            <pre>${RESPONSE_EXAMPLE}</pre>

            <h3 class="section-heading">POST /cube/mutate — Request</h3>
            <pre>${MUTATION_REQUEST_EXAMPLE}</pre>

            <h3 class="section-heading">POST /cube/mutate — Response</h3>
            <pre>// Success
{ "data": [{ "id": 251, "name": "Jane Doe", ... }] }

// Validation error (HTTP 400)
{ "error": "create requires at least one value" }

// Authorization error (HTTP 403)
{ "error": "Not authorized" }</pre>

            <h3 class="section-heading">Authorization</h3>
            <pre>${AUTHORIZATION_DOCS}</pre>
          </div>
        </div>

        <script>${SCRIPT}</script>
        <script>${PRETTY_SQL}</script>
      </body>
      </html>
    `)
  })

  return app
}
