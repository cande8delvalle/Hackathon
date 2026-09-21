'use strict';

/* ---------- Estado global persistido en localStorage ---------- */
const KEY = 'campo360.v1';
const AUTOR = 'Ana Martínez';

function freshState(keep = {}) {
  return { ver: 2, online: true, role: null, remember: true, firstLoginDone: false, ...seedData(), ...keep };
}
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.ver === 2 && Array.isArray(p.records) && Array.isArray(p.messages)) return p;
    }
  } catch (e) { /* sin storage: sigue en memoria */ }
  return freshState();
}
let S = loadState();
function save() {
  try {
    const c = { ...S };
    if (!S.remember) c.role = null;
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch (e) { /* cuota llena o storage bloqueado */ }
}

/* ---------- Estado de interfaz (no se persiste) ---------- */
function freshUi(prev) {
  return {
    route: { name: 'inicio', id: null },
    origin: 'inicio',
    panelOpen: prev ? prev.panelOpen : false,
    panelAnim: false,
    syncing: null,
    login: { user: '', pass: '', show: false, remember: true, loading: false, error: null },
    obs: { parcelId: 'lote3', cat: null, foto: null, nota: '', err: '' },
    calc: { parcelId: 'lote3', etapa: 'vegetativa', hum: 20 },
    parcelTab: 'obs',
    chat: { draft: '', foto: null, sheet: false },
    hist: { filtro: 'todo', parcelId: 'todas' },
    ai: { tab: 'alertas', parcelId: 'lote3', analyzing: null, draft: '', typing: false },
    labBusy: null,
    coop: { parcelId: 'todas', tipo: 'todos' },
    esp: { draft: '' },
    lightbox: null,
    restarting: false,
    scrollBottom: false,
  };
}
let ui = freshUi();

/* ---------- Consultas de datos ---------- */
const pendingRecords = () => S.records.filter((r) => r.estado === 'pendiente');
const pendingMsgs = () => S.messages.filter((m) => m.from === 'agro' && m.estado === 'pendiente');
const pendingCount = () => pendingRecords().length + pendingMsgs().length;
const syncedRecords = () => S.records.filter((r) => r.estado === 'sincronizado');
const uid = (p) => p + ++S.seq;
const unreadReplies = (pid) => S.messages.filter((m) => m.from === 'prod' && m.entregado && !m.leido && (!pid || m.parcelId === pid)).length;

function ahorroAna() {
  const n = new Date();
  return S.records
    .filter((r) => r.tipo === 'presc' && r.autor === AUTOR && new Date(r.fecha).getMonth() === n.getMonth() && new Date(r.fecha).getFullYear() === n.getFullYear())
    .reduce((a, r) => a + r.ahorro, 0);
}
function lastRecord(pid) {
  return S.records.filter((r) => r.parcelId === pid).sort((a, b) => b.fecha - a.fecha)[0] || null;
}
function agroMessages(pid) {
  return S.messages.filter((m) => m.parcelId === pid && (m.from === 'agro' || m.entregado)).sort((a, b) => a.fecha - b.fecha);
}
function espMessages(pid) {
  // Lo que ve el productor: sus consultas y las respuestas de la agrónoma ya sincronizadas.
  return S.messages.filter((m) => m.parcelId === pid && (m.from === 'prod' || m.estado === 'enviado')).sort((a, b) => a.fecha - b.fecha);
}
const unreadForProd = (pid) => S.messages.filter((m) => m.from === 'agro' && m.estado === 'enviado' && !m.leidoProd && (!pid || m.parcelId === pid)).length;
function prodConvItems() {
  return PARCELS.map((p) => {
    const msgs = espMessages(p.id);
    return { p, last: msgs[msgs.length - 1], unread: unreadForProd(p.id) };
  }).sort((a, b) => (b.last ? b.last.fecha : 0) - (a.last ? a.last.fecha : 0));
}
function prodDefaultConv() {
  const u = prodConvItems().find((c) => c.unread);
  return u ? u.p.id : 'lote3';
}

function topAvisos(n = 2) {
  const all = [];
  PARCELS.forEach((p) => {
    const a = S.alerts[p.id];
    if (a) a.items.forEach((it) => all.push({ ...it, updatedAt: a.updatedAt }));
  });
  const urg = all.filter((a) => SEV[a.sev].rank >= 2);
  return (urg.length ? urg : []).sort((a, b) => SEV[b.sev].rank - SEV[a.sev].rank || b.score - a.score).slice(0, n);
}

/* ---------- Altas de registros y mensajes ---------- */
function addRecord(rec) {
  const r = { id: uid('r'), fecha: Date.now(), autor: AUTOR, estado: 'pendiente', nuevoCoop: false, ...rec };
  S.records.push(r);
  save();
  schedulePump();
  return r;
}
function addMessage(m) {
  const msg = { id: uid('m'), fecha: Date.now(), from: 'agro', estado: 'pendiente', nuevoEsp: false, ...m };
  S.messages.push(msg);
  save();
  schedulePump();
  return msg;
}
// Consulta del productor: llega a la app de la agrónoma solo cuando ella tiene conexión.
function espReply(pid, texto, foto) {
  const msg = { id: uid('m'), parcelId: pid, from: 'prod', texto, foto: foto || null, fecha: Date.now(), entregado: false, leido: false };
  S.messages.push(msg);
  if (S.online) deliverReplies(false);
  save();
  return msg;
}

/* ---------- Sincronización ---------- */
let pumpTimer = null;
const markRecordSynced = (r) => { r.estado = 'sincronizado'; r.nuevoCoop = true; };
const markMsgSynced = (m) => { m.estado = 'enviado'; m.nuevoEsp = true; m.leidoProd = false; };

// Con conexión, cada registro nuevo pasa de Pendiente a Sincronizado en ~1,5 s.
function schedulePump() {
  if (pumpTimer || !S.online || ui.syncing) return;
  const items = [...pendingRecords(), ...pendingMsgs()];
  if (!items.length) return;
  const oldest = Math.min(...items.map((i) => i.fecha));
  pumpTimer = setTimeout(pumpFire, Math.max(60, 1500 - (Date.now() - oldest)));
}
function pumpFire() {
  pumpTimer = null;
  if (!S.online || ui.syncing) return;
  const now = Date.now();
  let changed = false;
  pendingRecords().forEach((r) => { if (now - r.fecha >= 1400) { markRecordSynced(r); changed = true; } });
  pendingMsgs().forEach((m) => { if (now - m.fecha >= 1400) { markMsgSynced(m); changed = true; } });
  if (changed) { save(); render(); }
  schedulePump();
}

// Al volver la señal con pendientes: barra de progreso de 2 s (lotes de hasta 50).
function bulkSync() {
  clearTimeout(pumpTimer); pumpTimer = null;
  const items = [...pendingRecords(), ...pendingMsgs()];
  const n = items.length;
  if (!n) { deliverReplies(true); return; }
  const chunks = Math.ceil(n / 50);
  const sy = { n, start: Date.now(), timers: [] };
  ui.syncing = sy;
  for (let i = 0; i < chunks; i++) {
    const slice = items.slice(i * 50, (i + 1) * 50);
    sy.timers.push(setTimeout(() => {
      if (ui.syncing !== sy) return;
      slice.forEach((it) => (it.tipo ? markRecordSynced(it) : markMsgSynced(it)));
      save(); render();
    }, (2000 * (i + 1)) / chunks));
  }
  sy.timers.push(setTimeout(() => {
    if (ui.syncing !== sy) return;
    ui.syncing = null;
    save();
    toast(`${n} ${plural(n, 'registro sincronizado', 'registros sincronizados')}`, 'ok');
    deliverReplies(true);
    render();
    schedulePump();
  }, 2000));
  render();
}
function cancelSync() {
  if (ui.syncing) { ui.syncing.timers.forEach(clearTimeout); ui.syncing = null; }
  clearTimeout(pumpTimer); pumpTimer = null;
}

// Las consultas del productor llegan a la app de la agrónoma solo con conexión.
function deliverReplies(announce) {
  if (!S.online) return 0;
  const nuevas = S.messages.filter((m) => m.from === 'prod' && !m.entregado);
  nuevas.forEach((m) => { m.entregado = true; m.leido = false; });
  if (nuevas.length) {
    save();
    if (announce) toast(`${nuevas.length} ${plural(nuevas.length, 'consulta nueva', 'consultas nuevas')} del productor`, 'info');
  }
  return nuevas.length;
}

function setOnline(v) {
  if (S.online === v) return;
  S.online = v;
  save();
  if (!v) cancelSync();
  else bulkSync();
  render();
}

/* ---------- Alertas del asistente ---------- */
function refreshAlerts(pid) {
  S.alerts[pid] = { updatedAt: Date.now(), items: analyzeParcel(S, pid) };
  save();
}
function runAnalysis(target) {
  if (!S.online || ui.ai.analyzing) return;
  ui.ai.analyzing = target;
  render();
  setTimeout(() => {
    const ids = target === 'todas' ? PARCELS.map((p) => p.id) : [target];
    ids.forEach(refreshAlerts);
    ui.ai.analyzing = null;
    toast(target === 'todas' ? 'Análisis de todas las parcelas actualizado' : `Análisis del ${parcelById(target).nombre} actualizado`, 'ok');
    render();
  }, 1300);
}

function uploadLab(pid) {
  if (!S.online || ui.labBusy) return;
  ui.labBusy = pid;
  render();
  setTimeout(() => {
    const d = LAB_SAMPLES[pid];
    S.labs[pid] = { file: labFile(pid), ph: d.ph, mo: d.mo, p: d.p, k: d.k, fecha: Date.now() };
    refreshAlerts(pid);
    ui.labBusy = null;
    toast('Análisis cargado: ' + S.labs[pid].file, 'ok');
    render();
  }, 900);
}
function removeLab(pid) {
  delete S.labs[pid];
  refreshAlerts(pid);
  toast('Análisis quitado del ' + parcelById(pid).nombre, 'ok');
  render();
}

/* ---------- Chat del asistente ---------- */
function aiSend(text) {
  text = text.trim();
  if (!text || !S.online || ui.ai.typing) return;
  S.aiChat.push({ id: uid('a'), from: 'user', text, fecha: Date.now() });
  ui.ai.draft = '';
  ui.ai.typing = true;
  ui.scrollBottom = true;
  save(); render();
  setTimeout(() => {
    const ans = aiAnswer(S, ui.ai.parcelId, text);
    ui.ai.parcelId = ans.parcelId;
    S.aiChat.push({ id: uid('a'), from: 'ai', data: ans, fecha: Date.now() });
    ui.ai.typing = false;
    ui.scrollBottom = true;
    save(); render();
  }, 1100);
}

/* ---------- Eventos de la cooperativa y CSV ---------- */
function coopEvents(f = { parcelId: 'todas', tipo: 'todos' }) {
  return syncedRecords()
    .filter((r) => (f.parcelId === 'todas' || r.parcelId === f.parcelId) && (f.tipo === 'todos' || r.tipo === f.tipo))
    .sort((a, b) => b.fecha - a.fecha)
    .map((r) => ({
      r,
      fecha: r.fecha,
      parcela: parcelById(r.parcelId).nombre,
      tipo: r.tipo === 'obs' ? 'Observación' : 'Prescripción',
      detalle: r.tipo === 'obs'
        ? `${CATS[r.cat].label}${r.nota ? ': ' + r.nota : ''}${r.foto ? ' (con foto)' : ''}`
        : `Riego en etapa ${STAGES[r.etapa].label}: humedad ${r.humedad}% (objetivo ${r.objetivo}%), ${num(r.horas)} h`,
      volumen: r.tipo === 'presc' ? r.volumen : '',
      ahorro: r.tipo === 'presc' ? r.ahorro : '',
      estado: 'Recibido',
    }));
}
function downloadCsv(rows) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['fecha', 'parcela', 'tipo', 'detalle', 'volumen_m3_ha', 'ahorro_estimado_m3_ha', 'estado'];
  const lines = [head.join(',')].concat(rows.map((e) => [csvDate(e.fecha), e.parcela, e.tipo, e.detalle, e.volumen, e.ahorro, e.estado].map(q).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'campo360_eventos.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Toasts ---------- */
function toast(msg, type = 'ok') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'c-toast c-toast-' + type;
  el.innerHTML = `${ic(type === 'info' ? 'info' : 'checkcircle', 20)}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 220); }, 3400);
}
