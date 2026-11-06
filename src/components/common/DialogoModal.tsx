/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Cerrar los modales al pulsar fuera (quick 261019-mcf)
 * Archivo: DialogoModal.tsx
 * Responsabilidad: El `<dialog>` de TODOS los modales del módulo, con una sola regla de cierre para
 *   el clic en el fondo y para Escape:
 *
 *     · `ocupado` (un envío en curso) → no hace NADA. Cerrar a mitad de un POST deja al usuario sin
 *       saber si lo que mandó llegó.
 *     · `hayCambios` → pregunta antes «¿Descartar los cambios?» (decisión del usuario del
 *       2026-10-19: «Preguntar antes»). «Seguir editando» deja el modal como estaba.
 *     · si no → `onCerrar()`, el mismo camino que el aspa.
 *
 *   Y el contenido puede DECLARAR sus cambios y su envío con `useCierreModal` (lo usan los modales
 *   del registro de `ModalContainer` y `ConfirmationDetail`), o pedir el cierre por la misma regla.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-19
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DialogHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react";
import {
  ContextoCierreRegistro,
  ContextoDialogoModal,
  type DeclaracionCierre,
} from "../../context/DialogoModalContext";

export interface DialogoModalProps extends Omit<
  DialogHTMLAttributes<HTMLDialogElement>,
  "onCancel" | "onClick" | "onPointerDown" | "onKeyDown"
> {
  /**
   * Cierra el modal: lo mismo que hace su aspa o su «Cancelar». Opcional SOLO cuando el contenido
   * declara su propio cierre con `useCierreModal` (p. ej. un `ConfirmationDetail`, que trae su
   * `onClose`); si no hay ninguno de los dos, el fondo no cierra.
   */
  onCerrar?: () => void;
  /** Hay trabajo sin guardar: el cierre por fondo o Escape pregunta antes de tirarlo. */
  hayCambios?: boolean;
  /** Hay un envío en curso: el cierre por fondo o Escape se ignora. */
  ocupado?: boolean;
  ref?: Ref<HTMLDialogElement>;
  children?: ReactNode;
}

/**
 * La confirmación «¿Descartar los cambios?». Va DENTRO del `<dialog>` del modal y no en un portal:
 * así un clic en SU fondo nunca llega al fondo del modal de debajo (el `target` es ella), y su
 * Escape se ataja aquí mismo antes de subir.
 */
const ConfirmacionDescartar = ({
  onSeguir,
  onDescartar,
}: {
  onSeguir: () => void;
  onDescartar: () => void;
}) => {
  // Mismo criterio de «empieza y acaba en el fondo» que el modal: un arrastre no es un clic fuera.
  const inicioEnFondo = useRef(false);

  return (
    <dialog
      open
      className="modal modal-open"
      role="alertdialog"
      aria-labelledby="dialogo-modal-descartar-titulo"
      onPointerDown={(e) => {
        e.stopPropagation();
        inicioEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (inicioEnFondo.current && e.target === e.currentTarget) onSeguir();
        inicioEnFondo.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        onSeguir();
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSeguir();
      }}
    >
      <div className="modal-box max-w-md">
        <h2
          id="dialogo-modal-descartar-titulo"
          className="app-modules-modal-title"
        >
          ¿Descartar los cambios?
        </h2>
        <p className="py-3">
          Lo que ha escrito en esta ventana todavía no se ha guardado y se
          perderá si la cierra.
        </p>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSeguir}
            autoFocus
          >
            Seguir editando
          </button>
          <button
            type="button"
            className="btn btn-outline btn-error"
            onClick={onDescartar}
          >
            Descartar
          </button>
        </div>
      </div>
    </dialog>
  );
};

