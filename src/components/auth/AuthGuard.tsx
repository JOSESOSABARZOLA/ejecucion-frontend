/**
 * Microservicio: ejecucion
 * Módulo: Auth central (frontend) — Fase 03.11 / Plan 05
 * Feature: Guard de las rutas privadas
 * Archivo: AuthGuard.tsx
 * Responsabilidad: Ser el ÚNICO punto de control de acceso del subárbol privado `/home/*`. Lee el
 *   estado de sesión del contexto y decide: mientras la sesión se hidrata muestra carga y NO navega
 *   —redirigir desde ahí es una salida DURA e incancelable de la SPA que echaría a un usuario con
 *   cookie válida en el primer render (P-06)—; con sesión viva deja pasar a los hijos; sin sesión
 *   deriva al portal de Auth central (modo central) o a la raíz de la app (modo local explícito).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { useEffect, useRef, type FC, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Loading from "../common/Loading";
import { useUser } from "../../context/UserContext";
import { redirectToCentralAuthPortal } from "../../config/authRuntimeConfig";

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard: FC<AuthGuardProps> = ({ children }) => {
  const { sessionState, authCentralEnabled } = useUser();

  // `null` = el modo todavía no resolvió. Se trata como CENTRAL, igual que el fallo cerrado del
  // bootstrap y del logout: nunca se toma el camino local por no haber podido preguntar.
  const isCentralMode = authCentralEnabled !== false;
  const shouldLeaveToPortal = sessionState === "anonymous" && isCentralMode;

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!shouldLeaveToPortal) {
      return;
    }

    // Guardia comprobada y armada de forma SÍNCRONA, y NO reseteada en el cleanup: el doble montaje
    // de efectos ejecuta el cleanup ENTRE las dos pasadas, así que rearmarla ahí produciría dos
    // navegaciones. Es el defecto del precedente `providers/AlertProviderWrapper.tsx`; no se copia.
    if (redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;

    redirectToCentralAuthPortal();
  }, [shouldLeaveToPortal]);

  // "Todavía no sé" NO es "no hay usuario": aquí sólo se espera (P-06).
  if (sessionState === "idle" || sessionState === "hydrating") {
    return <Loading />;
  }

  if (sessionState === "authenticated") {
    return <>{children}</>;
  }

  // Anónimo en modo central: el navegador ya está saliendo hacia el portal; mientras tanto no se
  // pinta ni el contenido privado ni una pantalla vacía.
  if (shouldLeaveToPortal) {
    return <Loading />;
  }

  // Anónimo en modo local explícito: la raíz es quien decide qué mostrar.
  return (
    <Navigate
      to="/"
      replace
    />
  );
};

export default AuthGuard;
