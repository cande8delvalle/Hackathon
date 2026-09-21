'use strict';

/* ================= Piezas comunes ================= */
const NAV = {
  agro: [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'parcelas', label: 'Parcelas', icon: 'layout' },
    { id: 'consultas', label: 'Consultas', icon: 'message' },
    { id: 'historial', label: 'Historial', icon: 'history' },
    { id: 'resumen', label: 'Cooperativa', icon: 'chart' },
  ],
  prod: [
    { id: 'pinicio', label: 'Inicio', icon: 'home' },
    { id: 'plotes', label: 'Lotes', icon: 'layout' },
    { id: 'pconsultas', label: 'Consultas', icon: 'message' },
  ],
};
const ROLE_LABEL = { agro: 'Agrónoma de campo', prod: 'Productor' };
const ROLE_SUB = { agro: 'app', prod: 'dueño del campo' };
const ROLE_DEFAULT = { agro: 'inicio', prod: 'pinicio' };
const ROUTES = {
  agro: ['inicio', 'parcelas', 'parcela', 'consultas', 'asistente', 'historial', 'obs', 'riego', 'resumen', 'cparcelas'],
  prod: ['pinicio', 'plotes', 'plote', 'pconsultas'],
};
const isWide = () => window.matchMedia('(min-width:600px)').matches;

function activeNav() {
  const n = ui.route.name;
  if (n === 'plote') return 'plotes';
  if (n === 'cparcelas') return 'resumen';
  if (n === 'parcela') return 'parcelas';
  if (n === 'asistente') return 'consultas';
  if (n === 'obs' || n === 'riego') return ui.origin;
  return n;
}

const joinList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);
const kindIcon = (k) => ({ deficit: 'droplet', plaga: 'bug', nutri: 'flask', lab: 'file', stale: 'clock', ok: 'checkcircle' }[k] || 'info');

function estadoChip(e) {
  if (e === 'pendiente') return `<span class="chip chip-pend">${ic('clock', 14)}Pendiente</span>`;
  if (e === 'sincronizado') return `<span class="chip chip-ok">${ic('check', 14)}Sincronizado</span>`;
  if (e === 'enviado') return `<span class="chip chip-ok">${ic('check', 14)}Enviado</span>`;
  return `<span class="chip chip-ok">${ic('check', 14)}Recibido</span>`;
}
function sevChip(sev) {
  const label = SEV[sev].label;
  if (sev === 'urgente') return `<span class="chip chip-urg">${ic('alert', 14)}${label}</span>`;
  if (sev === 'atencion') return `<span class="chip chip-pend">${ic('alert', 14)}${label}</span>`;
  return `<span class="chip chip-info">${ic('info', 14)}${label}</span>`;
}
function emptyState(icon, title, text, action = '') {
  return `<div class="empty">${ic(icon, 32)}<strong>${title}</strong><p>${text}</p>${action}</div>`;
}
function pageHead({ title, sub = '', back = false, right = '' }) {
  return `<header class="page-head">${back ? `<button class="icon-btn" data-act="back" aria-label="Volver">${ic('left', 24)}</button>` : ''}<div class="grow"><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${right}</header>`;
}
function thumb(kind, id, foto, big) {
  return `<button type="button" class="thumb${big ? ' thumb-big' : ''}" data-act="zoom" data-kind="${kind}" data-id="${id}" aria-label="Ampliar foto"><img src="${photoSrc(foto)}" alt="Foto adjunta"></button>`;
}

function banner(ctx) {
  if (S.role !== 'agro') return '';
  if (ui.syncing) {
    const n = ui.syncing.n;
    const el = Date.now() - ui.syncing.start;
    return `<div class="banner banner-sync" role="status">${ic('refresh', 20, 'spin')}<div class="grow"><strong>Sincronizando ${n} ${plural(n, 'registro', 'registros')}...</strong><div class="progress"><i style="animation-delay:-${el}ms"></i></div></div></div>`;
  }
  if (!S.online) {
    const n = pendingCount();
    let txt;
    if (ctx === 'ai') txt = 'El asistente necesita conexión. Tus registros siguen guardándose en el teléfono.';
    else if (ctx === 'chat') txt = 'Sin conexión. Tus mensajes se envían cuando haya conectividad';
    else if (n > 0) txt = `Sin conexión. ${n} ${plural(n, 'registro se enviará', 'registros se enviarán')} cuando haya conectividad`;
    else txt = 'Sin conexión. Tus registros se guardan en el teléfono y se envían cuando haya conectividad';
    return `<div class="banner banner-off" role="status">${ic('wifioff', 20)}<span>${txt}</span></div>`;
  }
  return '';
}

