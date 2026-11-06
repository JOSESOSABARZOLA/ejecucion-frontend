/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Guard de ruta por rol
 * Archivo: RutaProtegida.tsx
 * Responsabilidad: Cortar en el cliente el acceso a una pantalla cuyo rol el usuario no tiene.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Adaptado de: instruccion-frontend components/common/RutaProtegida.tsx (Doris Villavicencio, 2026-06-25)
 *
 * 🔴 La adaptación NO es cosmética y queda escrita porque D-1 lo exige: el original compara
 * `rolesPermitidos: number[]` contra el **código numérico de rol** del usuario, y el `User` de
 * Ejecución NO TIENE ese campo — tiene `rolName: string`. Copiarlo tal cual no compilaría, y forzarlo
 * obligaría a inventar aquí un código numérico de rol que no existe en ningún sitio del módulo. Se
 * adopta la IDEA (guard de ruta por rol), no la implementación. Segunda diferencia: el original redirige incondicionalmente cuando `user` es
 * nulo, y aquí eso expulsaría en el primer render a un usuario con cookie válida (P-06) porque la
 * sesión de Ejecución se hidrata contra el backend y tiene un estado intermedio explícito.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Loading from "./Loading";
import { useUser } from "../../context/UserContext";

/**
 * A dónde se manda a quien no alcanza. Tiene que ser una ruta que TODOS los roles puedan ver: el
 * tablero lo es —es el `index` de `/home` en `routes.tsx`, donde aterriza cualquiera que entre a
 * `/home` pelado—, así que ningún rol puede quedar rebotando entre dos guards.
 */
export const RUTA_DE_REFUGIO = "/home/dashboard";

type RutaProtegidaProps = {
  rolesPermitidos: readonly string[];
  children: ReactNode;
};

/** Mismo criterio que `resolverRegla` en `config/inboxActionStatusRules.ts`. */
const normalizarRol = (rol: string): string => rol.trim().toLowerCase();

/**
 * Guard de ruta por rol.
 *
 * **Por qué existe.** Hoy, quien teclea la URL de una pantalla que su rol no tiene LLEGA a la
 * pantalla: la única protección es que el submenú no aparezca en el sidebar, y un submenú ausente no
 * es un control de acceso —es una omisión del menú—. El backend responde 403 a las peticiones, de
 * modo que el dato no se filtra, pero el usuario ve un armazón vacío sembrado de errores y no
 * entiende si se ha roto la aplicación o si es que no le corresponde. Esto es **mejora de seguridad
 * de interfaz, no cosmética**.
 *
 * **Qué NO es.** No es autorización. Quien autoriza es el `@Roles` del endpoint en el backend, que
 * decide con el JWT y no con lo que el navegador crea de sí mismo. Este guard es **conveniencia**:
 * un usuario que manipule su perfil en memoria pasaría de aquí y se estrellaría igualmente contra el
 * 403. Nada de lo que se construya encima puede tratarlo como la última línea.
 *
 * **Qué NO sustituye.** `AuthGuard` sigue siendo el único punto de control de *sesión* de todo
 * `/home/*`. `RutaProtegida` es más fino —por rol, por ruta— y se ANIDA dentro de él.
 */
const RutaProtegida = ({ rolesPermitidos, children }: RutaProtegidaProps) => {
  const { user, sessionState } = useUser();

  // "Todavía no sé" NO es "no le corresponde": mientras la sesión se hidrata sólo se espera. Sin
  // esto, el guard redirigiría en el primer render a un usuario con cookie válida (P-06), que es el
  // mismo defecto que `AuthGuard` documenta y evita.
  if (sessionState === "idle" || sessionState === "hydrating") {
    return <Loading />;
  }

  const permitidos = rolesPermitidos.map(normalizarRol);
  const rolDelUsuario = user ? normalizarRol(user.rolName) : null;

  if (!rolDelUsuario || !permitidos.includes(rolDelUsuario)) {
    return (
      <Navigate
        to={RUTA_DE_REFUGIO}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default RutaProtegida;
