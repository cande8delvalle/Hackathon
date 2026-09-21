'use strict';

/* ---------- Constantes del dominio ---------- */
const PARCELS = [
  { id: 'lote1', nombre: 'Lote 1', cultivo: 'Soja', ha: 8.5 },
  { id: 'lote2', nombre: 'Lote 2', cultivo: 'Soja', ha: 4.2 },
  { id: 'lote3', nombre: 'Lote 3', cultivo: 'Soja', ha: 6.0 },
  { id: 'lote4', nombre: 'Lote 4', cultivo: 'Soja', ha: 3.8 },
  { id: 'lote5', nombre: 'Lote 5', cultivo: 'Soja', ha: 9.1 },
];
const parcelById = (id) => PARCELS.find((p) => p.id === id);

const STAGES = {
  emergencia: { label: 'Emergencia', mm: 200, obj: 25 },
  vegetativa: { label: 'Vegetativa', mm: 300, obj: 28 },
  floracion: { label: 'Floración', mm: 400, obj: 30 },
};
const CATS = {
  humedad: { label: 'Humedad', icon: 'droplet' },
  plaga: { label: 'Plaga', icon: 'bug' },
  nutriente: { label: 'Nutriente', icon: 'flask' },
};

// Lectura simulada de PDF: datos de ejemplo por parcela (Lote 3 es el del guion).
const LAB_SAMPLES = {
  lote1: { ph: 6.4, mo: 2.8, p: 22, k: 240 },
  lote2: { ph: 6.1, mo: 2.4, p: 15, k: 195 },
  lote3: { ph: 5.8, mo: 2.1, p: 18, k: 210 },
  lote4: { ph: 6.6, mo: 3.0, p: 25, k: 260 },
  lote5: { ph: 5.9, mo: 2.2, p: 17, k: 205 },
};
const labFile = (pid) => 'analisis_suelo_' + pid.replace('lote', 'lote') + '.pdf';

/* ---------- Cálculo de riego (fórmulas del enunciado) ---------- */
function calcRiego(etapa, hum) {
  const st = STAGES[etapa];
  const lamina = Math.max(0, ((st.obj - hum) * st.mm) / 100); // mm
  const volumen = lamina * 10; // m3/ha
  const horas = lamina / 6;
  const ahorro = Math.max(0, 400 - volumen);
  return {
    objetivo: st.obj, prof: st.mm,
    lamina: r1(lamina), volumen: r1(volumen), horas: r1(horas), ahorro: r1(ahorro),
    sinRiego: hum >= st.obj,
    deficit: st.obj - hum > 5,
  };
}

/* ---------- Motor de alertas (reglas sobre los registros; sin IA real) ---------- */
const SEV = {
  urgente: { rank: 3, label: 'Urgente' },
  atencion: { rank: 2, label: 'Atención' },
  info: { rank: 1, label: 'Info' },
};

function parcelFacts(S, pid, now) {
  const recs = S.records.filter((r) => r.parcelId === pid);
  const presc = recs.filter((r) => r.tipo === 'presc').sort((a, b) => b.fecha - a.fecha);
  const obs = recs.filter((r) => r.tipo === 'obs').sort((a, b) => b.fecha - a.fecha);
  return {
    presc, obs,
    plaga: obs.filter((o) => o.cat === 'plaga' && now - o.fecha <= 7 * D),
    nutri: obs.filter((o) => o.cat === 'nutriente' && now - o.fecha <= 21 * D),
    lab: S.labs[pid] || null,
    lp: presc[0] || null,
  };
}

function labCita(lab, extra) {
  return `Según el análisis cargado, el pH es ${num(lab.ph, 1)}, la materia orgánica ${num(lab.mo, 1)}%, el fósforo ${lab.p} ppm y el potasio ${lab.k} ppm.` + (extra ? ' ' + extra : '');
}