function shellHTML(inner, opts = {}) {
  const items = NAV[S.role];
  const active = activeNav();
  const badgeFor = (id) => {
    let n = 0;
    if (S.role === 'agro' && id === 'consultas') n = unreadReplies();
    if (S.role === 'prod' && id === 'pconsultas') n = unreadForProd();
    return n ? `<span class="nav-badge" aria-label="${n} ${plural(n, 'novedad', 'novedades')}">${n}</span>` : '';
  };
  const nav = items.map((it) => `<button class="nav-item${it.id === active ? ' active' : ''}" data-act="nav" data-to="${it.id}"${it.id === active ? ' aria-current="page"' : ''}>${ic(it.icon, 24)}<span class="nav-label">${it.label}</span>${badgeFor(it.id)}</button>`).join('');
  const who = S.role === 'agro' ? { ini: 'AM', name: 'Ana Martínez', sub: 'Agrónoma de campo' }
    : { ini: 'CB', name: 'Carlos Benítez', sub: 'Productor · dueño del campo' };
  const mtop = S.role !== 'agro' ? `<div class="mobile-top">${logo(36)}<span class="grow"></span><button class="icon-btn" data-act="logout" aria-label="Cerrar sesión">${ic('logout', 22)}</button></div>` : '';
  return `<div class="shell${opts.chatOpen ? ' chat-open' : ''}${items.length < 2 ? ' solo' : ''}">
    <aside class="sidenav"><div class="side-logo">${logo(40)}</div><nav class="side-nav" aria-label="Navegación principal">${nav}</nav>
      <div class="side-user"><span class="avatar">${who.ini}</span><span class="side-user-t"><strong>${who.name}</strong><small>${who.sub}</small></span><button class="icon-btn" data-act="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${ic('logout', 22)}</button></div></aside>
    <main class="main${opts.fill ? ' fill' : ''}" id="main"><div class="container">${mtop}${inner}</div></main>
    <nav class="bottomnav" aria-label="Navegación principal">${nav}</nav>
  </div>`;
}

/* ================= Login ================= */
function loginHTML() {
  const L = ui.login;
  const err = L.error === 'cred'
    ? `<div class="msg-err" role="alert">${ic('alert', 20)}<span>Usuario o contraseña incorrectos. Revisá los datos.</span></div>`
    : L.error === 'offline'
      ? `<div class="msg-off" role="alert">${ic('wifioff', 20)}<span>Necesitás conexión para el primer ingreso.</span></div>` : '';
  return `<div class="login enter">
    <aside class="login-panel">${logo(48, true, true)}
      <h1 class="login-claim">Registrá, calculá y sincronizá, con o sin conectividad.</h1>
      <ul class="login-checks">${['Funciona sin conexión', 'Guarda en el dispositivo', 'Sincroniza solo'].map((t) => `<li><span class="ck">${ic('check', 18)}</span>${t}</li>`).join('')}</ul>
    </aside>
    <div class="login-form-wrap"><form class="login-form" data-form="login" novalidate>
      <div class="login-mobile-logo">${logo(48)}</div>
      <h2>Ingresá a Campo 360</h2>
      <div class="field"><label for="login-user">Usuario</label><input class="input" id="login-user" data-model="login.user" value="${esc(L.user)}" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Escribí tu usuario" ${L.loading ? 'disabled' : ''}></div>
      <div class="field"><label for="login-pass">Contraseña</label><div class="pw-wrap"><input class="input" id="login-pass" data-model="login.pass" type="${L.show ? 'text' : 'password'}" value="${esc(L.pass)}" autocomplete="current-password" placeholder="Escribí tu contraseña" ${L.loading ? 'disabled' : ''}><button type="button" class="icon-btn pw-eye" data-act="toggle-pass" aria-label="${L.show ? 'Ocultar contraseña' : 'Mostrar contraseña'}" aria-pressed="${L.show}">${ic(L.show ? 'eyeoff' : 'eye', 22)}</button></div></div>
      <label class="check"><input type="checkbox" id="login-remember" data-model="login.remember" ${L.remember ? 'checked' : ''}><span class="box">${ic('check', 16)}</span><span>Mantener sesión en este dispositivo</span></label>
      ${err}
      <button class="btn btn-primary btn-block" type="submit" id="login-submit" ${L.loading ? 'disabled' : ''}>${L.loading ? `${ic('refresh', 20, 'spin')}Ingresando...` : 'Ingresar'}</button>
      <p class="muted small center">Ingresás una vez con conexión. Después la app abre sin conectividad.</p>
      <div class="quick"><p class="quick-t">Acceso rápido para la demo</p>
        <div class="quick-btns">${['agro', 'prod'].map((r) => `<button type="button" class="btn btn-secondary" data-act="quick-login" data-role="${r}" ${L.loading ? 'disabled' : ''}>${ROLE_LABEL[r]}</button>`).join('')}</div>
        <p class="muted small center">Usuarios: ana, productor · clave 1234</p></div>
    </form></div></div>`;
}

/* ================= AGRÓNOMA: Inicio ================= */
function avisoRow(a, clickable, act = 'open-alert') {
  const P = parcelById(a.parcelId);
  const inner = `<span class="av-ic sev-${a.sev}">${ic(kindIcon(a.kind), 20)}</span><span class="av-t"><strong>${P.nombre} · ${esc(a.title)}</strong></span>${sevChip(a.sev)}${clickable ? ic('right', 20, 'muted') : ''}`;
  return clickable
    ? `<button class="aviso" data-act="${act}" data-pid="${a.parcelId}">${inner}</button>`
    : `<div class="aviso">${inner}</div>`;
}
function avisosCard(list, clickable, acts = { row: 'open-alert', all: 'ai-open-all' }) {
  const upd = list.length ? Math.min(...list.map((a) => a.updatedAt)) : null;
  return `<section class="card avisos"><div class="card-head"><h2>${ic('bell', 20)}Avisos</h2>${clickable ? `<button class="link" data-act="${acts.all}">Ver todas</button>` : ''}</div>
    ${upd ? `<p class="muted small">Actualizado ${whenLabel(upd)}</p>` : ''}
    ${list.length ? `<div class="aviso-list">${list.map((a) => avisoRow(a, clickable, acts.row)).join('')}</div>` : emptyState('shield', 'Sin avisos por ahora', 'Cuando el asistente detecte algo que requiera atención, lo vas a ver acá.')}
    <p class="disclaimer small">${ic('info', 14)}<span>Posibilidad, no diagnóstico. Orientativo. No reemplaza a un ingeniero agrónomo.</span></p></section>`;
}

