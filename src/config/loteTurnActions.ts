/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Resolver PURO del TURNO de firma secuencial del acta D2 (FEND-03/RECE-06) — Fase 3.5
 * Archivo: loteTurnActions.ts
 * Responsabilidad: ADAPTADOR del turno de firma de la secuencia del acta D2. Dado un LOTE (sublote
 *   `(amasId, decisorUserId)`) y un ROL, dice QUÉ acción de firma le toca a ese rol AHORA. El turno se
 *   DERIVA de HECHOS PERSISTIDOS —`estado` + `firmaDecisorAt` / `firmaSecretarioAt` / `aprobadoAt`— y NO
 *   de `rolSiguiente`: `rolSiguiente` viaja en el resultado de UNA firma (FirmarLoteResult), pero NO en
 *   las filas de lote (SorteoLote) de las bandejas; leerlo ahí daría `undefined` y ocultaría TODOS los
 *   botones. La secuencia es 1) funcionario decisor → 2) secretario abogado → 3) director; solo la
 *   orden-3 aprueba. El gating de UI es CONVENIENCIA, NO seguridad: el backend deriva orden/actor del
 *   JWT y rechaza fuera de turno (T-3.4-18 / T-3.5-05). Unidad pura: sin React, sin red.
 *
 *   🔴 LA REGLA DEL TURNO YA NO VIVE AQUÍ (Fase 03.18, Plan 09). El cuerpo de `resolveLoteTurnActions`
 *   es hoy una llamada al MOTOR DE ACCIONES (`resolverAccion` sobre `POLITICA_ACCIONES`). Esta función
 *   sobrevive como ADAPTADOR porque dos de sus tres consumidores no son gates de botón, sino PREDICADOS
 *   —la seleccionabilidad del combo de firma (`comboFirma.esSeleccionable`) y el filtro de lotes de la
 *   bandeja de actas—, y por D-6 los predicados se quedan fuera del motor. Su firma, su tipo de retorno
 *   y su pureza no cambiaron: los tres consumidores siguen llamándola igual y recibiendo lo mismo.
 *
 *   🔴 LA FRASE QUE ESTABA AQUÍ, CITADA Y FECHADA, PORQUE NO ERA UN ERROR. Hasta el 2026-09-15 esta
 *   cabecera decía, escrita el 2026-07-23:
 *
 *       «Tampoco se fuerza en INBOX_ACTION_STATUS_RULES: el `status` de esa tabla es el enum EPAS y no
 *        puede expresar el turno del lote (corrección post-research).»
 *
 *   Se conserva porque SIGUE SIENDO CIERTA y porque borrarla haría que quien recuerde haberla leído
 *   pensara que se le cambió la memoria de sitio. El turno NO entra por la dimensión `status`, que
 *   sigue siendo el enum EPAS. Lo que cambió no es la afirmación: es el MECANISMO. Cuando se escribió,
 *   la tabla solo sabía gatear por rol y por estado; el Plan 01 de esta fase le añadió una segunda
 *   dimensión —CONDICIONES SOBRE HECHOS DERIVADOS— y el turno del lote es exactamente esa clase de
 *   condición. Por eso cabe ahora y no cabía entonces.
 *
 *   La compuerta de aceptación del decisor (`resolveDecisorFirmaGate`) es ADVISORY y se quedó fuera del
 *   motor a propósito: ver su propio JSDoc.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-15 (Fase 03.18, Plan 09: el turno lo decide el motor; esta
 *   función queda como adaptador para sus consumidores de predicado).
 */

import { resolverAccion } from "./inboxActionStatusRules";
import { hechosDeLote } from "./accionesHechos";
import type { SorteoLote, MiEpasAsignado } from "../services/SorteoService";

/** Rol operativo con un turno posible en la secuencia de firma (misma cadena EXACTA del backend). */
export type LoteTurnRole =
  | "funcionario decisor"
  | "secretario abogado"
  | "director";

/** Acción de firma de la secuencia que un rol puede tomar EN SU TURNO sobre el lote. */
export type LoteTurnAction =
  | "firmarDecisor"
  | "firmarSecretario"
  | "firmarDirector";

/**
 * Las tres acciones de firma, EN EL ORDEN DE LA SECUENCIA. Es la lista canónica: la consume este
 * adaptador y la consume la bandeja de actas para componer sus botones, de modo que no puedan
 * discrepar en cuáles son ni en qué orden van.
 */
export const ACCIONES_FIRMA_LOTE: readonly LoteTurnAction[] = [
  "firmarDecisor",
  "firmarSecretario",
  "firmarDirector",
] as const;

