/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: La base legal de cada infracción en la ficha (quick 261106-bo0)
 * Archivo: baseLegal.util.ts
 * Responsabilidad: Componer la referencia legal de una infracción —«Art. 316, lit. a, sublit. i,
 *   num. 1»— con las partes que vengan. El orden y las abreviaturas son los del pedido de la DME y
 *   viven SOLO aquí: cambiarlos es tocar esta función y su test. No transforma los valores (nunca
 *   inventa ni normaliza una cita legal: la autoridad es el catálogo de CORE) y tolera `undefined`
 *   para que un frontend desplegado antes que el backend no pinte «undefined».
 * Desarrollador: Andrés Miño
 * Fecha: 2026-11-06
 */
import type { FundamentoLegalInfraccion } from "../services/InfraccionesService";

/** Las cuatro partes de la referencia, en su orden y con su abreviatura. */
const PARTES: ReadonlyArray<
  [keyof Omit<FundamentoLegalInfraccion, "tipificacion">, string]
> = [
  ["articulo", "Art."],
  ["literal", "lit."],
  ["subliteral", "sublit."],
  ["numeral", "num."],
];

/**
 * La referencia legal de una infracción, sin las partes vacías.
 * @param f artículo, literal, subliteral y numeral (cualquiera puede faltar o ser `null`).
 * @returns p. ej. «Art. 316, num. 1»; `null` si no hay ninguna parte.
 */
export function referenciaLegal(
  f: Partial<
    Pick<
      FundamentoLegalInfraccion,
      "articulo" | "literal" | "subliteral" | "numeral"
    >
  >,
): string | null {
  const trozos: string[] = [];
  for (const [clave, abreviatura] of PARTES) {
    const valor = f[clave];
    const texto = typeof valor === "string" ? valor.trim() : "";
    if (texto.length > 0) trozos.push(`${abreviatura} ${texto}`);
  }
  return trozos.length > 0 ? trozos.join(", ") : null;
}
