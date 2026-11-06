/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: La Bandeja se entera de lo que trajo la pasada (Fase 03.24, Plan 18, G-13)
 * Archivo: datosNuevos.ts
 * Responsabilidad: Decir si una pasada de la sincronización con Resolución trajo datos que cambian la
 *   Bandeja de Entrada (UI-SPEC §3.1) y guardar los textos del aviso y de sus anuncios (§6.4).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-21
 *
 * ── LA REGLA NO SE RECALCULA ──────────────────────────────────────────────────────────────────
 * Se leen las cifras que mandó el servidor. Los `lotes` solos no cuentan: lo que cambia la lista son
 * los casos nuevos, los actualizados y los reingresados.
 */
import type { EstadoSincronizacionResolucion } from "../../services/EntradaLotesService";

/** El aviso, en la cabecera, cuando no es seguro recargar solo. */
export const AVISO_DATOS_NUEVOS = "Hay datos nuevos de Resolución";
/** El botón del aviso: hace lo mismo que «Actualizar». */
export const BOTON_RECARGAR = "Recargar";
/** Anuncio para el lector de pantalla cuando la bandeja se recargó sola. */
export const ANUNCIO_RECARGA_SOLA =
  "Llegaron datos nuevos de Resolución y la bandeja se actualizó.";
/** Anuncio para el lector de pantalla cuando sale el aviso. */
export const ANUNCIO_CON_AVISO =
  "Llegaron datos nuevos de Resolución. Pulse «Recargar» para verlos.";

/** ¿La pasada trajo casos nuevos, actualizados o reingresados? */
export const trajoDatos = (estado: EstadoSincronizacionResolucion): boolean =>
  estado.casosNuevos + estado.casosActualizados + estado.reingresados > 0;

/** El `title` del aviso: las tres cifras de la pasada. */
export const tituloDatosNuevos = (
  estado: EstadoSincronizacionResolucion,
): string =>
  `La última sincronización trajo ${estado.casosNuevos} caso(s) nuevo(s), ${estado.casosActualizados} actualizado(s) y ${estado.reingresados} reingresado(s).`;
