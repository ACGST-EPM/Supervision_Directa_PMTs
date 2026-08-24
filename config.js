// config.js — interruptores de funciones del tablero.
//
// MOSTRAR_FOTOS controla ÚNICAMENTE si el tablero MUESTRA en pantalla la sección de
// fotos de evidencia dentro del detalle de cada registro (rutinario o PO).
//
//   true  -> si un registro trae el campo "fotos" con al menos una ruta, se muestran
//            sus miniaturas dentro del detalle (clic para ampliar).
//   false -> esa sección no aparece en ningún registro y no se intenta cargar
//            ninguna imagen, aunque el registro traiga fotos.
//
// Lo que este interruptor NO controla (ver sección 10 de CONTEXTO_PROYECTO.md):
//   - NO hace privadas las fotos que ya estén subidas al repositorio. Si el repo es
//     público (como lo exige GitHub Pages gratis), las fotos siguen siendo
//     públicamente accesibles por su URL directa aunque esto esté en false.
//   - NO detiene la subida de fotos nuevas desde Power Automate. Esa es una capa
//     separada (la "capa de tubería"), que se diseña en otra fase, dentro del flujo
//     mismo, no en este archivo.
//
// Es solo el interruptor de "¿el tablero las despliega en pantalla o no?".
const MOSTRAR_FOTOS = true;