function viewInicio() {
  const pend = pendingCount();
  const unread = unreadReplies();
  const rows = PARCELS.map((p) => {
    const last = lastRecord(p.id);
    return `<button class="parcel-row" data-act="open-parcel" data-pid="${p.id}"><span class="p-ic">${ic('sprout', 22)}</span><span class="p-t"><strong>${p.nombre}</strong><small>${p.cultivo} · ${num(p.ha, 1)} ha</small></span>${last ? estadoChip(last.estado) : '<span class="chip chip-neutral">Sin registros</span>'}${ic('right', 20, 'muted')}</button>`;
  }).join('');
  const inner = `
    <header class="home-head"><span class="avatar avatar-lg">AM</span><div class="grow"><h1>Hola, Ana</h1><p class="muted">Cooperativa del Sur</p></div><button class="icon-btn" data-act="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${ic('logout', 22)}</button></header>
    ${banner()}
    <div class="home-grid">
      <div class="home-side">
        <div class="actions">
          <button class="action action-primary" data-act="go-obs">${ic('plus', 28)}<span>Nueva observación</span></button>
          <button class="action" data-act="go-riego">${ic('calc', 28)}<span>Calcular riego</span></button>
          <button class="action action-wide" data-act="open-consulta">${ic('message', 28)}<span>Consultas del productor</span>${unread ? `<span class="badge-new">${unread} ${plural(unread, 'consulta nueva', 'consultas nuevas')}</span>` : ''}</button>
        </div>
        <div class="kpis">
          <div class="kpi card${pend ? ' kpi-warn' : ''}"><span class="kpi-l">Pendientes de enviar</span><span class="kpi-v" id="kpi-pend">${num(pend)}</span><span class="kpi-s">${pend ? ic('clock', 14) + ' Se envían con conectividad' : ic('check', 14) + ' Todo enviado'}</span></div>
          <div class="kpi card"><span class="kpi-l">Ahorro estimado</span><span class="kpi-v">${num(ahorroAna())}<small> m³/ha</small></span><span class="kpi-s">${ic('trend', 14)} Este mes</span></div>
        </div>
        ${avisosCard(topAvisos(2), true)}
      </div>
      <section class="home-parcelas card"><div class="card-head"><h2>Parcelas</h2><button class="link" data-act="nav" data-to="parcelas">Ver todas</button></div><div class="parcel-list">${rows}</div></section>
    </div>`;
  return shellHTML(inner);
}

/* ================= AGRÓNOMA: Parcelas ================= */
function viewParcelas() {
  const cards = PARCELS.map((p) => {
    const last = lastRecord(p.id);
    const top = (S.alerts[p.id] ? S.alerts[p.id].items : []).find((a) => SEV[a.sev].rank >= 2);
    const no = S.records.filter((r) => r.parcelId === p.id && r.tipo === 'obs').length;
    const np = S.records.filter((r) => r.parcelId === p.id && r.tipo === 'presc').length;
    return `<button class="parcel-card card" data-act="open-parcel" data-pid="${p.id}">
      <span class="pc-top"><span class="p-ic">${ic('sprout', 24)}</span><span class="p-t"><strong>${p.nombre}</strong><small>${p.cultivo} · ${num(p.ha, 1)} ha</small></span>${ic('right', 20, 'muted')}</span>
      <span class="pc-mid"><span>${no} ${plural(no, 'observación', 'observaciones')}</span><span>${np} ${plural(np, 'prescripción', 'prescripciones')}</span></span>
      <span class="pc-bot">${last ? estadoChip(last.estado) + `<small class="muted">Último: ${whenLabel(last.fecha)}</small>` : '<span class="chip chip-neutral">Sin registros</span>'}${top ? sevChip(top.sev) : ''}</span></button>`;
  }).join('');
  return shellHTML(`${pageHead({ title: 'Parcelas', sub: 'Cooperativa del Sur · ' + num(PARCELS.reduce((a, p) => a + p.ha, 0), 1) + ' ha' })}${banner()}<div class="cards-grid">${cards}</div>`);
}

function labCard(pid, readonly) {
  const lab = S.labs[pid];
  return `<div class="card lab-card"><div class="lab-head"><span class="file-chip">${ic('file', 18)}<span>${esc(lab.file)}</span>${readonly ? "" : `<button class="file-x" data-act="lab-remove" data-pid="${pid}" aria-label="Quitar ${esc(lab.file)}">${ic("x", 18)}</button>`}</span></div>
    <dl class="lab-grid"><div><dt>pH</dt><dd>${num(lab.ph, 1)}</dd></div><div><dt>Materia orgánica</dt><dd>${num(lab.mo, 1)}%</dd></div><div><dt>Fósforo</dt><dd>${lab.p} ppm</dd></div><div><dt>Potasio</dt><dd>${lab.k} ppm</dd></div></dl>
    <p class="muted small">${ic('info', 14)} Del análisis cargado. Lectura simulada con datos de ejemplo.</p></div>`;
}
function labBlock(pid) {
  if (ui.labBusy === pid) return `<div class="lab-busy">${ic('refresh', 20, 'spin')}<span>Leyendo ${labFile(pid)}...</span></div>`;
  if (S.labs[pid]) return labCard(pid);
  return `<button class="btn btn-secondary btn-block" data-act="lab-upload" data-pid="${pid}" ${S.online ? '' : 'disabled'}>${ic('upload', 20)}Subir análisis (PDF)</button>${S.online ? '' : `<p class="hint">${ic('wifioff', 14)} Disponible cuando haya conexión.</p>`}`;
}

