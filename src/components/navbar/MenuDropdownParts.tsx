/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Partes del menu
 * Archivo: MenuDropdownParts.tsx
 * Responsabilidad: Proveer los diferentes componentes que formará parte del menu principal del navbar
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 */
import { NavLink, useLocation } from "react-router-dom";
import Iconos from "../common/Iconos";
import logoQuito from "../../assets/logo_quito.png";
import type { FC } from "react";
import {
  type NavigationItem,
  // type NavigationItem,
} from "../../config/navigation";
import { useUser } from "../../context/UserContext";

const resolveNavigationPath = (path: string, parentPath = "") => {
  const resolvedPath = path || parentPath;

  if (!resolvedPath) {
    return "";
  }

  if (resolvedPath.startsWith("/")) {
    return resolvedPath;
  }

  return `/home/${resolvedPath}`;
};

/**
 * ── EL TABLERO, FIJO EN EL SHELL Y NO COMO SUBMENÚ (decisión del usuario, 2026-10-02) ────────
 *
 * El resto del menú es DATA-DRIVEN: sale de `user.modulos` / `user.submenus`, que `usu_get_user`
 * arma en la base a partir de los grants por rol. El tablero NO. Se declara aquí, en el shell, y
 * eso tiene tres consecuencias que conviene tener presentes:
 *
 *   1. **No necesita grant, ni submenú, ni tocar `assert-menu-role-matrix.sql`.** La matriz sigue
 *      describiendo los nueve submenús operativos y no hay que reabrirla cada vez.
 *   2. **Aparece sin re-login.** Lo demás del menú se resuelve al INICIAR SESIÓN, así que un
 *      submenú nuevo es invisible hasta que el usuario vuelve a entrar. Esta entrada no.
 *   3. 🔴 **Pero no la ve nadie que el backend no admita.** `GET /dashboard` responde **403** al
 *      delegado de trabajo comunitario, así que enseñarle el enlace sería ofrecerle un rechazo.
 *      De ahí la lista de abajo — que es de VISIBILIDAD, no de autorización: quien autoriza es el
 *      `@Roles` del controlador más el servicio de alcance, y los dos siguen ahí.
 */
const ROLES_CON_TABLERO = new Set([
  "funcionario decisor",
  "secretario abogado",
  "director",
  "administrador",
]);

/** La ruta del tablero, tal y como la registra `routes.tsx` como hija de `/home`. */
const RUTA_TABLERO = "/home/dashboard";

const isPathActive = (pathname: string, path: string) => {
  if (!path) {
    return false;
  }

  return pathname === path || pathname.startsWith(`${path}/`);
};

// Cabecera del menu
const Header = () => (
  <div className="app-sidebar-header">
    <div className="app-sidebar-brand">
      <div className="app-sidebar-brand-logo-wrap">
        <img
          src={logoQuito}
          alt="Logo Quito"
          className="app-sidebar-brand-logo"
        />
      </div>

      <div className="app-sidebar-brand-copy">
        <p className="app-sidebar-title app-sidebar-brand-acronym">SIGOC</p>
        <h2 className="app-sidebar-title app-sidebar-brand-name">
          <span className="block">Sistema de Gestión</span>
          <span className="block">Orden y Control</span>
        </h2>
      </div>
    </div>
  </div>
);

type ContentProps = {
  onNavigate?: () => void;
};

//Contenido del menu desplegable
const Content: FC<ContentProps> = ({ onNavigate }) => {
  const { user } = useUser();
  const { pathname } = useLocation();

  if (!user) return null;

  const modulos = user.modulos.map((modulo) => ({
    id: modulo.moduId,
    label: modulo.moduName,
    path: modulo.moduPath,
    icon: modulo.moduIcon,
  }));

  const submenus = user.submenus.map((submenu) => ({
    id: submenu.submId,
    label: submenu.submName,
    path: submenu.submPath,
    icon: submenu.submIcon,
    parentId: submenu.moduId,
  }));

  const visibleMenuItems: NavigationItem[] = modulos.map((modulo) => {
    const submenuDelModulo = submenus.filter(
      (submenu) => submenu.parentId === modulo.id && submenu.label,
    );

    if (submenuDelModulo.length > 0) {
      return {
        ...modulo,
        children: submenuDelModulo,
      };
    }

    return modulo;
  });

  const verTablero = ROLES_CON_TABLERO.has(
    (user.rolName ?? "").trim().toLowerCase(),
  );

  // Un usuario SIN módulos y SIN tablero es el único que no tiene nada que ver. Con tablero, el
  // mensaje de «no hay opciones» sería falso: tiene una.
  if (visibleMenuItems.length === 0 && !verTablero) {
    return (
      <div className="app-sidebar-empty">
        No hay opciones de navegacion disponibles para este usuario.
      </div>
    );
  }

  return (
    <ul className="app-sidebar-menu app-sidebar-menu-list menu">
      {/*
        Va PRIMERO y fuera del `map` de módulos: es el punto de retorno, y se llega a él desde
        cualquier pantalla sin reescribir la URL — que era justo lo que no se podía hacer antes.
      */}
      {verTablero && (
        <li className="app-sidebar-group rounded-[1.35rem] border border-transparent bg-base-200 p-1.5">
          <NavLink
            to={RUTA_TABLERO}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                "app-sidebar-link app-sidebar-root-link",
                isActive ? "menu-active" : "",
              ].join(" ")
            }
          >
            <Iconos
              nombre="dashboard"
              estilo="text-current"
            />
            Dashboard
          </NavLink>
        </li>
      )}
      {visibleMenuItems.map((item) => {
        const hasActiveChild = item.children?.some((subitem) =>
          isPathActive(
            pathname,
            resolveNavigationPath(subitem.path, item.path),
          ),
        );

        return (
          <li
            key={item.id}
            className="app-sidebar-group rounded-[1.35rem] border border-transparent bg-base-200 p-1.5"
          >
            {item.children ? (
              <details
                open={hasActiveChild || item.defaultOpen}
                className="app-sidebar-details"
              >
                <summary
                  className={[
                    "app-sidebar-summary",
                    hasActiveChild ? "app-sidebar-summary-current" : "",
                  ].join(" ")}
                >
                  <span className="app-sidebar-summary-main">
                    <span className="app-sidebar-summary-leading">
                      <Iconos
                        nombre={item.icon}
                        estilo="text-current"
                      />
                    </span>
                    <span className="app-sidebar-summary-label">
                      {item.label}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="app-sidebar-summary-icon"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7.5 5.5L12 10L7.5 14.5"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>
                {item.children.map((subitem) => (
                  <ul
                    key={subitem.id}
                    className="app-sidebar-sublist"
                  >
                    <li>
                      <NavLink
                        to={subitem.path || item.path}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          [
                            "app-sidebar-link app-sidebar-subitem-link",
                            isActive
                              ? "menu-active app-sidebar-subitem-active"
                              : "",
                          ].join(" ")
                        }
                      >
                        <Iconos
                          nombre={subitem.icon}
                          estilo="text-current"
                        />
                        {subitem.label}
                      </NavLink>
                    </li>
                  </ul>
                ))}
              </details>
            ) : (
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "app-sidebar-link app-sidebar-root-link",
                    isActive ? "menu-active" : "",
                  ].join(" ")
                }
              >
                <Iconos
                  nombre={item.icon}
                  estilo="text-current"
                />
                {item.label}
              </NavLink>
            )}
          </li>
        );
      })}
    </ul>
  );
};

// Pie del menu para evaluar si se alcanza a poner opciones de configuracion
const Footer = () => null;

export { Header, Content, Footer };
