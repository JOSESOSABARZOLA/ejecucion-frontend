/**
 * Microservicio: ejecucion
 * Módulo: utils
 * Feature: Etiqueta de materia con el estado «Sin materia» (quick 261104-jh1)
 * Archivo: materia.util.ts
 * Responsabilidad: Componer, SOLO para pintar en pantalla, la etiqueta de materia (o submaterias) de
 *   un expediente a partir de los nombres resueltos en Sorteo y del flag `sinMateria`. «Sin materia»
 *   es un estado aparte que el backend nunca mete en los nombres (pueden acabar en providencias y
 *   actas); por eso esta función NO alimenta tokens de documentos.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-04
 */

/** Etiqueta única del estado «sin materia» en toda la UI. */
export const ETIQUETA_SIN_MATERIA = "Sin materia";

/**
 * Etiqueta de materia para la pantalla.
 * @param nombres nombres resueltos en Sorteo, ya unidos (p. ej. `LICENCIAMIENTO`), o vacío.
 * @param sinMateria si alguna infracción del expediente está «sin materia».
 * @param separador entre los nombres y la etiqueta «Sin materia» (`" / "` por defecto).
 * @returns `LICENCIAMIENTO`, `LICENCIAMIENTO / Sin materia`, `Sin materia` o `—`.
 */
export const etiquetaConSinMateria = (
  nombres?: string | null,
  sinMateria?: boolean,
  separador = " / ",
): string => {
  const limpios = nombres?.trim() ? nombres.trim() : "";
  if (limpios && sinMateria) return `${limpios}${separador}${ETIQUETA_SIN_MATERIA}`;
  if (limpios) return limpios;
  if (sinMateria) return ETIQUETA_SIN_MATERIA;
  return "—";
};
