# Campo 360 · demo interactiva

Prototipo en HTML, CSS y JavaScript puro (sin build, sin backend). Los datos viven en `localStorage`.

## Cómo abrirla

- Doble clic en `index.html`, o
- `node serve.js` y abrir http://localhost:5173

Bootstrap 5.3 (CDN) se usa solo como capa base de reset. `css/styles.css` es autosuficiente, así que la app se ve igual sin internet. Inter se carga desde Google Fonts; sin conexión cae a la tipografía del sistema.

## Vistas (selector en el panel de demo, abajo a la derecha)

| Vista | Usuario / clave | Qué hace |
|---|---|---|
| Agrónoma de campo | `ana` / `1234` | Inicio, Parcelas, Consultas (responde las consultas del productor + Asistente IA), Historial y el módulo **Cooperativa** (Resumen y Parcelas, con exportación a CSV) |
| Productor (dueño del campo) | `productor` / `1234` | Estado de lotes, alertas y riesgos; **envía las consultas (con fotos)** a la agrónoma |

## Guion de 3 minutos

1. Login → acceso rápido "Agrónoma de campo".
2. Panel de demo → activar "Modo avión".
3. Nueva observación en Lote 3, categoría Plaga, foto de ejemplo → Guardar.
4. Calcular riego: Vegetativa, 20 % → 24 mm, 240 m³/ha, 4 h, 160 m³/ha → Guardar prescripción.
5. Consultas → responder al productor con foto (queda "Pendiente").
6. Panel de demo → "Reiniciar app": todo sigue ahí.
7. Desactivar "Modo avión": se sincroniza (2 s) y los chips pasan a Sincronizado / Enviado.
8. Consultas → Asistente IA → Alertas → "Analizar parcela" (Lote 3).
9. Lote 3 → "Subir análisis (PDF)" → Asistente IA → Chat → "¿Qué hago con el Lote 3?".
10. Módulo Cooperativa (KPIs suben, "Exportar CSV") → vista Productor (ve la respuesta y manda una consulta nueva con foto) → vista Agrónoma (llega la consulta con su aviso).

## Notas

- El asistente es una simulación con reglas sobre los datos de la app; no usa IA real ni APIs.
- La lectura del PDF es simulada con datos de ejemplo (Lote 3: pH 5,8, MO 2,1 %, P 18 ppm, K 210 ppm).