function recCard(r, showParcel, recibido) {
  const chipE = recibido ? estadoChip("recibido") : estadoChip(r.estado);
  const P = parcelById(r.parcelId);
  const meta = `<p class="meta">${showParcel ? P.nombre + ' · ' : ''}${whenLabel(r.fecha)} · ${esc(r.autor)}</p>`;
  if (r.tipo === 'obs') {
    const c = CATS[r.cat];
    return `<article class="rec"><span class="rec-ic">${ic(c.icon, 22)}</span><div class="rec-b"><div class="rec-top"><strong>Observación · ${c.label}</strong>${chipE}</div>${r.nota ? `<p>${esc(r.nota)}</p>` : ''}${r.foto ? thumb('rec', r.id, r.foto) : ''}${meta}</div></article>`;
  }
  return `<article class="rec"><span class="rec-ic">${ic('droplet', 22)}</span><div class="rec-b"><div class="rec-top"><strong>Prescripción de riego</strong>${chipE}</div><p>Etapa ${STAGES[r.etapa].label} · humedad ${r.humedad}% (objetivo ${r.objetivo}%)</p><div class="mini-stats"><span><b>${num(r.volumen)}</b> m³/ha</span><span><b>${num(r.horas)}</b> h</span><span><b>${num(r.ahorro)}</b> m³/ha de ahorro</span></div>${meta}</div></article>`;
}
function msgCard(m) {
  return `<article class="rec"><span class="rec-ic">${ic('message', 22)}</span><div class="rec-b"><div class="rec-top"><strong>Mensaje al productor</strong>${estadoChip(m.estado)}</div>${m.texto ? `<p>${esc(m.texto)}</p>` : ''}${m.foto ? thumb('msg', m.id, m.foto) : ''}<p class="meta">${parcelById(m.parcelId).nombre} · ${whenLabel(m.fecha)} · ${AUTOR}</p></div></article>`;
}

function viewParcela() {
  const p = parcelById(ui.route.id);
  const obs = S.records.filter((r) => r.parcelId === p.id && r.tipo === 'obs').sort((a, b) => b.fecha - a.fecha);
  const pre = S.records.filter((r) => r.parcelId === p.id && r.tipo === 'presc').sort((a, b) => b.fecha - a.fecha);
  const tab = ui.parcelTab;
  const list = tab === 'obs' ? obs : pre;
  const last = lastRecord(p.id);
  const alerts = (S.alerts[p.id] ? S.alerts[p.id].items : []).filter((a) => a.kind !== 'ok').slice(0, 3);
  const body = list.length
    ? `<div class="rec-list">${list.map((r) => recCard(r, false)).join('')}</div>`
    : emptyState(tab === 'obs' ? 'leaf' : 'droplet', tab === 'obs' ? 'Sin observaciones todavía' : 'Sin prescripciones todavía', tab === 'obs' ? 'Registrá humedad, plagas o nutrientes de este lote.' : 'Calculá el riego y guardá la prescripción.', `<button class="btn btn-primary" data-act="${tab === 'obs' ? 'go-obs' : 'go-riego'}" data-pid="${p.id}">${tab === 'obs' ? 'Nueva observación' : 'Calcular riego'}</button>`);
  const inner = `${pageHead({ title: p.nombre, sub: `${p.cultivo} · ${num(p.ha, 1)} ha`, back: true, right: last ? estadoChip(last.estado) : '' })}${banner()}
    <div class="detail-grid">
      <div class="detail-side">
        <div class="detail-actions">
          <button class="btn btn-primary" data-act="go-obs" data-pid="${p.id}">${ic('plus', 20)}Nueva observación</button>
          <button class="btn btn-secondary" data-act="go-riego" data-pid="${p.id}">${ic('calc', 20)}Calcular riego</button>
          <button class="btn btn-secondary" data-act="open-consulta" data-pid="${p.id}">${ic('message', 20)}Consultar</button>
        </div>
        <div class="lab-zone">${labBlock(p.id)}</div>
        <section class="card"><div class="card-head"><h2>${ic('sparkles', 20)}Alertas del asistente</h2><button class="link" data-act="open-alert" data-pid="${p.id}">Ver</button></div>
          ${alerts.length ? `<div class="aviso-list">${alerts.map((a) => avisoRow(a, false)).join('')}</div>` : '<p class="muted">Sin alertas por ahora.</p>'}
          <button class="link" data-act="open-hist" data-pid="${p.id}">Ver historial completo</button></section>
      </div>
      <section class="card detail-main">
        <div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'obs'}" data-act="parcel-tab" data-tab="obs">Observaciones <span class="tab-n">${obs.length}</span></button><button role="tab" aria-selected="${tab === 'presc'}" data-act="parcel-tab" data-tab="presc">Prescripciones <span class="tab-n">${pre.length}</span></button></div>
        ${body}</section>
    </div>`;
  return shellHTML(inner);
}

