/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 04
 * Feature: Contexto de usuario y sesión
 * Archivo: UserContext.tsx
 * Responsabilidad: Ser la ÚNICA fuente de verdad de la sesión en el frontend. La sesión ya no se
 *   restaura del almacenamiento del navegador: al arrancar se le pregunta al backend
 *   (`GET /auth/mode` + `GET /auth/session`) y el perfil se hidrata SIEMPRE por `GET /auth/me`, igual
 *   en los dos modos de autenticación (D-01 / D-04). El estado de hidratación es explícito
 *   (`sessionState`), de modo que "todavía no sé" es distinguible de "no hay usuario": sin eso el
 *   guard expulsaría al usuario en el primer render aun teniendo cookie válida (P-06). Aquí NO se
 *   persiste nada privado —el perfil en `localStorage` era la fuga real entre usuarios de una máquina
 *   compartida (T-0311-16)— y al arrancar se borran de una vez las dos claves heredadas.
 * Desarrollador: Johan Freire / Andrés Miño (Fase 03.11)
 * Fecha: 2026-08-05
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: al cerrar sesión se vacía la caché
 *   del modo de firma, porque su `sesionCentral` es de la sesión del usuario — D-12).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-06: la caché del modo de firma se vacía
 *   también cuando el servidor da la sesión por muerta (401), al entrar con el login local y en cada
 *   hidratación de una sesión, no solo al cerrar sesión a mano.)
 */

import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import type { User, UserFromLogin } from "../interfaces/IUser";
import { authService } from "../services/AuthService";
import { AuthSessionService } from "../services/AuthSessionService";
import { registerUnauthorizedHandler } from "../api/httpClient";
import { getCentralAuthLogoutUrl } from "../config/authRuntimeConfig";
import { replaceLocation } from "../utils/navigation";
import { resetModoDeFirmaCache } from "../hooks/useClaveDeFirma";

/**
 * Estado de la sesión. `idle` es el instante previo al montaje del efecto de arranque; `hydrating`
 * es "todavía no sé" y NO significa "no hay usuario": quien confunda ambos echará de la app a un
 * usuario con cookie válida (P-06).
 */
export type SessionState = "idle" | "hydrating" | "authenticated" | "anonymous";

/**
 * Claves privadas que dejaron en el navegador las versiones anteriores de la app. El código nuevo no
 * las lee, pero siguen en disco en cada navegador que ya usó el módulo: se borran una sola vez al
 * arrancar (Q-11). La clave del tema NO está aquí a propósito: no es dato privado.
 */
const LEGACY_PRIVATE_STORAGE_KEYS = ["authToken", "userData"] as const;

