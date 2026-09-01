# Contexto del proyecto — Reconstrucción del Dashboard PMTs

> Documento de continuidad. Si retomas este proyecto en otra sesión, otra herramienta, o
> con otra persona, este archivo resume el estado, las decisiones tomadas y el porqué.

## 1. Origen y objetivo

Una compañera de trabajo construyó un tablero web de cumplimiento de PMTs (Plan de Manejo
de Tránsito) para EPM, publicado en GitHub Pages, alimentado por dos listas de SharePoint
(Rutinarios e Implementación/PO) vía Power Automate. El objetivo de este proyecto es
**reconstruir ese tablero desde cero en un repositorio propio** (`ACGST-EPM/Supervision_Directa_PMTs`),
corrigiendo por diseño los problemas identificados en la versión original.

## 2. Problemas encontrados en la versión original (y por qué se corrigen por diseño)

| # | Problema | Evidencia | Corrección de diseño |
|---|---|---|---|
| 1 | **Bug de puntaje**: la clave `'Hola'` (placeholder nunca reemplazado) se usaba como nombre interno de SharePoint para el ítem "Canalización lastrada" (peso 0.03) en el checklist de Puesta en Operación automático. Ese ítem nunca se evaluaba; el puntaje automático quedaba topado en 97%, no 100%. | Línea 565 del HTML original | Un paso "Seleccionar" en Power Automate define los nombres limpios nosotros mismos, controlados y verificados, no adivinados. |
| 2 | **Datos personales expuestos**: el JSON crudo escrito por Power Automate incluía el objeto completo `Author`/`Editor` de SharePoint (nombre completo y correo corporativo de quien diligenció el formulario), publicado en un repositorio público (GitHub Pages gratis exige repo público). Se confirmaron 5 correos corporativos reales expuestos. | Inspección directa de `crudo_rutinarios.json` | El paso "Seleccionar" filtra: solo salen los ~16 campos que el tablero realmente necesita. Nada de Author/Editor/metadatos. |
| 3 | **Archivo huérfano/duplicado**: `contratos_db.json` (8 contratos) no lo usaba el HTML — la relación contrato→proyecto→contratista estaba hardcodeada en un objeto `PROYECTOS` de 62 entradas dentro del HTML, y ya estaba desincronizado (`CW366713` existía en un archivo y no en el otro). | Comparación programática de ambas fuentes | Una sola fuente: `contratos.json`, cargado por `fetch()` igual que los demás datos. Se elimina el objeto embebido y el archivo huérfano. |
| 4 | **Tamaño innecesario**: `crudo_rutinarios.json` pesaba 866 KB para 205 registros; solo los campos usados por el tablero ocuparían ~403 KB (47%). | Medición directa | Consecuencia natural de corregir el punto 2 (menos campos = menos peso). |

## 3. Arquitectura decidida

**Estructura de archivos (4 + datos), sin build ni ES Modules — scripts clásicos:**
```
index.html      → estructura HTML únicamente
styles.css      → todo el CSS
modelo.js       → PESOS_RUT, PESOS_PO, umbrales (80/70), funciones de cálculo del puntaje
app.js          → carga de datos (fetch), mapeo, renderizado, filtros, orquestación
contratos.json  → única fuente de contrato→proyecto→contratista (reemplaza PROYECTOS y contratos_db.json)
crudo_rutinarios.json / crudo_implementacion.json → datos automáticos (ya deben existir con contenido `[]`)
```

**Por qué NO se usó una arquitectura más "profesional" (ES Modules, bundler):** los módulos ES
no cargan al abrir el HTML directo con `file://` (bloqueo CORS del navegador), lo cual complica
las pruebas locales sin ganancia real para un proyecto de este tamaño mantenido por una sola
persona. Se decidió modularización ligera con `<script>` clásicos.

## 4. Entorno de trabajo (decidido tras varias pruebas fallidas)

- **PC corporativo sin permisos de instalación** → descarta VS Code local y Claude Code (ambos requieren instalación local; verificado en docs oficiales de Claude Code, agosto 2026).
- **Replit**: se intentó como editor. Se abandonó por fricción reiterada: la vista previa ("Run") no se configuraba sola al importar desde GitHub, el flujo de creación de proyectos empuja hacia el Agente de IA (que puede crear/modificar archivos por su cuenta sin pedirlo explícitamente), y el árbol de archivos se confundía con el menú general de la cuenta.
- **Editor definitivo: github.dev** — VS Code corriendo en el navegador, sin instalación, sin agente de IA, conectado nativamente al repositorio (se abre presionando `.` sobre cualquier página de un repo en github.com, o cambiando `github.com` por `github.dev` en la URL).
- **Entorno de pruebas: GitHub Pages directo**, no la vista previa de un editor. Activado en Settings → Pages → Deploy from a branch → `main` / root. URL pública: `https://acgst-epm.github.io/Supervision_Directa_PMTs/`.

## 5. Flujo de trabajo Git decidido

Para cambios grandes (como la reconstrucción actual de los 4 archivos) o que tocan varios
archivos a la vez: **branch aparte + Pull Request**, no edición directa sobre `main`.

