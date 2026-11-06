/**
 * Microservicio: ejecucion
 * Módulo: toasts (frontend)
 * Feature: El aviso flotante como canal único del resultado de una acción (quick 261028-kmg)
 * Archivo: ToastItem.tsx
 * Responsabilidad: Pintar UN aviso flotante (icono, título, texto) con su botón «Cerrar aviso», el
 *   único camino para quitar los persistentes (error y advertencia).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 */
import React from "react";
import type { Toast } from "../../interfaces/IToast";
import Iconos from "../common/Iconos";

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
}

// Mapeo de tipos de toast a iconos
const TOAST_ICONS: Record<string, string> = {
  error: "cerrar", // X icon
  warning: "advertencia", // Warning icon
  success: "resolucion", // Check icon
  info: "informacion", // Info icon
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const iconName = TOAST_ICONS[toast.type] || "informacion";

  return (
    <div
      className={`app-toast app-toast-${toast.type}`}
      role="alert"
    >
      {/* Icon */}
      <div className="app-toast-icon">
        <Iconos nombre={iconName} />
      </div>

      {/* Content */}
      <div className="app-toast-content">
        {toast.title && <div className="app-toast-title">{toast.title}</div>}
        <div className="app-toast-message">{toast.message}</div>
      </div>

      {/* Close button */}
      <button
        className="app-toast-close"
        onClick={() => onClose(toast.id)}
        aria-label="Cerrar aviso"
      >
        <Iconos nombre="cerrar" />
      </button>
    </div>
  );
};

export default ToastItem;
