/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Cerrar los modales al pulsar fuera (quick 261019-mcf)
 * Archivo: DeclararCierre.tsx
 * Responsabilidad: `useCierreModal` en forma de componente, para los modales del registro que no
 *   pueden llamar al hook en su cuerpo:
 *
 *     · `DeclararCierreFormik` — el `dirty` y el `isSubmitting` de Formik solo existen DENTRO de
 *       `<Formik>`, así que se declara desde ahí.
 *     · `DeclararCierre` — para declarar solo en un paso del modal (p. ej. la confirmación de un
 *       asistente de dos pasos, donde el formulario ya se desmontó pero lo escrito sigue vivo).
 *
 *   Si hay varias vivas a la vez en el mismo diálogo, se SUMAN (`DialogoModal`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-19
 */
import { useFormikContext } from "formik";
import { useCierreModal } from "../../hooks/useCierreModal";

interface DeclararCierreProps {
  hayCambios?: boolean;
  ocupado?: boolean;
  onCerrar?: () => void;
}

export const DeclararCierre = (props: DeclararCierreProps) => {
  useCierreModal(props);
  return null;
};

export const DeclararCierreFormik = ({
  ocupado = false,
}: {
  /** Un envío que el modal lleva fuera de Formik (`isSaving`), sumado a `isSubmitting`. */
  ocupado?: boolean;
}) => {
  const { dirty, isSubmitting } = useFormikContext();
  useCierreModal({ hayCambios: dirty, ocupado: ocupado || isSubmitting });
  return null;
};
