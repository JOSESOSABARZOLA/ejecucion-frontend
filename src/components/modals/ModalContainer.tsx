/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Modales
 * Archivo: ModalContainer.tsx
 * Responsabilidad: Ser el contenedor de todos los modales que se requieran presentar para interacción del usuario
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado: 2026-04-07 - Integración con ModalContext
 * Modificado por: Andrés Miño — 2026-10-19 (quick 261019-mcf: el `<dialog>` pasa a ser
 *   `DialogoModal`, así que el clic en el fondo y Escape cierran; el modal del registro declara sus
 *   cambios y su envío desde dentro con `useCierreModal`.)
 */
import { useEffect, useRef, type FC } from "react";
import { useModal } from "../../hooks/useModal";
import { modalRegistry } from "../../interfaces/IModal";
import DialogoModal from "../common/DialogoModal";
// import { useToast } from "../../hooks/useToast";
// import { useToast } from "../../hooks/useToast";
// import { useModal, modalRegistry } from "../../context/ModalContext";

/**
 * Componente auxiliar que maneja la lógica del dialog HTML
 */
interface ModalContainerDialogProps {
  children: React.ReactNode;
  onClose: () => void;
}

const ModalContainerDialog: FC<ModalContainerDialogProps> = ({
  children,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Una vez el modal se haya renderizado, disparamos el método showModal para que se presente de manera correcta
  useEffect(() => {
    const modal = dialogRef.current;

    // Si es el elemento dialog que se renderizó correctamente pues lo abrimos (jsdom no siempre
    // implementa `showModal`, de ahí la comprobación)
    if (modal && typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    }
  }, []);

  return (
    <DialogoModal
      ref={dialogRef}
      id="contenedorModales"
      className="modal"
      onCerrar={onClose}
    >
      {children}
    </DialogoModal>
  );
};

/**
 * Contenedor general que es la capsula en donde se renderizan diferentes modales a lo largo de la aplicación
 */
const ModalContainer: FC = () => {
  // const { addToast } = useToast();
  const { modal, closeModal } = useModal();

  // useEffect(() => {
  //   if (!modal.isOpen || !modal.type) return;

  //   const ModalComponent = modalRegistry[modal.type];

  //   if (!ModalComponent) {
  //     addToast(
  //       "error",
  //       `Modal type not found in registry: ${modal.type}`,
  //       "Error de configuración",
  //     );
  //     console.error(`Modal type not found in registry: ${modal.type}`);
  //   }

  //   return () => {
  //     closeModal();
  //   }
  // }, [modal.type, addToast]);

  // Si no hay modal abierto, no renderizar nada
  if (!modal.isOpen || !modal.type) return null;

  // Obtener el componente modal del registro
  const ModalComponent = modalRegistry[modal.type];

  // Si el tipo de modal no existe en el registro, mostrar error
  if (!ModalComponent) {
    // addToast(
    //   "error",
    //   `Modal type not found in registry: ${modal.type}`,
    //   "Error de configuración",
    // );
    console.error(`Modal type not found in registry: ${modal.type}`);
    return null;
  }

  return (
    <ModalContainerDialog onClose={closeModal}>
      <ModalComponent
        caseData={modal.data}
        onClose={closeModal}
        refetchFn={modal.callbacks?.refetchFn}
      />
    </ModalContainerDialog>
  );
};

export default ModalContainer;
