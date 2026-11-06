/**
 * Microservicio: resolucion
 * Módulo: Alertas
 * Feature: WebSocket para alertas en tiempo real
 * Archivo: AlertWebSocketService.ts
 * Responsabilidad: Gestiona conexión WebSocket de socket.io para alertas, con reintentos y fallback a polling HTTP
 * Desarrollador: Johan Freire
 * Fecha: 2026-05-18
 */

import { ErrorParaUsuario } from "../api/mensajeParaUsuario";
import { io, Socket } from "socket.io-client";
import type { IAlert } from "../interfaces/IAlert";
import {
  getSocketConfig,
  getSocketUrl,
  POLLING_CONFIG,
} from "../config/socketConfig";
// import { createCorrelationId } from "../api/correlationId";

/**
 * Callbacks que se ejecutan cuando hay eventos en WebSocket
 */
interface AlertWebSocketCallbacks {
  onAlertNew: (alert: IAlert) => void;
  onAlertRead: (userAlertId: number) => void;
  onDisconnect: () => void;
  onFallbackToPolling?: () => void;
}

/**
 * Service para manejar WebSocket de alertas
 * Pattern: Object-literal (sin clases)
 */
export const AlertWebSocketService = {
  socket: null as Socket | null,
  disconnectTime: null as number | null,
  pollingFallbackTimer: null as ReturnType<typeof setTimeout> | null,
  // correlationId: createCorrelationId(),

  /**
   * Conecta al servidor WebSocket y configura listeners
   */
  connect: async (
    userId: string,
    callbacks: AlertWebSocketCallbacks,
  ): Promise<Socket | null> => {
    try {
      // Obtener token desde localStorage (guardado por UserContext hasta la Fase 03.11)
      const token = localStorage.getItem("authToken") || null;

      // ── SIN TOKEN NO SE INTENTA EL HANDSHAKE ─────────────────────────────────────────────────
      // Desde la Fase 03.11 el frontend NO ve el JWT en ningún modo: el login emite una cookie
      // HttpOnly y `authToken` dejó de escribirse. El gateway exige `handshake.auth.token`, así que
      // conectar sin él es un rechazo garantizado — y con `reconnectionAttempts: 5` eran cinco
      // rechazos y diez avisos en el log del backend por cada carga de página, ocultando los avisos
      // que sí importan.
      //
      // Se va DIRECTO al polling HTTP, que es el camino que de verdad funciona hoy: viaja por
      // `httpClient` con la cookie de sesión. Las alertas siguen llegando; lo que no hay es empuje
      // en tiempo real.
      //
      // ⚠️ ESTO NO ARREGLA LAS ALERTAS, las deja de romper con ruido. El arreglo de fondo es que el
      // gateway lea la cookie de sesión en el handshake en vez del bearer, y eso es la integración
      // del módulo de alertas con la sesión por cookie — trabajo aparte por decisión del usuario
      // (D-03 de la Fase 03.11).
      if (!token) {
        console.info(
          "[AlertWebSocketService] Sin token en el navegador: no se abre el WebSocket. " +
            "Las alertas se sirven por HTTP (polling). La integración del socket con la sesión " +
            "por cookie es trabajo aparte.",
        );
        callbacks.onFallbackToPolling?.();
        return null;
      }

      const config = getSocketConfig(token);
      const socketUrl = getSocketUrl();

      // Crear instancia de socket
      AlertWebSocketService.socket = io(socketUrl, config);

      // Listeners de conexión
      AlertWebSocketService.socket.on("connect", () => {
        // console.log(
        //   `[AlertWebSocket:${AlertWebSocketService.correlationId}] Conectado exitosamente`,
        // );
        AlertWebSocketService.disconnectTime = null;

        // Parar polling si estaba activo
        if (AlertWebSocketService.pollingFallbackTimer) {
          clearTimeout(AlertWebSocketService.pollingFallbackTimer);
          AlertWebSocketService.pollingFallbackTimer = null;
          // console.log(
          //   `[AlertWebSocket:${AlertWebSocketService.correlationId}] Polling fallback detenido`,
          // );
        }

        // Emitir suscripción a alertas del usuario
        AlertWebSocketService.socket?.emit("subscribe-alerts", { userId });
      });

      // Listener de desconexión
      AlertWebSocketService.socket.on("disconnect", () => {
        // console.warn(
        //   `[AlertWebSocket:${AlertWebSocketService.correlationId}] Desconectado`,
        // );
        AlertWebSocketService.disconnectTime = Date.now();

        // Iniciar timer para fallback a polling
        AlertWebSocketService.pollingFallbackTimer = setTimeout(() => {
          // console.warn(
          //   `[AlertWebSocket:${AlertWebSocketService.correlationId}] Umbral de desconexión alcanzado (${POLLING_CONFIG.FALLBACK_THRESHOLD_MS}ms), iniciando polling HTTP fallback`,
          // );
          callbacks.onFallbackToPolling?.();
        }, POLLING_CONFIG.FALLBACK_THRESHOLD_MS);

        callbacks.onDisconnect();
      });

      // Listener: Nueva alerta
      AlertWebSocketService.socket.on("new-alert", (data: IAlert) => {
        // `[AlertWebSocket:${AlertWebSocketService.correlationId}] Nueva alerta recibida: ${data.ualeId}`,
        console.log(
          `[AlertWebSocketService] Nueva alerta recibida: ${data.ualeId}`,
        );
        console.log(data);

        callbacks.onAlertNew(data);
      });

      // Listener: Alerta marcada como leída
      AlertWebSocketService.socket.on(
        "alert:read",
        (data: { userAlertId: number }) => {
          console.log(
            `[AlertWebSocket] Alerta marcada como leída: ${data.userAlertId}`,
          );
          callbacks.onAlertRead(data.userAlertId);
        },
      );

      // Listener de errores
      AlertWebSocketService.socket.on("connect_error", (error: Error) => {
        console.error(`[AlertWebSocket:] Error de conexión:`, error.message);
      });

      // Conectar
      AlertWebSocketService.socket.connect();

      return AlertWebSocketService.socket;
    } catch (error) {
      // El detalle técnico va a la consola; al usuario le llega una frase genérica en castellano.
      console.error("[AlertWebSocket] No se pudo conectar:", error);
      throw new ErrorParaUsuario(
        "No se pudieron activar los avisos en tiempo real. Se consultarán cada cierto tiempo.",
      );
    }
  },

  /**
   * Desconecta del WebSocket y limpia listeners
   */
  disconnect: (): void => {
    // console.log(
    //   `[AlertWebSocket:${AlertWebSocketService.correlationId}] Desconectando WebSocket`,
    // );

    if (AlertWebSocketService.pollingFallbackTimer) {
      clearTimeout(AlertWebSocketService.pollingFallbackTimer);
      AlertWebSocketService.pollingFallbackTimer = null;
    }

    if (AlertWebSocketService.socket) {
      AlertWebSocketService.socket.disconnect();
      AlertWebSocketService.socket = null;
    }
  },

  /**
   * Reconecta manualmente
   */
  reconnect: (): void => {
    // console.log(
    //   `[AlertWebSocket:${AlertWebSocketService.correlationId}] Reconectando WebSocket manualmente`,
    // );

    if (AlertWebSocketService.socket) {
      AlertWebSocketService.socket.connect();
    }
  },

  /**
   * Verifica si está conectado
   */
  isConnected: (): boolean => {
    return AlertWebSocketService.socket?.connected ?? false;
  },

  /**
   * Emite evento personalizado (ej. para marcar alerta como leída)
   */
  emit: (event: string, data: unknown): void => {
    if (AlertWebSocketService.socket?.connected) {
      AlertWebSocketService.socket.emit(event, data);
    }
  },
};
