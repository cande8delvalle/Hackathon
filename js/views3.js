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
  const sinR = sinResponderCount();
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
        <button class="action action-primary action-wide" data-act="p-open-chat">${ic('message', 28)}<span>Hablar con la agrónoma</span>${sinR ? `<span class="badge-new">${sinR} ${plural(sinR, 'consulta sin responder', 'consultas sin responder')}</span>` : ''}</button>
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

function espMsgHTML(m) {
  const mine = m.from === 'prod';
  const flash = m.nuevoEsp ? ' flash-b' : '';
  return `<div class="msg ${mine ? 'me' : 'them'}"><div class="bubble${flash}">${m.foto ? thumb('msg', m.id, m.foto, true) : ''}${m.texto ? `<p>${esc(m.texto)}</p>` : ''}</div>
    <div class="msg-meta">${mine ? (m.entregado ? estadoChip('enviado') : `${estadoChip('pendiente')}<small class="muted">Llega cuando la agrónoma tenga conexión</small>`) : ''}<span class="time">${hhmm(m.fecha)}</span></div></div>`;
}
function viewPConsultas() {
  const wide = isWide();
  const convs = espConvs();
  let id = ui.route.id;
  if (id && !convs.find((c) => c.parcel.id === id)) id = null;
  if (!id && wide && convs.length) id = convs[0].parcel.id;
  const list = convs.length
    ? convs.map((c) => `<button class="conv-item${c.parcel.id === id ? ' active' : ''}${c.nuevo ? ' flash' : ''}" data-act="esp-open" data-pid="${c.parcel.id}"><span class="p-ic">${ic('message', 22)}</span><span class="p-t"><strong>${c.parcel.nombre} · Soja</strong><small>${esc((c.last.from === 'agro' ? 'Ana: ' : 'Vos: ') + (c.last.texto || 'Foto'))}</small></span><span class="conv-r"><small>${shortWhen(c.last.fecha)}</small>${c.sinResponder ? '<span class="chip chip-pend">Sin responder</span>' : '<span class="chip chip-ok">Respondida</span>'}</span></button>`).join('')
    : emptyState('message', 'Todavía no hay consultas', 'Cuando la agrónoma te escriba desde el campo, la conversación aparece acá.');
  let panel;
  if (id) {
    const p = parcelById(id);
    const c = convs.find((x) => x.parcel.id === id);
    const f = parcelFacts(S, id, Date.now());
    const lp = f.lp;
    const sugg = ['Gracias, ya lo vi. ¿Cuándo regamos?', '¿Es urgente o puede esperar unos días?', 'Avisame cuando tengas el resultado del análisis.'];
    panel = `<div class="conv-head"><button class="icon-btn only-mobile" data-act="esp-back" aria-label="Volver a las consultas">${ic('left', 24)}</button><span class="avatar">AM</span><div class="grow"><strong>Ana Martínez · ${p.nombre} · ${p.cultivo}</strong><small class="muted">Agrónoma de campo</small></div>${c.sinResponder ? '<span class="chip chip-pend">Sin responder</span>' : ''}</div>
      <div class="ctx-strip"><span>${ic('droplet', 14)} Humedad ${lp ? lp.humedad + '% (objetivo ' + lp.objetivo + '%)' : 'sin datos'}</span><span>${ic('bug', 14)} ${f.plaga.length} de Plaga en 7 días</span><span>${ic('file', 14)} ${f.lab ? 'Análisis: pH ' + num(f.lab.ph, 1) : 'Sin análisis cargado'}</span></div>
      <div class="msgs" data-scroll="msgs">${c.msgs.map(espMsgHTML).join('')}</div>
      <div class="reply-wrap"><div class="chips-row reply-sugg">${sugg.map((s) => `<button class="fchip fchip-s" data-act="esp-sugg" data-t="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <form class="reply" data-form="esp-send"><textarea class="textarea" id="esp-input" data-model="esp.draft" placeholder="Escribí tu respuesta" rows="2">${esc(ui.esp.draft)}</textarea>
        <button class="btn btn-primary" type="submit" id="esp-send" data-needs="esp" ${ui.esp.draft.trim() ? '' : 'disabled'}>${ic('send', 20)}Enviar</button></form></div>`;
  } else {
    panel = emptyState('message', 'Elegí una conversación', 'Las consultas de la agrónoma aparecen a la izquierda.');
  }
  const n = sinResponderCount();
  const inner = `<div class="consult-head"><h1>Consultas</h1><span class="muted">${n} ${plural(n, 'consulta sin responder', 'consultas sin responder')}</span></div>
    <div class="chat-wrap${id ? ' conv-open' : ''}"><section class="conv-list card" aria-label="Conversaciones">${list}</section><section class="conv-panel card">${panel}</section></div>`;
  return shellHTML(inner, { fill: wide || !!id, chatOpen: !!id });
}
