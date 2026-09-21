'use strict';

/* ================= PRODUCTOR (dueño del campo) ================= */
// Ve solo lo que la agrónoma ya sincronizó, igual que la consola de la cooperativa.
function pAlerts(pid) { return S.alerts[pid] ? S.alerts[pid].items : []; }
function pStatusChip(pid) {
  const a = topSev(pid);
  return a ? sevChip(a.sev) : '<span class="chip chip-ok">' + ic('check', 14) + 'Sin alertas</span>';
}

function viewPInicio() {
  const totalHa = PARCELS.reduce((a, p) => a + p.ha, 0);
  const maxHa = Math.max(...PARCELS.map((p) => p.ha));
  const urg = PARCELS.filter((p) => pAlerts(p.id).some((a) => a.sev === 'urgente'));
  const haRiesgo = urg.reduce((a, p) => a + p.ha, 0);
  const activas = PARCELS.reduce((n, p) => n + pAlerts(p.id).filter((a) => SEV[a.sev].rank >= 2).length, 0);
  const pr = syncedRecords().filter((r) => r.tipo === 'presc');
  const ahorro = pr.reduce((a, r) => a + r.ahorro, 0);
  const sinR = unreadForProd();
  const recent = syncedRecords().sort((a, b) => b.fecha - a.fecha).slice(0, 4);
  const rows = PARCELS.map((p) => {
    const rs = syncedRecords().filter((r) => r.parcelId === p.id);
    return `<button class="parcel-row" data-act="p-open-lote" data-pid="${p.id}"><span class="p-ic">${ic('sprout', 22)}</span><span class="p-t"><strong>${p.nombre}</strong><small>${p.cultivo} · ${num(p.ha, 1)} ha · ${rs.length} ${plural(rs.length, 'registro', 'registros')}</small></span>${pStatusChip(p.id)}${ic('right', 20, 'muted')}</button>`;
  }).join('');
  const bars = PARCELS.map((p) => `<div class="bar-row"><span class="bar-l">${p.nombre}</span><span class="bar"><i style="width:${(p.ha / maxHa) * 100}%"></i></span><span class="bar-v">${num(p.ha, 1)} ha</span></div>`).join('');
  const risk = urg.length
    ? `<section class="risk" role="status">${ic('droplet', 24)}<div><strong>Posible riesgo de pérdida de producción</strong><p>Los registros sugieren un posible déficit hídrico en ${urg.length} ${plural(urg.length, 'parcela', 'parcelas')} (${num(haRiesgo, 1)} ha): ${joinList(urg.map((p) => p.nombre))}. Orientativo. No reemplaza a un ingeniero agrónomo.</p></div></section>`
    : `<section class="risk risk-ok" role="status">${ic('shield', 24)}<div><strong>Sin riesgos urgentes</strong><p>Los registros cargados no muestran situaciones urgentes por ahora.</p></div></section>`;
  const inner = `<header class="home-head"><span class="avatar avatar-lg">CB</span><div class="grow"><h1>Hola, Carlos</h1><p class="muted">Cooperativa del Sur · ${PARCELS.length} parcelas · ${num(totalHa, 1)} ha</p></div></header>
    ${risk}
    <div class="kpis4">
      <div class="kpi card"><span class="kpi-l">Parcelas</span><span class="kpi-v">${PARCELS.length}</span><span class="kpi-s">${num(totalHa, 1)} ha de soja</span></div>
      <div class="kpi card"><span class="kpi-l">Alertas activas</span><span class="kpi-v">${activas}</span><span class="kpi-s">${urg.length} ${plural(urg.length, 'urgente', 'urgentes')}</span></div>
      <div class="kpi card"><span class="kpi-l">Prescripciones de riego</span><span class="kpi-v">${pr.length}</span><span class="kpi-s">Registradas por la agrónoma</span></div>
      <div class="kpi card"><span class="kpi-l">Ahorro estimado acumulado (m³/ha)</span><span class="kpi-v">${num(ahorro)}</span></div>
    </div>
    <div class="two-col">
      <div class="col-stack">
        <button class="action action-primary action-wide" data-act="p-open-chat">${ic('message', 28)}<span>Hablar con la agrónoma</span>${sinR ? `<span class="badge-new">${sinR} ${plural(sinR, 'respuesta nueva', 'respuestas nuevas')}</span>` : ''}</button>
        ${avisosCard(topAvisos(3), true, { row: 'p-open-lote', all: 'p-nav-lotes' })}
        <section class="card"><div class="card-head"><h2>${ic('history', 20)}Últimos registros</h2></div>${recent.length ? `<div class="rec-list">${recent.map((r) => recCard(r, true, true)).join('')}</div>` : emptyState('history', 'Todavía no hay registros', 'Cuando la agrónoma sincronice observaciones, las vas a ver acá.')}</section>
      </div>
      <div class="col-stack">
        <section class="card"><div class="card-head"><h2>Mis lotes</h2><button class="link" data-act="p-nav-lotes">Ver todos</button></div><div class="parcel-list">${rows}</div></section>
        <section class="card"><div class="card-head"><h2>${ic('layout', 20)}Distribución de cultivos</h2></div><div class="bars">${bars}</div><p class="muted small">Total ${num(totalHa, 1)} ha · Soja 100%</p></section>
      </div>
    </div>`;
  return shellHTML(inner);
}