1. Crear branch (ej. `dashboard-corregido`) desde el selector de branch en github.dev.
2. Editar y hacer commit en ese branch.
3. Publish Branch / Sync Changes.
4. Abrir Pull Request en github.com, revisar el diff en "Files changed".
5. Merge con "Squash and merge", borrar el branch.
6. `main` se actualiza → GitHub Pages republica automáticamente.

Para ajustes triviales de una línea, editar directo sobre `main` es aceptable.

## 6. Power Automate — diseño corregido (EN CONSTRUCCIÓN)

Estructura general (ver guía original para plantilla base de acciones HTTP/SHA/PUT):

```
Recurrence (diario)
Obtener elementos → Rutinarios
Obtener elementos → Implementación
SeleccionarRutinarios      → Seleccionar (NUEVO: filtra y renombra campos)
SeleccionarImplementacion  → Seleccionar (NUEVO: filtra y renombra campos)
GetSHA / ContenidoRut(base64 de Seleccionar) / ShaRut / PutArchivo  (Rutinarios)
GetSHA / ContenidoImp(base64 de Seleccionar) / ShaImp / PutArchivo  (Implementación)
```

**Nombres internos de SharePoint — Rutinarios (verificados directamente sobre datos reales):**

**Corrección post-revisión de código (`app.js`, verificado contra lo que construyó Claude
Code):** el tablero necesita un identificador único por registro (`id`) para rastrear qué fila
está expandida — sin él, con más de un registro real todas las filas comparten el mismo `id`
vacío y expandir una fila expande/colapsa todas a la vez. No estaba en el mapeo original; se
agrega abajo como primera fila. Aplica igual para el Select de Implementación cuando se
construya — nunca omitir este campo ahí tampoco.

| Clave limpia nueva | Nombre interno SharePoint |
|---|---|
| id | `ID` |
| fecha | `Fecha` |
| contrato | `Contrato` → `.Value` |
| frente | `Seguimiento` → `.Value` |
| diligenciado_por | `Diligenciadopor` |
| direccion | `Direcci_x00f3_n` |
| tipo_cierre | `Tipodecierre` → `.Value` |
| observaciones | `Observacionesgenerales_x0028_FO_` |
| pmt | `PlandeManejodeTr_x00e1_nsito` → `.Value` |
| permiso_rotura | `PermisodeRotura` → `.Value` |
| senalizacion_vertical | `Se_x00f1_alizaci_x00f3_nVertical` → `.Value` |
| estado_senales | `Estadodese_x00f1_ales` → `.Value` |
| canalizacion_sentido | `Canalizaci_x00f3_n_x002d_Ensenti` → `.Value` |
| dispositivos_luminosos | `Gesti_x00f3_ncierrevial_x002d_Fl` → `.Value` |
| auxiliares_transito | `Gesti_x00f3_nauxiliatesdetr_x00e` → `.Value` |
| via_limpia | `V_x00ed_alimpiayencondicionesdeo` → `.Value` |
| platinas_pernadas | `Platinas_x003a_pernadas_x002c_an` → `.Value` |
| via_despejada | `V_x00ed_adespejada` → `.Value` |

**RESUELTO EN EL DISEÑO (NO en el código todavía — verificado por auditoría de Claude Code):**
el mapeo completo de Implementación (17 ítems del checklist PO, más la
estructura DG/PO y el algoritmo de fusión) está documentado completo en la sección 9 — ya no
es un pendiente. Rutinarios NO tiene la estructura de dos tarjetas DG/PO — es un único
formulario, sin necesidad de fusión.

**Deduplicación en Rutinarios (distinta a la de Implementación):** a diferencia de
Implementación, en Rutinarios cada envío del formulario ya llega completo en una sola fila —
no hay que fusionar nada. Pero puede pasar que alguien diligencie el formulario dos o más
veces por error con el mismo `contrato+frente+fecha` (mismo tipo de error humano que en
Implementación, aplicado aquí a un solo lado). Regla: en `app.js`, antes de calcular puntajes,
indexar los registros de Rutinarios por la clave `contrato+frente+fecha` — si hay más de un
registro con la misma clave, conservar únicamente el de `id` más alto (el envío más reciente)
y descartar los demás. Igual que en Implementación, los descartados no desaparecen en
silencio: se suman al mismo contador de `duplicadosIgnorados` y al mismo aviso visible en el
tablero (un solo contador combinado para las dos listas, no dos avisos separados).

**Tabla de correspondencia `funcionarios.json` (nueva, análoga a `contratos.json`):** el campo
`diligenciado_por` de Rutinarios llega como un número de registro de SharePoint (ej.
`119011.0`), no como nombre — confirmado por auditoría. Se decidió así en el diseño original
del PowerApp de esa tarjeta. En Implementación, en cambio, ese mismo campo ya llega como texto
con el nombre real (ej. "Leydi Johana Marín Zapata") — no necesita esta tabla.

