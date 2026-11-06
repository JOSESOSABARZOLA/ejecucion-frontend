/**
 * Microservicio: ejecucion
 * Módulo: toasts (frontend)
 * Archivo: ToastContainer.tsx
 * Responsabilidad: La pila de avisos (éxito, error, advertencia, información) de toda la app.
 *
 *   🔴 VA EN LA CAPA SUPERIOR DEL NAVEGADOR (popover="manual"). Los modales son `<dialog>` abiertos
 *   con `showModal()`, que los sube a la capa superior: ahí no hay `z-index` que valga y un aviso
 *   pintado como `position: fixed` normal queda DEBAJO del modal, así que el usuario confirmaba algo
 *   y no se enteraba de si salió bien o mal. Dentro de la capa superior manda el orden de entrada:
 *   el último en abrirse queda encima. Por eso, cada vez que cambia la pila, el contenedor se cierra
 *   y se vuelve a abrir — así queda encima de cualquier modal abierto después del aviso anterior.
 *   Sin avisos se cierra, para no dejar un elemento vacío en la capa superior.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 */
import React, { useContext, useLayoutEffect, useRef } from "react";
import { ToastContext } from "../../context/ToastContext";
import ToastItem from "./ToastItem";

const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext);
  const ref = useRef<HTMLDivElement>(null);
  const toasts = context?.toasts;

  useLayoutEffect(() => {
    const el = ref.current;
    // jsdom y navegadores viejos no tienen la API de popover: ahí el aviso se queda como fixed.
    if (!el || typeof el.showPopover !== "function") return;
    const abierto = el.matches(":popover-open");
    if (abierto) el.hidePopover();
    if (toasts && toasts.length > 0) el.showPopover();
  }, [toasts]);

  if (!context) {
    return null;
  }

  const { removeToast } = context;

  return (
    <div ref={ref} popover="manual" className="app-toast-container">
      {context.toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
