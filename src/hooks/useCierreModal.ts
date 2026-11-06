/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Cerrar los modales al pulsar fuera (quick 261019-mcf)
 * Archivo: useCierreModal.ts
 * Responsabilidad: Que un modal del REGISTRO (los que abre `openModal` y pinta `ModalContainer`)
 *   diga a su contenedor si tiene cambios sin guardar y si está enviando, para que el clic en el
 *   fondo y Escape apliquen la regla de `DialogoModal` con SUS datos. Una línea en el modal:
 *
 *     useCierreModal({ hayCambios: dirty, ocupado: isSubmitting });
 *
 *   Devuelve `solicitarCierre` por si el modal tiene su propio atajo de cierre y quiere que pase por
 *   la misma regla. Vale dentro de CUALQUIER `DialogoModal`, no solo del de `ModalContainer`. Fuera
 *   de uno (p. ej. un test que monta el modal suelto) no hace nada y `solicitarCierre` cae en
 *   `onCerrar`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-19
 */
import { useContext, useEffect, useId } from "react";
import {
  ContextoCierreRegistro,
  ContextoDialogoModal,
} from "../context/DialogoModalContext";

interface OpcionesCierreModal {
  hayCambios?: boolean;
  ocupado?: boolean;
  onCerrar?: () => void;
}

const nada = () => {};

export const useCierreModal = ({
  hayCambios = false,
  ocupado = false,
  onCerrar,
}: OpcionesCierreModal = {}): (() => void) => {
  const registro = useContext(ContextoCierreRegistro);
  const dialogo = useContext(ContextoDialogoModal);
  const id = useId();

  useEffect(() => {
    registro?.declarar(id, { hayCambios, ocupado, onCerrar });
  }, [registro, id, hayCambios, ocupado, onCerrar]);

  // Al desmontar se retira lo declarado: el diálogo vuelve a lo de siempre si no queda nadie más.
  useEffect(() => () => registro?.declarar(id, null), [registro, id]);

  return dialogo?.solicitarCierre ?? onCerrar ?? nada;
};
