/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Barra de navegación
 * Archivo: Navbar.tsx
 * Responsabilidad: Presentar todas las funcionalidades de una barra de navegación convencional
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 */

import MenuDropdown from "./MenuDropdown";
import SubMenuDropdown from "../common/SubMenuDropdown";
// Iconos: lo usaba el interruptor del tema, hoy comentado (ver el bloque «MODO OSCURO» más abajo).
// import Iconos from "../common/Iconos";
import AlertList from "./AlertList";
import UserInfoPerfil from "../common/UserInfoPerfil";
// useTheme: idem — el tema sigue existiendo, lo que no existe es el control que lo cambia.
// import { useTheme } from "../../hooks/useTheme";
import { useAlerts } from "../../hooks/useAlerts";
import type { IAlert } from "../../interfaces/IAlert";
import { useUser } from "../../context/UserContext";

type NavbarProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export default function Navbar({
  isSidebarOpen,
  onToggleSidebar,
}: NavbarProps) {
  const { alerts, totalAlerts, connectionStatus } = useAlerts();
  // const { theme, setTheme } = useTheme();
  const { user, logoutUser, isLoggingOut } = useUser();
  // const isDarkTheme = theme === "dark";

  if (!user) {
    return null;
  }

  const connectionBadgeClass =
    connectionStatus === "connected"
      ? "badge-success"
      : connectionStatus === "polling"
        ? "badge-warning"
        : "badge-error";

  const connectionLabel =
    connectionStatus === "connected"
      ? ""
      : connectionStatus === "polling"
        ? ""
        : "";

  const alertProps = {
    botonProps: {
      estilos:
        "app-topbar-icon-button btn btn-ghost btn-circle text-primary hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary focus-visible:outline-none active:bg-primary/10 active:text-primary",
      icono: "notificaciones",
      deshabilitado: false,
      indicativo: { activo: true, cantidad: totalAlerts },
    },
    menuClassName:
      "app-shell-overlay-panel app-alert-panel mt-4 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl p-0",
    renderItem: (items: IAlert[]) => <AlertList items={items} />,
  };

  //Objeto de configuración para presentación del submenu de las opciones del perfil
  type PerfilItem = {
    label: string;
    // icon: string;
    onClick?: () => void;
  };

  const itemsPerfil: PerfilItem[] = [
    {
      label: "Acerca de",
    },
    {
      label: "Cambiar Contraseña",
    },
    {
      // El cierre de sesión es asíncrono y termina navegando fuera del módulo: mientras dura, el
      // elemento se anuncia como en curso y no vuelve a dispararse. La idempotencia de verdad vive
      // en el contexto; esto es sólo para no invitar al usuario a pulsar dos veces.
      label: isLoggingOut ? "Cerrando sesión…" : "Cerrar Sesión",
      onClick: () => {
        if (isLoggingOut) {
          return;
        }

        void logoutUser();
      },
    },
    {
      label: "Versión",
    },
  ];

  const propsPerfil = {
    items: itemsPerfil,
    menuClassName:
      "app-shell-overlay-panel app-profile-panel mt-4 w-[18rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl p-0",
    renderItem: (items: PerfilItem[]) => (
      <>
        {/* ─────────────────────────────────────────────────────────────────────────────────
            MODO OSCURO — DESHABILITADO (reunión del 2026-09-16, encargo del usuario).

            Se COMENTA, no se borra: el tema oscuro sigue existiendo entero (ThemeContext,
            useTheme, app-shell-theme-dark.css y los bloques [data-theme="dark"] repartidos por
            todas las hojas). Lo que se retira es el ÚNICO control que lo enciende. Borrarlo
            obligaría a reescribirlo desde cero el día que se vuelva a querer, y a redescubrir
            que el interruptor vivía aquí, dentro del panel de perfil.

            Comentar este control NO bastó: el ThemeProvider seguía eligiendo el oscuro si el
            navegador lo tenía guardado o si el sistema operativo lo prefería, y quien lo tenía
            se quedó atrapado sin interruptor (corregido el 2026-10-05, quick 261005-fas).

            El apagado de verdad vive ahora en src/providers/ThemeProvider.tsx, en la constante
            MODO_OSCURO_HABILITADO, que también fija el setTheme en claro: descomentar SOLO este
            bloque pintaría un interruptor que no hace nada. Para devolver el modo oscuro:
              1. Poner MODO_OSCURO_HABILITADO a true en ThemeProvider.tsx.
              2. Descomentar este bloque, los imports de Iconos y useTheme y las líneas de
                 theme/isDarkTheme del principio del componente.
              3. Reescribir src/providers/ThemeProvider.test.tsx, que fija el estado apagado y
                 fallará a propósito.
            ───────────────────────────────────────────────────────────────────────────────── */}
        <li className="m-0! list-none! p-0!">
          {/*
          <div className="app-profile-panel-theme">
            <div className="app-profile-panel-theme-copy">
              <p className="app-profile-panel-theme-label">Tema</p>
              <p className="app-profile-panel-theme-value">
                {isDarkTheme ? "Oscuro" : "Claro"}
              </p>
            </div>
            <button
              type="button"
              aria-label={
                isDarkTheme ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
              }
              aria-pressed={isDarkTheme}
              onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
              // onClick={() => {}}
              data-state={isDarkTheme ? "dark" : "light"}
              className="app-profile-panel-switch"
            >
              <span className="sr-only">Cambiar tema</span>
              <span
                aria-hidden="true"
                className="app-profile-panel-switch-mark app-profile-panel-switch-mark-light"
              >
                <Iconos
                  nombre="temaClaro"
                  estilo="app-profile-panel-switch-mark-icon"
                />
              </span>
              <span
                aria-hidden="true"
                className="app-profile-panel-switch-mark app-profile-panel-switch-mark-dark"
              >
                <Iconos
                  nombre="temaOscuro"
                  estilo="app-profile-panel-switch-mark-icon"
                />
              </span>
              <span
                aria-hidden="true"
                className="app-profile-panel-switch-thumb"
              >
                <Iconos
                  nombre={isDarkTheme ? "temaOscuro" : "temaClaro"}
                  estilo="app-profile-panel-switch-thumb-icon"
                />
              </span>
            </button>
          </div>

          */}
          <UserInfoPerfil />
        </li>

        <li className="m-0! list-none! p-0!">
          <ul className="app-profile-panel-list">
            {items.map((item, index) => (
              <li
                key={item.label}
                className={`app-profile-panel-item-shell m-0! list-none! p-0! ${
                  index === 0 ? "app-profile-panel-list-start" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-disabled={item.onClick ? undefined : true}
                  className="app-profile-panel-item"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </li>
      </>
    ),
  };

  return (
    // <div className="navbar bg-base-100 shadow-sm drawer-content">
    <div className="app-topbar navbar z-30 min-h-16 shrink-0 border-b border-base-300 bg-base-100 px-4 text-base-content shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur md:px-6">
      {/* Botón del menú desplegable */}
      <div className="navbar-start gap-2">
        <MenuDropdown
          open={isSidebarOpen}
          onToggle={onToggleSidebar}
        />
      </div>
      {/* Título del navbar */}
      <div className="navbar-center">
        <a className="app-topbar-brand text-xl font-bold tracking-wide text-primary">
          SIGOC
        </a>
      </div>
      {/* Botones finales para alertas y perfil de usuario */}
      <div className="navbar-end gap-1">
        {/* Badge de estado de conexión WebSocket */}
        <div className={`badge ${connectionBadgeClass} gap-1 mr-2`}>
          <span className="text-xs font-medium">{connectionLabel}</span>
        </div>

        {/* Botón para visualización rápida de alertas del usuario */}
        <SubMenuDropdown
          {...alertProps}
          items={alerts}
        />

        {/* Botón para visualización del estado del perfil de usuario que está logeado */}
        <SubMenuDropdown {...propsPerfil} />
      </div>
    </div>
  );
}
