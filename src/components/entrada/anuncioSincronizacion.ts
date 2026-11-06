/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: La línea de estado no anuncia el reloj (Fase 03.24, Plan 18, G-16)
 * Archivo: anuncioSincronizacion.ts
 * Responsabilidad: Decidir qué se le anuncia al lector de pantalla cuando cambia el resultado de la
 *   sincronización con Resolución (UI-SPEC §4.2 y §6.5). Es una función pura: recibe el último
 *   resultado TERMINADO que vio la línea y el estado nuevo, y devuelve el texto o null.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 *
 * ── 🔴 SE COMPARA EL RESULTADO, NUNCA EL RELOJ ────────────────────────────────────────────────
 * Antes la línea entera era `role="status"` y el lector repetía «hace N minutos» cada minuto. Aquí
 * solo cuenta el `resultado`: ni el «hace N», ni el `fin` de una pasada nueva con el mismo resultado,
 * ni «Sincronizando…» son novedad. La primera lectura tampoco: lo que ya estaba al abrir la página
 * no es un cambio.
 */
import type {
  EstadoSincronizacionResolucion,
  ResultadoSincronizacion,
} from "../../services/EntradaLotesService";

/** El resultado vuelve a CORRECTA desde PARCIAL o FALLIDA. */
export const ANUNCIO_RECUPERADA = "La sincronización vuelve a ser correcta.";

/** El resultado pasa a FALLIDA. El motivo llega saneado por el servidor (T-03.24-71). */
export const anuncioFallida = (motivo: string | null): string =>
  motivo
    ? `La última sincronización falló: ${motivo}.`
    : "La última sincronización falló.";

/**
 * El resultado pasa a PARCIAL. Sin fallos contados (la pasada se quedó corta de páginas), la línea
 * visible dice «incompleta», y el anuncio dice lo mismo en vez de «0 fallo(s)».
 */
export const anuncioParcial = (fallosTotales: number): string =>
  fallosTotales > 0
    ? `La última sincronización terminó con ${fallosTotales} fallo(s).`
    : "La última sincronización quedó incompleta.";

/**
 * Lo que hay que anunciar al pasar de `anterior` a `estado`, o null si no hay nada que decir.
 *
 * @param anterior último resultado TERMINADO que vio la línea; null si todavía no vio ninguno.
 * @param estado el estado que acaba de mandar el servidor.
 * @returns el texto del anuncio, o null en la primera lectura, con el mismo resultado, mientras corre
 *   una pasada o sin pasadas.
 */
export const anuncioDelCambio = (
  anterior: ResultadoSincronizacion | null,
  estado: EstadoSincronizacionResolucion,
): string | null => {
  if (estado.enCurso || estado.resultado === "NUNCA") return null;
  if (anterior === null || anterior === "NUNCA") return null;
  if (anterior === estado.resultado) return null;

  switch (estado.resultado) {
    case "FALLIDA":
      return anuncioFallida(estado.motivo);
    case "PARCIAL":
      return anuncioParcial(estado.fallosTotales);
    case "CORRECTA":
      return ANUNCIO_RECUPERADA;
    default:
      return null;
  }
};
