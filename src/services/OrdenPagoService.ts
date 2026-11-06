/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/ordenes-pago (frontend)
 * Feature: Bandeja de órdenes de pago (2026-09-03)
 * Archivo: OrdenPagoService.ts
 * Responsabilidad: Consumir `/ordenes-pago`. El actor NUNCA viaja en el cuerpo —lo deriva el backend
 *   del JWT— y `editable` llega calculado por el servidor: la pantalla no reimplementa la regla de
 *   pertenencia, la obedece.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-03
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 04 — D-01: la bandeja APARTE se retira.
 *   El cliente NO se recorta: `bandeja()` se queda marcada con quién era su llamador, por qué sigue
 *   aquí y la condición exacta para borrarla; `registrar`, `anular` e `historial` conservan sus
 *   llamadores vivos en «Mis Expedientes», en el modal de providencia y en la línea de tiempo.)
 */
import httpClient from "../api/httpClient";
import type { ObligacionHacerEnBandeja } from "../interfaces/IObligacionHacer";

/** Qué se paga con esta orden. Espeja `TipoOrdenPago` del backend. */
export type TipoOrdenPago = "MULTA" | "REMANENTE";

/** REGISTRADA la teclea el decisor; PAGADA la escribirá Tesorería cuando su seam se encienda. */
export type EstadoOrdenPago = "REGISTRADA" | "PAGADA";

/** Campo contra el que busca el cuadro de texto (espeja el selector del sistema que se migra). */
export type CampoBusquedaOrdenPago =
  "TODOS" | "EXPEDIENTE" | "ADMINISTRADO" | "NUMERO";

/** PENDIENTE = sin orden vigente de la multa; es la columna «Pendiente crear orden para pago». */
export type FiltroEstadoOrdenPago =
  "TODOS" | "PENDIENTE" | "REGISTRADA" | "PAGADA";

export interface OrdenPago {
  ordpId: number;
  eejeId: number;
  tipo: TipoOrdenPago;
  numero: string;
  estado: EstadoOrdenPago;
  registradaAt: string;
  registradaBy: number;
  registradaPor?: string;
  anuladaAt?: string;
  anuladaBy?: number;
  anuladaMotivo?: string;
}

/** Una fila de la bandeja: el expediente con sus dos órdenes vigentes. */
export interface FilaBandejaOrdenPago {
  eejeId: number;
  expNumber?: string;
  administrado?: string;
  materia?: string;
  eejeStatus: string;
  multaImpuesta?: number;
  multa?: OrdenPago;
  remanente?: OrdenPago;

  /**
   * EL CORRECTIVO, junto a la pecuniaria. Espeja `FilaBandejaOrdenPago.obligacionHacer` del backend
   * (`ordenes-pago/interfaces/orden-pago.interface.ts`).
   *
   * 🔴 2026-09-15 — ESTE CAMPO YA VIAJABA Y SE ESTABA TIRANDO. Ésta es la QUINTA superficie que lo
   * lleva (CH-5, decisión del área usuaria del 2026-09-09): el repositorio de órdenes usa los
   * MISMOS fragmentos de `obligacion-hacer.sql.ts` que las otras cuatro bandejas, así que el bloque
   * llega por la red y `httpClient` lo entrega intacto. Faltaba esta línea. Aquí importa por partida
   * doble: quien cobra necesita ver si el expediente arrastra correctivo pendiente, y la ejecución
   * sustitutoria genera DEUDA NUEVA (art. 239) sobre un expediente que ya pagó su multa.
   *
   * ⚠️ OPCIONAL DE VERDAD: un expediente sin correctivo no trae el bloque.
   *
   * 🔴 NO TRAE EL PELDAÑO (`PeldanoCompulsorio`): sólo viaja en `GET /obligacion-hacer/:eejeId`.
   * Una condición sobre él es INDECIDIBLE en una fila, y lo indecidible se apaga.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;

  /** Lo decide el SERVIDOR (es el decisor asignado). La pantalla solo lo obedece. */
  editable: boolean;
}

