/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: Reglas PURAS de la firma en COMBO de actas de sorteo (RECE-05) — Fase 3.12
 * Archivo: comboFirma.ts
 * Responsabilidad: Toda la lógica de SELECCIÓN (qué sublotes puede marcar el usuario, qué payload sale
 *   de esas marcas) y de LECTURA DEL REPORTE (qué se le dice al usuario cuando vuelve un 200 con
 *   omitidos) del combo de firma, FUERA del JSX y con test colocado. La página se queda solo con el
 *   estado y el render.
 *
 *   EL TURNO NO SE DECIDE AQUÍ. `esSeleccionable` CONSUME `resolveLoteTurnActions` (./loteTurnActions):
 *   reimplementar la regla de la secuencia en este módulo crearía una TERCERA verdad —junto a la del
 *   resolver del cliente y la de los guards del backend— que se desincronizaría en la primera
 *   modificación de la secuencia. Aquí solo se AÑADE la condición que el turno no cubre: que el sublote
 *   tenga `decisorUserId` resuelto, porque sin él no existe un par válido que enviar (Pitfall 6).
 *
 *   El gating de selección es CONVENIENCIA, no seguridad: el backend deriva orden y actor del JWT, y
 *   omite con motivo lo que no corresponda. Unidad pura: sin React, sin estado, sin red.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-06
 * Modificado por: Andrés Miño — 2026-08-06 (quick 260806-m7u: un sublote con TODOS sus casos
 *   excusados deja de ser marcable y estrena su propio motivo, SIN_CASOS_ACTIVOS, que NO se confunde
 *   con YA_FIRMADO).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 15 — D-10/D-20: `etiquetaMotivo` traduce
 *   FIRMA_FALLIDA y FIRMA_NO_INTENTADA; entra `etiquetaCausaFirma`, el catálogo cerrado de las siete
 *   causas de un fallo de firma; `resumenReporte` cuenta las actas que el corte dejó sin intentar.)
 */

import { resolveLoteTurnActions } from "./loteTurnActions";
import type { CausaFirma } from "./firmaCopy";
import type {
  ComboMotivo,
  FirmarLotesPar,
  FirmarLotesResult,
  SorteoLote,
} from "../services/SorteoService";

/**
 * Clave de identidad de UN sublote. Es EXACTAMENTE la misma cadena que `ActasSorteoPage` ya usa como
 * `key` de cada `Collapse` (`${amasId}-${decisorUserId ?? "?"}`), a propósito: si el combo inventara su
 * propia clave, el mismo lote tendría dos identidades conviviendo en la misma pantalla y marcar una
 * fila podría seleccionar otra.
 *
 * Un lote sin decisor resuelto produce la variante con interrogante — que NUNCA será seleccionable
 * (ver `esSeleccionable`), pero necesita clave para poder renderizarse.
 */
export function clavePar(
  lote: Pick<SorteoLote, "amasId" | "decisorUserId">,
): string {
  return `${lote.amasId}-${lote.decisorUserId ?? "?"}`;
}

/**
 * ¿Tiene este sublote TODOS sus casos excusados? (quick 260806-m7u)
 *
 * El backend sella la firma solo sobre los casos ACTIVOS —el mismo predicado con el que arma el
 * acta—, así que un sublote sin ninguno no sella nada: firmaría un acta vacía. El backend lo omite
 * con motivo `SIN_CASOS_ACTIVOS`, y esta función es el espejo en cliente para no ofrecer marcarlo.
 *
 * ESTRICTO a 0, igual que el backend: `casosActivos` ausente (respuesta antigua en caché, dist viejo)
 * NO cuenta como vacío. Se atranca lo que se SABE vacío, nunca lo que simplemente no se sabe — la
 * alternativa dejaría la bandeja entera sin poder marcarse contra un backend anterior.
 */
function sinCasosActivos(lote: SorteoLote): boolean {
  return lote.casosActivos === 0;
}