/**
 * ¿Qué acción de firma le toca al rol `rolName` sobre este `lote` AHORA? Deriva el turno de
 * `estado` + marcas de firma (NUNCA de `rolSiguiente`, ausente en las filas de lote).
 *
 * 🔴 LA REGLA YA NO SE ESCRIBE AQUÍ: la escribe `POLITICA_ACCIONES` y la evalúa `resolverAccion`.
 * Se conserva citado, palabra por palabra, el enunciado original de este JSDoc (2026-07-23), que es
 * exactamente lo que las tres reglas del motor dicen hoy con otro lenguaje:
 *
 *     - funcionario decisor  → `firmarDecisor`     si `estado==='PENDIENTE'` && !firmaDecisorAt
 *     - secretario abogado   → `firmarSecretario`  si `estado==='PARCIALMENTE_FIRMADO'`
 *                              && !!firmaDecisorAt && !firmaSecretarioAt
 *     - director             → `firmarDirector`    si `estado==='PARCIALMENTE_FIRMADO'`
 *                              && !!firmaSecretarioAt && !aprobadoAt
 *     `APROBADO`/`RECHAZADO` (y cualquier estado ausente) → `[]`. El rol se normaliza a minúsculas
 *     (trim); un rol fuera de su turno o desconocido devuelve `[]` (default deny).
 *
 * Una matriz de paridad de 160 celdas (`politicaAcciones.test.ts`) demuestra, caso por caso, que el
 * motor decide lo mismo — y se escribió y pasó ANTES de sustituir este cuerpo.
 *
 * 🔴 SE DEVUELVEN LAS HABILITADAS, NO LAS VISIBLES, Y ÉSE ES EL PUNTO ENTERO DE ESTA FUNCIÓN. Con
 * «apagar y no esconder» (D-7), las tres firmas son ahora VISIBLES casi siempre: fuera de turno el
 * motor las devuelve `{ visible: true, habilitada: false }` con su motivo, para que el funcionario
 * sepa que el paso existe aunque todavía no le toque. Filtrar por `visible` convertiría en «en
 * turno» a TODOS los lotes de la bandeja y en seleccionables a todas las casillas del combo. Es el
 * error exacto que alguien va a cometer al leer esto, y por eso está escrito aquí y no solo en el
 * plan: lo que este adaptador significa —y lo que sus tres consumidores esperan— es «¿puede este rol
 * firmar esto AHORA?», que es `habilitada`.
 *
 * Devuelve una lista (0 o 1 acción, porque los roles de la secuencia son disjuntos) para que el
 * consumidor la componga uniformemente con las demás.
 *
 * @param lote    fila de lote de las bandejas (SorteoLote): se leen `estado` y las marcas de firma.
 * @param rolName rol_name crudo del backend (p. ej. user.rolName); se compara en minúsculas.
 */
export function resolveLoteTurnActions(
  lote: SorteoLote,
  rolName: string,
): LoteTurnAction[] {
  // `?? ""` se conserva: `resolverAccion` normaliza el rol con `.trim().toLowerCase()`, y un rol
  // nulo llegado de un contexto de usuario a medio cargar reventaría ahí en vez de negar.
  const ctx = { rol: rolName ?? "", hechos: hechosDeLote(lote) };

  return ACCIONES_FIRMA_LOTE.filter(
    (accion) => resolverAccion(accion, ctx).habilitada,
  );
}

/**
 * Compuerta ADVISORY para ofrecer `firmarDecisor` agrupado por `amasId` en MisAsignadosPage (Plan 07):
 * el decisor solo debería poder firmar su sublote cuando NO le queda ningún caso activo pendiente, es
 * decir, cuando TODOS los casos del grupo están aceptados (aceptación implícita computed-on-read) o
 * excusados (sin caso activo pendiente). Es ADVISORY: la autorización real la hace cumplir el backend;
 * aquí solo se decide si habilitar el botón. Un grupo vacío devuelve `false` (no hay nada que firmar).
 *
 * 🔴 NO ENTRÓ EN EL MOTOR CON EL TURNO, Y EL LÍMITE SE DECLARA AQUÍ IGUAL QUE LOS DE D-6 (Plan 09).
 * No es una regla de acción: es una compuerta ADVISORY sobre un GRUPO de casos —«¿le queda al decisor
 * algún caso activo pendiente en este sublote?»—, y el motor decide sobre UNA acción con los hechos de
 * UNA fila, no sobre un agregado de filas. Meterla dentro obligaría a inventar un hecho derivado que
 * el backend no envía y que habría que calcular en el navegador recorriendo el grupo, que es
 * exactamente el tipo de cálculo que esta fase saca de las pantallas. Además el backend es quien la
 * hace cumplir: aquí solo evita ofrecer un acto que allá se rechazaría.
 *
 * @param grupo casos del sublote del decisor (MiEpasAsignado[]) agrupados por `amasId`.
 */
export function resolveDecisorFirmaGate(grupo: MiEpasAsignado[]): boolean {
  return (
    grupo.length > 0 &&
    grupo.every((c) => c.aceptadoImplicito === true /* o excusado — sin caso activo pendiente */)
  );
}