Se crea `funcionarios.json` en la raíz del repo, mantenido a mano igual que `contratos.json`
(cambia con poca frecuencia, no vale la pena automatizarlo). Estructura:
```json
[
  { "numero_registro": "119011", "nombre": "NOMBRE EJEMPLO", "cargo": "CARGO EJEMPLO" }
]
```
El archivo se crea con este único registro de ejemplo — el usuario lo completa con los datos
reales después. `app.js` debe cargarlo por `fetch()` igual que `contratos.json`, y al mostrar
`diligenciado_por` en Rutinarios: normalizar el número (quitar el `.0` si llega como número
decimal, convertir a texto) y buscarlo en `funcionarios.json`. Si hay coincidencia, mostrar
"Nombre — Cargo". Si no hay coincidencia (el archivo está incompleto o es un número nuevo),
mostrar el número crudo con una etiqueta visible tipo "Funcionario no identificado (119011)"
— mismo principio de siempre: nunca ocultar, siempre señalar lo que no se pudo resolver.

**Validación obligatoria antes de activar la recurrencia:** los pesos de los ítems
seleccionados en Implementación deben sumar exactamente 1.00 (100%). Si no suman, hay un
ítem mal enlazado — la misma clase de error que causó el bug original.

**PAT de GitHub:** fine-grained, alcance limitado únicamente a `Supervision_Directa_PMTs`,
permiso "Contents: Read and write", con fecha de expiración corta (ej. 90 días) documentada
en algún lugar visible. Limitación aceptada y no resuelta: el token queda en texto plano en
el header HTTP dentro del flujo (no hay Key Vault gratuito en Power Automate).

**Requisito previo a activar el flujo:** `crudo_rutinarios.json` y `crudo_implementacion.json`
deben existir en el repo con contenido `[]` antes de la primera corrida (si no, el `GetSHA`
falla con 404).

## 7. Hoja de ruta y estado

| Fase | Estado |
|---|---|
| 1. Repositorio propio + entorno de edición | ✅ Completo (github.dev, luego Claude Code Nube) |
| 2. Los 4 archivos corregidos, probados con datos de muestra | ✅ Completo |
| 3. Publicación en GitHub Pages | ✅ Completo — publica desde `main` |
| 4. Flujo de Power Automate corregido (mapeo Rutinarios + Implementación, paginación) | ✅ Completo y en producción (recurrencia diaria activa) |
| 5. Prueba de punta a punta con datos reales | ✅ Completo |
| 6. PR `mejoras-datos-reales` (fusión DG/PO, deduplicación, normalización de contratos, identidad visual EPM) | ✅ Fusionado a `main` |
| 7. PR `mejoras-ux` (filtros nuevos, gráficos dinámicos, reporte PDF, ocultar "Sin dato") | ✅ Fusionado a `main` |
| 8. Mantenimiento (vencimiento del token cada 90 días, hábito de Pull antes de publicar) | ⏳ Continuo |

**Pendientes abiertos (no bloquean nada, quedan para cuando el usuario tenga tiempo/decisión):**
- Completar `funcionarios.json`: variantes de nombre para Julián Sánchez y otros funcionarios con doble formato entre Rutinarios e Implementación (Sergio Ochoa y Leydi Marín ya están resueltos).
- 6 contratos huérfanos sin resolver en `contratos.json`: `CW348929`, `CW353551`, `CW369125`, `CW280931`, `CW327799`, `CW3000` — decidir si son válidos (agregarlos) o error de diligenciamiento (dejarlos como "Contrato no reconocido" indefinidamente).
- Fotos de evidencia fotográfica: sigue pausado, pendiente de que EPM defina la política de privacidad (sección 10). Confirmado: son columnas tipo Miniatura (`Registro Fotografico PO1/PO2/DO1/DO2/FO1/FO2/AD3/AD4`), no adjuntos genéricos de SharePoint — el diseño del paso "Seleccionar" para esto queda pendiente de descubrir la forma real del dato cuando se retome.

## 8. Apéndice — Motor de puntaje EXACTO (copiado literal del HTML original)

**Importante para quien construya `modelo.js`: estos valores son la fuente de verdad oficial
(derivada por la compañera original desde las medidas DAX del `.pbix` de Power BI, R²=1). No
deben aproximarse, redondearse distinto, ni reinventarse. Cópialos tal cual.**

