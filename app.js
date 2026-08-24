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
  const MUESTRA_INTERNA_RUTINARIOS = [{
    id: 'RUT-MUESTRA-INTERNA',
    fecha: '2026-08-01',
    contrato: 'CW323402',
    diligenciado_por: 'Equipo Supervisión Directa',
    direccion: '(dato de respaldo interno, sin conexión a archivos JSON)',
    tipo_cierre: 'Parcial',
    observaciones: 'Este registro solo aparece cuando el tablero no pudo leer ningún archivo JSON externo.',
    pmt: 'Si', permiso_rotura: 'Si', senalizacion_vertical: 'Si', estado_senales: 'Bueno',
    canalizacion_sentido: 'Si', dispositivos_luminosos: 'Si', auxiliares_transito: 'Si',
    via_limpia: 'Si', platinas_pernadas: 'Si', via_despejada: 'Si', fotos: [],
  }];
  const MUESTRA_INTERNA_PO = [{
    id: 'PO-MUESTRA-INTERNA',
    fecha: '2026-08-01',
    contrato: 'CW323402',
    diligenciado_por: 'Equipo Supervisión Directa',
    direccion: '(dato de respaldo interno, sin conexión a archivos JSON)',
    observaciones: 'Este registro solo aparece cuando el tablero no pudo leer ningún archivo JSON externo.',
    pmt_impreso: 'Si', horario_inicio: 'Si', reposicion_senales: 'Si', senalizacion_segun_planos: 'Si',
    espaciamiento_senales: 'Si', tamano_senales: 'Si', canalizacion_sentido_flujo: 'Si',
    canalizacion_segun_planos: 'Si', canalizacion_lastrada: 'Si', canalizacion_reflectividad: 'Si',
    ancho_carril: 'Si', longitud_transicion: 'Si', longitud_seguridad: 'Si', area_acopio: 'Si',
    flashers: 'Si', auxiliares_cantidad: 'Si', auxiliares_baston: 'Si', fotos: [],
  }];

  const ESTADO = {
    contratos: [],
    registros: [],
    fuente: { rutinarios: '', implementacion: '' },
    filas_expandidas: new Set(),
    filtro: { tipo: 'todos', contrato: 'todos', semaforo: 'todos', texto: '', desde: '', hasta: '' },
  };

  function escapeHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    return ESTADO.contratos.find((c) => c.contrato === codigo) || null;
  }

  // --- Filtrado ---

  function registrosFiltrados() {
    const f = ESTADO.filtro;
    const texto = f.texto.trim().toLowerCase();
    return ESTADO.registros.filter((r) => {
      if (f.tipo !== 'todos' && r.tipo !== f.tipo) return false;
      if (f.contrato !== 'todos' && r.contrato !== f.contrato) return false;
      if (f.semaforo !== 'todos' && r.semaforo !== f.semaforo) return false;
      if (f.desde && r.fecha && r.fecha < f.desde) return false;
      if (f.hasta && r.fecha && r.fecha > f.hasta) return false;
      if (texto) {
        const info = contratoInfo(r.contrato);
        const bolsa = [
          r.direccion, r.observaciones, r.diligenciado_por, r.contrato,
          info ? info.proyecto : '', info ? info.contratista : '',
        ].join(' ').toLowerCase();
        if (!bolsa.includes(texto)) return false;
      }
      return true;
    });
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
        ${items}
        <div class="detalle-observaciones">
          <span class="etq">Observaciones</span>
          <span>${escapeHtml(registro.observaciones || 'Sin observaciones registradas.')}</span>
        </div>
        ${renderFotos(registro)}
      </div>
    `;
  }

  function renderTabla(lista) {
    const cuerpo = document.getElementById('cuerpo-tabla');
    if (lista.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="9" class="sin-datos">No hay registros para los filtros seleccionados.</td></tr>';
      return;
    }

    const filas = lista.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    cuerpo.innerHTML = filas.map((r) => {
      const info = contratoInfo(r.contrato);
      const expandida = ESTADO.filas_expandidas.has(r.id);
      const puntajeTxt = r.puntaje === null ? '—' : `${r.puntaje}%`;
      const filaPrincipal = `
        <tr class="fila-registro" data-id="${escapeHtml(r.id)}">
          <td class="icono-expandir">${expandida ? '▾' : '▸'}</td>
          <td>${escapeHtml(r.fecha || '—')}</td>
          <td><span class="badge-tipo">${r.tipo === 'rutinario' ? 'Rutinario' : 'PO'}</span></td>
          <td>${escapeHtml(r.contrato || '—')}</td>
          <td>${escapeHtml(info ? info.proyecto : '—')}</td>
          <td>${escapeHtml(info ? info.contratista : '—')}</td>
          <td>${escapeHtml(r.direccion || '—')}</td>
          <td>${puntajeTxt}</td>
          <td><span class="badge ${r.semaforo}">${ETIQUETAS_SEMAFORO[r.semaforo]}</span></td>
        </tr>
      `;
      const filaDetalle = expandida
        ? `<tr class="fila-detalle" data-id-detalle="${escapeHtml(r.id)}"><td colspan="9">${renderDetalle(r)}</td></tr>`
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

  function leerFiltrosDesdeUI() {
    ESTADO.filtro = {
      tipo: document.getElementById('filtro-tipo').value,
      contrato: document.getElementById('filtro-contrato').value,
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
    ['filtro-tipo', 'filtro-contrato', 'filtro-semaforo', 'filtro-desde', 'filtro-hasta'].forEach((id) => {
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
      const id = fila.dataset.id;
      if (ESTADO.filas_expandidas.has(id)) {
        ESTADO.filas_expandidas.delete(id);
      } else {
        ESTADO.filas_expandidas.add(id);
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
    const [contratos, rut, po] = await Promise.all([
      fetchJSON('contratos.json'),
      cargarLista('rutinarios', MUESTRA_INTERNA_RUTINARIOS),
      cargarLista('implementacion', MUESTRA_INTERNA_PO),
    ]);

    ESTADO.contratos = contratos || [];
    ESTADO.fuente.rutinarios = rut.fuente;
    ESTADO.fuente.implementacion = po.fuente;
    ESTADO.registros = [
      ...rut.datos.map((row) => mapearRegistro(row, 'rutinario', PESOS_RUT)),
      ...po.datos.map((row) => mapearRegistro(row, 'po', PESOS_PO)),
    ];

    document.getElementById('fuente-datos').textContent =
      `Rutinarios: ${ESTADO.fuente.rutinarios} · Implementación (PO): ${ESTADO.fuente.implementacion}`;

    poblarFiltroContratos();
    leerFiltrosDesdeUI();
    wireEventos();
    renderizarTodo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
