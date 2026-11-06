/**
 * Microservicio: ejecucion
 * Módulo: Firma digital (frontend) — Sorteo / Actas, generación, excusa y despacho
 * Feature: Clave de firma del usuario, con sus cinco estados (UI-SPEC 03.21 §2)
 * Archivo: CampoClaveCertificado.tsx
 * Responsabilidad: EL campo de clave de los cinco sitios donde se firma (paso 4 de la generación,
 *   excusa, despacho DMR/DMIT, firma del acta y combo), para que el rótulo, el copy y las
 *   precauciones no se repitan (ni diverjan). Dibuja uno de cinco estados:
 *     A — firmador apagado: el aviso que pasa la superficie (`avisoSinFirmador`) y ningún campo.
 *     B — encendido, con sesión central, vacío: el campo.
 *     C — encendido y SIN sesión central (`sesionCentral === false`): aviso `warning` y ningún
 *         campo; pedir una clave que no puede usarse es pedirla de más.
 *     D — encendido, con la clave escrita: el campo.
 *     E — tras un rechazo de la clave (`error`): el campo marcado, con su línea de error.
 *   Y, antes de esos, mientras el modo de firma no se conoce: «comprobando…» (`cargando`) o el aviso
 *   de que no se pudo comprobar, con «Reintentar» (`errorModo`). Ninguno de los dos es el estado A:
 *   no se sabe si el firmador está apagado y no se afirma.
 *
 *   🔴 PRECAUCIONES QUE NO SON DECORATIVAS:
 *   - `type="password"` por defecto, con un botón para mostrarla que el usuario decide pulsar.
 *   - `autoComplete="new-password"` y no `"off"`: en un `type="password"` Chromium y Firefox ignoran
 *     `"off"`, autocompletan la contraseña de ACCESO guardada (que viajaría como `signPassword`) y
 *     ofrecen guardar la clave del certificado. `"new-password"` les dice que no es la del login. Y
 *     los atributos de descarte de los gestores de contraseñas más comunes (1Password, LastPass,
 *     Bitwarden, Dashlane): ninguno debe ni rellenarla ni ofrecerse a recordarla.
 *   - Sin `name` y sin `placeholder`, y fuera de todo `<form>`: sin nombre el campo no puede
 *     serializarse por accidente en ningún envío.
 *   - `id` por `useId()`: dos campos en el mismo DOM no chocan.
 *   - El valor vive en el estado del componente padre (el hook `useClaveDeFirma`) y se borra al
 *     cerrar y al terminar el envío. Nunca va al almacenamiento del navegador, a la URL, a la
 *     consola ni a un aviso: este archivo no escribe en ninguno de esos sitios.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-13
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 08: el campo pasa a ser el único de
 *   las superficies de firma — rótulo «Clave de firma» en 14 px / 700, `useId`, sin `name` ni
 *   `placeholder`, mostrar/ocultar traído de `PasoFirmaClave`, estados A y C con `Alert`, línea de
 *   error del estado E, y las props `error`, `inputRef`, `avisoSinFirmador` y `sesionCentral`).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: props `cargando`, `errorModo` y
 *   `onReintentarModo`, para no pintar el estado A mientras el modo no se conoce.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-05: `autoComplete="new-password"` y
 *   los atributos de descarte de los gestores de contraseñas, para que nadie la rellene ni la guarde.)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 */
import { useId, useState, type FC, type Ref } from "react";
import Alert from "../common/Alert";
import Iconos from "../common/Iconos";
import {
  AVISO_MODO_FIRMA_CARGANDO,
  AVISO_MODO_FIRMA_DESCONOCIDO,
  AVISO_SIN_SESION_CENTRAL,
  PISTA_CLAVE_FIRMA,
  ROTULO_CLAVE_FIRMA,
} from "../../config/firmaCopy";