const DialogoModal = ({
  onCerrar,
  hayCambios = false,
  ocupado = false,
  ref,
  children,
  ...resto
}: DialogoModalProps) => {
  const [confirmando, setConfirmando] = useState(false);

  /**
   * LO QUE EL CONTENIDO DECLARA con `useCierreModal`. Hace falta cuando quien sabe si hay cambios
   * o un envío en curso no es quien pinta el `<dialog>`: los modales del registro de
   * `ModalContainer`, o `ConfirmationDetail`, que lleva su envío por dentro. Se SUMA a las props
   * (basta con que uno de los dos diga «hay cambios»). Los booleanos van en estado; el `onCerrar`
   * en una ref, porque muchos lo pasan como función nueva en cada render y en el estado sería un
   * bucle de renders.
   */
  const [declarado, setDeclarado] = useState({
    hayCambios: false,
    ocupado: false,
  });
  const declaraciones = useRef(new Map<string, DeclaracionCierre>());
  const cerrarDeclarado = useRef<(() => void) | undefined>(undefined);

  const declarar = useCallback(
    (id: string, declaracion: DeclaracionCierre | null) => {
      if (declaracion) declaraciones.current.set(id, declaracion);
      else declaraciones.current.delete(id);
      const todas = [...declaraciones.current.values()];
      cerrarDeclarado.current = todas.find((d) => d.onCerrar)?.onCerrar;
      const cambios = todas.some((d) => d.hayCambios);
      const enCurso = todas.some((d) => d.ocupado);
      setDeclarado((previo) =>
        previo.hayCambios === cambios && previo.ocupado === enCurso
          ? previo
          : { hayCambios: cambios, ocupado: enCurso },
      );
    },
    [],
  );

  const registro = useMemo(() => ({ declarar }), [declarar]);

  const cerrar = useCallback(() => {
    (cerrarDeclarado.current ?? onCerrar)?.();
  }, [onCerrar]);

  const conCambios = hayCambios || declarado.hayCambios;
  const enCurso = ocupado || declarado.ocupado;

  /**
   * 🔴 EL CLIC FUERA TIENE QUE EMPEZAR Y ACABAR EN EL FONDO. El navegador entrega `click` al ancestro
   * común de donde se pulsó y donde se soltó: si alguien selecciona texto arrastrando desde dentro
   * del formulario y suelta fuera, el `click` llega con `target` = el propio `<dialog>`, y mirar solo
   * el `click` cerraría el modal con lo escrito. Por eso el `pointerdown` también tiene que caer en
   * el fondo.
   */
  const inicioEnFondo = useRef(false);

  const solicitarCierre = useCallback(() => {
    if (enCurso) return;
    if (conCambios) {
      setConfirmando(true);
      return;
    }
    cerrar();
  }, [enCurso, conCambios, cerrar]);

  const alPulsarAbajo = (e: PointerEvent<HTMLDialogElement>) => {
    inicioEnFondo.current = e.target === e.currentTarget;
  };

  const alPulsar = (e: MouseEvent<HTMLDialogElement>) => {
    const fuera = inicioEnFondo.current && e.target === e.currentTarget;
    inicioEnFondo.current = false;
    if (fuera) solicitarCierre();
  };

  /**
   * ESCAPE, CON LA MISMA REGLA. `preventDefault()` no sobra: en un `<dialog>` abierto con
   * `showModal()` Escape CIERRA el elemento por su cuenta, sin avisar a React, y el estado se queda
   * creyendo que el modal sigue abierto. Se ataja en `keydown` (que además impide el `cancel`) y,
   * por si el `cancel` llega igual, también ahí. `stopPropagation()` para que un modal anidado no
   * cierre de paso al de debajo: React propaga por el árbol de componentes, también desde un portal.
   * Si un hijo ya trató su Escape (un desplegable que se cierra), se le respeta.
   */
  const alTeclear = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    solicitarCierre();
  };

  const alCancelar = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    e.stopPropagation();
    solicitarCierre();
  };

  const valor = useMemo(() => ({ solicitarCierre }), [solicitarCierre]);

  return (
    <dialog
      ref={ref}
      {...resto}
      onPointerDown={alPulsarAbajo}
      onClick={alPulsar}
      onKeyDown={alTeclear}
      onCancel={alCancelar}
    >
      <ContextoDialogoModal.Provider value={valor}>
        <ContextoCierreRegistro.Provider value={registro}>
          {children}
        </ContextoCierreRegistro.Provider>
      </ContextoDialogoModal.Provider>
      {confirmando && (
        <ConfirmacionDescartar
          onSeguir={() => setConfirmando(false)}
          onDescartar={() => {
            setConfirmando(false);
            cerrar();
          }}
        />
      )}
    </dialog>
  );
};

export default DialogoModal;
