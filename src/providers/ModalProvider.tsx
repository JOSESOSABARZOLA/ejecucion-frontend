/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Provider de modales
 * Archivo: ModalProvider.tsx
 * Responsabilidad: Gestionar el estado centralizado de modales
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-07
 */

import {
  useContext,
  useState,
  useCallback,
  type FC,
  type ReactNode,
} from "react";
import type {
  ModalType,
  ModalCallbacks,
  ModalState,
  ModalContextProps,
} from "../interfaces/IModal";
import { ModalContext } from "../context/ModalContext";

/**
 * Provider de modales - Gestiona el estado centralizado del modal
 */
export const ModalProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: null,
    data: null,
    callbacks: undefined,
  });

  /**
   * Abre un modal del tipo especificado con datos y callbacks opcionales
   */
  const openModal = useCallback(
    (type: ModalType, data?: any, callbacks?: ModalCallbacks) => {
      setModal({
        isOpen: true,
        type,
        data,
        callbacks,
      });
    },
    [],
  );

  /**
   * Cierra el modal actual
   */
  const closeModal = useCallback(() => {
    setModal({
      isOpen: false,
      type: null,
      data: null,
      callbacks: undefined,
    });
  }, []);

  /**
   * Dispara el callback onSuccess y cierra el modal
   */
  const triggerSuccess = useCallback(
    (data?: any) => {
      if (modal.callbacks?.onSuccess) {
        modal.callbacks.onSuccess(data);
      }
      closeModal();
    },
    [modal.callbacks, closeModal],
  );

  /**
   * Dispara el callback onError pero mantiene el modal abierto
   */
  const triggerError = useCallback(
    (error?: any) => {
      if (modal.callbacks?.onError) {
        modal.callbacks.onError(error);
      }
    },
    [modal.callbacks],
  );

  return (
    <ModalContext.Provider
      value={{
        modal,
        openModal,
        closeModal,
        triggerSuccess,
        triggerError,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

/**
 * Hook para acceder al contexto de modales desde cualquier componente
 * @throws {Error} Si se usa fuera de un ModalProvider
 * @returns {ModalContextProps} El contexto de modales
 */
export const useModal = (): ModalContextProps => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal debe usarse dentro de ModalProvider");
  }
  return context;
};