function analyzeParcel(S, pid, now = Date.now()) {
  const f = parcelFacts(S, pid, now);
  const P = parcelById(pid);
  const items = [];
  const { lp, lab } = f;

  if (lp) {
    const age = (now - lp.fecha) / D;
    const def = lp.objetivo - lp.humedad;
    const last = f.presc.slice(0, 2);
    const pres = last.length === 1 ? 'la última prescripción' : `las ${last.length} últimas prescripciones`;
    const hs = [...new Set(last.map((p) => p.humedad))].map((h) => h + '%').join(' y ');
    const etapa = STAGES[lp.etapa].label.toLowerCase();
    if (age > 30) {
      items.push({
        kind: 'stale', sev: 'info', score: 0, title: 'Datos de humedad desactualizados',
        detail: `La última prescripción de ${P.nombre} tiene ${Math.round(age)} días. Los registros no alcanzan para estimar la humedad actual del suelo.`,
        causas: ['Falta de mediciones recientes en el lote', 'Cambios de manejo que todavía no se cargaron en la app'],
        acciones: ['Registrar una observación de humedad actualizada.', 'Calcular el riego con una medición reciente.'],
        basada: `${pres} (hace ${Math.round(age)} días)`,
      });
    } else if (def > 5) {
      const c = calcRiego(lp.etapa, lp.humedad);
      items.push({
        kind: 'deficit', sev: 'urgente', score: def + 1 - age / 100, title: 'Posible déficit hídrico',
        detail: `Los registros sugieren que la humedad del suelo (${lp.humedad}%) está por debajo del objetivo para la etapa ${etapa} (${lp.objetivo}%): ${def} puntos menos.` +
          (lab ? ' ' + labCita(lab, 'Conviene que el ingeniero evalúe si influyen en cómo el suelo retiene el agua.') : ''),
        causas: ['Aporte de agua insuficiente en los últimos días', `Mayor demanda del cultivo en la etapa ${etapa}`, 'Posible pérdida de humedad en la capa superficial del suelo'],
        acciones: ['Revisar nuevamente la humedad del lote.', `Considerar el cálculo de riego sugerido por Campo 360: ${num(c.volumen)} m³/ha (${num(c.horas)} h).`, 'Confirmar con el ingeniero agrónomo antes de regar.'],
        basada: `${pres} (humedad de ${hs}, objetivo ${lp.objetivo}%)` + (lab ? ` y el análisis ${lab.file}` : ''),
      });
    } else if (def > 0) {
      items.push({
        kind: 'deficit', sev: 'atencion', score: def, title: 'Humedad cerca del límite',
        detail: `La humedad registrada (${lp.humedad}%) está apenas por debajo del objetivo (${lp.objetivo}%). Los registros sugieren seguir su evolución.`,
        causas: ['Consumo normal de agua del cultivo en la etapa ' + etapa],
        acciones: ['Repetir la medición de humedad en los próximos días.', 'Evaluar con el ingeniero si hace falta regar.'],
        basada: `${pres} (humedad de ${hs}, objetivo ${lp.objetivo}%)`,
      });
    }
  }

  if (f.plaga.length >= 2) {
    const k = f.plaga.length;
    items.push({
      kind: 'plaga', sev: 'atencion', score: k, title: 'Plaga repetida',
      detail: `Se registraron ${k} observaciones de Plaga en los últimos 7 días en ${P.nombre}. Los registros sugieren que la situación podría persistir.` +
        (lab ? ' ' + `Según el análisis cargado, el pH es ${num(lab.ph, 1)}; conviene tenerlo presente antes de decidir una aplicación.` : ''),
      causas: ['Condiciones del lote favorables para la plaga', 'Etapa del cultivo más susceptible', 'Podría estar relacionado con el estrés del cultivo por falta de agua'],
      acciones: ['Evaluar el estado de las plantas y confirmar la presencia de la plaga.', lab ? 'Revisar con el ingeniero el análisis de suelo antes de realizar una aplicación.' : 'Consultar al ingeniero antes de realizar una aplicación.', 'Registrar la evolución con una nueva observación y foto.'],
      basada: `${k} observaciones de Plaga en 7 días` + (lab ? ` y el análisis ${lab.file}` : ''),
    });
  } else if (f.plaga.length === 1) {
    items.push({
      kind: 'plaga', sev: 'info', score: 1, title: 'Observación de plaga reciente',
      detail: `Se registró 1 observación de Plaga en los últimos 7 días. Se recomienda revisar si se repite.`,
      causas: ['Podría tratarse de un hecho puntual del lote'],
      acciones: ['Volver a recorrer el sector afectado.', 'Registrar una nueva observación con foto.'],
      basada: '1 observación de Plaga en 7 días',
    });
  }

  if (f.nutri.length >= 1) {
    const k = f.nutri.length;
    items.push({
      kind: 'nutri', sev: 'atencion', score: k, title: 'Posible problema nutricional',
      detail: `Se registró ${k} ${plural(k, 'observación', 'observaciones')} de Nutriente en las últimas 3 semanas. Podría estar relacionado con la disponibilidad de nutrientes en el suelo.` +
        (lab ? ' ' + `Según el análisis cargado, el fósforo es ${lab.p} ppm y el potasio ${lab.k} ppm; se recomienda revisarlos con el ingeniero.` : ''),
      causas: ['Disponibilidad limitada de algún nutriente', 'Efecto de la humedad del suelo sobre la absorción'],
      acciones: [lab ? 'Revisar con el ingeniero los valores del análisis de suelo.' : 'Cargar el análisis de suelo del lote y revisarlo con el ingeniero.', 'Observar las hojas de cerca y registrar una foto.'],
      basada: `${k} ${plural(k, 'observación', 'observaciones')} de Nutriente en 21 días` + (lab ? ` y el análisis ${lab.file}` : ''),
    });
  }

  if (lab) {
    items.push({
      kind: 'lab', sev: 'info', score: 0, title: 'Análisis de suelo cargado',
      detail: labCita(lab, lab.ph < 6.2 ? `Se recomienda que el ingeniero evalúe si un pH de ${num(lab.ph, 1)} requiere alguna corrección.` : 'Los valores quedan como contexto para las demás alertas.'),
      causas: ['Datos de referencia del análisis cargado (lectura simulada para la demo)'],
      acciones: ['Comparar los valores con los objetivos del cultivo junto con el ingeniero.', 'Repetir el análisis si cambia el manejo del lote.'],
      basada: `el análisis ${lab.file}`,
    });
  }

  if (!items.length) {
    items.push({
      kind: 'ok', sev: 'info', score: 0, title: 'Sin novedades relevantes',
      detail: 'Los registros cargados no muestran situaciones que requieran atención por ahora.',
      causas: ['Registros dentro de lo esperado para la etapa'],
      acciones: ['Mantener el seguimiento con nuevas observaciones.'],
      basada: `${f.obs.length} observaciones y ${f.presc.length} prescripciones`,
    });
  }

  return items
    .map((it) => ({ ...it, id: pid + '-' + it.kind, parcelId: pid }))
    .sort((a, b) => SEV[b.sev].rank - SEV[a.sev].rank || b.score - a.score);
}

