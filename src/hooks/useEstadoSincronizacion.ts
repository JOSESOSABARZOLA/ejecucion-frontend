/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: Estado de la sincronización automática con Resolución (Fase 03.24, Plan 07, D-13)
 * Archivo: useEstadoSincronizacion.ts
 * Responsabilidad: Leer GET /entrada-lotes/sincronizacion al montar la Bandeja de Entrada y volver a
 *   leerlo cada minuto mientras la página esté abierta, para que la línea «hace N minutos» no mienta
 *   y para que se entere de las pasadas nuevas sin recargar. No decide nada: entrega el estado tal
 *   como lo manda el servidor, o null si todavía no llegó o si la consulta falló.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 *
 * ── 🔴 UN ERROR NO SE PROPAGA ─────────────────────────────────────────────────────────────────
 * La línea de estado es informativa. Si el endpoint falla (backend sin el Plan 13, un 403, la red),
 * el estado vuelve a null y la línea simplemente no se pinta: tumbar la Bandeja de Entrada —o
 * llenarla de avisos— por no poder contar la última sincronización sería peor que no contarla.
 *
 * ── EL TEMPORIZADOR ───────────────────────────────────────────────────────────────────────────
 * Un `setInterval` por montaje, apagado en el cleanup. La bandera `vigente` evita escribir el estado
 * cuando una respuesta llega después de desmontar. Coste: una petición por minuto y pestaña abierta,
 * contra un endpoint que lee memoria del proceso (T-03.24-25, aceptado).
 */
import { useEffect, useState } from "react";
import {
  EntradaLotesService,
  type EstadoSincronizacionResolucion,
} from "../services/EntradaLotesService";

/** Cada cuánto se vuelve a leer el estado: un minuto, la resolución de «hace N minutos». */
export const INTERVALO_REFRESCO_SINCRONIZACION_MS = 60_000;

/**
 * Estado de la última sincronización con Resolución, refrescado solo.
 *
 * @param opciones.intervaloMs cada cuánto se vuelve a consultar (60 s por defecto).
 * @returns el estado que mandó el servidor, o null mientras no llegue o si la consulta falló.
 */
export function useEstadoSincronizacion(
  opciones: { intervaloMs?: number } = {},
): EstadoSincronizacionResolucion | null {
  const intervaloMs =
    opciones.intervaloMs ?? INTERVALO_REFRESCO_SINCRONIZACION_MS;
  const [estado, setEstado] = useState<EstadoSincronizacionResolucion | null>(
    null,
  );

  useEffect(() => {
    let vigente = true;

    const consultar = () => {
      EntradaLotesService.estadoSincronizacion()
        .then((nuevo) => {
          if (vigente) setEstado(nuevo);
        })
        .catch(() => {
          if (vigente) setEstado(null);
        });
    };

    consultar();
    const temporizador = setInterval(consultar, intervaloMs);

    return () => {
      vigente = false;
      clearInterval(temporizador);
    };
  }, [intervaloMs]);

  return estado;
}