function viewPLotes() {
  const cards = PARCELS.map((p) => {
    const rs = syncedRecords().filter((r) => r.parcelId === p.id);
    const no = rs.filter((r) => r.tipo === 'obs').length;
    const np = rs.length - no;
    const last = rs.slice().sort((a, b) => b.fecha - a.fecha)[0];
    return `<button class="parcel-card card" data-act="p-open-lote" data-pid="${p.id}">
      <span class="pc-top"><span class="p-ic">${ic('sprout', 24)}</span><span class="p-t"><strong>${p.nombre}</strong><small>${p.cultivo} · ${num(p.ha, 1)} ha</small></span>${ic('right', 20, 'muted')}</span>
      <span class="pc-mid"><span>${no} ${plural(no, 'observación', 'observaciones')}</span><span>${np} ${plural(np, 'prescripción', 'prescripciones')}</span></span>
      <span class="pc-bot">${pStatusChip(p.id)}<small class="muted">${last ? 'Último: ' + whenLabel(last.fecha) : 'Sin registros'}</small></span></button>`;
  }).join('');
  return shellHTML(`${pageHead({ title: 'Lotes', sub: 'Estado de tus campos, según lo que registró la agrónoma' })}<div class="cards-grid">${cards}</div>`);
}

function viewPLote() {
  const p = parcelById(ui.route.id);
  const rs = syncedRecords().filter((r) => r.parcelId === p.id);
  const obs = rs.filter((r) => r.tipo === 'obs').sort((a, b) => b.fecha - a.fecha);
  const pre = rs.filter((r) => r.tipo === 'presc').sort((a, b) => b.fecha - a.fecha);
  const tab = ui.parcelTab;
  const list = tab === 'obs' ? obs : pre;
  const al = S.alerts[p.id];
  const items = (al ? al.items : []).slice().sort((a, b) => SEV[b.sev].rank - SEV[a.sev].rank || b.score - a.score);
  const body = list.length
    ? `<div class="rec-list">${list.map((r) => recCard(r, false, true)).join('')}</div>`
    : emptyState(tab === 'obs' ? 'leaf' : 'droplet', tab === 'obs' ? 'Sin observaciones todavía' : 'Sin prescripciones todavía', 'Cuando la agrónoma sincronice registros de este lote, los vas a ver acá.');
  const inner = `${pageHead({ title: p.nombre, sub: `${p.cultivo} · ${num(p.ha, 1)} ha`, back: true, right: pStatusChip(p.id) })}
    <div class="detail-grid">
      <div class="detail-side">
        <button class="btn btn-primary btn-block" data-act="p-open-chat" data-pid="${p.id}">${ic('message', 20)}Consultar a la agrónoma</button>
        ${S.labs[p.id] ? labCard(p.id, true) : `<div class="card-lite"><p class="muted small">${ic('file', 14)} Todavía no hay análisis de laboratorio cargado para este lote.</p></div>`}
        <section><h2 class="side-h">${ic('sparkles', 20)}Alertas del asistente</h2>${al ? `<p class="muted small upd">${ic('clock', 14)} Actualizado ${whenLabel(al.updatedAt)}</p>` : ''}<div class="alert-list">${items.length ? items.map((a) => alertCardHTML(a, false)).join('') : emptyState('shield', 'Sin alertas', 'No hay alertas para este lote.')}</div></section>
      </div>
      <section class="card detail-main">
        <div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'obs'}" data-act="parcel-tab" data-tab="obs">Observaciones <span class="tab-n">${obs.length}</span></button><button role="tab" aria-selected="${tab === 'presc'}" data-act="parcel-tab" data-tab="presc">Prescripciones <span class="tab-n">${pre.length}</span></button></div>
        ${body}</section>
    </div>`;
  return shellHTML(inner);
}