/* ---------- Respuestas del chat del asistente (reglas, sin IA real) ---------- */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function detectIntent(q) {
  const t = norm(q);
  if (/clima|lluvia|pronostico|precio|mercado|satelit|tiempo/.test(t)) return 'fuera';
  if (/que hago|que hacer|resumen|estado|como esta|situacion|recomend/.test(t)) return 'todo';
  if (/riego|regar|humedad|agua|hidric/.test(t)) return 'riego';
  if (/plaga|bicho|insect|oruga|chinche|mancha|hoja/.test(t)) return 'plaga';
  if (/suelo|\bph\b|analisis|laboratorio|nutri|fosforo|potasio|materia/.test(t)) return 'suelo';
  return 'todo';
}

function aiAnswer(S, pid, q, now = Date.now()) {
  const m = norm(q).match(/lote\s*([1-5])/);
  if (m) pid = 'lote' + m[1];
  const P = parcelById(pid);
  const f = parcelFacts(S, pid, now);
  const { lp, lab } = f;
  const intent = detectIntent(q);
  const alerts = analyzeParcel(S, pid, now);
  const nivel = alerts.reduce((a, b) => (SEV[b.sev].rank > SEV[a].rank ? b.sev : a), 'info');
  const out = { parcelId: pid, intent, blocks: [], causas: [], acciones: [], card: null, nivel, basada: '' };

  if (intent === 'fuera') {
    out.blocks.push({ src: 'sin', text: 'Solo puedo analizar la información cargada en Campo 360: observaciones, prescripciones, humedad, etapa del cultivo, historial del lote y análisis de laboratorio. No tengo datos de clima, precios ni imágenes satelitales.' });
    out.acciones = ['Probá con una pregunta sobre un lote, por ejemplo “¿Qué hago con el ' + P.nombre + '?”.'];
    out.nivel = 'info';
    return out;
  }

  const age = lp ? (now - lp.fecha) / D : 0;
  const def = lp ? lp.objetivo - lp.humedad : 0;
  const hayDeficit = lp && age <= 30 && def > 0;
  const c = lp ? calcRiego(lp.etapa, lp.humedad) : null;
  const etapa = lp ? STAGES[lp.etapa].label.toLowerCase() : '';

  const bloqueHumedad = () => {
    if (!lp) return out.blocks.push({ src: 'reg', text: `No hay prescripciones ni mediciones de humedad registradas en ${P.nombre}.` });
    if (age > 30) return out.blocks.push({ src: 'reg', text: `Los registros de humedad de ${P.nombre} tienen más de 30 días, así que no alcanzan para estimar su estado actual.` });
    if (def > 5) return out.blocks.push({ src: 'reg', text: `Según los registros del ${P.nombre}, se observa humedad del ${lp.humedad}% frente a un objetivo del ${lp.objetivo}%, por lo que existe un posible déficit hídrico.` });
    if (def > 0) return out.blocks.push({ src: 'reg', text: `Según los registros del ${P.nombre}, la humedad (${lp.humedad}%) está apenas por debajo del objetivo (${lp.objetivo}%); se recomienda seguir su evolución.` });
    out.blocks.push({ src: 'reg', text: `Según los registros del ${P.nombre}, la humedad (${lp.humedad}%) alcanza el objetivo (${lp.objetivo}%), por lo que los registros no sugieren déficit hídrico.` });
  };
  const bloquePlaga = (detalle) => {
    const k = f.plaga.length;
    if (k >= 2) out.blocks.push({ src: 'reg', text: (detalle ? '' : 'Además, ') + 'se registraron observaciones de plaga repetidas durante los últimos 7 días.'.replace(/^./, (x) => (detalle ? x.toUpperCase() : x)) });
    else if (k === 1) out.blocks.push({ src: 'reg', text: (detalle ? '' : 'Además, ') + 'se registró 1 observación de plaga en los últimos 7 días; se recomienda revisar si se repite.'.replace(/^./, (x) => (detalle ? x.toUpperCase() : x)) });
    else if (detalle) out.blocks.push({ src: 'reg', text: `No hay observaciones de plaga en los últimos 7 días en ${P.nombre}.` });
    if (detalle && f.plaga[0] && f.plaga[0].nota) out.blocks.push({ src: 'reg', text: `Última nota registrada: “${f.plaga[0].nota}”. Los registros no permiten confirmar qué plaga es.` });
  };
  const bloqueSuelo = (detalle) => {
    if (lab) {
      const ph = lab.ph < 6.2
        ? `El análisis cargado muestra un pH de ${num(lab.ph, 1)}, por lo que sería conveniente que el ingeniero agrónomo evalúe si las condiciones del suelo requieren alguna corrección.`
        : `El análisis cargado muestra un pH de ${num(lab.ph, 1)}; se recomienda que el ingeniero lo revise junto con el resto de los datos.`;
      out.blocks.push({ src: 'lab', text: ph + ` Otros datos del análisis: materia orgánica ${num(lab.mo, 1)}%, fósforo ${lab.p} ppm y potasio ${lab.k} ppm.` });
    } else {
      out.blocks.push({ src: 'sin', text: 'Todavía no hay un análisis de suelo cargado para este lote. Si lo subís desde “Subir análisis (PDF)”, lo voy a incluir en las próximas respuestas.' });
    }
    if (detalle && f.nutri.length) out.blocks.push({ src: 'reg', text: `También hay ${f.nutri.length} ${plural(f.nutri.length, 'observación', 'observaciones')} de nutrientes en las últimas 3 semanas, que podrían estar relacionadas con la disponibilidad de nutrientes.` });
  };
  const cardRiego = () => {
    if (hayDeficit && c && !c.sinRiego) {
      out.card = { etapa: STAGES[lp.etapa].label, humedad: lp.humedad, objetivo: lp.objetivo, lamina: c.lamina, volumen: c.volumen, horas: c.horas, ahorro: c.ahorro };
    }
  };

  if (intent === 'todo') {
    bloqueHumedad(); bloquePlaga(false); bloqueSuelo(true);
    if (hayDeficit) out.causas.push(`un aporte de agua insuficiente y mayor demanda del cultivo en etapa ${etapa}`);
    if (f.plaga.length) out.causas.push('condiciones del lote favorables para la plaga');
    if (f.nutri.length || (lab && lab.ph < 6.2)) out.causas.push('la disponibilidad de nutrientes en el suelo');
    if (hayDeficit && def > 5) out.acciones.push('Revisar nuevamente la humedad del lote.');
    if (f.plaga.length) out.acciones.push('Evaluar el estado de las plantas y confirmar la presencia de la plaga.');
    out.acciones.push(lab ? 'Revisar con el ingeniero el análisis de suelo antes de realizar una aplicación.' : 'Cargar el análisis de suelo y revisarlo con el ingeniero antes de realizar una aplicación.');
    if (hayDeficit && c && !c.sinRiego) out.acciones.push('Considerar el cálculo de riego sugerido por Campo 360.');
    cardRiego();
  } else if (intent === 'riego') {
    bloqueHumedad();
    if (hayDeficit && c && !c.sinRiego) out.blocks.push({ src: 'calc', text: `Para pasar de ${lp.humedad}% a ${lp.objetivo}% en etapa ${etapa} (profundidad de ${c.prof} mm), Campo 360 calcula una lámina de ${num(c.lamina)} mm.` });
    if (hayDeficit) out.causas.push('un aporte de agua insuficiente en los últimos días', `mayor demanda del cultivo en etapa ${etapa}`);
    out.acciones.push('Revisar nuevamente la humedad del lote.', 'Considerar el cálculo de riego sugerido por Campo 360.', 'Confirmar con el ingeniero agrónomo antes de regar.');
    cardRiego();
  } else if (intent === 'plaga') {
    bloquePlaga(true);
    if (f.plaga.length) out.causas.push('condiciones de humedad o etapa del cultivo favorables para la plaga');
    out.acciones.push('Evaluar el estado de las plantas y confirmar la presencia de la plaga.', 'Registrar la evolución con una nueva observación y foto.', lab ? 'Revisar con el ingeniero el análisis de suelo antes de realizar una aplicación.' : 'Consultar al ingeniero antes de realizar una aplicación.');
  } else {
    bloqueSuelo(true);
    if (lab && lab.ph < 6.2) out.causas.push('condiciones de acidez del suelo');
    if (f.nutri.length) out.causas.push('disponibilidad limitada de algún nutriente');
    out.acciones.push(lab ? 'Revisar con el ingeniero los valores del análisis antes de decidir una corrección.' : 'Cargar el análisis de suelo del lote desde “Subir análisis (PDF)”.', 'Observar las hojas de cerca y registrar una foto.');
  }

  const partes = [];
  if (f.presc.length) partes.push(`${f.presc.length} ${plural(f.presc.length, 'prescripción', 'prescripciones')}` + (lp ? ` (última: humedad ${lp.humedad}%, objetivo ${lp.objetivo}%)` : ''));
  if (f.obs.length) partes.push(`${f.obs.length} ${plural(f.obs.length, 'observación', 'observaciones')} (${f.plaga.length} de Plaga en 7 días)`);
  if (lab) partes.push(`análisis ${lab.file}`);
  out.basada = partes.join(', ') || 'sin registros en este lote';
  return out;
}