/* ================= AGRÓNOMA: Nueva observación ================= */
function parcelSelect(id, model, value, extra = '') {
  return `<div class="select-wrap"><select class="select" id="${id}" data-model="${model}" ${extra}>${PARCELS.map((p) => `<option value="${p.id}" ${p.id === value ? 'selected' : ''}>${p.nombre} · ${p.cultivo} · ${num(p.ha, 1)} ha</option>`).join('')}</select>${ic('down', 20)}</div>`;
}
function viewObs() {
  const o = ui.obs;
  const cats = Object.keys(CATS).map((k) => `<button type="button" class="cat-btn" role="radio" aria-checked="${o.cat === k}" data-act="pick-cat" data-cat="${k}">${ic(CATS[k].icon, 24)}<span>${CATS[k].label}</span></button>`).join('');
  const foto = o.foto
    ? `<div class="photo-prev"><img src="${photoSrc(o.foto)}" alt="Miniatura de la foto"><span class="grow muted small">Foto lista para guardar</span><button type="button" class="icon-btn" data-act="obs-foto-clear" aria-label="Quitar foto">${ic('x', 22)}</button></div>` : '';
  const inner = `${pageHead({ title: 'Nueva observación', sub: 'Se guarda en el teléfono', back: true })}${banner()}
    <form class="form card" data-form="obs-save" novalidate>
      <div class="field"><label for="obs-parcel">Parcela</label>${parcelSelect('obs-parcel', 'obs.parcelId', o.parcelId)}</div>
      <div class="field"><span class="label" id="cat-l">Categoría <em>(obligatoria)</em></span><div class="cat-row" role="radiogroup" aria-labelledby="cat-l">${cats}</div>${o.err ? `<div class="msg-err" role="alert">${ic('alert', 20)}<span>${o.err}</span></div>` : ''}</div>
      <div class="field"><span class="label">Foto</span><div class="btn-row">
        <button type="button" class="btn btn-secondary" data-act="obs-foto">${ic('camera', 20)}Tomar foto</button>
        <button type="button" class="btn btn-secondary" data-act="obs-foto-demo">${ic('image', 20)}Usar foto de ejemplo</button></div>${foto}
        <input type="file" id="file-obs" accept="image/*" hidden></div>
      <div class="field"><label for="obs-nota">Notas</label><textarea class="textarea" id="obs-nota" data-model="obs.nota" placeholder="Escribí lo que ves en el lote">${esc(o.nota)}</textarea></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${ic('check', 22)}Guardar en el teléfono</button>
    </form>`;
  return shellHTML(inner);
}

/* ================= AGRÓNOMA: Calculadora de riego ================= */
function calcResultsHTML() {
  const c = ui.calc;
  const r = calcRiego(c.etapa, c.hum);
  const st = STAGES[c.etapa];
  return `<div class="res-cards">
      <div class="res-card"><span class="res-ic">${ic('droplet', 22)}</span><span class="res-l">Volumen</span><span class="res-v">${num(r.volumen)}<small> m³/ha</small></span></div>
      <div class="res-card"><span class="res-ic">${ic('timer', 22)}</span><span class="res-l">Horas de aspersión</span><span class="res-v">${num(r.horas)}<small> h</small></span></div>
      <div class="res-card"><span class="res-ic">${ic('trend', 22)}</span><span class="res-l">Ahorro estimado</span><span class="res-v">${num(r.ahorro)}<small> m³/ha</small></span></div>
    </div>
    ${r.sinRiego ? `<div class="msg-ok" role="status">${ic('checkcircle', 20)}<span>La humedad ya alcanza el objetivo. No hace falta regar.</span></div>` : ''}
    ${r.deficit ? `<div class="deficit"><span class="chip chip-urg">${ic('droplet', 14)}Déficit hídrico</span><span class="muted small">Humedad más de 5 puntos por debajo del objetivo.</span></div>` : ''}
    <p class="muted small">Etapa ${st.label}: profundidad ${st.mm} mm, objetivo ${st.obj}%. Lámina de riego: ${num(r.lamina)} mm.</p>
    <p class="note">${ic('info', 14)} Valores de ejemplo para la demo</p>`;
}
function viewRiego() {
  const c = ui.calc;
  const stages = Object.keys(STAGES).map((k) => `<button type="button" class="cat-btn cat-btn-s" role="radio" aria-checked="${c.etapa === k}" data-act="pick-etapa" data-etapa="${k}"><span>${STAGES[k].label}</span></button>`).join('');
  const inner = `${pageHead({ title: 'Calcular riego', sub: 'Elegí la parcela, la etapa y la humedad', back: true })}${banner()}
    <div class="calc-grid">
      <section class="card form">
        <div class="field"><label for="calc-parcel">Parcela</label>${parcelSelect('calc-parcel', 'calc.parcelId', c.parcelId)}</div>
        <div class="field"><span class="label" id="et-l">Etapa del cultivo</span><div class="cat-row" role="radiogroup" aria-labelledby="et-l">${stages}</div></div>
        <div class="field"><label for="calc-hum-num">Humedad del suelo (%)</label>
          <div class="hum-row"><input type="range" id="calc-hum-range" min="0" max="60" step="1" value="${c.hum}" aria-label="Humedad del suelo, deslizador"><input class="input hum-num" type="number" inputmode="decimal" id="calc-hum-num" min="0" max="60" step="1" value="${c.hum}"></div></div>
      </section>
      <section class="card calc-res"><h2>Resultado</h2><div id="calc-results">${calcResultsHTML()}</div>
        <button class="btn btn-primary btn-lg btn-block" data-act="save-presc">${ic('check', 22)}Guardar prescripción</button></section>
    </div>`;
  return shellHTML(inner);
}

