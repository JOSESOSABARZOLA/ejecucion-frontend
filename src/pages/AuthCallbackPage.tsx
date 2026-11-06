/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 05
 * Feature: Ruta pública de retorno del portal de Auth central
 * Archivo: AuthCallbackPage.tsx
 * Responsabilidad: Recibir el código de un solo uso que Auth central deja en la query, canjearlo por
 *   la cookie de sesión del módulo EXACTAMENTE una vez, hidratar el perfil y aterrizar en el tablero
 *   reemplazando el historial (que es lo que borra el código de la URL, T-0311-22). Es ruta PÚBLICA:
 *   vive fuera del layout principal y fuera del guard, porque cuando se monta todavía no hay sesión.
 *   Un canje fallido informa y ofrece volver al portal; jamás se reintenta el mismo código (P-02).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../components/common/Loading";
import { useUser } from "../context/UserContext";
import { AuthSessionService } from "../services/AuthSessionService";
import { redirectToCentralAuthPortal } from "../config/authRuntimeConfig";

/** Destino tras un canje exitoso: el mismo aterrizaje que ya tenía el acceso local. */
const LANDING_PATH = "/home/dashboard";

const MISSING_CODE_MESSAGE =
  "El enlace de retorno no trae el código de acceso. Vuelve a ingresar desde el portal.";
const GENERIC_EXCHANGE_ERROR =
  "No se pudo validar el acceso. Vuelve a ingresar desde el portal.";

type CallbackStatus = "processing" | "error";

/**
 * Lee el código de un solo uso de la URL actual. Se lee de `window.location` y no del objeto que
 * devuelve `useSearchParams` porque ese objeto es inestable entre renders y volvería a disparar el
 * efecto del canje.
 * @returns el código, o null si el retorno no trae ninguno
 */
function readAuthorizationCode(): string | null {
  const code = new URLSearchParams(window.location.search).get("code");

  return code && code.trim() !== "" ? code : null;
}

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { hydrateSession } = useUser();

  // El código se captura UNA sola vez, en el primer render, y ya no cambia: si se releyera dentro
  // del efecto, la limpieza de la URL lo dejaría vacío en la siguiente pasada.
  const [code] = useState<string | null>(() => readAuthorizationCode());
  const [status, setStatus] = useState<CallbackStatus>(
    code ? "processing" : "error",
  );
  const [errorMessage, setErrorMessage] = useState<string>(
    code ? "" : MISSING_CODE_MESSAGE,
  );

  const exchangedRef = useRef(false);

  useEffect(() => {
    // PRIMERA sentencia del efecto: la guardia se comprueba y se arma de forma SÍNCRONA, antes de
    // cualquier `await`. Si se armara después del primer `await`, las dos pasadas del doble montaje
    // de efectos de desarrollo pasarían la guardia y el código —que es de un solo uso— se canjearía
    // dos veces: el segundo canje devuelve 401 y presenta como fallo un acceso que ya funcionó.
    if (exchangedRef.current) {
      return;
    }

    exchangedRef.current = true;

    if (!code) {
      // Sin código no hay nada que canjear; el estado de error ya quedó fijado en el primer render.
      return;
    }

    const exchangeCode = async () => {
      try {
        await AuthSessionService.exchange(code);
        // Un solo camino de hidratación en los dos modos: el perfil sale siempre de `/auth/me`.
        await hydrateSession();
        // El reemplazo del historial es lo que borra el código de la URL, y ocurre DESPUÉS del
        // canje: limpiarla antes rompería el flujo si hubiese un re-render intermedio.
        navigate(LANDING_PATH, { replace: true });
      } catch (error) {
        setErrorMessage(
          mensajeParaUsuario(error, GENERIC_EXCHANGE_ERROR),
        );
        setStatus("error");
      }
    };

    void exchangeCode();

    // NO hay cleanup que resetee `exchangedRef`: el doble montaje ejecuta el cleanup ENTRE las dos
    // pasadas, así que resetearlo ahí desarma la guardia justo antes de la segunda. Ese es el
    // defecto del precedente `providers/AlertProviderWrapper.tsx` (arma el ref y lo resetea en el
    // cleanup); no se copia. Tampoco vale `useState` como guardia: su actualización es asíncrona y
    // no bloquea la segunda invocación.
    //
    // Las dependencias son estables (el código es estado, `navigate` y `hydrateSession` están
    // memoizados), pero lo que impide el segundo canje es el ref, no la lista.
  }, [code, hydrateSession, navigate]);

  if (status === "processing") {
    return <Loading />;
  }

  return (
    <div className="app-auth-callback flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div className="app-auth-callback-card card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h1 className="card-title text-error">
            No se pudo completar el acceso
          </h1>
          <p className="text-base-content/80">{errorMessage}</p>
          <div className="card-actions mt-4">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => redirectToCentralAuthPortal()}
            >
              Volver al portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