interface UserContextProps {
  user: User | null;
  setUser: (user: User | null) => void;
  loginUser: (userFromLogin: UserFromLogin) => Promise<void>;
  logoutUser: () => Promise<void>;
  hydrateSession: () => Promise<void>;
  sessionState: SessionState;
  /** `null` mientras `GET /auth/mode` no ha resuelto. */
  authCentralEnabled: boolean | null;
  isLoggingOut: boolean;
  isLoading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

/**
 * Borra de una vez las claves privadas heredadas. Toda la lectura/escritura del almacenamiento del
 * navegador que le queda a este módulo son estos dos `removeItem`. Va defendido porque el
 * almacenamiento puede no existir (modo privado, políticas del navegador, entornos de test): que no
 * haya dónde borrar nunca puede impedir arrancar la sesión.
 */
function clearLegacyPrivateStorage(): void {
  try {
    const storage = window.localStorage;

    if (!storage) {
      return;
    }

    LEGACY_PRIVATE_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
  } catch {
    // Sin almacenamiento accesible no hay nada heredado que limpiar.
  }
}

export const UserProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [authCentralEnabled, setAuthCentralEnabled] = useState<boolean | null>(
    null,
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrappedRef = useRef(false);
  const logoutInFlightRef = useRef(false);

  /**
   * Hidrata el perfil de autorización desde `GET /auth/me`. Es el ÚNICO punto de hidratación del
   * perfil y sirve a los dos modos: el bootstrap, el login local y el callback del canje (Plan 05)
   * pasan todos por aquí, de modo que el shape que consumen el menú y los puntos de gating por rol y
   * actividades sale siempre del mismo sitio.
   */
  const hydrateSession = useCallback(async () => {
    // Una sesión (re)hidratada puede ser OTRA: el callback del Auth central o el login local en la
    // misma pestaña. El modo de firma cacheado dice si la sesión ANTERIOR era central (D-12) y no
    // puede heredarse; la siguiente superficie de firma vuelve a preguntarlo.
    resetModoDeFirmaCache();
    try {
      const profile = await AuthSessionService.getMe();

      setUser(profile);
      setSessionState("authenticated");
    } catch {
      setUser(null);
      setSessionState("anonymous");
    }
  }, []);

  /**
   * Arranque de la sesión: modo + ¿hay cookie? + perfil. Un solo efecto, una sola vez.
   */
  useEffect(() => {
    // Guardia contra el doble montaje de efectos de StrictMode. Se comprueba y se arma de forma
    // SÍNCRONA, antes de cualquier `await`: si se armara después del primer `await`, las dos
    // invocaciones de StrictMode pasarían la guardia y el bootstrap se ejecutaría dos veces.
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;

    clearLegacyPrivateStorage();
    setSessionState("hydrating");

    const bootstrap = async () => {
      try {
        const mode = await AuthSessionService.getMode();

        setAuthCentralEnabled(mode.authCentralEnabled);
      } catch {
        // Fallo cerrado: si no se puede PROBAR que el backend acepta el camino local, se asume
        // central. Ofrecer el formulario local por no haber podido preguntar sería el error caro.
        setAuthCentralEnabled(true);
      }

      try {
        await AuthSessionService.getSession();
      } catch {
        // Un 401 aquí es el camino normal del usuario anónimo (el backend lo devuelve por diseño y
        // el interceptor global excluye esta ruta de la reacción a 401): no se propaga.
        setUser(null);
        setSessionState("anonymous");

        return;
      }

      await hydrateSession();
    };

    void bootstrap();

    // NO hay cleanup que resetee `bootstrappedRef`: StrictMode ejecuta el cleanup ENTRE las dos
    // invocaciones del efecto, así que resetear el ref ahí desarma la guardia justo antes de la
    // segunda pasada y el bootstrap se duplica. Ese es el defecto que tiene hoy
    // `providers/AlertProviderWrapper.tsx` (arma el ref y lo resetea en el cleanup); no se copia.
  }, [hydrateSession]);

  /**
   * Reacción global a una sesión caída: el cliente HTTP avisa por aquí cuando el backend responde
   * 401 en una ruta que no es de sesión. El manejador SOLO limpia estado; no navega. La salida al
   * portal la decide el guard, que sabe distinguir "hidratando" de "anónimo": navegar desde
   * cualquier punto de la app convertiría un 401 esporádico en una expulsión (T-0311-18).
   */
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      setSessionState("anonymous");
      // La sesión murió sin pasar por `logoutUser`: su `sesionCentral` cacheada tampoco sobrevive.
      resetModoDeFirmaCache();
    });

    return () => {
      registerUnauthorizedHandler(() => {});
    };
  }, []);

  /**
   * Login con el formulario local (sólo disponible cuando el backend publica
   * `authCentralEnabled: false`). El backend emite la cookie de sesión; el cuerpo ya no trae token y
   * aquí no se persiste ni se lee credencial alguna. El perfil se toma de `GET /auth/me`, no del
   * cuerpo del login, para que haya un solo camino de hidratación en los dos modos (D-04).
   * @param userFromLogin credenciales del formulario
   */
  const loginUser = async (userFromLogin: UserFromLogin) => {
    setIsLoading(true);
    setError(null);
    // Login local sin recargar la página: nada de la sesión anterior se hereda, tampoco el modo de
    // firma (D-12). `hydrateSession` lo vuelve a vaciar; aquí cubre además un login que falla.
    resetModoDeFirmaCache();

    try {
      await authService.getUserAuthorization(userFromLogin);
      await hydrateSession();
    } catch (err) {
      const errorMessage =
        mensajeParaUsuario(err, "No se pudo iniciar la sesión. Inténtelo de nuevo.");

      setError(errorMessage);
      setUser(null);
      setSessionState("anonymous");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cierra la sesión. La cookie es HttpOnly: sólo el backend puede eliminarla, así que desde aquí no
   * se intenta borrarla. Pase lo que pase con la petición, el estado local queda limpio y el
   * navegador sale del módulo: dejar al usuario dentro con la sesión medio cerrada es peor que
   * cerrarla de más.
   */
  const logoutUser = async () => {
    // Guardia armada de forma síncrona: dos clics seguidos no pueden lanzar dos peticiones. No se
    // rearma en ningún momento porque el cierre termina SIEMPRE en navegación fuera de la app.
    if (logoutInFlightRef.current) {
      return;
    }

    logoutInFlightRef.current = true;
    setIsLoggingOut(true);

    try {
      await AuthSessionService.logout();
    } catch {
      // La sesión del navegador se limpia igual: si la petición falló, la cookie puede seguir viva
      // en el backend, pero mantener el perfil en pantalla sería mentirle al usuario.
    } finally {
      setUser(null);
      setSessionState("anonymous");
      // El modo de firma cacheado dice si ESTA sesión es central (D-12): no sobrevive al cierre, o
      // el siguiente usuario de la pestaña heredaría la respuesta del anterior.
      resetModoDeFirmaCache();
      // Modo local -> raíz de la app. En central (y también con el modo aún sin resolver, por el
      // mismo fallo cerrado del bootstrap) -> logout del portal, que es quien tiene la sesión madre.
      replaceLocation(
        authCentralEnabled === false ? "/" : getCentralAuthLogoutUrl(),
      );
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        loginUser,
        logoutUser,
        hydrateSession,
        sessionState,
        authCentralEnabled,
        isLoggingOut,
        isLoading,
        error,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextProps => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser debe usarse dentro de UserProvider");
  return context;
};
