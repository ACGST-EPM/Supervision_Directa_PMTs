// modelo.js — Motor de puntaje.
//
// Copiado LITERAL de la sección 8 de CONTEXTO_PROYECTO.md (fuente de verdad oficial,
// derivada por la compañera original desde las medidas DAX del .pbix de Power BI, R²=1).
// No se aproxima, no se redondea distinto, no se reinventa ningún valor de aquí.
//
// Script clásico (sin "type=module"): estas variables y funciones quedan disponibles
// como globales para app.js, siempre que index.html cargue modelo.js ANTES que app.js.

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

// --- Validación de integridad (adición de seguridad, no forma parte del snippet original) ---
// Suma los pesos de cada tabla y avisa por consola si alguna vez dejan de sumar 1.00 exacto
// (la misma clase de error que causó el bug de la clave 'Hola' en la versión anterior).
(function verificarSumaPesos(){
  function sumaPesos(tabla){
    let total = 0;
    for (const col in tabla) {
      const def = tabla[col];
      total += Array.isArray(def) ? def[1] : def;
    }
    return Math.round(total * 1e8) / 1e8;
  }
  const sumaRut = sumaPesos(PESOS_RUT);
  const sumaPO = sumaPesos(PESOS_PO);
  if (sumaRut !== 1) console.error(`PESOS_RUT no suma 1.00 (suma actual: ${sumaRut}). Revisar modelo.js.`);
  if (sumaPO !== 1) console.error(`PESOS_PO no suma 1.00 (suma actual: ${sumaPO}). Revisar modelo.js.`);
})();