```javascript
// Umbrales oficiales
const UMBRAL_VERDE = 80;   // >= 80  -> Cumple (verde)
const UMBRAL_ROJO  = 70;   // <= 70  -> Crítico (rojo) ; entre 70 y 80 -> Por mejorar

function semaforoDe(pct){
  if(pct===null||pct===undefined) return 'sin_dato';
  if(pct>=UMBRAL_VERDE) return 'verde';
  if(pct<=UMBRAL_ROJO)  return 'rojo';
  return 'amarillo';
}

// valor de un criterio Sí/No: Si=1, No=0, "No aplica"=1 ; vacío/otro => null (no cuenta)
function valBool(v){
  const lo=(v==null?'':(''+v)).trim().toLowerCase();
  if(lo==='si'||lo==='sí') return 1;
  if(lo==='no') return 0;
  if(lo==='no aplica') return 1;
  return null;
}
// valor de calidad (Estado de señales)
function valCal(v){
  const lo=(v==null?'':(''+v)).trim().toLowerCase();
  if(lo==='bueno') return 1; if(lo==='regular') return 0.6; if(lo==='malo') return 0;
  return null;
}

/* PESOS OFICIALES — Rutinarios. 'cal' marca el ítem de calidad (usa valCal en vez de valBool) */
const PESOS_RUT = {
  'pmt': 0.02,
  'permiso_rotura': 0.02,
  'senalizacion_vertical': 0.15,
  'estado_senales': ['cal', 0.05],
  'canalizacion_sentido': 0.22,
  'dispositivos_luminosos': 0.10,
  'auxiliares_transito': 0.12,
  'via_limpia': 0.12,
  'platinas_pernadas': 0.12,
  'via_despejada': 0.08,
};
// Suma de verificación: 0.02+0.02+0.15+0.05+0.22+0.10+0.12+0.12+0.12+0.08 = 1.00 ✓

/* PESOS OFICIALES — Puesta en Operación (PO / Implementación) */
const PESOS_PO = {
  'pmt_impreso': 0.03,
  'horario_inicio': 0.08,
  'reposicion_senales': 0.08,
  'senalizacion_segun_planos': 0.03,
  'espaciamiento_senales': 0.04,
  'tamano_senales': 0.04,
  'canalizacion_sentido_flujo': 0.03,
  'canalizacion_segun_planos': 0.07,
  'canalizacion_lastrada': 0.03,   // <- este es el ítem que tenía la clave 'Hola' en la versión original. NUNCA usar un placeholder aquí.
  'canalizacion_reflectividad': 0.03,
  'ancho_carril': 0.10,
  'longitud_transicion': 0.10,
  'longitud_seguridad': 0.10,
  'area_acopio': 0.03,
  'flashers': 0.08,
  'auxiliares_cantidad': 0.10,
  'auxiliares_baston': 0.03,
};
// Suma de verificación: debe dar exactamente 1.00. Verificar SIEMPRE antes de publicar.

// evalúa una fila con una tabla de pesos -> { pct: 0..100|null, n_items, items:{clave:valor} }
function evaluarPonderado(row, pesos){
  let p = 0, n = 0; const items = {};
  for (const col in pesos) {
    const def = pesos[col];
    const esCal = Array.isArray(def);
    const w = esCal ? def[1] : def;
    const v = esCal ? valCal(row[col]) : valBool(row[col]);
    if (v === null) continue;
    n++; p += v * w; items[col] = v;
  }
  return { pct: n ? Math.round(p * 1000) / 10 : null, n_items: n, items };
}
```

**Nota sobre `estado_senales`:** es el único ítem de "calidad" (Bueno/Regular/Malo) en vez de
Sí/No — por eso su definición en `PESOS_RUT` es un arreglo `['cal', 0.05]` en vez de solo
`0.05`, y `evaluarPonderado` lo detecta con `Array.isArray(def)` para usar `valCal` en vez de
`valBool`. Si se pierde este detalle, ese ítem se evaluará mal silenciosamente.

**Nombres de columnas ya traducidos:** en la tabla de arriba los pesos usan las claves LIMPIAS
que ya definimos en la sección 6 de este documento (`pmt`, `senalizacion_vertical`, etc. para
Rutinarios). El equivalente completo para Implementación/PO todavía no está mapeado a nombres
internos de SharePoint — sigue pendiente el descubrimiento descrito en la sección 6, pero los
NOMBRES LIMPIOS y sus PESOS de esta tabla sí son definitivos y no deben cambiar.

## 9. Implementación (PO): estructura real, mapeo completo, fusión DG/PO y duplicados

**Descubrimiento estructural clave:** la lista SharePoint "Plan Seguimiento PMT -
Implementacion" recibe datos del PowerApp mediante **dos tarjetas separadas dentro del mismo
formulario**: una de "Datos Generales" (DG: contrato, frente, fecha, clima, diligenciado por,
dirección, tipo de cierre) y otra de "Previo a Obras" (PO: checklist de 17 ítems que sí se
puntúa). **Cada tarjeta crea su PROPIA fila en la lista, con su propio `ID` de SharePoint** —
no son la misma fila. Para saber qué fila DG corresponde a qué fila PO, ambas tarjetas piden
de nuevo contrato, frente y fecha, y esa combinación (`contrato+frente+fecha`) es la clave de
cruce. La fusión de estas dos filas en un solo registro completo se hace en `app.js`, NO en
Power Automate (más fácil de depurar y corregir ahí que dentro de un flujo).

**Nombre interno confirmado del campo Frente:**
- Rutinarios: columna visible "Frentes", nombre interno `Seguimiento`.
- Implementación, lado DG: nombre interno `Seguimiento` (mismo patrón, sin sufijo).
- Implementación, lado PO: nombre interno `Seguimiento_x0028_PO_x0029_` (columna visible hoy
  dice "Frente (PO)", pero originalmente se creó con otro nombre — el interno no cambió).

**Mapeo completo de campos — Implementación (verificado sobre datos reales, sin suposiciones
pendientes):**

