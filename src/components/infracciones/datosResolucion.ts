/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: El lote de Resolución, de verdad — el aviso de datos de Resolución incompletos
 *   (Fase 03.24, Plan 11, D-05)
 * Archivo: datosResolucion.ts
 * Responsabilidad: Los TEXTOS del aviso de D-05: la frase del aviso y la etiqueta legible de cada
 *   código que manda el servidor en `datosResolucionFaltantes`. Los consume `AvisoDatosResolucion`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 *
 * Viven aquí y no junto al componente porque NO son componentes: exportarlos desde
 * `AvisoDatosResolucion.tsx` dispara `react-refresh/only-export-components` (un archivo que exporta
 * componentes y constantes a la vez pierde el recargado en caliente), la misma razón por la que
 * existe `obligacion-hacer/comunes.ts`.
 */

/** El texto del aviso: una sola redacción para las tres pantallas. */
export const TEXTO_DATOS_RESOLUCION_INCOMPLETOS = "Datos de Resolución incompletos";

/**
 * La etiqueta legible de cada código del backend (`CodigoFaltanteResolucion`, Plan 10), en minúscula
 * porque se lee dentro de una frase («Falta: multa, caso enlazado»). Un código que no esté aquí se
 * enseña tal cual (degradación honesta).
 */
export const ETIQUETA_FALTANTE_RESOLUCION: Record<string, string> = {
  MULTA: "multa",
  RESOLUCION_NUMERO: "número de resolución",
  RESOLUCION_FECHA: "fecha de resolución",
  CORE_ID: "caso enlazado",
  INFRACCIONES: "infracciones",
};
