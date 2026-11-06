/**
 * Microservicio: ejecucion
 * Módulo: utils
 * Feature: SBU de ingreso manual por el ejecutor (quick 261105-cc7)
 * Archivo: importe.util.ts
 * Responsabilidad: El PAR ÚNICO del dinero en el frontend, en formato ecuatoriano (es-EC: punto
 *   para los miles, coma para los decimales, siempre dos decimales):
 *   - `formatearUsd` lo PINTA en pantalla: «USD 2.300,00».
 *   - `parsearImporte` lo LEE de una casilla: «1.234,56» ⇒ 1234.56.
 *
 *   Ninguna pantalla formatea dinero por su cuenta, ni con «$» ni con la API de internacionalización
 *   del navegador: así una misma deuda se lee igual en la ficha, en el compositor y en el PDF, y lo
 *   que la pantalla enseña se puede volver a teclear tal cual.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-05
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — entra `formatearUsd`, espejo del
 *   backend, y sustituye al formateador con «$» de `ResolucionOrigen`; el lector acepta el prefijo
 *   «USD»)
 */

/**
 * Entero sin separadores, o con punto de miles en grupos EXACTOS de tres; opcionalmente, coma y uno
 * o dos decimales. Nada más.
 */
const IMPORTE_ES_EC = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;

/** Prefijo de moneda opcional que se tolera al leer: «$» o «USD» (sin distinguir mayúsculas). */
const PREFIJO_MONEDA = /^(?:\$|usd)\s*/i;

/**
 * Formatea un importe en dólares para la PANTALLA: «USD 2.300,00».
 *
 * 🔴 ESPEJO DECLARADO de `formatearUsd` de
 * `ejecucion-backend/src/modules/documentation/utils/importe-legal.util.ts` (el que imprime los
 * PDF): mismo algoritmo —no finito ⇒ 0, valor absoluto, redondeo a centavos ANTES de partir para
 * que 230,999 no salga «230,100», miles con «.», dos decimales tras «,», prefijo «USD » con espacio
 * normal— y misma tabla de casos en las pruebas. Si cambia allí, cambia aquí.
 *
 * Se escribe a mano y no con `Intl`: el resultado no depende del ICU del navegador (que mete un
 * espacio duro o cambia el símbolo según la versión). Y se muestra la cifra TAL CUAL, sin abreviar:
 * el administrado la cuadra contra su orden de pago.
 *
 * @param valor importe en dólares.
 * @returns p. ej. `USD 1.234.567,89`.
 */
export const formatearUsd = (valor: number): string => {
  const seguro = Number.isFinite(valor) ? Math.abs(valor) : 0;
  const totalCentavos = Math.round(seguro * 100);
  const entero = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;
  const miles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `USD ${miles},${String(centavos).padStart(2, "0")}`;
};

/**
 * Convierte el texto que teclea una persona en Ecuador a un número de dólares.
 *
 * 🔴 Lo que no es formato ecuatoriano se RECHAZA, no se reinterpreta: «470.75» no se lee como
 * 47.075 ni como 470,75, sino como `undefined`. Un importe mal leído crea una deuda distinta de la
 * que se quiso escribir, así que en la duda se pide escribirlo bien (DD-9).
 *
 * @param texto lo escrito; admite espacios alrededor y un prefijo «$» o «USD» (para que pegar lo
 *   que enseña `formatearUsd` funcione).
 * @returns el importe (puede ser 0: la regla «mayor que cero» es del llamador), o `undefined` si el
 *   texto no es un importe válido: punto como decimal, más de dos decimales, signos, letras o grupos
 *   de miles mal formados.
 */
export const parsearImporte = (texto: string): number | undefined => {
  const limpio = texto.trim().replace(PREFIJO_MONEDA, "");
  const partes = IMPORTE_ES_EC.exec(limpio);
  if (!partes) return undefined;

  const entero = partes[1].replace(/\./g, "");
  const decimales = partes[2];
  const valor = Number(decimales ? `${entero}.${decimales}` : entero);
  return Number.isFinite(valor) ? valor : undefined;
};