export interface BandejaOrdenesPago {
  filas: FilaBandejaOrdenPago[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ConsultaBandejaOrdenesPago {
  campo?: CampoBusquedaOrdenPago;
  q?: string;
  estado?: FiltroEstadoOrdenPago;
  pagina?: number;
  limite?: number;
}

export const OrdenPagoService = {
  /**
   * La bandeja → GET /ordenes-pago/bandeja. Los parámetros vacíos NO se mandan: un `q=` vacío en la
   * URL haría que el backend filtrara por la cadena vacía y no por «sin filtro».
   *
   * ── 🔴 HOY NO TIENE NINGÚN LLAMADOR, Y NO ES UN DESCUIDO ──────────────────────────────────────
   * Su único llamador era la pantalla aparte de órdenes de pago, que la Fase 03.22 / Plan 04 retiró
   * (D-01): el número se teclea ahora dentro de «Mis Expedientes», que es la bandeja propia del
   * decisor, y `GET /sorteo/mis-asignados` ya trae las dos órdenes vigentes por fila.
   *
   * ── POR QUÉ SE CONSERVA ──────────────────────────────────────────────────────────────────────
   * 1. El endpoint sigue VIVO y grant-eado a los tres roles operativos en el backend. Esa fase
   *    retira la SUPERFICIE, no el permiso (D-03): `GET /ordenes-pago/bandeja` sigue respondiendo
   *    200 al secretario abogado, al director y al decisor, y eso es correcto.
   * 2. «Una vista de cobertura de pagos para el secretario abogado y el director» es un DIFERIDO
   *    NOMBRADO de la Fase 03.22: se descartó para esta fase, no para siempre. Si el área la pide,
   *    es fase propia — y empezarla reescribiendo un cliente que hoy tiene 3 pruebas verdes, y que
   *    el `AGENTS.md` de este repo obliga a escribir así porque prohíbe `axios` directo, sería
   *    trabajo tirado.
   *
   * ── CONDICIÓN EXACTA DE BORRADO ──────────────────────────────────────────────────────────────
   * Si ese diferido se descarta DEFINITIVAMENTE, este método se va —y no solo él— junto con
   * `FilaBandejaOrdenPago`, `BandejaOrdenesPago`, `ConsultaBandejaOrdenesPago`,
   * `CampoBusquedaOrdenPago`, `FiltroEstadoOrdenPago` y sus 3 pruebas de `OrdenPagoService.test.ts`.
   * Mientras tanto, `registrar`, `anular` e `historial` SÍ tienen llamadores vivos (`CeldaOrden`,
   * `OrdenesPagoCabecera` y la línea de tiempo del expediente) y no comparten esta nota.
   */
  async bandeja(
    consulta: ConsultaBandejaOrdenesPago = {},
  ): Promise<BandejaOrdenesPago> {
    const params = new URLSearchParams();
    if (consulta.campo) params.set("campo", consulta.campo);
    if (consulta.q?.trim()) params.set("q", consulta.q.trim());
    if (consulta.estado) params.set("estado", consulta.estado);
    if (consulta.pagina) params.set("pagina", String(consulta.pagina));
    if (consulta.limite) params.set("limite", String(consulta.limite));

    const { data } = await httpClient.get<BandejaOrdenesPago>(
      `/ordenes-pago/bandeja?${params.toString()}`,
    );
    return data;
  },

  /**
   * Registra el número → POST /ordenes-pago. Solo el decisor del expediente; el backend lo comprueba
   * con el guard de pertenencia, así que un `editable` mal calculado aquí no abre nada.
   */
  async registrar(
    eejeId: number,
    tipo: TipoOrdenPago,
    numero: string,
  ): Promise<OrdenPago> {
    const { data } = await httpClient.post<OrdenPago>("/ordenes-pago", {
      eejeId,
      tipo,
      numero,
    });
    return data;
  },

  /** Anula una orden con su motivo → PATCH /ordenes-pago/:ordpId/anular. Nunca se borra. */
  async anular(ordpId: number, motivo: string): Promise<void> {
    await httpClient.patch(`/ordenes-pago/${ordpId}/anular`, { motivo });
  },

  /** El historial del expediente, anuladas incluidas → GET /ordenes-pago/:eejeId/historial. */
  async historial(eejeId: number): Promise<OrdenPago[]> {
    const { data } = await httpClient.get<OrdenPago[]>(
      `/ordenes-pago/${eejeId}/historial`,
    );
    return data;
  },
};

export default OrdenPagoService;
