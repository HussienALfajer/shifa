// The admin page's HTML (Arabic, RTL). The token comes from the URL fragment (`#t=...`), which
// the browser never sends; every API call carries it in `x-admin-token`. The QR is fetched into
// memory and shown as a blob URL, then dropped; nothing is cached (no-store).
export const ADMIN_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>شفاء — تجربة واتساب</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; background: #fafafa; color: #222; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: start; }
  button { margin: 2px; padding: 4px 10px; }
  #qr img { width: 280px; height: 280px; image-rendering: pixelated; }
  .muted { color: #666; font-size: 0.9em; }
</style>
</head>
<body>
<h1>تجربة واتساب (0.3-S5) — لوحة محلية</h1>
<p class="muted">تعمل على هذا الجهاز فقط. رمز QR يعادل السيطرة على الحساب: لا تصوّره ولا تشاركه.</p>
<h2>الجلسات</h2>
<table><thead><tr><th>الجلسة</th><th>الدور</th><th>الحاوية</th><th>حالة WAHA</th><th>الحالة</th><th>متوقفة بانتظار الاستئناف</th><th>إجراءات</th></tr></thead>
<tbody id="sessions"></tbody></table>
<div id="qr"></div>
<h2>نتائج التحقق</h2><ul id="verify"></ul>
<h2>محاولات الإرسال</h2><ul id="attempts"></ul>
<p id="msg" class="muted"></p>
<script>
const token = new URLSearchParams(location.hash.slice(1)).get('t') || '';
const api = (path, method = 'GET') =>
  fetch(path, { method, headers: { 'x-admin-token': token } });
const el = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
function say(text) { document.getElementById('msg').textContent = text; }
async function act(session, action) {
  const res = await api('/api/sessions/' + encodeURIComponent(session) + '/' + action, 'POST');
  say(session + ': ' + action + ' → ' + res.status);
  refresh();
}
async function showQr(session) {
  const box = document.getElementById('qr');
  box.replaceChildren();
  const res = await api('/api/sessions/' + encodeURIComponent(session) + '/qr.png');
  if (!res.ok) { say('QR: ' + res.status); return; }
  const url = URL.createObjectURL(await res.blob());
  const img = document.createElement('img');
  img.src = url;
  img.onload = () => URL.revokeObjectURL(url);
  box.append(el('p', 'امسح الرمز من تطبيق واتساب للأعمال على الهاتف G خلال دقيقة.'), img);
  setTimeout(() => box.replaceChildren(), 60000);
}
async function refresh() {
  const res = await api('/api/sessions');
  if (!res.ok) { say('غير مصرّح: افتح الرابط الذي طبعه السكربت كما هو.'); return; }
  const data = await res.json();
  const body = document.getElementById('sessions');
  body.replaceChildren();
  for (const s of data.sessions) {
    const tr = document.createElement('tr');
    for (const v of [s.name, s.role, s.container, s.waha_status, s.health, s.needs_admin_resume ? 'نعم' : 'لا']) tr.append(el('td', String(v)));
    const td = document.createElement('td');
    for (const [label, fn] of [['تشغيل', () => act(s.name, 'start')], ['إيقاف', () => act(s.name, 'stop')], ['QR', () => showQr(s.name)], ['استئناف', () => act(s.name, 'resume')]]) {
      const b = el('button', label); b.onclick = fn; td.append(b);
    }
    tr.append(td);
    body.append(tr);
  }
  document.getElementById('verify').replaceChildren(...data.verifyOutcomes.map((r) => el('li', r.outcome + ': ' + r.n)));
  document.getElementById('attempts').replaceChildren(...data.attempts.map((r) => el('li', r.status + ': ' + r.n)));
}
refresh();
setInterval(refresh, 10000);
</script>
</body>
</html>
`;