/* ================= AGRÓNOMA: Consultas (chat con el productor) ================= */
function selectorSeg(active) {
  return `<div class="seg" role="tablist" aria-label="Tipo de consulta"><button role="tab" aria-selected="${active === 'prod'}" data-act="nav" data-to="consultas">${ic('message', 20)}Productor</button><button role="tab" aria-selected="${active === 'ia'}" data-act="nav" data-to="asistente">${ic('sparkles', 20)}Asistente IA</button></div>`;
}
function convItems() {
  return PARCELS.map((p) => {
    const msgs = agroMessages(p.id);
    return { p, last: msgs[msgs.length - 1], unread: unreadReplies(p.id) };
  }).sort((a, b) => (b.last ? b.last.fecha : 0) - (a.last ? a.last.fecha : 0));
}
function defaultConvId() {
  const u = convItems().find((c) => c.unread);
  return u ? u.p.id : 'lote3';
}
function agroMsgHTML(m) {
  const mine = m.from === 'agro';
  return `<div class="msg ${mine ? 'me' : 'them'}"><div class="bubble">${m.foto ? thumb('msg', m.id, m.foto) : ''}${m.texto ? `<p>${esc(m.texto)}</p>` : ''}</div>
    <div class="msg-meta">${mine ? estadoChip(m.estado) : ''}<span class="time">${hhmm(m.fecha)}</span></div></div>`;
}
function composerHTML(model, placeholder, opts, form = 'chat-send') {
  const { foto, sheet } = opts;
  return `<div class="composer-wrap">${foto ? `<div class="photo-prev composer-prev"><img src="${photoSrc(foto)}" alt="Miniatura"><span class="grow muted small">Foto adjunta</span><button type="button" class="icon-btn" data-act="chat-foto-clear" aria-label="Quitar foto">${ic('x', 22)}</button></div>` : ''}
    ${sheet ? `<div class="photo-menu" role="menu"><button class="pop-item" role="menuitem" data-act="chat-foto-pick">${ic('image', 20)}Elegir de la galería</button><button class="pop-item" role="menuitem" data-act="chat-foto-demo">${ic('leaf', 20)}Usar foto de ejemplo</button></div>` : ''}
    <form class="composer" data-form="${form}"><button type="button" class="icon-btn icon-btn-b" data-act="chat-foto" aria-label="Adjuntar foto" aria-expanded="${!!sheet}">${ic('camera', 24)}</button>
      <input class="input" id="chat-input" data-model="${model}" value="${esc(ui.chat.draft)}" placeholder="${placeholder}" autocomplete="off">
      <button class="btn btn-primary icon-btn-b send" type="submit" id="chat-send" data-needs="chat" aria-label="Enviar" ${(ui.chat.draft.trim() || foto) ? '' : 'disabled'}>${ic('send', 22)}</button></form>
    <input type="file" id="file-chat" accept="image/*" hidden></div>`;
}
function viewConsultas() {
  const wide = isWide();
  const id = ui.route.id || (wide ? defaultConvId() : null);
  const items = convItems().map((c) => {
    const prev = c.last ? (c.last.from === 'agro' ? 'Vos: ' : 'Carlos: ') + (c.last.texto || 'Foto') : 'Todavía no hay consultas';
    return `<button class="conv-item${c.p.id === id ? ' active' : ''}" data-act="open-conv" data-pid="${c.p.id}"><span class="p-ic">${ic('message', 22)}</span><span class="p-t"><strong>${c.p.nombre} · Soja</strong><small>${esc(prev)}</small></span><span class="conv-r"><small>${c.last ? shortWhen(c.last.fecha) : ''}</small>${c.unread ? `<span class="badge-new">${c.unread} ${plural(c.unread, 'consulta nueva', 'consultas nuevas')}</span>` : (c.last && c.last.from === 'prod' ? '<span class="chip chip-pend">Sin responder</span>' : (c.last && c.last.estado === 'pendiente' ? ic('clock', 16, 'pend-ic') : ''))}</span></button>`;
  }).join('');
  let panel;
  if (id) {
    const p = parcelById(id);
    const msgs = agroMessages(id);
    panel = `<div class="conv-head"><button class="icon-btn only-mobile" data-act="conv-back" aria-label="Volver a las consultas">${ic('left', 24)}</button><span class="avatar">CB</span><div class="grow"><strong>Carlos Benítez · ${p.nombre} · ${p.cultivo}</strong></div></div>
      <div class="msgs" data-scroll="msgs">${msgs.length ? msgs.map(agroMsgHTML).join('') : emptyState('message', 'Todavía no hay consultas en este lote', 'Cuando el productor te escriba, la vas a ver acá. También podés escribirle vos, con foto.')}</div>
      ${composerHTML('chat.draft', 'Escribí tu respuesta', ui.chat)}`;
  } else {
    panel = emptyState('message', 'Elegí una conversación', 'Las consultas del productor aparecen acá.');
  }
  const inner = `<div class="consult-head"><h1>Consultas</h1>${selectorSeg('prod')}</div>${banner('chat')}
    <div class="chat-wrap${id ? ' conv-open' : ''}"><section class="conv-list card" aria-label="Conversaciones por parcela">${items}</section><section class="conv-panel card">${panel}</section></div>`;
  return shellHTML(inner, { fill: wide || !!id, chatOpen: !!id });
}