/**
 * ¿Puede el usuario MARCAR este sublote para el combo? Es true sii se cumplen las TRES condiciones:
 *   1. `resolveLoteTurnActions(lote, rolName)` devuelve al menos una acción — es su turno;
 *   2. el lote tiene `decisorUserId` definido; y
 *   3. el lote conserva al menos un caso ACTIVO.
 *
 * La segunda no es redundante: el turno se deriva de `estado` y de las marcas de firma, que existen
 * aunque el LEFT JOIN del decisor no haya resuelto. Un sublote en turno pero sin decisor produciría un
 * par `{ amasId, decisorUserId: undefined }` que el DTO del backend rechaza con 400 — y ese 400 tumba
 * la petición ENTERA, arrastrando a los pares que sí eran válidos (Pitfall 6).
 *
 * La tercera tampoco: el turno se deriva de las MARCAS DE FIRMA, que siguen ahí aunque todos los casos
 * del sublote se hayan excusado. Sin esta condición la fila aparecería en turno y perfectamente
 * marcable, y el combo la devolvería omitida con `SIN_CASOS_ACTIVOS` sin que el usuario entendiera por
 * qué (quick 260806-m7u).
 *
 * @param lote    fila de sublote de la bandeja.
 * @param rolName rol_name crudo del backend; la normalización la hace `resolveLoteTurnActions`.
 */
export function esSeleccionable(lote: SorteoLote, rolName: string): boolean {
  return (
    resolveLoteTurnActions(lote, rolName).length > 0 &&
    lote.decisorUserId !== undefined &&
    lote.decisorUserId !== null &&
    !sinCasosActivos(lote)
  );
}

/**
 * Por qué este sublote NO se puede marcar, cuando la razón es EXPLICABLE al usuario. Devuelve texto
 * solo en los casos confusos —está en turno de ese rol y sin embargo la casilla está deshabilitada— y
 * `undefined` tanto si el lote es seleccionable como si sencillamente no es el turno de ese rol (ahí
 * no hay nada que explicar: la fila no ofrece la acción).
 *
 * PRECEDENCIA: "sin casos activos" va primero porque es la razón TERMINAL — ese sublote no lo va a
 * poder firmar nadie, ni en combo ni individualmente, mientras que la falta de decisor resuelto sí
 * tiene salida ("fírmelo individualmente"). Ofrecer esa salida sobre un sublote vacío sería mandar al
 * usuario a un 400 (quick 260806-m7u).
 */
export function motivoNoSeleccionable(
  lote: SorteoLote,
  rolName: string,
): string | undefined {
  const enTurno = resolveLoteTurnActions(lote, rolName).length > 0;

  if (enTurno && sinCasosActivos(lote)) {
    return "No se puede firmar: todos los expedientes de este sublote fueron excusados, así que no le queda ninguno activo y el acta se firmaría vacía. Revise las excusas o vuelva a sortear esos expedientes.";
  }

  if (enTurno && (lote.decisorUserId === undefined || lote.decisorUserId === null)) {
    return "No se puede firmar en combo: este sublote no tiene decisor resuelto. Actualice la bandeja o fírmelo individualmente.";
  }

  return undefined;
}

/**
 * Convierte las marcas de la pantalla en el PAYLOAD del combo. Recorre los lotes en su orden de
 * bandeja (resultado determinista) y se queda solo con los que están en el conjunto de claves Y son
 * seleccionables.
 *
 * Descarta EN SILENCIO las claves huérfanas (marcadas antes de un refetch que ya no las trae) y los
 * lotes que dejaron de ser elegibles: es la segunda barrera del filtro —la primera es la casilla
 * deshabilitada, la tercera es el DTO del backend— y su trabajo es que del submit no salga nunca un par
 * inválido, no avisar de ello.
 *
 * @param lotes   lotes de la bandeja tal como se están pintando.
 * @param claves  claves marcadas (`clavePar`); acepta un Set o cualquier iterable.
 * @param rolName rol del usuario, para resolver el turno de cada lote.
 */
