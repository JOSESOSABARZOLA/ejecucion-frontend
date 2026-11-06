/**
 * Microservicio: resolucion
 * Módulo: Compartido
 * Feature: Configuración WebSocket
 * Archivo: socketConfig.ts
 * Responsabilidad: Expone opciones de configuración centralizadas para socket.io-client
 * Desarrollador: Johan Freire
 * Fecha: 2026-05-18
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: el sondeo de alertas pasa de 10 s a
 *   15 min; ver POLLING_CONFIG)
 */

import type { ManagerOptions } from "socket.io-client";
import { env } from "./env";

/**
 * Obtiene la URL del servidor socket.io
 * Derivada de apiBaseUrl: remueve /api si existe
 */
export const getSocketUrl = (): string => {
  const apiUrl = env.apiBaseUrl;
  // Si apiBaseUrl es /api (producción), usar root
  if (apiUrl === "/api") {
    return "/";
  }
  // Si es http://localhost:3000, devolver igual (socket.io automáticamente usa /socket.io)
  //   console.log("url del socket: ", apiUrl);

  return apiUrl;
};

type noProperties = "multiplex" | "parser";
/**
 * Opciones de configuración de socket.io con reintentos y reconexión automática
 */

export const getSocketConfig = (
  token: string | null = null,
): Omit<ManagerOptions, noProperties> & { auth: { token: string | null } } => ({
  path: "/socket.io",
  //   path: "/socket.io/socket.io.js",

  // Autenticación: token JWT en opciones de auth (socket.io lo envía en headers)
  auth: {
    token: token,
  },

  // Reconexión automática
  reconnection: true,
  reconnectionDelay: 1000, // Delay inicial en ms
  reconnectionDelayMax: 5000, // Delay máximo
  reconnectionAttempts: 5, // Intentos de reconexión
  randomizationFactor: 0.1, // Factor de variación para backoff

  // Timeouts
  timeout: 10000, // Timeout inicial de conexión

  // Transporte
  transports: ["websocket", "polling"], // Prioridad: WebSocket primero, luego polling como fallback

  // Otros
  autoConnect: false, // No conectar automáticamente al instanciar
  forceNew: false, // Reutilizar conexión existente si hay
});

/**
 * Configuración del sondeo HTTP de alertas (`GET /alert/unread`).
 *
 * Se usa cuando no hay WebSocket: siempre con la sesión central (el navegador no tiene token para
 * el handshake) y, en local, si el socket lleva más de `FALLBACK_THRESHOLD_MS` desconectado.
 *
 * `POLLING_INTERVAL_MS` = 15 MINUTOS (decisión del usuario, 2026-11-04, quick 261030-m29). Las
 * alertas de la campana son de plazos que se cuentan en DÍAS y el programador de plazos del backend
 * corre cada 15 min (`ALERTAS_PLAZOS_INTERVALO_MINUTOS`): consultar más seguido no puede traer nada
 * nuevo. Los 10 s de antes eran 360 peticiones por hora y por usuario sin nada que traer. Al iniciar
 * sesión se cargan igualmente las no leídas, así que nadie espera 15 min para ver las que ya tenía.
 */
export const POLLING_CONFIG = {
  FALLBACK_THRESHOLD_MS: 30 * 1000, // 30 segundos de desconexión antes de iniciar polling
  POLLING_INTERVAL_MS: 15 * 60 * 1000, // Sondeo cada 15 minutos (ver el comentario de arriba)
} as const;