interface CampoClaveCertificadoProps {
  /** true cuando el firmador está encendido. Si es false se pinta el estado A (`avisoSinFirmador`). */
  requerida: boolean;
  value: string;
  onChange: (valor: string) => void;
  /** Deshabilita el campo y el botón de mostrar mientras la firma está en vuelo. */
  disabled?: boolean;
  /** Estado E: la línea de error bajo el campo, `aria-invalid` y el borde `input-error`. */
  error?: string;
  /** Para devolverle el foco al campo tras un rechazo de la clave. */
  inputRef?: Ref<HTMLInputElement>;
  /**
   * Estado A (D-11): el aviso de la superficie cuando el firmador está apagado. OBLIGATORIO: cada
   * superficie dice qué documento sale sin firma (`AVISO_SIN_FIRMADOR` de `config/firmaCopy`).
   */
  avisoSinFirmador: string;
  /**
   * `false` ⇒ estado C (D-12). Ausente ⇒ el servidor no lo informó y la UI degrada: se pinta el
   * campo y la falta de sesión llegará como fallo al enviar.
   */
  sesionCentral?: boolean;
  /** El modo de firma todavía se está leyendo (`useClaveDeFirma().cargando`). */
  cargando?: boolean;
  /** No se pudo leer el modo de firma (`useClaveDeFirma().errorModo`). */
  errorModo?: boolean;
  /** Vuelve a leer el modo tras un fallo (`useClaveDeFirma().reintentarModo`). */
  onReintentarModo?: () => void;
}

const CampoClaveCertificado: FC<CampoClaveCertificadoProps> = ({
  requerida,
  value,
  onChange,
  disabled = false,
  error,
  inputRef,
  avisoSinFirmador,
  sesionCentral,
  cargando = false,
  errorModo = false,
  onReintentarModo,
}) => {
  const idBase = useId();
  const idCampo = `${idBase}-campo`;
  const idPista = `${idBase}-pista`;
  const idError = `${idBase}-error`;
  const [mostrando, setMostrando] = useState(false);

  if (cargando) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        {AVISO_MODO_FIRMA_CARGANDO}
      </p>
    );
  }

  if (errorModo) {
    return (
      <Alert
        variant="warning"
        message={AVISO_MODO_FIRMA_DESCONOCIDO}
        buttonFunction={onReintentarModo}
      />
    );
  }

  if (!requerida) {
    return <Alert variant="info" message={avisoSinFirmador} />;
  }

  if (sesionCentral === false) {
    return <Alert variant="warning" message={AVISO_SIN_SESION_CENTRAL} />;
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <label className="text-sm font-bold" htmlFor={idCampo}>
        {ROTULO_CLAVE_FIRMA}
      </label>
      <div className="relative w-full">
        <input
          id={idCampo}
          ref={inputRef}
          type={mostrando ? "text" : "password"}
          autoComplete="new-password"
          // Descarte de los gestores de contraseñas: 1Password, LastPass, Bitwarden y Dashlane.
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          spellCheck={false}
          aria-describedby={error ? `${idPista} ${idError}` : idPista}
          aria-invalid={error ? true : undefined}
          className={`input input-bordered w-full pr-12 focus:input-primary${error ? " input-error" : ""}`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setMostrando((visible) => !visible)}
          className="btn btn-ghost btn-sm btn-circle absolute right-2 top-1/2 h-8 w-8 min-h-0 -translate-y-1/2"
          aria-label={mostrando ? "Ocultar la clave" : "Mostrar la clave"}
          aria-pressed={mostrando}
          aria-controls={idCampo}
          disabled={disabled}
        >
          <Iconos nombre={mostrando ? "ocultarMirada" : "mirar"} />
        </button>
      </div>
      <span id={idPista} className="text-sm text-base-content/70">
        {PISTA_CLAVE_FIRMA}
      </span>
      {error && (
        <span
          id={idError}
          className="flex items-center gap-1 text-sm text-base-content"
        >
          {/* El icono es decorativo: el significado lo llevan el texto, el borde y aria-invalid. El
              texto no va en rojo porque en el tema oscuro no llega a 4,5:1 (UI-SPEC § Color). */}
          <span aria-hidden="true">
            <Iconos nombre="advertencia" estilo="text-error" />
          </span>
          {error}
        </span>
      )}
    </fieldset>
  );
};

export default CampoClaveCertificado;