| Clave limpia | Nombre interno SharePoint | Lado |
|---|---|---|
| id | `ID` | — |
| contrato_dg | `Contrato` → `.Value` | DG (clave de cruce) |
| frente_dg | `Seguimiento` → `.Value` | DG (clave de cruce) |
| fecha_dg | `Fecha` | DG (clave de cruce) |
| diligenciado_por | `Diligenciadopor` → `.Value` | DG (solo existe ahí) |
| direccion | `Direcci_x00f3_n` | DG (solo existe ahí) |
| tipo_cierre | `Tipodecierre` → `.Value` | DG (solo existe ahí) |
| contrato_po | `Contrato_x0028_DO_x0029_` → `.Value` | PO (clave de cruce; nombre interno heredado de un renombre) |
| frente_po | `Seguimiento_x0028_PO_x0029_` → `.Value` | PO (clave de cruce) |
| fecha_po | `Fecha_x0028_PO_x0029_` | PO (clave de cruce) |
| observaciones | `Observacionesgenerales` | PO |
| pmt_impreso | `PlandeManejodeTr_x00e1_nsito` → `.Value` | PO |
| horario_inicio | `Inicioenhoraautorizada` → `.Value` | PO |
| reposicion_senales | `Reposici_x00f3_ndese_x00f1_ales` → `.Value` | PO |
| senalizacion_segun_planos | `Se_x00f1_alizaci_x00f3_nVertical` → `.Value` | PO |
| espaciamiento_senales | `Se_x00f1_alizaci_x00f3_nvertical0` → `.Value` | PO |
| tamano_senales | `Se_x00f1_alizaci_x00f3_nvertical1` → `.Value` | PO |
| canalizacion_sentido_flujo | `Canalizaci_x00f3_n_x002d_Ensenti` → `.Value` | PO |
| canalizacion_segun_planos | `Canalizaci_x00f3_n_x002d_Ubicaci` → `.Value` | PO |
| canalizacion_lastrada | `Hola` → `.Value` (nombre interno real, verificado — ver nota abajo) | PO |
| canalizacion_reflectividad | `Canalizaci_x00f3_n_x002d_Element` → `.Value` | PO |
| ancho_carril | `Gesti_x00f3_ncierrevial_x002d_An` → `.Value` | PO |
| longitud_transicion | `Gesti_x00f3_ncierrevial_x002d_Lo` → `.Value` | PO |
| longitud_seguridad | `Gesti_x00f3_ncierrevial_x002d_Lo0` → `.Value` | PO |
| area_acopio | `Gesti_x00f3_ncierrevial_x002d__x` → `.Value` | PO |
| flashers | `Gesti_x00f3_ncierrevial_x002d_Fl` → `.Value` | PO |
| auxiliares_cantidad | `Gesti_x00f3_nauxiliatesdetr_x00e` → `.Value` (ojo: la variante mal escrita "auxiliaTES", verificada — la correctamente escrita "auxiliaRES" NO es esta) | PO |
| auxiliares_baston | `Gesti_x00f3_nauxiliaresdetr_x00e1` → `.Value` | PO |

**Nota histórica sobre `Hola`:** en la primera revisión del código original se diagnosticó como
un placeholder olvidado (bug). Se corrigió esa conclusión con evidencia directa: el campo
`Hola` es un nombre interno real (probablemente la columna se creó originalmente con ese
nombre de prueba y luego se le cambió el nombre visible, sin que el nombre interno cambiara —
el mismo fenómeno visto en otras columnas). Confirmado cruzando el valor de `Hola` con el
texto de `Observacionesgenerales` de un registro real que mencionaba "falta de lastrado".

**Columnas descartadas (existen en la lista, no forman parte de `PESOS_PO`, no se seleccionan):**
`Se_x00f1_alizaci_x00f3_nvertical3` (Marca contratista), certificación/indumentaria de
auxiliares, cantidad de maletines/balizas/conos, condición del flujo vehicular, reporte de
imprevistos, boleta de supervisión, y las columnas de las etapas DO/FO (esas pertenecen al
histórico que ya no se puntúa — ver la nota original de la guía sobre columnas de fases
anteriores).

**Algoritmo de fusión y manejo de duplicados (para `app.js`) — CORREGIDO tras auditoría de
Claude Code, que encontró filas de clave parcial (contrato vacío pero frente/fecha con datos)
y filas totalmente vacías que el diseño original no contemplaba:**

