'use strict';

/* ================= Rutas (hash) ================= */
function parseHash() {
  const [name, id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || '', id: id || null };
}
function validRoute(r) {
  if (!S.role || !ROUTES[S.role].includes(r.name)) return false;
  if (r.name === 'parcela' && !parcelById(r.id)) return false;
  if (r.id && (r.name === 'consultas' || r.name === 'pconsultas' || r.name === 'plote') && !parcelById(r.id)) return false;
  return true;
}
function applyHash() {
  let r = parseHash();
  if (!validRoute(r)) r = { name: S.role ? ROLE_DEFAULT[S.role] : 'inicio', id: null };
  ui.route = r;
  if (r.name !== 'obs' && r.name !== 'riego') ui.origin = r.name === 'parcela' ? 'parcelas' : r.name === 'asistente' ? 'consultas' : r.name;
  ui.enter = true;
  ui.scrollBottom = true;
  ui.chat.sheet = false;
  render();
}
function go(name, id = null) {
  const h = '#/' + name + (id ? '/' + id : '');
  if (location.hash !== h) {
    try { history.pushState(null, '', h); } catch (e) { location.hash = h; return; }
  }
  applyHash();
}
window.addEventListener('hashchange', applyHash);
window.addEventListener('popstate', applyHash);

/* ================= Render ================= */
function screenHTML() {
  if (ui.restarting) return `<div class="splash">${logo(64, true, true)}<p>Reiniciando app...</p></div>`;
  if (!S.role) return loginHTML();
  const maps = {
    agro: { inicio: viewInicio, resumen: viewResumen, cparcelas: viewCParcelas, parcelas: viewParcelas, parcela: viewParcela, consultas: viewConsultas, asistente: viewAsistente, historial: viewHistorial, obs: viewObs, riego: viewRiego },
    prod: { pinicio: viewPInicio, plotes: viewPLotes, plote: viewPLote, pconsultas: viewPConsultas },
  };
  const m = maps[S.role];
  return (m[ui.route.name] || m[ROLE_DEFAULT[S.role]])();
}

let lastHTML = '', lastPanel = '', lastOverlay = '';
function render() {
  const root = $('#screen');
  const html = screenHTML();
  const enter = ui.enter;
  if (html !== lastHTML || enter) {
    const ae = document.activeElement;
    let fid = null, sel = null;
    if (ae && root.contains(ae) && ae.id) { fid = ae.id; try { sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { /* sin selección */ } }
    const scrolls = {};
    $$('[data-scroll]', root).forEach((el) => { scrolls[el.dataset.scroll] = el.scrollTop; });
    const wy = window.scrollY;
    root.innerHTML = html;
    lastHTML = html;
    if (enter) {
      ui.enter = false;
      const c = $('.container', root) || root.firstElementChild;
      if (c) c.classList.add('enter');
      window.scrollTo(0, 0);
    } else window.scrollTo(0, wy);
    $$('[data-scroll]', root).forEach((el) => {
      el.scrollTop = ui.scrollBottom ? el.scrollHeight : (scrolls[el.dataset.scroll] || 0);
    });
    ui.scrollBottom = false;
    if (fid) {
      const el = document.getElementById(fid);
      if (el && !el.disabled) {
        el.focus({ preventScroll: true });
        if (sel && el.setSelectionRange && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* tipo sin selección */ } }
      }
    }
  }
  renderPanel();
  renderOverlay();
  afterRender();
}

let readTimer = null, flagTimer = null;
function afterRender() {
  const n = ui.route.name;
  const high = S.role === 'agro' ? ((n === 'consultas' && (ui.route.id || isWide())) || (n === 'asistente' && ui.ai.tab === 'chat'))
    : S.role === 'prod' ? (ui.route.name === 'pconsultas' && !!ui.route.id) : false;
  document.body.dataset.fab = high ? 'high' : '';
  document.body.dataset.role = S.role || 'login';

  if (S.role === 'agro' && n === 'consultas') {
    const id = ui.route.id || (isWide() ? defaultConvId() : null);
    if (id && unreadReplies(id) > 0 && !readTimer) {
      readTimer = setTimeout(() => {
        readTimer = null;
        if (S.role === 'agro' && ui.route.name === 'consultas') {
          S.messages.forEach((m) => { if (m.from === 'prod' && m.parcelId === id && m.entregado) m.leido = true; });
          save(); render();
        }
      }, 2500);
    }
  }
  if (!flagTimer && ((S.role === 'agro' && ui.route.name === 'resumen' && syncedRecords().some((r) => r.nuevoCoop)) || (S.role === 'prod' && S.messages.some((m) => m.nuevoEsp)))) {
    flagTimer = setTimeout(() => {
      flagTimer = null;
      if (S.role === 'agro' && ui.route.name === 'resumen') S.records.forEach((r) => { if (r.estado === 'sincronizado') r.nuevoCoop = false; });
      if (S.role === 'prod') S.messages.forEach((m) => { m.nuevoEsp = false; });
      save();
    }, 3600);
  }
}

