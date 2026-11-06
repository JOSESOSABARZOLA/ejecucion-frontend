/**
 * Microservicio: ejecucion
 * Módulo: toasts (frontend)
 * Feature: El aviso flotante como canal único del resultado de una acción (quick 261028-kmg)
 * Archivo: IToast.ts
 * Responsabilidad: Tipos de la pila de avisos flotantes (éxito, error, advertencia, información) y del
 *   contexto que la expone (`useToast`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number; // milisegundos; por defecto 3000 (solo cuenta si el aviso NO es persistente)
  createdAt: number; // marca de tiempo: orden FIFO y tiempo restante del auto-cierre
  /**
   * El aviso se queda hasta que el usuario lo cierra. Lo decide el PROVEEDOR por el tipo
   * (`TIPOS_PERSISTENTES`: error y advertencia), no quien llama: una duración explícita en un error
   * se ignora.
   */
  persistente?: boolean;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (
    type: ToastType,
    message: string,
    title?: string,
    duration?: number
  ) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}
