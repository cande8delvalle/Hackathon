'use strict';

/* ================= COOPERATIVA (módulo dentro de la sesión de la agrónoma) ================= */
function coopSeg(active) {
  return `<div class="seg" role="tablist" aria-label="Módulo Cooperativa"><button role="tab" aria-selected="${active === 'resumen'}" data-act="nav" data-to="resumen">${ic('chart', 20)}Resumen</button><button role="tab" aria-selected="${active === 'cparcelas'}" data-act="nav" data-to="cparcelas">${ic('layout', 20)}Parcelas</button></div>`;
}
function topSev(pid) {
  const a = S.alerts[pid];
  const it = a ? a.items.find((x) => SEV[x.sev].rank >= 2) : null;
  return it || null;
}

function viewResumen() {
  const all = syncedRecords();
  const obsN = all.filter((r) => r.tipo === 'obs').length;
  const pr = all.filter((r) => r.tipo === 'presc');
  const volProm = pr.length ? pr.reduce((a, r) => a + r.volumen, 0) / pr.length : 0;
  const ahorro = pr.reduce((a, r) => a + r.ahorro, 0);
  const ev = coopEvents(ui.coop);
  const totalHa = PARCELS.reduce((a, p) => a + p.ha, 0);
  const maxHa = Math.max(...PARCELS.map((p) => p.ha));
  const bars = PARCELS.map((p) => `<div class="bar-row"><span class="bar-l">${p.nombre}</span><span class="bar"><i style="width:${(p.ha / maxHa) * 100}%"></i></span><span class="bar-v">${num(p.ha, 1)} ha</span></div>`).join('');
  const optsP = `<option value="todas" ${ui.coop.parcelId === 'todas' ? 'selected' : ''}>Todas las parcelas</option>` + PARCELS.map((p) => `<option value="${p.id}" ${ui.coop.parcelId === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');
  const optsT = [['todos', 'Todos los tipos'], ['obs', 'Observaciones'], ['presc', 'Prescripciones']].map(([v, l]) => `<option value="${v}" ${ui.coop.tipo === v ? 'selected' : ''}>${l}</option>`).join('');
  const rows = ev.map((e) => `<tr class="${e.r.nuevoCoop ? 'flash' : ''}"><td>${tableDate(e.fecha)}</td><td>${e.parcela}</td><td>${e.tipo}</td><td class="td-det">${esc(e.detalle)}</td><td>${estadoChip('recibido')}</td></tr>`).join('');
  const cards = ev.map((e) => `<article class="ev-card${e.r.nuevoCoop ? ' flash' : ''}"><div class="rec-top"><strong>${e.tipo} · ${e.parcela}</strong>${estadoChip('recibido')}</div><p>${esc(e.detalle)}</p><p class="meta">${tableDate(e.fecha)}</p></article>`).join('');
  const events = ev.length
    ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Parcela</th><th>Tipo</th><th>Detalle</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div><div class="ev-cards">${cards}</div>`
    : emptyState('table', 'No hay eventos para estos filtros', 'Probá con otra parcela o con otro tipo de registro.', '<button class="btn btn-secondary" data-act="coop-clear">Quitar filtros</button>');
  const avisos = topAvisos(3);
  const inner = `${pageHead({ title: 'Cooperativa del Sur', sub: 'Resumen de lo que llegó desde el campo', right: `<button class="btn btn-primary" data-act="export-csv">${ic('download', 20)}Exportar CSV</button>` })}
    <div class="coop-seg">${coopSeg('resumen')}</div>${banner()}
    <div class="kpis4">
      <div class="kpi card"><span class="kpi-l">Observaciones</span><span class="kpi-v">${num(obsN)}</span></div>
      <div class="kpi card"><span class="kpi-l">Prescripciones</span><span class="kpi-v">${num(pr.length)}</span></div>
      <div class="kpi card"><span class="kpi-l">Volumen prescrito promedio (m³/ha)</span><span class="kpi-v">${num(volProm)}</span></div>
      <div class="kpi card"><span class="kpi-l">Ahorro estimado acumulado (m³/ha)</span><span class="kpi-v">${num(ahorro)}</span></div>
    </div>
    <div class="two-col">
      ${avisosCard(avisos, false)}
      <section class="card"><div class="card-head"><h2>${ic('layout', 20)}Superficie por parcela</h2></div><div class="bars">${bars}</div><p class="muted small">Total ${num(totalHa, 1)} ha · Soja 100%</p></section>
    </div>
    <section class="card events"><div class="card-head"><h2>Eventos recibidos</h2><span class="muted small">${ev.length} ${plural(ev.length, 'evento', 'eventos')}</span></div>
      <div class="filters"><div class="field"><label for="f-parcel">Parcela</label><div class="select-wrap"><select class="select" id="f-parcel" data-model="coop.parcelId">${optsP}</select>${ic('down', 20)}</div></div>
      <div class="field"><label for="f-tipo">Tipo</label><div class="select-wrap"><select class="select" id="f-tipo" data-model="coop.tipo">${optsT}</select>${ic('down', 20)}</div></div></div>
      ${events}</section>`;
  return shellHTML(inner);
}

function viewCParcelas() {
  const totalHa = PARCELS.reduce((a, p) => a + p.ha, 0);
  const data = PARCELS.map((p) => {
    const rs = syncedRecords().filter((r) => r.parcelId === p.id);
    const pr = rs.filter((r) => r.tipo === 'presc');
    return { p, no: rs.filter((r) => r.tipo === 'obs').length, np: pr.length, ahorro: pr.reduce((a, r) => a + r.ahorro, 0), alerta: topSev(p.id), lab: S.labs[p.id] };
  });
  const rows = data.map((d) => `<tr><td><strong>${d.p.nombre}</strong></td><td>${d.p.cultivo}</td><td>${num(d.p.ha, 1)} ha</td><td>${d.no}</td><td>${d.np}</td><td>${num(d.ahorro)} m³/ha</td><td>${d.alerta ? sevChip(d.alerta.sev) + `<small class="muted"> ${esc(d.alerta.title)}</small>` : '<span class="muted">Sin alertas</span>'}</td><td><button class="btn btn-secondary btn-sm" data-act="coop-ver" data-pid="${d.p.id}">Ver eventos</button></td></tr>`).join('');
  const cards = data.map((d) => `<article class="ev-card"><div class="rec-top"><strong>${d.p.nombre} · ${d.p.cultivo}</strong><span class="muted small">${num(d.p.ha, 1)} ha</span></div><p>${d.no} observaciones · ${d.np} prescripciones · ahorro ${num(d.ahorro)} m³/ha</p><div class="rec-top">${d.alerta ? sevChip(d.alerta.sev) : '<span class="muted small">Sin alertas</span>'}<button class="btn btn-secondary btn-sm" data-act="coop-ver" data-pid="${d.p.id}">Ver eventos</button></div></article>`).join('');
  const bars = PARCELS.map((p) => `<div class="bar-row"><span class="bar-l">${p.nombre}</span><span class="bar"><i style="width:${(p.ha / totalHa) * 100 * 3.2}%"></i></span><span class="bar-v">${num((p.ha / totalHa) * 100, 1)}%</span></div>`).join('');
  return shellHTML(`${pageHead({ title: 'Cooperativa del Sur', sub: `${PARCELS.length} parcelas · ${num(totalHa, 1)} ha · Soja 100%` })}
    <div class="coop-seg">${coopSeg('cparcelas')}</div>${banner()}
    <div class="two-col"><section class="card"><div class="card-head"><h2>${ic('layout', 20)}Distribución de la superficie</h2></div><div class="bars">${bars}</div></section>
    <section class="card"><div class="card-head"><h2>${ic('sparkles', 20)}Posibles riesgos</h2></div><p class="muted small">Según las alertas orientativas del asistente. No reemplaza a un ingeniero agrónomo.</p>${topAvisos(3).length ? `<div class="aviso-list">${topAvisos(3).map((a) => avisoRow(a, false)).join('')}</div>` : emptyState('shield', 'Sin alertas', 'No hay riesgos para mostrar.')}</section></div>
    <section class="card events"><div class="card-head"><h2>Detalle por parcela</h2></div><div class="table-wrap t-lg"><table class="tbl"><thead><tr><th>Parcela</th><th>Cultivo</th><th>Área</th><th>Observaciones</th><th>Prescripciones</th><th>Ahorro acumulado</th><th>Alerta</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="ev-cards c-lg">${cards}</div></section>`);
}