/* ================= Panel de demo ================= */
function renderPanel() {
  const off = !S.online;
  const n = pendingCount();
  const card = ui.panelOpen ? `<div class="dp-card${ui.panelAnim ? ' pop' : ''}" role="dialog" aria-label="Panel de demo">
      <div class="dp-head"><strong>Panel de demo</strong><span class="muted small">${n} ${plural(n, 'pendiente', 'pendientes')}</span></div>
      <button class="dp-switch" id="dp-airplane" role="switch" aria-checked="${off}" data-act="dp-airplane"><span class="dp-sw-t">${ic(off ? 'plane' : 'wifi', 22)}<span><strong>Modo avión</strong><small>${off ? 'Sin conexión' : 'Con conexión'}</small></span></span><span class="sw${off ? ' on' : ''}"><i></i></span></button>
      <p class="muted small dp-note">Afecta al teléfono de la agrónoma.</p>
      <button class="btn btn-secondary btn-block" id="dp-restart" data-act="dp-restart">${ic('restart', 20)}Reiniciar app</button>
      <button class="btn btn-secondary btn-block" id="dp-reset" data-act="dp-reset">${ic('refresh', 20)}Restablecer datos de ejemplo</button>
      <div class="field"><label for="dp-view">Vista</label><div class="select-wrap"><select class="select" id="dp-view">${['agro', 'prod'].map((r) => `<option value="${r}" ${S.role === r ? 'selected' : ''}>${ROLE_LABEL[r]} (${ROLE_SUB[r]})</option>`).join('')}${S.role ? '' : '<option value="" selected disabled>Elegí una vista</option>'}</select>${ic('down', 20)}</div></div></div>` : '';
  const html = `${card}<button class="dp-fab" id="dp-fab" data-act="dp-toggle" aria-expanded="${ui.panelOpen}" aria-label="Panel de demo">${ic(ui.panelOpen ? 'x' : 'sliders', 26)}${off ? '<span class="dp-dot"></span>' : ''}</button>`;
  if (html === lastPanel) return;
  const host = $('#demo');
  const ae = document.activeElement;
  const fid = ae && host.contains(ae) ? ae.id : null;
  host.innerHTML = html;
  lastPanel = html;
  if (fid) { const el = document.getElementById(fid); if (el) el.focus({ preventScroll: true }); }
  ui.panelAnim = false;
}
function renderOverlay() {
  const html = ui.lightbox ? `<div class="lb" data-act="lb-close" role="dialog" aria-modal="true" aria-label="Foto ampliada"><button class="icon-btn lb-x" id="lb-close" data-act="lb-close" aria-label="Cerrar foto">${ic('x', 24)}</button><img src="${ui.lightbox}" alt="Foto ampliada"></div>` : '';
  if (html === lastOverlay) return;
  $('#overlay').innerHTML = html;
  lastOverlay = html;
  if (ui.lightbox) { const b = $('#lb-close'); if (b) b.focus(); }
}