export function paresDesdeSeleccion(
  lotes: readonly SorteoLote[],
  claves: Iterable<string>,
  rolName: string,
): FirmarLotesPar[] {
  const marcadas = claves instanceof Set ? claves : new Set(claves);

  return lotes
    .filter(
      (lote) => marcadas.has(clavePar(lote)) && esSeleccionable(lote, rolName),
    )
    .map((lote) => ({
      amasId: lote.amasId,
      // `esSeleccionable` ya garantizó que está definido; el aserto solo satisface al compilador.
      decisorUserId: lote.decisorUserId as number,
    }));
}

/**
 * Cuántos MASTERS distintos toca esta selección. Es el número que debe decir la confirmación reforzada
 * del director, y NO la cantidad de sublotes marcados (D-05).
 *
 * La razón: el `approveMaster` de Asignaciones es por MASTER, no por sublote. Decirle "va a firmar 9
 * actas" oculta las dos direcciones del error: quizá esas 9 solo cierran 3 masters, o —lo grave— 3
 * marcas aparentemente pequeñas cierran 3 masters COMPLETOS que incluyen sublotes de OTROS decisores.
 * El conteo se puede anticipar antes de enviar porque agrupar por `amasId` no necesita al servidor; el
 * reporte lo confirma después con `mastersAprobados.length`.
 */
export function contarMasters(pares: readonly FirmarLotesPar[]): number {
  return new Set(pares.map((p) => p.amasId)).size;
}

/**
 * Resumen en una frase del reporte del combo, para el toast o la cabecera del detalle.
 *
 * Distingue SIEMPRE firmados de omitidos —un 200 no significa "todo firmado"— y levanta una
 * ADVERTENCIA EXPLÍCITA cuando algún omitido lleva `intentado` en true (D-04): eso significa que
 * Asignaciones ya se tocó por ese par aunque la firma no quedara aplicada localmente, y reintentar a
 * ciegas puede duplicar allá lo que aquí parece pendiente. Es el único caso en el que el usuario tiene
 * que salir de esta pantalla.
 *
 * Con la firma real (Fase 03.21) añade UNA frase cuando el corte de D-20 dejó actas sin intentar
 * (`FIRMA_NO_INTENTADA`). Un fallo de firma nunca levanta la advertencia de Asignaciones: la firma va
 * antes del approve y esos omitidos viajan con `intentado: false`.
 */
export function resumenReporte(res: FirmarLotesResult): string {
  const ok = res.firmados.length;
  const no = res.omitidos.length;
  const masters = res.mastersAprobados.length;
  const tocados = res.omitidos.filter((o) => o.intentado).length;
  const noIntentadas = res.omitidos.filter(
    (o) => o.motivo === "FIRMA_NO_INTENTADA",
  ).length;

  const partes: string[] = [
    `Se firmaron ${ok} de ${res.solicitados} ${res.solicitados === 1 ? "acta" : "actas"}.`,
  ];

  if (no > 0) {
    partes.push(`${no} ${no === 1 ? "quedó omitida" : "quedaron omitidas"}.`);
  }

  if (masters > 0) {
    partes.push(
      `Se aprobaron ${masters} ${masters === 1 ? "lote master" : "lotes master"} en Asignaciones.`,
    );
  }

  if (tocados > 0) {
    partes.push(
      `Atención: ${tocados} de las omitidas alcanzaron a tocar Asignaciones; revíselas allá antes de reintentar.`,
    );
  }

  // D-20: el corte deja actas SIN INTENTAR. Pueden reenviarse tal cual, pero la confirmación del combo
  // ya se cerró y la clave se borró, así que la frase dice cómo: volver a abrir y escribirla de nuevo.
  if (noIntentadas > 0) {
    partes.push(
      `La firma se detuvo en un acta anterior por una causa que afecta a todas: ${noIntentadas} ${
        noIntentadas === 1 ? "acta no se intentó" : "actas no se intentaron"
      }. Vuelva a abrir «Firmar en combo» y escriba la clave de nuevo.`,
    );
  }

  return partes.join(" ");
}

/**
 * Copy de usuario para cada motivo de omisión. Recibe ÚNICAMENTE el motivo del catálogo cerrado del
 * backend: nunca compone texto a partir del `detalle` ni de ningún mensaje libre venido del servidor
 * (T-3.12-19). El `detalle` puede mostrarse aparte como texto plano, pero no se interpola aquí.
 *
 * El copy es ACCIONABLE —qué hacer ahora— en vez de una transliteración del enum.
 */