```
function fusionarImplementacion(registrosCrudos):
  # PRIMERO: descartar filas sin ningún dato en ninguno de los dos lados —
  # no aportan nada, no tiene sentido mostrarlas ni como "incompletas" (confirmado por
  # auditoría: 41 de 100 filas reales caían en este caso).
  registrosCrudos = registrosCrudos.filter(r => tieneAlgunDatoDG(r) || tieneAlgunDatoPO(r))

  ladoDG = registros donde contrato_dg/frente_dg/fecha_dg tienen valor
  ladoPO = registros donde contrato_po/frente_po/fecha_po tienen valor

  # CLAVE: solo indexar (para poder cruzar) las filas cuya clave está COMPLETA
  # (contrato, frente Y fecha, los tres con valor). Una fila con clave parcial (ej.
  # contrato_po vacío pero frente_po/fecha_po con datos — 14 casos reales encontrados)
  # NUNCA entra al índice de cruce, porque agruparla por una clave incompleta podría
  # fusionarla por error con otra fila no relacionada que comparta solo frente+fecha.
  # Esa fila se muestra igual, pero como "incompleta / sin cruce posible", nunca se
  # intenta emparejar.
  dgConClaveCompleta = ladoDG.filter(clave completa)
  poConClaveCompleta = ladoPO.filter(clave completa)
  dgClaveParcial = ladoDG.filter(clave incompleta)  # -> se muestran como incompletas, sin cruce
  poClaveParcial = ladoPO.filter(clave incompleta)  # -> se muestran como incompletas, sin cruce

  # Indexar solo lo que tiene clave completa, resolviendo duplicados:
  # si dos filas comparten la misma clave completa, se conserva la de id MÁS ALTO (envío
  # más reciente = probable corrección de un envío duplicado por error). La descartada NO
  # se pierde en silencio: se registra en "duplicados ignorados".
  dgPorClave, duplicadosDG = indexarConDedup(dgConClaveCompleta, clave=contrato_dg+frente_dg+fecha_dg)
  poPorClave, duplicadosPO = indexarConDedup(poConClaveCompleta, clave=contrato_po+frente_po+fecha_po)

  # Cruzar: para cada entrada PO con clave completa, buscar su pareja DG por la misma clave
  para cada registro PO en poPorClave:
    dg = dgPorClave[misma clave] (o null si no existe)
    fusionado = combinar(datos de dg si existe, checklist y puntaje de PO)
    si dg es null: marcar fusionado.incompleto = true (falta el lado DG)
  # Igual al revés: entradas DG sin pareja PO -> "incompleto" (falta el lado PO).
  # Más las filas de clave parcial (dgClaveParcial, poClaveParcial): se agregan también
  # como "incompletas / sin cruce posible", cada una tal cual, sin intentar emparejar.

  si duplicadosDG.length + duplicadosPO.length > 0:
    mostrar aviso visible en el tablero (no solo en consola) con el conteo total
  retornar { registrosFusionados, duplicadosIgnorados: duplicadosDG + duplicadosPO }
```

**Requisito de interfaz derivado de este algoritmo:** un registro `incompleto` (falta un lado)
debe seguir siendo visible en la tabla, no ocultarse — con su puntaje como "Sin dato" y alguna
señal visual clara (ej. una etiqueta "Incompleto") en vez de fallar o mostrarse como si tuviera
puntaje 0%. Perder visibilidad sobre datos incompletos es tan malo como que la app se rompa.

**Hallazgo de la verificación con datos reales (post-activación del flujo), CORREGIDO tras
auditoría de Claude Code sobre los 100 registros reales de cada lista:** aparecieron problemas
de calidad de dato (error humano al diligenciar el formulario, no un bug del flujo). La
normalización de espacios/mayúsculas es necesaria pero **no basta por sí sola** — se
confirmaron 6 códigos de contrato que no existen en `contratos.json`, ni siquiera
normalizados, y requieren una decisión de negocio (agregarlos a `contratos.json` si son
válidos, o tratarlos como error de diligenciamiento):
- `CW348929` (Rutinarios)
- `CW353551` (Rutinarios — verificado sobre las 233 filas reales completas)
- `CW369125` (Rutinarios — verificado sobre las 233 filas reales completas)
- `CW280931` (Rutinarios — verificado sobre las 233 filas reales completas)
- `CW327799` (Implementación, ambos lados — con y sin espacio; ninguna variante existe en
  `contratos.json`)
- `CW3000` (Implementación, lado PO — probable error de tipeo de `CW328120`)

**Typo adicional encontrado (mismo tratamiento que los contratos huérfanos):** el registro
`id: 228` de Rutinarios tiene `diligenciado_por: 8992996` (con un dígito de más) en vez de
`992996`, el número correcto que usa esa misma persona en el resto de sus registros. Al buscar
en `funcionarios.json` no va a encontrar coincidencia — debe mostrar "Funcionario no
identificado", no fallar ni quedar en blanco.

Hasta que el usuario confirme cuál de estos es válido, los tres se tratan igual: se muestran
con la etiqueta "Contrato no reconocido" (ver regla de normalización abajo), nunca se ocultan
ni se inventa a qué proyecto pertenecen.

**Regla de normalización (para `app.js`):** antes de cruzar `contrato`/`contrato_po`/`contrato_dg`
contra `contratos.json`, normalizar ambos lados (quitar espacios sobrantes con `trim()`, colapsar
espacios internos, pasar a mayúsculas) antes de comparar. Si aun así no hay coincidencia, el
registro se muestra igual — nunca se descarta — con una etiqueta visible "Contrato no
reconocido" en vez de dejar el proyecto/contratista en blanco sin explicación.

**AMPLIACIÓN de la regla (verificado que faltaba — la normalización aplicada primero solo
cubría la visualización, no el cruce DG/PO):** la clave de fusión `contrato+frente+fecha` que
usa `fusionarImplementacion()` (y el equivalente de deduplicación en Rutinarios) también debe
construirse con los valores YA NORMALIZADOS, no con los valores crudos. Si no se hace así, dos
envíos de la misma inspección real (uno DG, uno PO) con el mismo contrato pero escrito con
espacios o mayúsculas distintas (ej. `"CW 327799"` vs `"CW327799"`) nunca se identifican como
la misma clave y el algoritmo los deja como dos registros "Incompleto" separados en vez de
fusionarlos en uno completo — inflando artificialmente el conteo de incompletos.