/* ================= Acciones de alto nivel ================= */
function switchView(role) {
  if (!role) return;
  S.role = role;
  save();
  ui.route = { name: ROLE_DEFAULT[role], id: null };
  ui.chat = { draft: '', foto: null, sheet: false };
  go(ROLE_DEFAULT[role]);
  if (role === 'agro' && S.online) {
    const u = unreadReplies();
    if (u) toast(`Tenés ${u} ${plural(u, 'respuesta nueva', 'respuestas nuevas')} del productor`, 'info');
  }
}
function restartApp() {
  ui.restarting = true;
  render();
  setTimeout(() => {
    const sy = ui.syncing;
    ui = freshUi(ui);
    ui.syncing = sy;
    if (S.role) go(ROLE_DEFAULT[S.role]); else applyHash();
    toast('App reiniciada: tus registros siguen guardados', 'ok');
  }, 750);
}
function resetData() {
  cancelSync();
  S = freshState({ online: true, role: S.role, remember: S.remember, firstLoginDone: S.firstLoginDone });
  save();
  ui = freshUi(ui);
  if (S.role) go(ROLE_DEFAULT[S.role]); else applyHash();
  toast('Datos de ejemplo restablecidos', 'ok');
}
function logout() {
  S.role = null;
  save();
  ui.login = freshUi().login;
  ui.route = { name: 'inicio', id: null };
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* noop */ }
  render();
}
function doLogin(user, pass, remember) {
  if (ui.login.loading) return;
  ui.login.user = user; ui.login.pass = pass; ui.login.remember = remember;
  ui.login.loading = true; ui.login.error = null;
  render();
  setTimeout(() => {
    ui.login.loading = false;
    const role = { ana: 'agro', productor: 'prod' }[user.trim().toLowerCase()];
    if (!S.online && !S.firstLoginDone) { ui.login.error = 'offline'; render(); return; }
    if (!role || pass !== '1234') { ui.login.error = 'cred'; render(); return; }
    S.role = role; S.remember = remember; S.firstLoginDone = true;
    save();
    ui.login = freshUi().login;
    go(ROLE_DEFAULT[role]);
    schedulePump();
  }, 1000);
}

function saveObs() {
  const o = ui.obs;
  const nota = $('#obs-nota');
  if (nota) o.nota = nota.value;
  if (!o.cat) { o.err = 'Elegí una categoría para guardar.'; render(); return; }
  addRecord({ tipo: 'obs', parcelId: o.parcelId, cat: o.cat, nota: o.nota.trim(), foto: o.foto });
  toast('Guardado en el teléfono', 'ok');
  const pid = o.parcelId;
  ui.obs = { parcelId: pid, cat: null, foto: null, nota: '', err: '' };
  ui.parcelTab = 'obs';
  go('parcela', pid);
}
function savePresc() {
  const c = ui.calc;
  const r = calcRiego(c.etapa, c.hum);
  addRecord({ tipo: 'presc', parcelId: c.parcelId, etapa: c.etapa, humedad: c.hum, objetivo: r.objetivo, lamina: r.lamina, volumen: r.volumen, horas: r.horas, ahorro: r.ahorro });
  toast('Prescripción guardada en el teléfono', 'ok');
  ui.parcelTab = 'presc';
  go('parcela', c.parcelId);
}
const chatConvId = () => ui.route.id || (isWide() ? defaultConvId() : null);
function sendChat() {
  const id = chatConvId();
  const text = ui.chat.draft.trim();
  if (!id || (!text && !ui.chat.foto)) return;
  addMessage({ parcelId: id, texto: text, foto: ui.chat.foto });
  ui.chat.draft = ''; ui.chat.foto = null; ui.chat.sheet = false;
  ui.scrollBottom = true;
  render();
  const i = $('#chat-input'); if (i) i.focus();
}
function sendEsp() {
  const t = $('#esp-input');
  const text = (t ? t.value : ui.esp.draft).trim();
  const convs = espConvs();
  const id = ui.route.id || (isWide() && convs[0] ? convs[0].parcel.id : null);
  if (!text || !id) return;
  espReply(id, text);
  ui.esp.draft = '';
  ui.scrollBottom = true;
  toast(S.online ? 'Respuesta enviada a Ana' : 'Respuesta guardada. Llegará cuando la agrónoma tenga conexión', 'ok');
  render();
  const i = $('#esp-input'); if (i) i.focus();
}
function photoOf(kind, id) {
  const it = (kind === 'rec' ? S.records : S.messages).find((x) => x.id === id);
  return it ? photoSrc(it.foto) : null;
}