/* ================= AGRÓNOMA: Asistente IA ================= */
function alertCardHTML(a, showParcel) {
  const P = parcelById(a.parcelId);
  return `<article class="alert-card sev-b-${a.sev}"><div class="alert-head"><span class="av-ic sev-${a.sev}">${ic(kindIcon(a.kind), 22)}</span><h3 class="grow">${showParcel ? P.nombre + ' · ' : ''}${esc(a.title)}</h3>${sevChip(a.sev)}</div>
    <p>${esc(a.detail)}</p>
    <p class="ai-h">Posibles causas</p><ul class="ai-ul">${a.causas.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <p class="ai-h">Acciones sugeridas</p><ul class="ai-ul">${a.acciones.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <p class="ai-basada"><strong>Basada en:</strong> ${esc(a.basada)}</p>
    <p class="disclaimer">${ic('info', 16)}<span>Posibilidad, no diagnóstico · Orientativo. No reemplaza a un ingeniero agrónomo.</span></p></article>`;
}
function alertsTab() {
  const sel = ui.ai.parcelId;
  const ids = sel === 'todas' ? PARCELS.map((p) => p.id) : [sel];
  const items = [];
  ids.forEach((id) => { const a = S.alerts[id]; if (a) a.items.forEach((it) => items.push(it)); });
  items.sort((a, b) => SEV[b.sev].rank - SEV[a.sev].rank || b.score - a.score);
  const upds = ids.map((id) => S.alerts[id] && S.alerts[id].updatedAt).filter(Boolean);
  const busy = ui.ai.analyzing;
  const off = !S.online;
  const opts = `<option value="todas" ${sel === 'todas' ? 'selected' : ''}>Todas las parcelas</option>` + PARCELS.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.nombre} · ${p.cultivo}</option>`).join('');
  let body;
  if (busy) body = `<div class="card analyzing">${ic('sparkles', 28, 'spin-slow')}<strong>Analizando ${busy === 'todas' ? 'todas las parcelas' : 'los registros del ' + parcelById(busy).nombre}...</strong><p class="muted">Revisando observaciones, prescripciones, humedad e historial.</p><div class="progress"><i class="indet"></i></div></div>`;
  else if (items.length) body = `<div class="alert-list">${items.map((a) => alertCardHTML(a, sel === 'todas')).join('')}</div>`;
  else body = emptyState('sparkles', 'Todavía no hay alertas', off ? 'Se generan cuando analizás la parcela con conexión.' : 'Tocá “Analizar parcela” para revisar los registros.');
  return `<div class="ai-tools"><div class="select-wrap"><select class="select" id="ai-parcel" data-model="ai.parcelId" aria-label="Parcela a analizar">${opts}</select>${ic('down', 20)}</div>
      <button class="btn btn-primary" data-act="ai-analyze" ${off || busy ? 'disabled' : ''}>${ic('sparkles', 20)}${sel === 'todas' ? 'Analizar todas las parcelas' : 'Analizar parcela'}</button></div>
    ${upds.length ? `<p class="muted small upd">${ic('clock', 14)} Actualizado ${whenLabel(Math.min(...upds))}</p>` : ''}${body}`;
}
function aiMsgHTML(m) {
  if (m.from === 'user') return `<div class="msg me"><div class="bubble"><p>${esc(m.text)}</p></div><div class="msg-meta"><span class="time">${hhmm(m.fecha)}</span></div></div>`;
  const d = m.data;
  const P = parcelById(d.parcelId);
  const tags = { reg: ['Registros', 'tag-reg'], lab: ['Análisis cargado', 'tag-lab'], calc: ['Cálculo de Campo 360', 'tag-calc'], sin: ['Aviso', 'tag-sin'] };
  const c = d.card;
  return `<div class="msg them ai"><div class="bubble ai-bubble"><div class="ai-head">${ic('sparkles', 18)}<strong>Asistente IA · ${P.nombre}</strong></div>
    ${d.blocks.map((b) => `<div class="src"><span class="tag ${tags[b.src][1]}">${tags[b.src][0]}</span><p>${esc(b.text)}</p></div>`).join('')}
    ${d.causas.length ? `<p class="ai-h">Posibles causas</p><p>Podría estar relacionado con ${esc(joinList(d.causas))}.</p>` : ''}
    ${d.acciones.length ? `<p class="ai-h">Acciones sugeridas</p><ul class="ai-ul">${d.acciones.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    ${c ? `<div class="calc-card"><span class="tag tag-calc">Cálculo de Campo 360</span><strong>Cálculo de riego</strong><div class="calc-stats"><div><small>Volumen</small><b>${num(c.volumen)} m³/ha</b></div><div><small>Horas estimadas</small><b>${num(c.horas)} h</b></div><div><small>Ahorro estimado</small><b>${num(c.ahorro)} m³/ha</b></div></div><small class="muted">Etapa ${c.etapa} · humedad ${c.humedad}% · objetivo ${c.objetivo}%. Valores de ejemplo para la demo.</small></div>` : ''}
    ${d.basada ? `<p class="ai-basada"><strong>Nivel de atención:</strong> ${sevChip(d.nivel)}</p><p class="ai-basada"><strong>Basada en:</strong> ${esc(d.basada)}</p>` : ''}
    <p class="disclaimer">${ic('info', 16)}<span>Orientativo. No reemplaza a un ingeniero agrónomo.</span></p></div>
    <div class="msg-meta"><span class="time">${hhmm(m.fecha)}</span></div></div>`;
}
function aiChatTab() {
  const P = parcelById(ui.ai.parcelId === 'todas' ? 'lote3' : ui.ai.parcelId);
  const off = !S.online;
  const f = parcelFacts(S, P.id, Date.now());
  const sugg = [`¿Qué hago con el ${P.nombre}?`, '¿Cómo está la humedad?', '¿Hay plagas repetidas?', '¿Qué dice el análisis de suelo?'];
  const msgs = S.aiChat.map(aiMsgHTML).join('') + (ui.ai.typing ? '<div class="msg them"><div class="bubble typing" aria-label="El asistente está escribiendo"><i></i><i></i><i></i></div></div>' : '');
  return `<div class="ai-chat">
    <div class="ai-ctx card"><div class="ai-ctx-row"><div class="select-wrap"><select class="select" id="ai-parcel" data-model="ai.parcelId" aria-label="Parcela de la conversación">${PARCELS.map((p) => `<option value="${p.id}" ${p.id === P.id ? 'selected' : ''}>${p.nombre} · ${p.cultivo}</option>`).join('')}</select>${ic('down', 20)}</div>
      <p class="muted small">${f.obs.length} ${plural(f.obs.length, 'observación', 'observaciones')} · ${f.presc.length} ${plural(f.presc.length, 'prescripción', 'prescripciones')} · ${f.lab ? 'análisis cargado (' + esc(f.lab.file) + ')' : 'sin análisis cargado'}</p></div>
      <details class="legend"><summary>¿De dónde salen los datos?</summary><p class="small"><span class="tag tag-reg">Registros</span> lo que cargó el equipo en la app. <span class="tag tag-lab">Análisis cargado</span> datos del PDF de laboratorio. <span class="tag tag-calc">Cálculo de Campo 360</span> fórmulas de la aplicación.</p></details></div>
    <div class="msgs" data-scroll="aimsgs">${msgs || emptyState('sparkles', 'Preguntale al asistente', 'Analiza solo lo que está cargado en Campo 360. Probá con una de las preguntas de abajo.')}</div>
    <div class="ai-suggest">${sugg.map((q) => `<button class="fchip" data-act="ai-suggest" data-q="${esc(q)}" ${off || ui.ai.typing ? 'disabled' : ''}>${esc(q)}</button>`).join('')}</div>
    <form class="composer card-composer" data-form="ai-send"><input class="input" id="ai-input" data-model="ai.draft" value="${esc(ui.ai.draft)}" placeholder="Escribí tu pregunta" autocomplete="off" ${off ? 'disabled' : ''}>
      <button class="btn btn-primary icon-btn-b send" type="submit" id="ai-send" data-needs="ai" aria-label="Enviar pregunta" ${off || !ui.ai.draft.trim() || ui.ai.typing ? 'disabled' : ''}>${ic('send', 22)}</button></form></div>`;
}
function viewAsistente() {
  const tab = ui.ai.tab;
  const inner = `<div class="consult-head"><h1>Consultas</h1>${selectorSeg('ia')}</div>
    <div class="tabs tabs-ai" role="tablist"><button role="tab" aria-selected="${tab === 'alertas'}" data-act="ai-tab" data-tab="alertas">${ic('bell', 20)}Alertas</button><button role="tab" aria-selected="${tab === 'chat'}" data-act="ai-tab" data-tab="chat">${ic('message', 20)}Chat</button></div>
    ${banner('ai')}
    <p class="disclaimer strip">${ic('info', 16)}<span>Orientativo. No reemplaza a un ingeniero agrónomo.</span></p>
    ${tab === 'alertas' ? alertsTab() : aiChatTab()}`;
  return shellHTML(inner, { fill: tab === 'chat' });
}