// El productor manda las consultas (con foto); la agrónoma las responde.
function espMsgHTML(m) {
  const mine = m.from === 'prod';
  const flash = m.nuevoEsp ? ' flash-b' : '';
  const status = mine ? `${estadoChip('enviado')}${m.entregado ? '' : '<small class="muted">Ana la ve cuando tenga conexión</small>'}` : '';
  return `<div class="msg ${mine ? 'me' : 'them'}"><div class="bubble${flash}">${m.foto ? thumb('msg', m.id, m.foto, true) : ''}${m.texto ? `<p>${esc(m.texto)}</p>` : ''}</div>
    <div class="msg-meta">${status}<span class="time">${hhmm(m.fecha)}</span></div></div>`;
}
const prodConvId = () => ui.route.id || (isWide() ? prodDefaultConv() : null);
function viewPConsultas() {
  const wide = isWide();
  const id = prodConvId();
  const list = prodConvItems().map((c) => {
    const prev = c.last ? (c.last.from === 'prod' ? 'Vos: ' : 'Ana: ') + (c.last.texto || 'Foto') : 'Escribí tu primera consulta';
    const tail = c.unread ? `<span class="badge-new">${c.unread} ${plural(c.unread, 'respuesta nueva', 'respuestas nuevas')}</span>`
      : c.last ? (c.last.from === 'prod' ? '<span class="chip chip-pend">Esperando respuesta</span>' : '<span class="chip chip-ok">Respondida</span>') : '';
    return `<button class="conv-item${c.p.id === id ? ' active' : ''}${c.last && c.last.nuevoEsp ? ' flash' : ''}" data-act="esp-open" data-pid="${c.p.id}"><span class="p-ic">${ic('message', 22)}</span><span class="p-t"><strong>${c.p.nombre} · Soja</strong><small>${esc(prev)}</small></span><span class="conv-r"><small>${c.last ? shortWhen(c.last.fecha) : ''}</small>${tail}</span></button>`;
  }).join('');
  let panel;
  if (id) {
    const p = parcelById(id);
    const msgs = espMessages(id);
    const f = parcelFacts(S, id, Date.now());
    const lp = f.lp;
    panel = `<div class="conv-head"><button class="icon-btn only-mobile" data-act="esp-back" aria-label="Volver a las consultas">${ic('left', 24)}</button><span class="avatar">AM</span><div class="grow"><strong>Ana Martínez · ${p.nombre} · ${p.cultivo}</strong><small class="muted">Agrónoma de campo</small></div></div>
      <div class="ctx-strip"><span>${ic('droplet', 14)} Humedad ${lp ? lp.humedad + '% (objetivo ' + lp.objetivo + '%)' : 'sin datos'}</span><span>${ic('bug', 14)} ${f.plaga.length} de Plaga en 7 días</span><span>${ic('file', 14)} ${f.lab ? 'Análisis: pH ' + num(f.lab.ph, 1) : 'Sin análisis cargado'}</span></div>
      <div class="msgs" data-scroll="msgs">${msgs.length ? msgs.map(espMsgHTML).join('') : emptyState('message', 'Todavía no hay consultas en este lote', 'Escribile a la agrónoma lo que ves en el lote. Podés sumar una foto.')}</div>
      ${composerHTML('chat.draft', 'Escribí tu consulta', ui.chat, 'prod-send')}`;
  } else {
    panel = emptyState('message', 'Elegí un lote', 'Tus consultas a la agrónoma aparecen acá.');
  }
  const inner = `<div class="consult-head"><h1>Consultas</h1><span class="muted">Escribile a la agrónoma, con fotos</span></div>
    <div class="chat-wrap${id ? ' conv-open' : ''}"><section class="conv-list card" aria-label="Conversaciones por lote">${list}</section><section class="conv-panel card">${panel}</section></div>`;
  return shellHTML(inner, { fill: wide || !!id, chatOpen: !!id });
}