/* ================= Eventos ================= */
const ACT = {
  nav: (el) => go(el.dataset.to),
  back: () => {
    const n = ui.route.name;
    if (n === 'parcela') go('parcelas');
    else if (n === 'plote') go('plotes');
    else if ((n === 'obs' || n === 'riego') && ui.backTo) go(ui.backTo.name, ui.backTo.id);
    else go('inicio');
  },
  logout,
  'go-obs': (el) => {
    ui.backTo = { ...ui.route };
    ui.obs = { parcelId: el.dataset.pid || ui.obs.parcelId, cat: null, foto: null, nota: '', err: '' };
    go('obs');
  },
  'go-riego': (el) => {
    ui.backTo = { ...ui.route };
    ui.calc = { parcelId: el.dataset.pid || ui.calc.parcelId, etapa: 'vegetativa', hum: 20 };
    go('riego');
  },
  'open-consulta': (el) => { ui.chat = { draft: '', foto: null, sheet: false }; go('consultas', el.dataset.pid || defaultConvId()); },
  'open-conv': (el) => { if (ui.route.id !== el.dataset.pid) ui.chat = { draft: '', foto: null, sheet: false }; go('consultas', el.dataset.pid); },
  'conv-back': () => go('consultas'),
  'open-parcel': (el) => { ui.parcelTab = 'obs'; go('parcela', el.dataset.pid); },
  'parcel-tab': (el) => { ui.parcelTab = el.dataset.tab; render(); },
  'open-alert': (el) => { ui.ai.parcelId = el.dataset.pid; ui.ai.tab = 'alertas'; go('asistente'); },
  'ai-open-all': () => { ui.ai.parcelId = 'todas'; ui.ai.tab = 'alertas'; go('asistente'); },
  'ai-tab': (el) => {
    ui.ai.tab = el.dataset.tab;
    if (ui.ai.tab === 'chat' && ui.ai.parcelId === 'todas') ui.ai.parcelId = 'lote3';
    ui.scrollBottom = true;
    render();
  },
  'ai-analyze': () => runAnalysis(ui.ai.parcelId),
  'ai-suggest': (el) => aiSend(el.dataset.q),
  'open-hist': (el) => { ui.hist = { filtro: 'todo', parcelId: el.dataset.pid }; go('historial'); },
  'hist-filter': (el) => { ui.hist.filtro = el.dataset.f; render(); },
  'lab-upload': (el) => uploadLab(el.dataset.pid),
  'lab-remove': (el) => removeLab(el.dataset.pid),
  'pick-cat': (el) => { ui.obs.cat = el.dataset.cat; ui.obs.err = ''; const n = $('#obs-nota'); if (n) ui.obs.nota = n.value; render(); },
  'obs-foto': () => { const f = $('#file-obs'); if (f) f.click(); },
  'obs-foto-demo': () => { const n = $('#obs-nota'); if (n) ui.obs.nota = n.value; ui.obs.foto = 'sample'; render(); },
  'obs-foto-clear': () => { ui.obs.foto = null; render(); },
  'pick-etapa': (el) => { ui.calc.etapa = el.dataset.etapa; render(); },
  'save-presc': savePresc,
  'chat-foto': () => { ui.chat.sheet = !ui.chat.sheet; render(); },
  'chat-foto-pick': () => { ui.chat.sheet = false; render(); const f = $('#file-chat'); if (f) f.click(); },
  'chat-foto-demo': () => { ui.chat.foto = 'sample'; ui.chat.sheet = false; render(); },
  'chat-foto-clear': () => { ui.chat.foto = null; render(); },
  zoom: (el) => { const s = photoOf(el.dataset.kind, el.dataset.id); if (s) { ui.lightbox = s; render(); } },
  'lb-close': () => { ui.lightbox = null; render(); },
  'toggle-pass': () => { ui.login.show = !ui.login.show; render(); },
  'quick-login': (el) => {
    const r = el.dataset.role;
    const u = { agro: 'ana', prod: 'productor' }[r];
    doLogin(u, '1234', ui.login.remember);
  },
  'export-csv': () => {
    const rows = coopEvents(ui.coop);
    downloadCsv(rows);
    toast(`Se descargó campo360_eventos.csv (${rows.length} ${plural(rows.length, 'evento', 'eventos')})`, 'ok');
  },
  'coop-clear': () => { ui.coop = { parcelId: 'todas', tipo: 'todos' }; render(); },
  'coop-ver': (el) => { ui.coop = { parcelId: el.dataset.pid, tipo: 'todos' }; go('resumen'); },
  'esp-open': (el) => go('pconsultas', el.dataset.pid),
  'esp-back': () => go('pconsultas'),
  'p-open-lote': (el) => { ui.parcelTab = 'obs'; go('plote', el.dataset.pid); },
  'p-nav-lotes': () => go('plotes'),
  'p-open-chat': (el) => go('pconsultas', el.dataset.pid && espConvs().find((c) => c.parcel.id === el.dataset.pid) ? el.dataset.pid : null),
  'esp-sugg': (el) => { ui.esp.draft = el.dataset.t; render(); const i = $('#esp-input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
  'dp-toggle': () => { ui.panelOpen = !ui.panelOpen; ui.panelAnim = ui.panelOpen; renderPanel(); },
  'dp-airplane': () => {
    const goOff = S.online;
    setOnline(!S.online);
    if (goOff) toast('Modo avión activado. Todo se guarda en el teléfono.', 'info');
  },
  'dp-restart': restartApp,
  'dp-reset': resetData,
};

document.addEventListener('click', (e) => {
  const t = e.target;
  if (ui.chat.sheet && !t.closest('.photo-menu') && !t.closest('[data-act="chat-foto"]')) { ui.chat.sheet = false; render(); }
  const el = t.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'lb-close' && t.closest('img')) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});

function setModel(path, value) {
  const parts = path.split('.');
  let o = ui;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}
function updateNeeds() {
  const c = $('#chat-send'); if (c) c.disabled = !(ui.chat.draft.trim() || ui.chat.foto);
  const a = $('#ai-send'); if (a) a.disabled = !S.online || ui.ai.typing || !ui.ai.draft.trim();
  const s = $('#esp-send'); if (s) s.disabled = !ui.esp.draft.trim();
}
function onHum(t) {
  let v = parseFloat(t.value);
  if (isNaN(v)) { if (t.id === 'calc-hum-num') return; v = 0; }
  const c = Math.max(0, Math.min(60, v));
  ui.calc.hum = c;
  const rg = $('#calc-hum-range'), nm = $('#calc-hum-num');
  if (t !== rg) rg.value = c;
  if (t !== nm) nm.value = c; else if (c !== v) nm.value = c;
  $('#calc-results').innerHTML = calcResultsHTML();
}
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'calc-hum-range' || t.id === 'calc-hum-num') { onHum(t); return; }
  const m = t.dataset && t.dataset.model;
  if (!m || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  setModel(m, t.value);
  updateNeeds();
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'dp-view') { switchView(t.value); return; }
  if (t.id === 'calc-hum-num') { t.value = ui.calc.hum; return; }
  if (t.id === 'file-obs' || t.id === 'file-chat') {
    const f = t.files && t.files[0];
    if (!f) return;
    readImage(f).then((d) => {
      if (t.id === 'file-obs') { const n = $('#obs-nota'); if (n) ui.obs.nota = n.value; ui.obs.foto = d; } else ui.chat.foto = d;
      render();
    }).catch(() => toast('No se pudo abrir esa imagen. Probá con otra.', 'info'));
    t.value = '';
    return;
  }
  const m = t.dataset && t.dataset.model;
  if (!m) return;
  if (t.type === 'checkbox') { setModel(m, t.checked); return; }
  setModel(m, t.value);
  if (t.tagName === 'SELECT') {
    if (m === 'ai.parcelId' && ui.ai.tab === 'chat' && t.value === 'todas') ui.ai.parcelId = 'lote3';
    render();
  }
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.dataset.form;
  if (f === 'login') doLogin($('#login-user').value, $('#login-pass').value, $('#login-remember').checked);
  else if (f === 'obs-save') saveObs();
  else if (f === 'chat-send') sendChat();
  else if (f === 'ai-send') aiSend(ui.ai.draft);
  else if (f === 'esp-send') sendEsp();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (ui.lightbox) { ui.lightbox = null; render(); } else if (ui.chat.sheet) { ui.chat.sheet = false; render(); } else if (ui.panelOpen) { ui.panelOpen = false; renderPanel(); }
});
window.matchMedia('(min-width:600px)').addEventListener('change', () => render());

/* ================= Arranque ================= */
(function boot() {
  if (S.role && !NAV[S.role]) { S.role = null; save(); } // sesión vieja de un rol que ya no existe
  if (S.online) deliverReplies(false);
  applyHash();
  schedulePump();
})();
