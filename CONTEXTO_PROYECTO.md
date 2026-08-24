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

**PENDIENTE:** nombres internos de Implementación (17 ítems del checklist de PO). Método
acordado para obtenerlos: crear el flujo con solo las dos acciones "Obtener elementos",
ejecutar prueba manual, e inspeccionar el output crudo de "Obtener elementos" de
Implementación en el historial de ejecución — sin necesidad de escribir nada a GitHub todavía.

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
| 1. Repositorio propio + entorno de edición | ✅ Completo (github.dev) |
| 2. Los 4 archivos corregidos, probados con datos de muestra | 🔄 En curso (siguiente paso) |
| 3. Publicación en GitHub Pages | ✅ Infraestructura lista (Pages activo, probado con archivo de prueba) |
| 4. Flujo de Power Automate corregido | ⏳ Diseño definido, pendiente nombres de Implementación y construcción real |
| 5. Prueba de punta a punta | ⏳ Pendiente |
| 6. Mantenimiento (vencimiento de token, hábito de Pull antes de publicar) | ⏳ Pendiente |

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

## 11. Convenciones acordadas

- Nombres de archivo: minúsculas, sin tildes, sin espacios (evita romper GitHub Pages, que
  es case-sensitive, a diferencia de Windows).
- `contratos.json` es la única fuente de verdad para contrato→proyecto→contratista.
- No usar `type="module"` en los `<script>` — scripts clásicos únicamente.
