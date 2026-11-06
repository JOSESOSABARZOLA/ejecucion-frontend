/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: Provider orquestador de alertas
 * Archivo: AlertProviderWrapper.tsx
 * Responsabilidad: Orquestar carga inicial, WebSocket, fallback a polling y sincronización de estado.
 *   · Modo LOCAL: carga inicial + WebSocket, y sondeo HTTP si el socket no está.
 *   · Modo CENTRAL (sesión por cookie): carga inicial + sondeo HTTP directo, SIN intentar el socket.
 *   · Modo aún sin resolver (`null`): nada (fallo cerrado, como el bootstrap, el guard y la raíz).
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29, D-CANAL: REVISA la D-03 de la Fase
 *   03.11. En modo central el módulo ya no queda inerte: sin esto la campana del 127 no enseña
 *   ninguna alerta de plazo. El sondeo usa la cookie de sesión por `httpClient`; el riesgo P-08 —un
 *   401 del sondeo expulsa al usuario— solo se da con la sesión ya caída, igual que con cualquier
 *   otra petición. El handshake del socket por cookie sigue fuera de alcance.)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: el sondeo va cada 15 min, ver
 *   `POLLING_CONFIG`; y no arranca un segundo intervalo si ya hay uno)
 */

import {
  ErrorParaUsuario,
  mensajeParaUsuario,
} from "../api/mensajeParaUsuario";
import { type FC, type ReactNode, useContext, useEffect, useRef } from "react";
import { AlertContext } from "../context/AlertContext";
// import { UserContext } from "../context/UserContext";
import { AlertService } from "../services/AlertService";
import { AlertWebSocketService } from "../services/AlertWebSocketService";
import { POLLING_CONFIG } from "../config/socketConfig";
import { useUser } from "../context/UserContext";

interface AlertProviderWrapperProps {
  children: ReactNode;
}

/**
 * Provider que gestiona la sincronización de alertas
 * Debe ser envuelto dentro de UserProvider (depende de userId)
 */
