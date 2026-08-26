// app.js — carga de datos, mapeo, renderizado y filtros del Tablero de Seguimiento PMTs.
//
// Depende de que index.html haya cargado ANTES, en este orden:
//   1. config.js  (MOSTRAR_FOTOS)
//   2. modelo.js  (PESOS_RUT, PESOS_PO, semaforoDe, evaluarPonderado, valBool, valCal)
// Script clásico (sin "type=module"): todo vive dentro de un IIFE para no ensuciar
// el scope global, salvo las variables/funciones que modelo.js y config.js ya definen.

(function () {
  'use strict';

  // Etiquetas legibles para cada ítem del checklist. Esto es solo presentación:
  // los pesos y nombres de clave "de verdad" viven en modelo.js y no se tocan aquí.
  const ETIQUETAS_RUT = {
    pmt: 'PMT vigente',
    permiso_rotura: 'Permiso de rotura',
    senalizacion_vertical: 'Señalización vertical',
    estado_senales: 'Estado de las señales',
    canalizacion_sentido: 'Canalización en el sentido correcto',
    dispositivos_luminosos: 'Dispositivos luminosos / flashers',
    auxiliares_transito: 'Auxiliares de tránsito',
    via_limpia: 'Vía limpia y en condiciones',
    platinas_pernadas: 'Platinas pernadas / ancladas',
    via_despejada: 'Vía despejada',
  };

  const ETIQUETAS_PO = {
    pmt_impreso: 'PMT impreso en sitio',
    horario_inicio: 'Horario de inicio cumplido',
    reposicion_senales: 'Reposición de señales',
    senalizacion_segun_planos: 'Señalización según planos',
    espaciamiento_senales: 'Espaciamiento entre señales',
    tamano_senales: 'Tamaño de señales',
    canalizacion_sentido_flujo: 'Canalización según sentido del flujo',
    canalizacion_segun_planos: 'Canalización según planos',
    canalizacion_lastrada: 'Canalización lastrada',
    canalizacion_reflectividad: 'Reflectividad de la canalización',
    ancho_carril: 'Ancho de carril',
    longitud_transicion: 'Longitud de transición',
    longitud_seguridad: 'Longitud de seguridad',
    area_acopio: 'Área de acopio',
    flashers: 'Flashers',
    auxiliares_cantidad: 'Cantidad de auxiliares',
    auxiliares_baston: 'Auxiliares con bastón',
  };

  const ETIQUETAS_SEMAFORO = {
    verde: 'Cumple',
    amarillo: 'Por mejorar',
    rojo: 'Crítico',
    sin_dato: 'Sin dato',
  };

  // Fallback interno mínimo: solo se usa si fallan TANTO crudo_*.json COMO datos_*.json
  // (por ejemplo, al abrir index.html con doble clic desde el explorador de archivos,
  // donde el navegador bloquea fetch() a archivos locales por política de CORS).
  //
  // Incluye casos deliberados de "incompleto" y "contrato no reconocido" para poder
  // probar visualmente esas etiquetas sin depender de datos reales.
  const MUESTRA_INTERNA_RUTINARIOS = [
    {
      id: 'RUT-MUESTRA-1',
      fecha: '2026-08-01',
      contrato: 'CW323402',
      frente: '1',
      diligenciado_por: '119011',
      direccion: '(dato de respaldo interno, sin conexión a archivos JSON)',
      tipo_cierre: 'Parcial',
      observaciones: 'Registro de muestra completo y con contrato reconocido.',
      pmt: 'Si', permiso_rotura: 'Si', senalizacion_vertical: 'Si', estado_senales: 'Bueno',
      canalizacion_sentido: 'Si', dispositivos_luminosos: 'Si', auxiliares_transito: 'Si',
      via_limpia: 'Si', platinas_pernadas: 'Si', via_despejada: 'Si', fotos: [],
    },
    {
      id: 'RUT-MUESTRA-2',
      fecha: '2026-08-02',
      contrato: 'CW999999',
      frente: '2',
      diligenciado_por: '999999',
      direccion: '(dato de respaldo interno, sin conexión a archivos JSON)',
      tipo_cierre: 'Total',
      observaciones: 'Registro de muestra con contrato no reconocido y funcionario no identificado.',
      pmt: 'Si', permiso_rotura: 'No', senalizacion_vertical: 'Si', estado_senales: 'Regular',
      canalizacion_sentido: 'Si', dispositivos_luminosos: 'No', auxiliares_transito: 'Si',
      via_limpia: 'Si', platinas_pernadas: 'Si', via_despejada: 'No', fotos: [],
    },
  ];

  // Formato "crudo" (filas separadas DG/PO), igual al que entrega Power Automate, para que
  // pase por el mismo algoritmo de fusión que los datos reales.
  const MUESTRA_INTERNA_IMPLEMENTACION = [
    {
      id: 'PO-MUESTRA-DG-1', contrato_dg: 'CW323402', frente_dg: '1', fecha_dg: '2026-08-01',
      diligenciado_por: 'Equipo Supervisión Directa',
      direccion: '(dato de respaldo interno, sin conexión a archivos JSON)', tipo_cierre: 'Parcial',
      contrato_po: null, frente_po: null, fecha_po: null,
    },
    {
      id: 'PO-MUESTRA-PO-1', contrato_dg: null, frente_dg: null, fecha_dg: null,
      diligenciado_por: null, direccion: null, tipo_cierre: null,
      contrato_po: 'CW323402', frente_po: '1', fecha_po: '2026-08-01',
      observaciones: 'Registro de muestra completo y con contrato reconocido.',
      pmt_impreso: 'Si', horario_inicio: 'Si', reposicion_senales: 'Si', senalizacion_segun_planos: 'Si',
      espaciamiento_senales: 'Si', tamano_senales: 'Si', canalizacion_sentido_flujo: 'Si',
      canalizacion_segun_planos: 'Si', canalizacion_lastrada: 'Si', canalizacion_reflectividad: 'Si',
      ancho_carril: 'Si', longitud_transicion: 'Si', longitud_seguridad: 'Si', area_acopio: 'Si',
      flashers: 'Si', auxiliares_cantidad: 'Si', auxiliares_baston: 'Si',
    },
    {
      id: 'PO-MUESTRA-PO-2', contrato_dg: null, frente_dg: null, fecha_dg: null,
      diligenciado_por: null, direccion: null, tipo_cierre: null,
      contrato_po: 'CW322377', frente_po: '2', fecha_po: '2026-08-02',
      observaciones: 'Registro de muestra incompleto: falta el lado de Datos Generales.',
      pmt_impreso: 'Si', horario_inicio: 'No', reposicion_senales: 'Si', senalizacion_segun_planos: 'Si',
      espaciamiento_senales: 'No', tamano_senales: 'Si', canalizacion_sentido_flujo: 'Si',
      canalizacion_segun_planos: 'No', canalizacion_lastrada: 'Si', canalizacion_reflectividad: 'Si',
      ancho_carril: 'Si', longitud_transicion: 'Si', longitud_seguridad: 'Si', area_acopio: 'No',
      flashers: 'Si', auxiliares_cantidad: 'Si', auxiliares_baston: 'Si',
    },
    {
      id: 'PO-MUESTRA-DG-3', contrato_dg: 'CW999999', frente_dg: '1', fecha_dg: '2026-08-03',
      diligenciado_por: 'Equipo Supervisión Directa',
      direccion: '(dato de respaldo interno, sin conexión a archivos JSON)', tipo_cierre: 'Total',
      contrato_po: null, frente_po: null, fecha_po: null,
    },
    {
      id: 'PO-MUESTRA-PO-3', contrato_dg: null, frente_dg: null, fecha_dg: null,
      diligenciado_por: null, direccion: null, tipo_cierre: null,
      contrato_po: 'CW999999', frente_po: '1', fecha_po: '2026-08-03',
      observaciones: 'Registro de muestra completo pero con contrato no reconocido.',
      pmt_impreso: 'Si', horario_inicio: 'Si', reposicion_senales: 'No', senalizacion_segun_planos: 'Si',
      espaciamiento_senales: 'Si', tamano_senales: 'No', canalizacion_sentido_flujo: 'Si',
      canalizacion_segun_planos: 'Si', canalizacion_lastrada: 'No', canalizacion_reflectividad: 'Si',
      ancho_carril: 'Si', longitud_transicion: 'No', longitud_seguridad: 'Si', area_acopio: 'Si',
      flashers: 'No', auxiliares_cantidad: 'Si', auxiliares_baston: 'Si',
    },
  ];

  const ESTADO = {
    contratos: [],
    contratosPorClave: new Map(),
    funcionarios: [],
    registros: [],
    fuente: { rutinarios: '', implementacion: '' },
    duplicadosIgnorados: { rutinarios: 0, implementacion: 0 },
    filas_expandidas: new Set(),
    filtro: { tipo: 'todos', contrato: 'todos', frente: 'todos', semaforo: 'todos', texto: '', desde: '', hasta: '' },
  };

  function escapeHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Utilidades de texto/clave (usadas por deduplicación, fusión y normalización) ---

  function normStr(v) {
    return (v == null ? '' : String(v)).trim();
  }

  // Clave de cruce/deduplicación contrato+frente+fecha. Solo se usa para *comparar* filas
  // entre sí (Rutinarios contra sí mismo, o DG contra PO en Implementación) — no tiene
  // relación con la normalización de contrato contra contratos.json (ver normalizarContrato).
  function claveTripleta(contrato, frente, fecha) {
    return `${normStr(contrato)}|${normStr(frente)}|${normStr(fecha)}`;
  }

  // Contrato: quita espacios sobrantes, colapsa/elimina espacios internos (un código de
  // contrato nunca debería tener espacios de por sí — el espacio es siempre un error de
  // tipeo) y pasa a mayúsculas, para poder cruzar contra contratos.json de forma tolerante.
  function normalizarContrato(c) {
    return normStr(c).replace(/\s+/g, '').toUpperCase();
  }

  // Número de funcionario: quita el ".0" que agrega SharePoint cuando el campo se guarda
  // como número decimal (ej. 119011.0 -> "119011").
  function normalizarNumeroFuncionario(v) {
    let s = normStr(v);
    if (s.endsWith('.0')) s = s.slice(0, -2);
    return s;
  }

  // Agrupa `lista` por la clave que devuelva `obtenerClave(fila)`. Cuando dos o más filas
  // comparten clave, conserva solo la de `id` más alto (envío más reciente) y reporta el
  // resto como duplicados descartados — nunca en silencio.
  function indexarConDedup(lista, obtenerClave) {
    const grupos = new Map();
    lista.forEach((fila) => {
      const clave = obtenerClave(fila);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(fila);
    });
    const porClave = new Map();
    const duplicados = [];
    grupos.forEach((filas, clave) => {
      if (filas.length === 1) {
        porClave.set(clave, filas[0]);
        return;
      }
      filas.sort((a, b) => Number(b.id) - Number(a.id));
      porClave.set(clave, filas[0]);
      filas.slice(1).forEach((f) => duplicados.push(f.id));
    });
    return { porClave, duplicados };
  }

  // --- Deduplicación de Rutinarios (sección 6) ---

  function deduplicarRutinarios(lista) {
    const { porClave, duplicados } = indexarConDedup(
      lista,
      (r) => claveTripleta(r.contrato, r.frente, r.fecha)
    );
    return { registros: Array.from(porClave.values()), duplicadosIgnorados: duplicados.length };
  }

  // --- Fusión DG/PO de Implementación (sección 9, algoritmo corregido) ---

  function tieneDatoDG(r) {
    return !!(normStr(r.contrato_dg) || normStr(r.frente_dg) || normStr(r.fecha_dg) ||
      normStr(r.diligenciado_por) || normStr(r.direccion) || normStr(r.tipo_cierre));
  }

  // OJO: `frente_po` NO cuenta por sí solo como evidencia de "hay dato en el lado PO".
  // Se encontraron 14 filas reales que son en realidad un DG completo (contrato, frente,
  // fecha, diligenciado_por, dirección, tipo de cierre) con un valor suelto en `frente_po`
  // sin `contrato_po` ni `fecha_po` ni ningún ítem del checklist contestado — probablemente
  // un residuo de la tarjeta PO que el usuario abrió y no llegó a diligenciar. Si `frente_po`
  // contara como evidencia, esas 14 filas se mostrarían DOS veces: una por su lado DG real y
  // otra como una fila PO fantasma "incompleta" con el mismo `id`.
  function tieneDatoPO(r) {
    if (normStr(r.contrato_po) || normStr(r.fecha_po) || normStr(r.observaciones)) return true;
    return Object.keys(PESOS_PO).some((clave) => normStr(r[clave]) !== '');
  }

  function claveCompletaDG(r) {
    return !!(normStr(r.contrato_dg) && normStr(r.frente_dg) && normStr(r.fecha_dg));
  }

  function claveCompletaPO(r) {
    return !!(normStr(r.contrato_po) && normStr(r.frente_po) && normStr(r.fecha_po));
  }

  function construirRegistroDesdePO(po, dg, incompleto) {
    return Object.assign({}, po, {
      id: po.id,
      contrato: dg ? dg.contrato_dg : po.contrato_po,
      frente: dg ? dg.frente_dg : po.frente_po,
      fecha: dg ? dg.fecha_dg : po.fecha_po,
      diligenciado_por: dg ? dg.diligenciado_por : null,
      direccion: dg ? dg.direccion : null,
      tipo_cierre: dg ? dg.tipo_cierre : null,
      incompleto: incompleto,
    });
  }

  function construirRegistroDesdeDG(dg, incompleto) {
    return {
      id: dg.id,
      contrato: dg.contrato_dg,
      frente: dg.frente_dg,
      fecha: dg.fecha_dg,
      diligenciado_por: dg.diligenciado_por,
      direccion: dg.direccion,
      tipo_cierre: dg.tipo_cierre,
      observaciones: null,
      incompleto: incompleto,
    };
  }

  function fusionarImplementacion(registrosCrudos) {
    // 1) Descartar filas que no traen ningún dato en ninguno de los dos lados.
    const conDatos = registrosCrudos.filter((r) => tieneDatoDG(r) || tieneDatoPO(r));

    // 2) Filas que ya traen evidencia de los DOS lados en la MISMA fila cruda, con el lado
    //    PO de clave incompleta (falta contrato_po y/o fecha_po ahí mismo): no hay que
    //    cruzarlas contra otra fila para saber que ese checklist les pertenece — ya viven en
    //    el mismo `id`. Se fusionan directo consigo mismas y quedan fuera del resto del
    //    algoritmo, para no mostrar el mismo envío dos veces (una por su lado DG y otra como
    //    fila PO fantasma "incompleta"). Nunca se marcan como "incompleto" salvo que su
    //    propia clave DG tampoco esté completa.
    const autoFusionadas = conDatos.filter((r) => tieneDatoDG(r) && tieneDatoPO(r) && !claveCompletaPO(r));
    const autoFusionadasIds = new Set(autoFusionadas.map((r) => r.id));
    const restantes = conDatos.filter((r) => !autoFusionadasIds.has(r.id));

    const ladoDG = restantes.filter(tieneDatoDG);
    const ladoPO = restantes.filter(tieneDatoPO);

    // 3) Del resto, separar clave completa (se puede cruzar) de clave parcial (nunca se
    //    cruza, para no fusionar por error filas no relacionadas que compartan solo
    //    frente+fecha).
    const dgCompleta = ladoDG.filter(claveCompletaDG);
    const poCompleta = ladoPO.filter(claveCompletaPO);
    const dgParcial = ladoDG.filter((r) => !claveCompletaDG(r));
    const poParcial = ladoPO.filter((r) => !claveCompletaPO(r));

    // 4) Indexar (y deduplicar) solo lo que tiene clave completa.
    const { porClave: dgPorClave, duplicados: duplicadosDG } =
      indexarConDedup(dgCompleta, (r) => claveTripleta(r.contrato_dg, r.frente_dg, r.fecha_dg));
    const { porClave: poPorClave, duplicados: duplicadosPO } =
      indexarConDedup(poCompleta, (r) => claveTripleta(r.contrato_po, r.frente_po, r.fecha_po));

    const registros = autoFusionadas.map((r) => construirRegistroDesdePO(r, r, !claveCompletaDG(r)));
    const clavesDGUsadas = new Set();

    // 5) Cruzar: cada PO de clave completa busca su pareja DG por la misma clave.
    poPorClave.forEach((po, clave) => {
      const dg = dgPorClave.get(clave) || null;
      if (dg) clavesDGUsadas.add(clave);
      registros.push(construirRegistroDesdePO(po, dg, dg === null));
    });

    // 6) DG de clave completa que no encontraron pareja PO -> incompletos (falta el PO).
    dgPorClave.forEach((dg, clave) => {
      if (clavesDGUsadas.has(clave)) return;
      registros.push(construirRegistroDesdeDG(dg, true));
    });

    // 7) Clave parcial de cualquiera de los dos lados -> siempre incompletos, nunca se
    //    intenta emparejar.
    dgParcial.forEach((r) => registros.push(construirRegistroDesdeDG(r, true)));
    poParcial.forEach((r) => registros.push(construirRegistroDesdePO(r, null, true)));

    return { registros, duplicadosIgnorados: duplicadosDG.length + duplicadosPO.length };
  }

  async function fetchJSON(ruta) {
    try {
      const resp = await fetch(ruta, { cache: 'no-store' });
      if (!resp.ok) return null;
      const data = await resp.json();
      return Array.isArray(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  // Cascada de carga: datos automáticos de Power Automate -> datos de respaldo curados
  // a mano -> muestra interna mínima. Así el tablero siempre muestra algo, incluso antes
  // de que el flujo de Power Automate esté activo.
  async function cargarLista(nombreBase, muestraInterna) {
    const crudo = await fetchJSON(`crudo_${nombreBase}.json`);
    if (crudo && crudo.length > 0) return { datos: crudo, fuente: `crudo_${nombreBase}.json` };

    const datos = await fetchJSON(`datos_${nombreBase}.json`);
    if (datos && datos.length > 0) return { datos, fuente: `datos_${nombreBase}.json` };

    return { datos: muestraInterna, fuente: 'muestra interna (sin JSON externo disponible)' };
  }

  function mapearRegistro(row, tipo, pesos) {
    const resultado = evaluarPonderado(row, pesos);
    return Object.assign({}, row, {
      tipo: tipo,
      puntaje: resultado.pct,
      n_items: resultado.n_items,
      semaforo: semaforoDe(resultado.pct),
    });
  }

  function contratoInfo(codigo) {
    if (!normStr(codigo)) return null;
    return ESTADO.contratosPorClave.get(normalizarContrato(codigo)) || null;
  }

  function funcionarioInfo(numeroRegistro) {
    const clave = normalizarNumeroFuncionario(numeroRegistro);
    if (!clave) return null;
    return ESTADO.funcionarios.find((f) => normStr(f.numero_registro) === clave) || null;
  }

  // Texto a mostrar para "diligenciado por". En Rutinarios llega como número de registro
  // de SharePoint y se resuelve contra funcionarios.json; en Implementación ya llega como
  // nombre de texto y se muestra tal cual (ver sección 6 de CONTEXTO_PROYECTO.md).
  function textoDiligenciadoPor(registro) {
    if (registro.tipo !== 'rutinario') {
      return normStr(registro.diligenciado_por) || 'Sin dato';
    }
    const numero = normalizarNumeroFuncionario(registro.diligenciado_por);
    if (!numero) return 'Sin dato';
    const f = funcionarioInfo(numero);
    return f ? `${f.nombre} — ${f.cargo}` : `Funcionario no identificado (${numero})`;
  }

  // --- Filtrado ---

  function registrosFiltrados() {
    const f = ESTADO.filtro;
    const texto = f.texto.trim().toLowerCase();
    return ESTADO.registros.filter((r) => {
      if (f.tipo !== 'todos' && r.tipo !== f.tipo) return false;
      if (f.contrato !== 'todos' && r.contrato !== f.contrato) return false;
      if (f.frente !== 'todos' && normStr(r.frente) !== f.frente) return false;
      if (f.semaforo !== 'todos' && r.semaforo !== f.semaforo) return false;
      if (f.desde && r.fecha && r.fecha < f.desde) return false;
      if (f.hasta && r.fecha && r.fecha > f.hasta) return false;
      if (texto) {
        const info = contratoInfo(r.contrato);
        const bolsa = [
          r.direccion, r.observaciones, textoDiligenciadoPor(r), r.contrato,
          info ? info.proyecto : '', info ? info.contratista : '',
        ].join(' ').toLowerCase();
        if (!bolsa.includes(texto)) return false;
      }
      return true;
    });
  }

  // --- Render: aviso de duplicados ---

  function renderAvisoDuplicados() {
    const cont = document.getElementById('aviso-duplicados');
    const total = ESTADO.duplicadosIgnorados.rutinarios + ESTADO.duplicadosIgnorados.implementacion;
    if (total <= 0) {
      cont.hidden = true;
      cont.textContent = '';
      return;
    }
    cont.hidden = false;
    cont.textContent = `⚠ Se detectaron ${total} registro(s) duplicado(s) (mismo contrato + frente + fecha). ` +
      `Se conservó el envío más reciente de cada uno y se descartó el resto ` +
      `(Rutinarios: ${ESTADO.duplicadosIgnorados.rutinarios}, Implementación: ${ESTADO.duplicadosIgnorados.implementacion}).`;
  }

  // --- Render: resumen KPI ---

  function renderResumen(lista) {
    const cont = document.getElementById('resumen-grid');
    const total = lista.length;
    const conPuntaje = lista.filter((r) => r.puntaje !== null);
    const promedio = conPuntaje.length
      ? Math.round((conPuntaje.reduce((s, r) => s + r.puntaje, 0) / conPuntaje.length) * 10) / 10
      : null;
    const conteos = { verde: 0, amarillo: 0, rojo: 0, sin_dato: 0 };
    lista.forEach((r) => { conteos[r.semaforo]++; });

    const tarjetas = [
      { etiqueta: 'Registros filtrados', valor: total, clase: '' },
      { etiqueta: 'Puntaje promedio', valor: promedio === null ? '—' : `${promedio}%`, clase: '' },
      { etiqueta: 'En verde (cumple)', valor: conteos.verde, clase: 'verde' },
      { etiqueta: 'En amarillo (por mejorar)', valor: conteos.amarillo, clase: 'amarillo' },
      { etiqueta: 'En rojo (crítico)', valor: conteos.rojo, clase: 'rojo' },
    ];
    cont.innerHTML = tarjetas.map((t) => `
      <div class="tarjeta-kpi ${t.clase}">
        <div class="valor">${escapeHtml(t.valor)}</div>
        <div class="etiqueta">${escapeHtml(t.etiqueta)}</div>
      </div>
    `).join('');
  }

  // --- Render: gráfico de barras por contrato ---

  function renderGrafico(lista) {
    const cont = document.getElementById('grafico-contratos');
    const porContrato = new Map();
    lista.forEach((r) => {
      if (r.puntaje === null) return;
      if (!porContrato.has(r.contrato)) porContrato.set(r.contrato, []);
      porContrato.get(r.contrato).push(r.puntaje);
    });

    if (porContrato.size === 0) {
      cont.innerHTML = '<p class="sin-datos">No hay registros con puntaje calculable para los filtros actuales.</p>';
      return;
    }

    const filas = Array.from(porContrato.entries()).map(([contrato, puntajes]) => {
      const promedio = Math.round((puntajes.reduce((s, v) => s + v, 0) / puntajes.length) * 10) / 10;
      const info = contratoInfo(contrato);
      const etiqueta = info ? `${contrato} · ${info.proyecto}` : contrato;
      return { contrato, etiqueta, promedio, semaforo: semaforoDe(promedio) };
    }).sort((a, b) => b.promedio - a.promedio);

    cont.innerHTML = filas.map((f) => `
      <div class="barra-contrato">
        <div class="barra-etiqueta" title="${escapeHtml(f.etiqueta)}">${escapeHtml(f.etiqueta)}</div>
        <div class="barra-fondo">
          <div class="barra-relleno" style="width:${f.promedio}%; background:var(--color-${f.semaforo === 'sin_dato' ? 'sin-dato' : f.semaforo});"></div>
        </div>
        <div class="barra-valor">${f.promedio}%</div>
      </div>
    `).join('');
  }

  // --- Render: tabla y detalle ---

  function etiquetasPara(registro) {
    return registro.tipo === 'rutinario' ? ETIQUETAS_RUT : ETIQUETAS_PO;
  }
  function pesosPara(registro) {
    return registro.tipo === 'rutinario' ? PESOS_RUT : PESOS_PO;
  }

  function renderFotos(registro) {
    if (!MOSTRAR_FOTOS) return '';
    if (!registro.fotos || !registro.fotos.length) return '';
    const miniaturas = registro.fotos.map((ruta) =>
      `<img src="${escapeHtml(ruta)}" alt="Evidencia fotográfica del registro ${escapeHtml(registro.id || '')}" class="foto-miniatura" data-full="${escapeHtml(ruta)}">`
    ).join('');
    return `
      <div class="fotos-evidencia">
        <h4>Fotos de evidencia</h4>
        <div class="galeria-miniaturas">${miniaturas}</div>
      </div>
    `;
  }

  function renderDetalle(registro) {
    const etiquetas = etiquetasPara(registro);
    const pesos = pesosPara(registro);
    const items = Object.keys(pesos).map((clave) => {
      const valor = registro[clave];
      const texto = (valor == null || valor === '') ? 'Sin dato' : valor;
      return `<div class="detalle-item"><span class="etq">${escapeHtml(etiquetas[clave] || clave)}</span><span class="val">${escapeHtml(texto)}</span></div>`;
    }).join('');

    return `
      <div class="detalle-registro">
        <div class="detalle-meta">
          <div class="detalle-item"><span class="etq">Frente</span><span class="val">${escapeHtml(registro.frente || 'Sin dato')}</span></div>
          <div class="detalle-item"><span class="etq">Tipo de cierre</span><span class="val">${escapeHtml(registro.tipo_cierre || 'Sin dato')}</span></div>
          <div class="detalle-item"><span class="etq">Diligenciado por</span><span class="val">${escapeHtml(textoDiligenciadoPor(registro))}</span></div>
        </div>
        ${items}
        <div class="detalle-observaciones">
          <span class="etq">Observaciones</span>
          <span>${escapeHtml(registro.observaciones || 'Sin observaciones registradas.')}</span>
        </div>
        ${renderFotos(registro)}
      </div>
    `;
  }

  function renderNotas(registro) {
    const badges = [];
    if (registro.incompleto) {
      badges.push('<span class="badge advertencia">Incompleto</span>');
    }
    if (registro.contrato && !contratoInfo(registro.contrato)) {
      badges.push('<span class="badge advertencia">Contrato no reconocido</span>');
    }
    return badges.length ? badges.join(' ') : '—';
  }

  // Clave de identidad de fila para el seguimiento de expandido/colapsado. Rutinarios e
  // Implementación son dos listas de SharePoint independientes: sus `id` pueden coincidir
  // en valor sin ser el mismo registro, así que se combinan con el tipo.
  function claveFila(r) {
    return `${r.tipo}-${r.id}`;
  }

  function renderTabla(lista) {
    const cuerpo = document.getElementById('cuerpo-tabla');
    if (lista.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="11" class="sin-datos">No hay registros para los filtros seleccionados.</td></tr>';
      return;
    }

    const filas = lista.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    cuerpo.innerHTML = filas.map((r) => {
      const info = contratoInfo(r.contrato);
      const clave = claveFila(r);
      const expandida = ESTADO.filas_expandidas.has(clave);
      const puntajeTxt = r.puntaje === null ? '—' : `${r.puntaje}%`;
      const filaPrincipal = `
        <tr class="fila-registro" data-clave="${escapeHtml(clave)}">
          <td class="icono-expandir">${expandida ? '▾' : '▸'}</td>
          <td>${escapeHtml(r.fecha || '—')}</td>
          <td><span class="badge-tipo">${r.tipo === 'rutinario' ? 'Rutinario' : 'PO'}</span></td>
          <td>${escapeHtml(r.contrato || '—')}</td>
          <td>${escapeHtml(r.frente || '—')}</td>
          <td>${escapeHtml(info ? info.proyecto : '—')}</td>
          <td>${escapeHtml(info ? info.contratista : '—')}</td>
          <td>${escapeHtml(r.direccion || '—')}</td>
          <td>${puntajeTxt}</td>
          <td><span class="badge ${r.semaforo}">${ETIQUETAS_SEMAFORO[r.semaforo]}</span></td>
          <td>${renderNotas(r)}</td>
        </tr>
      `;
      const filaDetalle = expandida
        ? `<tr class="fila-detalle" data-clave-detalle="${escapeHtml(clave)}"><td colspan="11">${renderDetalle(r)}</td></tr>`
        : '';
      return filaPrincipal + filaDetalle;
    }).join('');
  }

  // --- Filtros: selects dinámicos ---

  function poblarFiltroContratos() {
    const select = document.getElementById('filtro-contrato');
    const actuales = new Set(ESTADO.registros.map((r) => r.contrato).filter(Boolean));
    const opciones = ['<option value="todos">Todos</option>'].concat(
      Array.from(actuales).sort().map((codigo) => {
        const info = contratoInfo(codigo);
        const etiqueta = info ? `${codigo} · ${info.proyecto}` : codigo;
        return `<option value="${escapeHtml(codigo)}">${escapeHtml(etiqueta)}</option>`;
      })
    );
    select.innerHTML = opciones.join('');
  }

  function poblarFiltroFrentes() {
    const select = document.getElementById('filtro-frente');
    const actuales = new Set(ESTADO.registros.map((r) => normStr(r.frente)).filter(Boolean));
    const opciones = ['<option value="todos">Todos</option>'].concat(
      Array.from(actuales).sort().map((frente) => `<option value="${escapeHtml(frente)}">${escapeHtml(frente)}</option>`)
    );
    select.innerHTML = opciones.join('');
  }

  function leerFiltrosDesdeUI() {
    ESTADO.filtro = {
      tipo: document.getElementById('filtro-tipo').value,
      contrato: document.getElementById('filtro-contrato').value,
      frente: document.getElementById('filtro-frente').value,
      semaforo: document.getElementById('filtro-semaforo').value,
      texto: document.getElementById('filtro-texto').value,
      desde: document.getElementById('filtro-desde').value,
      hasta: document.getElementById('filtro-hasta').value,
    };
  }

  function renderizarTodo() {
    const lista = registrosFiltrados();
    renderResumen(lista);
    renderGrafico(lista);
    renderTabla(lista);
  }

  // --- Eventos ---

  function wireEventos() {
    ['filtro-tipo', 'filtro-contrato', 'filtro-frente', 'filtro-semaforo', 'filtro-desde', 'filtro-hasta'].forEach((id) => {
      document.getElementById(id).addEventListener('change', () => {
        leerFiltrosDesdeUI();
        renderizarTodo();
      });
    });
    document.getElementById('filtro-texto').addEventListener('input', () => {
      leerFiltrosDesdeUI();
      renderizarTodo();
    });
    document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
      document.getElementById('filtro-tipo').value = 'todos';
      document.getElementById('filtro-contrato').value = 'todos';
      document.getElementById('filtro-frente').value = 'todos';
      document.getElementById('filtro-semaforo').value = 'todos';
      document.getElementById('filtro-texto').value = '';
      document.getElementById('filtro-desde').value = '';
      document.getElementById('filtro-hasta').value = '';
      leerFiltrosDesdeUI();
      renderizarTodo();
    });

    document.getElementById('cuerpo-tabla').addEventListener('click', (ev) => {
      const miniatura = ev.target.closest('.foto-miniatura');
      if (miniatura) {
        abrirLightbox(miniatura.dataset.full);
        return;
      }
      const fila = ev.target.closest('tr.fila-registro');
      if (!fila) return;
      const clave = fila.dataset.clave;
      if (ESTADO.filas_expandidas.has(clave)) {
        ESTADO.filas_expandidas.delete(clave);
      } else {
        ESTADO.filas_expandidas.add(clave);
      }
      renderizarTodo();
    });

    document.getElementById('lightbox-cerrar').addEventListener('click', cerrarLightbox);
    document.getElementById('lightbox').addEventListener('click', (ev) => {
      if (ev.target.id === 'lightbox') cerrarLightbox();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') cerrarLightbox();
    });
  }

  function abrirLightbox(ruta) {
    const overlay = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = ruta;
    overlay.hidden = false;
  }
  function cerrarLightbox() {
    const overlay = document.getElementById('lightbox');
    overlay.hidden = true;
    document.getElementById('lightbox-img').src = '';
  }

  // --- Arranque ---

  async function init() {
    const [contratos, funcionarios, rut, imp] = await Promise.all([
      fetchJSON('contratos.json'),
      fetchJSON('funcionarios.json'),
      cargarLista('rutinarios', MUESTRA_INTERNA_RUTINARIOS),
      cargarLista('implementacion', MUESTRA_INTERNA_IMPLEMENTACION),
    ]);

    ESTADO.contratos = contratos || [];
    ESTADO.contratosPorClave = new Map(ESTADO.contratos.map((c) => [normalizarContrato(c.contrato), c]));
    ESTADO.funcionarios = funcionarios || [];
    ESTADO.fuente.rutinarios = rut.fuente;
    ESTADO.fuente.implementacion = imp.fuente;

    // Deduplicación y cálculo de puntajes SIEMPRE antes de renderizar, sobre los datos
    // ya sea reales o de muestra (así los ejemplos internos también pasan por el mismo
    // camino que los datos de producción).
    const dedupRut = deduplicarRutinarios(rut.datos);
    const fusionImp = fusionarImplementacion(imp.datos);

    ESTADO.duplicadosIgnorados = {
      rutinarios: dedupRut.duplicadosIgnorados,
      implementacion: fusionImp.duplicadosIgnorados,
    };

    ESTADO.registros = [
      ...dedupRut.registros.map((row) => mapearRegistro(row, 'rutinario', PESOS_RUT)),
      ...fusionImp.registros.map((row) => mapearRegistro(row, 'po', PESOS_PO)),
    ];

    document.getElementById('fuente-datos').textContent =
      `Rutinarios: ${ESTADO.fuente.rutinarios} · Implementación (PO): ${ESTADO.fuente.implementacion}`;

    poblarFiltroContratos();
    poblarFiltroFrentes();
    leerFiltrosDesdeUI();
    wireEventos();
    renderAvisoDuplicados();
    renderizarTodo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