/* ================= AGRÓNOMA: Historial ================= */
function histItems() {
  const { filtro, parcelId } = ui.hist;
  let items = [
    ...S.records.map((r) => ({ t: 'rec', ts: r.fecha, r })),
    ...S.messages.filter((m) => m.from === 'agro').map((m) => ({ t: 'msg', ts: m.fecha, m })),
  ];
  const get = (i) => i.r || i.m;
  if (parcelId !== 'todas') items = items.filter((i) => get(i).parcelId === parcelId);
  if (filtro === 'obs') items = items.filter((i) => i.t === 'rec' && i.r.tipo === 'obs');
  if (filtro === 'presc') items = items.filter((i) => i.t === 'rec' && i.r.tipo === 'presc');
  if (filtro === 'pend') items = items.filter((i) => get(i).estado === 'pendiente');
  return items.sort((a, b) => b.ts - a.ts);
}
function viewHistorial() {
  const { filtro, parcelId } = ui.hist;
  const chips = [['todo', 'Todo'], ['obs', 'Observaciones'], ['presc', 'Prescripciones'], ['pend', 'Pendientes']].map(([k, l]) => `<button class="fchip${filtro === k ? ' active' : ''}" data-act="hist-filter" data-f="${k}" aria-pressed="${filtro === k}">${l}</button>`).join('');
  const items = histItems();
  let list = '';
  if (!items.length) {
    list = filtro === 'pend'
      ? emptyState('checkcircle', 'No hay registros pendientes', 'Todo lo que guardaste ya está sincronizado.')
      : emptyState('history', 'Todavía no hay registros', 'Cuando guardes una observación o una prescripción, aparece acá.');
  } else {
    let cur = '';
    list = '<div class="hist-list">' + items.map((i) => {
      const lb = dayLabel(i.ts);
      const head = lb !== cur ? `<h3 class="day">${lb}</h3>` : '';
      cur = lb;
      return head + (i.t === 'rec' ? recCard(i.r, true) : msgCard(i.m));
    }).join('') + '</div>';
  }
  const zone = parcelId !== 'todas'
    ? `<div class="lab-zone card-lite"><strong>Análisis de laboratorio · ${parcelById(parcelId).nombre}</strong>${labBlock(parcelId)}</div>`
    : '<p class="muted small">Elegí una parcela para subir o ver su análisis de laboratorio.</p>';
  const opts = `<option value="todas" ${parcelId === 'todas' ? 'selected' : ''}>Todas las parcelas</option>` + PARCELS.map((p) => `<option value="${p.id}" ${p.id === parcelId ? 'selected' : ''}>${p.nombre}</option>`).join('');
  return shellHTML(`${pageHead({ title: 'Historial', sub: 'Todos los registros y consultas' })}${banner()}
    <div class="hist-tools"><div class="chips-row" role="group" aria-label="Filtros">${chips}</div><div class="select-wrap"><select class="select" id="hist-parcel" data-model="hist.parcelId" aria-label="Filtrar por parcela">${opts}</select>${ic('down', 20)}</div></div>
    <div class="hist-zone">${zone}</div>${list}`);
}