export const AlertProviderWrapper: FC<AlertProviderWrapperProps> = ({
  children,
}) => {
  const alertContext = useContext(AlertContext);
  const { user, authCentralEnabled } = useUser();

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isInitializedRef = useRef(false);

  if (!alertContext) {
    throw new Error("AlertProviderWrapper debe estar dentro de AlertProvider");
  }

  const {
    setAlerts,
    setTotalAlerts,
    setIsConnected,
    setIsLoading,
    setConnectionStatus,
    setError,
    addAlert,
    markAlertAsRead,
  } = alertContext;

  /**
   * Carga alertas iniciales desde HTTP
   */
  const loadAlertsInitial = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[AlertProvider] Cargando alertas iniciales");
      const response = await AlertService.getUnreadAlerts();
      setAlerts(response.alerts);
      setTotalAlerts(response.totalAlerts);
      setError(null);
    } catch (err) {
      console.error("[AlertProvider] Error al cargar alertas iniciales:", err);
      setError(
        new ErrorParaUsuario(
          mensajeParaUsuario(err, "No se pudieron cargar los avisos."),
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Inicia el sondeo HTTP: en modo central desde el principio y, en local, cuando el WebSocket lleva
   * más de 30 s desconectado. Un segundo aviso de «cae al sondeo» no crea un segundo intervalo.
   */
  const startPollingFallback = () => {
    if (pollingIntervalRef.current) {
      return;
    }
    console.log(
      `[AlertProvider] Iniciando polling fallback (cada ${POLLING_CONFIG.POLLING_INTERVAL_MS}ms)`,
    );
    setConnectionStatus("polling");

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await AlertService.getUnreadAlerts();
        setAlerts(response.alerts);
        setTotalAlerts(response.totalAlerts);
      } catch (err) {
        console.error("[AlertProvider] Error en polling fallback:", err);
      }
    }, POLLING_CONFIG.POLLING_INTERVAL_MS);
  };

  /**
   * Detiene polling HTTP fallback
   */
  const stopPollingFallback = () => {
    if (pollingIntervalRef.current) {
      console.log("[AlertProvider] Deteniendo polling fallback");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  /**
   * Efecto principal: carga inicial + conexión WebSocket
   */
  useEffect(() => {
    // No inicializar si no hay usuario
    if (!user) {
      console.log("[AlertProvider] Esperando usuario autenticado");
      return;
    }

    // Modo aún sin resolver (`null`): no se inicializa nada. Mismo fallo cerrado que aplican el
    // bootstrap, el logout, el guard y la raíz; cuando el modo se resuelva, el efecto vuelve a
    // correr por la dependencia `authCentralEnabled`.
    if (authCentralEnabled === null) {
      console.log("[AlertProvider] Modo de autenticación sin resolver");
      return;
    }

    // Evitar inicialización múltiple
    if (isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;
    const userId = String(user.usuId);

    // ── MODO CENTRAL: SONDEO HTTP, SIN SOCKET (quick 261030-m29, D-CANAL) ──────────────────────
    // REVISA la D-03 de la Fase 03.11, que dejaba aquí el módulo inerte. Sin alertas en central la
    // campana del 127 no enseñaría ningún aviso de plazo, que es para lo que existe.
    // · El socket no se intenta: el navegador no tiene token y el gateway exige
    //   `handshake.auth.token`. Leer la cookie en el handshake sigue siendo trabajo aparte.
    // · El sondeo viaja por `httpClient` con la cookie de sesión. El riesgo P-08 (un 401 del sondeo
    //   dispara la reacción global y expulsa al usuario) solo se da con la sesión YA caída, igual
    //   que con cualquier otra petición de la app: con la sesión viva el sondeo responde 200.
    // · El intervalo se arma ANTES de la carga y de forma síncrona, para que la limpieza del efecto
    //   lo encuentre siempre (una carga lenta no puede dejar un intervalo huérfano tras desmontar).
    if (authCentralEnabled === true) {
      setIsConnected(false);
      startPollingFallback();
      void loadAlertsInitial();

      return () => {
        console.log("[AlertProvider] Limpiando recursos");
        stopPollingFallback();
        isInitializedRef.current = false;
      };
    }

    (async () => {
      try {
        // Paso 1: Cargar alertas iniciales desde HTTP
        await loadAlertsInitial();

        // Paso 2: Conectar WebSocket
        const socket = await AlertWebSocketService.connect(userId, {
          onAlertNew: (alert) => {
            console.log("[AlertProvider] Nueva alerta recibida:", alert.ualeId);
            addAlert(alert);
          },

          onAlertRead: (userAlertId) => {
            console.log(
              "[AlertProvider] Alerta marcada como leída:",
              userAlertId,
            );
            // markAlertAsRead(userAlertId);
          },

          onDisconnect: () => {
            console.log("[AlertProvider] WebSocket desconectado");
            setIsConnected(false);
          },

          onFallbackToPolling: () => {
            console.log("[AlertProvider] Activando fallback a polling HTTP");
            startPollingFallback();
          },
        });

        // `connect` devuelve null cuando no hay token en el navegador: no se abrió ningún socket y
        // las alertas van por polling. Marcar "connected" ahí sería mentir sobre el estado que la UI
        // muestra — y el propio servicio ya activó el fallback.
        if (socket) {
          setIsConnected(true);
          setConnectionStatus("connected");
          console.log("[AlertProvider] AlertWebSocketService conectado");
        } else {
          setIsConnected(false);
          setConnectionStatus("polling");
        }
      } catch (err) {
        console.error("[AlertProvider] Error en inicialización:", err);
        setError(
          new ErrorParaUsuario(
            mensajeParaUsuario(
              err,
              "No se pudieron activar los avisos en tiempo real.",
            ),
          ),
        );
        // Fallback inmediato a polling
        startPollingFallback();
      }
    })();

    // Cleanup: Desconectar WebSocket y parar polling al desmontar
    return () => {
      console.log("[AlertProvider] Limpiando recursos");
      AlertWebSocketService.disconnect();
      stopPollingFallback();
      isInitializedRef.current = false;
    };
  }, [
    user,
    // Sin esta dependencia, cuando `GET /auth/mode` resuelve DESPUÉS del primer render el efecto no
    // vuelve a correr y las alertas no arrancarían nunca (ni en local ni en central). Verificado con
    // un test negativo: al quitarla, los casos "el modo se resuelve … después del primer render"
    // FALLAN.
    authCentralEnabled,
    setAlerts,
    setTotalAlerts,
    setIsConnected,
    setConnectionStatus,
    setError,
    addAlert,
    markAlertAsRead,
    setIsLoading,
  ]);

  return children;
};
