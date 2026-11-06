/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Progreso de sorteo de un LOTE de entrada, derivado del estado de sus casos
 * Archivo: loteSorteoProgreso.ts
 * Responsabilidad: Decidir, dado el conjunto de casos de un lote, CUÁNTOS siguen pendientes de
 *   sortearse. El sorteo POR CASO no avanza `envl_status` (la reconciliación del backend lo hace
 *   aparte y puede quedarse atrás), así que la Bandeja de Entrada deriva el badge y el gate del
 *   botón «Aprobar y enviar a sorteo» de los HECHOS de cada caso, no del estado del lote.
 *
 *   🔴 POR QUÉ SE DERIVA POR NEGACIÓN, Y NO ENUMERANDO ESTADOS DE DESTINO
 *   La versión anterior contaba un caso como sorteado solo si su EPAS estaba EXACTAMENTE en
 *   `SORTEADO` o `ASIGNADO_DECISOR`. Como el EPAS sigue avanzando —`EN_VERIFICACION_PAGO`,
 *   `EN_TRABAJO_COMUNITARIO`, `PENDIENTE_COACTIVA`, `CUMPLIDO`, `ARCHIVADO`, `EN_IMPUGNACION`—, en
 *   cuanto un caso pasaba de `ASIGNADO_DECISOR` dejaba de contarse y el lote RETROCEDÍA de
 *   «En Sorteo» a «Por sortear». El secretario veía como pendientes lotes ya sorteados cuyos casos
 *   estaban en otras instancias, y el botón de enviar a sorteo VOLVÍA a ofrecerse sobre ellos.
 *
 *   La cuenta correcta es por NEGACIÓN: pendiente es solo lo que TODAVÍA puede sortearse, es decir
 *   los dos estados PREVIOS al sorteo (`RECIBIDO`, `VERIFICADO`) y los casos aún sin aterrizar. Así
 *   la cuenta es MONÓTONA: ningún estado que se agregue al grafo en el futuro puede volver a romperla.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-28
 */

import type { EnvioLoteCaso } from "../services/EntradaLotesService";

/**
 * Estados PREVIOS al sorteo: son los únicos desde los que `SORTEAR` sigue siendo posible
 * (`epas-transitions.config.ts`). Un caso en cualquiera de ellos está PENDIENTE.
 */
export const ESTADOS_PENDIENTES_DE_SORTEO: ReadonlySet<string> = new Set([
  "RECIBIDO",
  "VERIFICADO",
]);

/**
 * Terminal alterno: el caso se devolvió a la DMR y NUNCA va a sortearse. No es pendiente (no bloquea
 * al lote) pero tampoco es sorteado (no se puede presentar como «En Sorteo»). Cuenta aparte.
 */
export const ESTADO_DESCARTADO = "DEVUELTO_DMR";

/** Desglose de los casos de un lote según su situación frente al sorteo. */
export interface ProgresoSorteo {
  /** Todos los casos del lote. */
  total: number;
  /** Aún pueden sortearse: `RECIBIDO`, `VERIFICADO`, o todavía sin aterrizar (sin `eejeStatus`). */
  pendientes: number;
  /** Ya salieron del sorteo: cualquier estado posterior, presente o futuro. */
  sorteados: number;
  /** Devueltos a la DMR: nunca se sortearán. */
  descartados: number;
}

/**
 * Clasifica los casos de un lote frente al sorteo.
 *
 * Un caso SIN `eejeStatus` (aún no aterrizado como EPAS local) se cuenta como PENDIENTE: no se puede
 * sortear lo que todavía no existe, y presentar el lote como completo escondería trabajo real.
 *
 * @param casos casos del lote (`lote.casos`), tal como los hidrata el backend.
 */
export function contarProgresoSorteo(
  casos: readonly EnvioLoteCaso[],
): ProgresoSorteo {
  let pendientes = 0;
  let sorteados = 0;
  let descartados = 0;

  for (const caso of casos) {
    const estado = caso.eejeStatus;

    if (estado == null || ESTADOS_PENDIENTES_DE_SORTEO.has(estado)) {
      pendientes++;
    } else if (estado === ESTADO_DESCARTADO) {
      descartados++;
    } else {
      sorteados++;
    }
  }

  return { total: casos.length, pendientes, sorteados, descartados };
}

/**
 * ¿Ya no queda nada por sortear en este lote? Es el gate del botón «Aprobar y enviar a sorteo»:
 * con cero pendientes no hay nada que enviar, y ofrecerlo dispara un sorteo externo que el backend
 * va a rechazar después de haber creado el master en Asignaciones.
 *
 * Un lote sin casos devuelve `false`: no está completo, está vacío.
 */
export function noQuedaNadaPorSortear(progreso: ProgresoSorteo): boolean {
  return progreso.total > 0 && progreso.pendientes === 0;
}

/**
 * ¿El lote debe presentarse como «En Sorteo» pese a que su `envl_status` siga en `APROBADO`?
 * Solo si no queda nada pendiente Y al menos un caso llegó de verdad al sorteo: un lote cuyos casos
 * se devolvieron todos a la DMR no está «En Sorteo».
 */
export function seMuestraEnSorteo(progreso: ProgresoSorteo): boolean {
  return noQuedaNadaPorSortear(progreso) && progreso.sorteados > 0;
}