**Verificación a escala completa (1960 filas reales de `crudo_implementacion.json`, corrida
por Claude Code, matemática verificada a nivel de "lado" DG/PO — sirve como número de
referencia para comparar tras aplicar la ampliación de normalización de arriba):**

| Categoría | Cantidad |
|---|---|
| Filas totalmente vacías | 807 de 1960 (41% — proporción consistente con la muestra de 100) |
| Fusionados completos (DG+PO cruzados por clave) | 458 |
| Autofusionados (ambos lados en la misma fila cruda) | 46 |
| Incompleto — sin PO (DG huérfano) | 153 |
| Incompleto — sin DG (PO huérfano) | 84 |
| Incompleto — clave parcial | 2 |
| Descartados por duplicado | 27 (todos del lado PO) |
| **Total registros finales mostrados (antes de la ampliación)** | **743** |

Se espera que, tras normalizar también la clave de cruce, el número de "Incompleto" baje y el
de "Fusionados completos" suba (algunos pares que hoy no cruzan por diferencias de formato sí
deberían cruzar). El nuevo total no tiene que coincidir con 743 — lo que hay que verificar es
que la aritmética por lado siga cerrando exacta, igual que arriba.

**Nota de infraestructura Git (importante antes de fusionar el Pull Request):** el archivo real
de 1960 filas vive en `main` (donde Power Automate escribe todos los días); el branch
`mejoras-datos-reales` tiene congelada una copia vieja de 100 filas desde que se creó. Antes de
fusionar el PR, hay que sincronizar el branch con `main` (traer los cambios de `main` al
branch) para no arriesgar que el merge sobreescriba los datos reales de producción con la
copia vieja de muestra.

## 10. Fotos de evidencia fotográfica (decisión en curso, con interruptor)

Las listas de SharePoint incluyen **adjuntos nativos** (fotos tomadas desde el formulario de
PowerApps) — confirmado: `crudo_rutinarios.json` solo trae la bandera `{HasAttachments}`, no
una columna de tipo Imagen/Hipervínculo. Obtener las fotos requiere pasos adicionales en
Power Automate (`Obtener adjuntos` + `Obtener contenido de adjunto` por ítem) que **todavía no
están diseñados** — pendiente para la Fase 4/6.

**Se probó la alternativa de enlazar directo a la URL de SharePoint** (sin copiar la foto al
repo): funciona para empleados EPM que ya tienen acceso a la lista, pero pide permiso a
empleados sin acceso directo y pide inicio de sesión a externos. Se descartó por fricción —
el objetivo es que cualquiera con el link del tablero vea las fotos sin trámites adicionales.

**Decisión:** proceder a copiar las fotos al repositorio (mismo patrón que los JSON), con un
**interruptor de dos capas independientes**, porque la política de privacidad de EPM sobre
estas fotos aún no está definida:

1. **Capa de interfaz** (`MOSTRAR_FOTOS` en `config.js`, nuevo archivo de solo interruptores
   de funciones): controla si el tablero *muestra* fotos. Instantáneo, sin tocar Power
   Automate. **No hace privadas las fotos que ya estén en el repo** — solo deja de
   desplegarlas en pantalla.
2. **Capa de tubería** (en el flujo de Power Automate, pendiente de diseñar en la Fase 4/6):
   controla si las fotos *se siguen copiando* al repo público de ahí en adelante. Esta es la
   que de verdad resuelve el tema de privacidad. Si la política resulta ser "no pueden ser
   públicas", apagar solo la Capa 1 NO es suficiente — hay que apagar también la Capa 2 y
   limpiar lo ya subido (reescribir historial de Git, igual que se documentó para los datos
   personales en la sección 2).

**Contrato de datos para el front-end** (no depende de cómo Power Automate las entregue):
cada registro puede traer `fotos: ["ruta/relativa1.jpg", ...]` — lista vacía o ausente si no
hay fotos. Se muestran como miniaturas dentro del detalle de cada registro (no en una galería
aparte), para heredar automáticamente los filtros activos sin lógica adicional.

**Pendiente técnico para la Fase 4/6:** las fotos de cámara/PowerApps suelen pesar 1-5 MB; la
API de contenido de GitHub usada para los JSON tiene un límite práctico cercano a 1 MB por
archivo en una sola operación — probablemente se necesite comprimir/redimensionar en Power
Automate antes de subir, o usar una API distinta de GitHub para archivos grandes.

## 11. Identidad visual EPM (logo + paleta de colores)

**Logo:** archivo `LogoEPM.png` — debe subirse a la raíz del repositorio (o a una carpeta
`assets/`) y colocarse en la esquina superior izquierda del encabezado del tablero. Tiene
fondo transparente, así que funciona bien sobre cualquier color de fondo del encabezado.

**Colores reales del logo (extraídos por muestreo de píxeles, no aproximados):**
- Verde principal: `#00a950`
- Verde claro: `#9fce66`

**Paleta complementaria oficial EPM** (proporcionada por el usuario, gama completa
naranja→amarillo→verde→verde azulado, sin ningún tono rojo).