/* ---------- Datos de ejemplo ---------- */
function seedData(now = Date.now()) {
  let n = 0;
  const id = (p) => p + ++n;
  const mk = (extra) => ({ estado: 'sincronizado', nuevoCoop: false, ...extra });
  const presc = (parcelId, fecha, autor) => {
    const c = calcRiego('vegetativa', 20);
    return mk({ id: id('r'), tipo: 'presc', parcelId, fecha, autor, etapa: 'vegetativa', humedad: 20, objetivo: c.objetivo, lamina: c.lamina, volumen: c.volumen, horas: c.horas, ahorro: c.ahorro });
  };
  const obs = (parcelId, dias, cat, nota, foto, autor) => mk({ id: id('r'), tipo: 'obs', parcelId, fecha: now - dias * D, autor, cat, nota, foto: foto || null });

  const d0 = new Date(now); d0.setDate(1); d0.setHours(0, 0, 0, 0);
  const mes = d0.getTime();
  const enMes = (frac) => Math.round(mes + (now - mes) * frac);
  const ANA = 'Ana Martínez', MR = 'Marcos Ruiz';

  const records = [
    // 3 prescripciones de Ana este mes
    presc('lote3', enMes(0.35), ANA), presc('lote1', enMes(0.55), ANA), presc('lote3', enMes(0.75), ANA),
    // 9 prescripciones anteriores del equipo
    presc('lote1', now - 36 * D, MR), presc('lote1', now - 52 * D, MR),
    presc('lote2', now - 40 * D, MR), presc('lote2', now - 58 * D, MR),
    presc('lote3', now - 45 * D, MR),
    presc('lote4', now - 38 * D, MR), presc('lote4', now - 66 * D, MR),
    presc('lote5', now - 42 * D, MR), presc('lote5', now - 61 * D, MR),
    // 8 observaciones
    obs('lote3', 1.2, 'plaga', 'Hojas con mordidas en el borde. Se ven insectos chicos en el envés.', 'sample', ANA),
    obs('lote3', 2.5, 'humedad', 'Suelo seco a 10 cm. Costra superficial en la zona baja.', null, ANA),
    obs('lote3', 4.5, 'plaga', 'Mordidas en hojas nuevas, en el mismo sector del borde.', 'sample2', ANA),
    obs('lote1', 6, 'nutriente', 'Amarillamiento entre nervaduras en el sector este.', 'sample2', ANA),
    obs('lote1', 12, 'humedad', 'Humedad pareja, sin cambios respecto de la semana anterior.', null, ANA),
    obs('lote2', 16, 'plaga', 'Un foco chico en el borde. Sin daño visible en el resto.', null, MR),
    obs('lote4', 9, 'humedad', 'Suelo húmedo y parejo en todo el lote.', null, MR),
    obs('lote5', 20, 'nutriente', 'Plantas más chicas en la cabecera y color verde pálido.', 'sample', MR),
  ];

  const t = now - 2 * D;
  const messages = [
    { id: id('m'), parcelId: 'lote3', from: 'prod', texto: '¿Qué opinás de esta mancha en el lote 3?', foto: 'sample', fecha: t, entregado: true, leido: true },
    { id: id('m'), parcelId: 'lote3', from: 'agro', texto: 'Puede ser falta de nutrientes o un problema de humedad. ¿Podés mandar una foto de la hoja de cerca?', foto: null, fecha: t + 3600e3, estado: 'enviado', nuevoEsp: false, leidoProd: true },
  ];

  const S = {
    records, messages, labs: {}, alerts: {}, aiChat: [], seq: 1000,
  };
  const ayer = new Date(now); ayer.setDate(ayer.getDate() - 1); ayer.setHours(17, 5, 0, 0);
  PARCELS.forEach((p) => { S.alerts[p.id] = { updatedAt: ayer.getTime(), items: analyzeParcel(S, p.id, now) }; });
  return S;
}