export function etiquetaMotivo(motivo: ComboMotivo): string {
  switch (motivo) {
    case "FUERA_DE_TURNO":
      return "Todavía no es su turno: falta la firma anterior de la secuencia (decisor → secretario → director).";
    case "YA_FIRMADO":
      return "Ya estaba firmada: esa firma se aplicó antes y no hace falta repetirla.";
    case "RECHAZADO":
      return "El lote fue rechazado: sus expedientes quedaron liberados y debe volver a sortearse.";
    case "CASOS_SIN_ACEPTAR":
      return "El decisor debe aceptar o excusarse de todos sus expedientes antes de que se pueda firmar.";
    case "SIN_CASOS_ACTIVOS":
      // Deliberadamente NO dice "ya firmada": nadie la firmó — es que no hay nada que firmar.
      return "Todos los expedientes de este sublote fueron excusados: no queda ninguno que firmar. Revise las excusas o vuelva a sortear esos expedientes.";
    case "EXCUSA_PENDIENTE":
      // No es "ya firmada" ni "fuera de turno": es que el CONTENIDO del acta aún puede cambiar.
      return "Este sublote tiene una excusa sin resolver, así que sus expedientes todavía pueden cambiar. El director debe aprobarla o rechazarla antes de firmar.";
    case "PAR_INEXISTENTE":
      return "Ese sublote ya no existe: actualice la bandeja y vuelva a seleccionarlo.";
    case "ERROR_ASIGNACIONES":
      return "El servicio de Asignaciones respondió con error: la firma no se aplicó localmente.";
    case "ERROR_INTERNO":
      return "Error interno al procesar esta acta: reintente y, si persiste, reporte el incidente.";
    case "FIRMA_FALLIDA":
      // D-10: la firma va ANTES del approve; si falla, ni se sella el acta ni se aprueba el lote.
      return "La firma digital no se aplicó: el acta no se firmó y su lote no se aprobó.";
    case "FIRMA_NO_INTENTADA":
      // D-20: el corte cubre la clave, la sesión, el certificado y el firmador caído, no solo la clave.
      return "No se intentó: la firma falló en un acta anterior de este mismo envío por una causa que afecta a todas (la clave, la sesión, el certificado o el servicio de firma), y repetirla habría fallado igual. Puede volver a enviarla cuando se resuelva.";
  }
}

/**
 * Copy de usuario para la CAUSA de un fallo de firma (UI-SPEC §10.9), la que viaja en
 * `omitido.causaFirma` con `FIRMA_FALLIDA` y `FIRMA_NO_INTENTADA`. El reporte la pinta en una línea
 * propia bajo el motivo.
 *
 * Mismo contrato que `etiquetaMotivo` (T-3.12-19): recibe ÚNICAMENTE el literal del catálogo cerrado
 * y nunca compone texto con el `detalle` del servidor ni con el mensaje del firmador. El `switch` es
 * exhaustivo: si el backend añade una causa y el espejo de `firmaCopy.ts` crece, TypeScript avisa aquí.
 *
 * Es una frase de DIAGNÓSTICO, no de acción: qué hacer ya lo dicen el motivo y el resumen.
 */
export function etiquetaCausaFirma(causa: CausaFirma): string {
  switch (causa) {
    case "CLAVE_INCORRECTA":
      return "La clave de firma no es correcta.";
    case "CERTIFICADO":
      return "Su firma electrónica no está registrada en el Auth central o está caducada.";
    case "SIN_SESION_CENTRAL":
      return "Su sesión no está abierta con el Auth central.";
    case "FALTA_CLAVE":
      return "No llegó la clave de firma.";
    case "FIRMADOR_NO_RESPONDE":
      return "El servicio de firma no respondió.";
    case "RESPUESTA_INVALIDA":
      return "El servicio de firma devolvió una respuesta que no se pudo verificar.";
    case "DOCUMENTO_NO_FIRMABLE":
      return "El acta no estaba lista para firmarse.";
  }
}