**Decisión de diseño — conflicto resuelto:** el semáforo de cumplimiento (verde/amarillo/rojo)
necesita que "crítico" se distinga con fuerza visual de "cumple", y la paleta EPM no tiene
rojo. Se decidió usar el naranja más intenso de la paleta complementaria como sustituto de
rojo para "crítico" — se mantiene dentro de marca y, como beneficio adicional, mejora la
accesibilidad para daltonismo rojo-verde (el tipo más común) al usar naranja-verde en vez de
rojo-verde.

**Paleta final a usar en `styles.css` (variables CSS):**

```css
:root {
  --color-marca: #00a950;       /* verde principal EPM (logo, encabezado, acentos) */
  --color-marca-clara: #9fce66; /* verde claro EPM (acentos secundarios) */
  --color-verde: #00a950;       /* semáforo: Cumple */
  --color-amarillo: #d5c700;    /* semáforo: Por mejorar (Pantone 389) */
  --color-rojo: #d56b00;        /* semáforo: Crítico — en realidad naranja, ver nota arriba */
  --color-sin-dato: #9e9e9e;    /* semáforo: Sin dato — gris neutro, fuera de la paleta EPM */
}
```

**Importante:** aunque la variable se siga llamando `--color-rojo` (por consistencia con el
resto del código que ya usa esa clase `.rojo` para "crítico" — ver `app.js`, sección de
`ETIQUETAS_SEMAFORO`), su valor real es naranja. No renombrar la variable ni la clase CSS, eso
obligaría a tocar `app.js` sin necesidad; solo cambia el valor del color.

## 12. Mejoras UX — ronda posterior al MVP (branch `mejoras-ux`, FUSIONADO a `main`)

**Filtro por "diligenciado por":** nuevo filtro desplegable, poblado dinámicamente con los
valores distintos presentes en los datos ya cargados (nombre resuelto vía `funcionarios.json`
cuando exista, valor crudo si no).

**Filtro por "contratista":** nuevo filtro desplegable, poblado con los valores distintos de
contratista presentes en `contratos.json` (vía el contrato de cada registro). Filtra ambas
listas.

**Bug del filtro de texto con `municipios` (RESUELTO):** no era que `municipios` fuera un
arreglo — la función de búsqueda simplemente nunca leía ese campo. Se agregó
`info.municipios.join(' ')` a la bolsa de texto que arma la búsqueda.

**Unificación de nombres entre Rutinarios e Implementación:** `funcionarios.json` admite un
campo opcional `variantes_implementacion` (arreglo de strings) por persona, para que el mismo
funcionario con dos formatos distintos (ej. "Sergio Ochoa Jiménez" en Rutinarios vs. "Sergio
Ochoa — Profesional C" en Implementación) aparezca una sola vez en el filtro. Resuelto para
Sergio Ochoa y Leydi Marín; pendiente completar a mano para Julián Sánchez y otros.

**Gráficos dinámicos — Chart.js vía CDN:** primera dependencia externa del proyecto además de
fuentes/logo. Torta de distribución por semáforo + línea de evolución de cumplimiento en el
tiempo, ambos reactivos a todos los filtros activos.

**Regla — ocultar registros "Sin dato" (distinta de "Incompleto", que se sigue mostrando
siempre):** un registro con `semaforo === 'sin_dato'` se excluye de tabla, contadores y
gráficos, con aviso visible del conteo (nunca en silencio).

**Reporte en PDF:** botón "Generar reporte" que usa `window.print()` (sin librería externa de
generación de PDF) con una hoja de estilos de impresión dedicada. Refleja los filtros activos.
Rango de fechas ≤8 días: registros expandidos con checklist y observaciones completas. Rango
>8 días (o sin fechas definidas): una fila resumida por registro. Los gráficos se convierten a
imagen estática (`canvas.toDataURL()`) antes de imprimir — **hay que esperar tanto a
`animation.onComplete` de Chart.js como al evento `load` de cada `<img>` antes de llamar a
`window.print()`**, o las imágenes salen en blanco (dos condiciones de carrera distintas,
ambas confirmadas y corregidas con logs instrumentados). En el reporte impreso: "Frente" se
reemplaza por "Dirección" (más útil para un lector externo), se agrega "Contratista", los
registros "Incompleto" se excluyen sin aviso visible en el PDF (el conteo interno se descartó
por decisión del usuario — no aporta a quien recibe el reporte), y los saltos de página fluyen
libremente entre registros (solo se evita partir una fila individual de datos u observaciones,
no el registro completo).

**Nota de infraestructura:** durante esta ronda, GitHub Pages se configuró temporalmente para
publicar desde el branch `mejoras-ux` (para poder probar en la URL real antes del merge). Tras
fusionar a `main`, se debe volver a apuntar Pages a `main` en Settings — ya se hizo.

**Fotos y contraseña de acceso — quedaron fuera de esta ronda:** ver sección 10 (fotos, sigue
pendiente la política de privacidad de EPM) y la nota de la sección 6 sobre autenticación
(evaluada, descartada por ahora).

## 13. Convenciones acordadas

- Nombres de archivo: minúsculas, sin tildes, sin espacios (evita romper GitHub Pages, que
  es case-sensitive, a diferencia de Windows).
- `contratos.json` es la única fuente de verdad para contrato→proyecto→contratista.
- No usar `type="module"` en los `<script>` — scripts clásicos únicamente.
