/**
 * Microservicio: ejecucion
 * Módulo: N/A
 * Feature: Avisos del sistema
 * Archivo: AlertList.tsx
 * Responsabilidad: Renderiza las alertas que se presentarán en el Navbar
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29, D-CANAL: cada alerta es un botón;
 *   pulsarla la quita del panel, la marca leída en el servidor y lleva a su expediente si su ruta
 *   es interna (`destinoDeAlerta`). Una marca fallida no molesta ni bloquea el camino. «Ver más»
 *   lleva a Avisos.)
 * Modificado por: Andrés Miño — 2026-11-04 (revisión 261030-m29: WR-05, recarga las no leídas si
 *   quedaban fuera del panel; IN-09, sin `div` dentro del botón, sin la papelera que no hacía nada y
 *   con lo que hace el clic en texto para lectores de pantalla)
 */
import { type FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { IAlert } from "../../interfaces/IAlert";
import BadgePriority from "../common/BadgePriority";
import Iconos from "../common/Iconos";
import { useAlerts } from "../../hooks/useAlerts";
import { AlertService } from "../../services/AlertService";
import { abrirAlerta, destinoDeAlerta } from "../../utils/destinoAlerta";

type AlertListProps = {
  items: IAlert[];
};

/**
 * Cierra el panel de la campana: el desplegable de daisyUI se abre por foco, así que soltar el foco
 * lo cierra. Sin esto, tras navegar el panel seguiría abierto encima del expediente.
 */
const cerrarPanel = () => {
  const activo = document.activeElement;
  if (activo instanceof HTMLElement) {
    activo.blur();
  }
};

/**
 * La lista con alertas. Vive aparte del vacío para que los hooks del enrutador y del contexto solo
 * se pidan cuando hay algo que pulsar (el vacío se pinta también fuera de un enrutador en pruebas).
 */
const ListaDeAlertas: FC<AlertListProps> = ({ items }) => {
  const navigate = useNavigate();
  // `removeAlert` y no `markAlertAsRead`: el panel enseña solo las NO leídas, así que la leída sale
  // del panel y el contador baja en uno.
  const { removeAlert, totalAlerts, setAlerts, setTotalAlerts } = useAlerts();

  /** Vuelve a pedir la página de no leídas (UNA petición; un fallo solo se avisa en consola). */
  const recargarNoLeidas = async () => {
    try {
      const respuesta = await AlertService.getUnreadAlerts();
      setAlerts(respuesta.alerts);
      setTotalAlerts(respuesta.totalAlerts);
    } catch (error) {
      console.warn("[Alertas] No se pudieron recargar las no leídas", error);
    }
  };

  const pulsar = (alerta: IAlert) => {
    // WR-05 (revisión 261030-m29): el panel trae como mucho una página de las no leídas y el
    // contador lleva el total. Si quedaban no leídas FUERA del panel, al quitar esta se recarga la
    // página en el acto: sin esto, tras pulsar las cinco el panel decía «Sin notificaciones nuevas»
    // con la insignia en positivo hasta el siguiente sondeo (15 min). Se recarga DESPUÉS de marcarla
    // en el servidor, para que no vuelva; y sin esperar, para no retrasar la navegación.
    const quedabanFuera = totalAlerts > items.length;
    return abrirAlerta(alerta, {
      marcarLeidaEnVista: removeAlert,
      marcarLeidaEnServidor: async (id) => {
        await AlertService.markAsRead(id);
        if (quedabanFuera) {
          void recargarNoLeidas();
        }
      },
      navegar: (ruta) => {
        cerrarPanel();
        navigate(ruta);
      },
    });
  };

  return (
    <>
      {/* Encabezado informativo de las notificaciones */}
      <li className="menu-title m-0! block! p-0! normal-case! tracking-normal!  select-none">
        <div className="app-shell-overlay-header app-alert-panel-header border-b border-base-300 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="app-alert-panel-header-icon">
                <Iconos
                  nombre="notificaciones"
                  estilo="text-current"
                />
              </span>
              <div className="min-w-0">
                <h3 className="app-shell-overlay-title app-alert-panel-title text-base font-semibold">
                  Alertas del sistema
                </h3>
                <p className="app-shell-overlay-copy app-alert-panel-copy mt-1 text-sm">
                  Actualizaciones recientes para tu bandeja. ¡Mantente
                  informado!
                </p>
                <p className="app-alert-panel-meta mt-1 text-xs font-medium">
                  Últimas {items.length} alertas pendientes
                </p>
              </div>
            </div>
          </div>
        </div>
      </li>

      {/* Renderizado de las notificaciones propiamente */}
      <li className="m-0! list-none! p-0!">
        <div className="app-shell-overlay-body app-alert-panel-body max-h-74 overflow-y-auto overscroll-contain border-b border-base-300 px-3 py-3">
          <div className="app-alert-panel-list">
            {items.map((item) => {
              const destino = destinoDeAlerta(item);
              return (
                <button
                  key={item.ualeId}
                  type="button"
                  onClick={() => void pulsar(item)}
                  // El `title` dice qué hace el clic, que no es lo mismo con y sin expediente.
                  title={
                    destino
                      ? "Abrir el expediente y marcar como leída"
                      : "Marcar como leída"
                  }
                  className="app-shell-overlay-card app-alert-panel-item appearance-none flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition-all focus:bg-white focus:text-inherit focus:outline-none focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-white active:text-inherit"
                >
                  {/* Seccion de prioridad y tiempo transcurrido */}
                  <span className="app-alert-panel-item-head">
                    <BadgePriority
                      text={item.aresPriority}
                      priority={item.aresPriority}
                      size={"xs"}
                      como="span"
                    />

                    <BadgePriority
                      text={item.elapsedTime}
                      priority={"default"}
                      size={"xs"}
                      como="span"
                    />
                  </span>
                  {/* Seccion de titulo */}
                  <span className="app-alert-panel-item-head">
                    <span className="app-alert-panel-item-title">
                      {item.aresTitle}
                    </span>
                  </span>
                  {/* Seccion de mensaje (texto, nunca HTML: puede llevar nombres de otros módulos) */}
                  <span className="app-shell-overlay-card-copy app-alert-panel-item-copy block">
                    {item.aresMessage}
                  </span>
                  {/* Lo que hace el clic, también para lectores de pantalla (el `title` no se
                      anuncia de forma fiable). */}
                  <span className="sr-only">
                    {destino
                      ? "Abre el expediente y la marca como leída."
                      : "La marca como leída."}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </li>
      <Link
        to="/home/alerts"
        onClick={cerrarPanel}
        className="link link-hover ml-3 mt-2 mb-2"
      >
        Ver más
      </Link>
    </>
  );
};

const AlertList: FC<AlertListProps> = ({ items }) => {
  if (!items.length) {
    return (
      <div className="app-alert-panel-empty">
        <span className="app-alert-panel-empty-icon">
          <Iconos
            nombre="notificaciones"
            estilo="text-current"
          />
        </span>
        <h4 className="app-alert-panel-empty-title">
          Sin notificaciones nuevas
        </h4>
        <p className="app-alert-panel-empty-copy">
          Cuando el sistema registre nuevas alertas aparecerán aquí.
        </p>
      </div>
    );
  }

  return <ListaDeAlertas items={items} />;
};

export default AlertList;
