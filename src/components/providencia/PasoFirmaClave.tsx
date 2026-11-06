/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Paso 4 de la página de generación — Firma sobre el seam env-gated (D-06) y firma real
 *   en el mismo acto de emitir (Fase 03.21)
 * Archivo: PasoFirmaClave.tsx
 * Responsabilidad: Ser el paso 4 de la página de generación sobre la bandera de firma que el
 *   módulo ya tenía: si el firmador está encendido, pedir la clave del certificado; si está
 *   apagado, DECIRLO.
 *
 *   ── POR QUÉ EL PASO EXISTE AUNQUE NO SE FIRME ────────────────────────────────────────────────
 *   Hoy —y en el despliegue actual— el firmador está apagado. Sería más corto esconder el paso,
 *   pero entonces el decisor terminaría el trámite creyendo que firmó, y el documento saldría sin
 *   firma criptográfica sin que nadie se lo hubiera dicho nunca. El paso se queda, con el texto
 *   exigido por D-06, y el botón de generar queda habilitado: no hay nada que corregir, es el
 *   despliegue el que está así.
 *
 *   ── LA BANDERA SE PREGUNTA AL BACKEND, NO SE DUPLICA ─────────────────────────────────────────
 *   Se consume el hook que ya existe y que ya tiene prueba. Su doctrina se hereda entera, incluida
 *   la más importante: si el modo no se puede consultar, se asume APAGADO. Es la conducta que no
 *   pide claves de más.
 *
 *   ── 🔴 LA CLAVE NO SE GUARDA EN NINGÚN SITIO ─────────────────────────────────────────────────
 *   Vive en el estado del hook mientras el paso está montado y se borra en los dos finales
 *   posibles: al desmontar el paso y al terminar el envío. Nunca en el almacenamiento del
 *   navegador, nunca en la URL, nunca en un volcado a consola, nunca en un aviso emergente, nunca
 *   en el sobre de un error. Este archivo no escribe en consola ni una vez, y el único canal que
 *   publica estado hacia arriba —`onEstado`— lleva SOLO BOOLEANOS (tres desde la Fase 03.21): por
 *   construcción no puede llevar la clave, y hay prueba que enumera sus claves para que siga sin
 *   poder.
 *
 *   Borrarla al terminar el envío significa que un reintento obliga a teclearla de nuevo. Es
 *   deliberado: es el precio de que una clave no sobreviva al acto para el que se pidió.
 *
 *   ── LA CLAVE VIAJA POR EL CANAL DE FIRMA, Y SOLO POR ÉL (Fase 03.21, D-04/D-16) ──────────────
 *   Con el firmador encendido la providencia se firma en el mismo acto de emitir. La clave sale de
 *   aquí de UNA sola manera: el paso registra hacia la página un LECTOR (`registrarLectorClave`), y
 *   el compositor lo llama en el instante de emitir (`obtenerClaveDeFirma`) para pasarla a
 *   `ProvidenciaService.emitir`, que la manda como `signPassword`, hermano de `payload`. La página
 *   nunca la copia a su estado: guarda el lector, no el valor. Y al desmontar el paso el lector
 *   deja de devolver nada.
 *
 *   El campo es el ÚNICO de las superficies de firma (`CampoClaveCertificado`, UI-SPEC §2): mismo
 *   rótulo, misma pista y los cinco estados — apagado (A), sin sesión central (C, D-12), vacío o
 *   escrito (B/D) y clave rechazada (E). Si la firma falla, la página entrega aquí `errorFirma`: la
 *   clave se borra y, si fue la clave, el campo queda marcado, con su línea y con el foco (estado E),
 *   y eso es TODO lo que se dice. Cualquier otro fallo lo dice la página en el aviso flotante: el
 *   paso ya no pinta ninguna caja (regla de mensajes 261028-kmg, que sustituye a UI-SPEC §3.3).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10: el paso monta `CampoClaveCertificado`
 *   en vez de su campo propio; `EstadoPasoFirma.sinSesionCentral`; `registrarLectorClave`,
 *   `errorFirma` y `onEditarClave`; `TEXTO_FIRMA_DESACTIVADA` sale de `config/firmaCopy`).
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: el paso publica `modoDesconocido`
 *   y el campo pinta «comprobando» / «no se pudo comprobar» mientras el modo no se conoce).
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el paso ya no pinta `errorFirma.mensaje`
 *   en una caja; la clave rechazada se dice solo bajo el campo y el resto, en el aviso flotante de la
 *   página).
 */

import { useEffect, useRef } from "react";
import CampoClaveCertificado from "../sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../../hooks/useClaveDeFirma";
import {
  AVISO_SIN_FIRMADOR,
  ERROR_CLAVE_INCORRECTA,
} from "../../config/firmaCopy";

/** Rótulo del paso y nombre accesible de la sección (UI-SPEC §4.2). */
export const ROTULO_PASO_FIRMA = "Firma";

/**
 * El texto exigido por D-06, palabra por palabra como lo fija el contrato de copy (UI-SPEC §5.7).
 * Dice las dos cosas: que la firma está desactivada EN ESTE DESPLIEGUE —no rota, no pendiente de
 * un trámite del usuario— y qué consecuencia tiene sobre el documento que va a salir. Desde la
 * Fase 03.21 tiene un solo origen: el aviso del firmador apagado de esta superficie.
 */
export const TEXTO_FIRMA_DESACTIVADA = AVISO_SIN_FIRMADOR.generacion;

/**
 * Lo que el paso publica hacia la página. Canal de SOLO LECTURA y de BOOLEANOS: `requerida` para
 * que la confirmación diga si se firmará, `listaParaEnviar` para gatear el botón primario y
 * `sinSesionCentral` para decir por qué está apagado en el estado C. 🔴 La clave NO está aquí y no
 * puede estarlo.
 */
export interface EstadoPasoFirma {
  /** El firmador está encendido y por tanto se pidió la clave. */
  requerida: boolean;
  /** ¿Se puede generar? Falso si la clave hace falta y está en blanco, o en el estado C. */
  listaParaEnviar: boolean;
  /** Estado C (D-12): el firmador está encendido y la sesión no viene del Auth central. */
  sinSesionCentral: boolean;
  /**
   * El modo de firma todavía se lee o no se pudo leer (revisión 03.21, WR-01): no se sabe si hará
   * falta la clave, y `listaParaEnviar` es falso hasta saberlo.
   */
  modoDesconocido: boolean;
}

/** Un fallo de firma que la página devuelve al paso. */
export interface ErrorFirmaPaso {
  /**
   * «{consecuencia} {texto del servidor}» (UI-SPEC §10.1). Nunca lleva la clave. El paso NO lo
   * pinta (quick 261028-kmg): si no es la clave, la página lo lleva al aviso flotante; si es la
   * clave, basta la línea del campo.
   */
  mensaje: string;
  /** `APP-FIRMA-CLAVE-001`: estado E — el campo marcado, con su línea y con el foco. */
  claveIncorrecta: boolean;
}

export interface PropsPasoFirmaClave {
  /**
   * Hay una generación en vuelo. Apaga el campo, y al pasar de `true` a `false` —el envío
   * terminó, con éxito o sin él— borra la clave.
   */
  enviando?: boolean;
  /** Canal de solo lectura hacia la página. Memorizar la función (`useCallback` sin dependencias). */
  onEstado?: (estado: EstadoPasoFirma) => void;
  /**
   * Recibe el LECTOR de la clave: una función que devuelve la clave en el momento en que se la
   * llama (o `undefined` si no se pide, está en blanco o el paso se desmontó). La página guarda el
   * lector, nunca el valor (D-16). Memorizar la función.
   */
  registrarLectorClave?: (leer: () => string | undefined) => void;
  /** Un fallo de firma de la última emisión, o `null`. Lo pone y lo quita la página. */
  errorFirma?: ErrorFirmaPaso | null;
  /** El decisor volvió a escribir en el campo: la página retira el aviso de fallo. */
  onEditarClave?: () => void;
}

const ID_TITULO = "paso-firma-titulo";

const PasoFirmaClave = ({
  enviando = false,
  onEstado,
  registrarLectorClave,
  errorFirma = null,
  onEditarClave,
}: PropsPasoFirmaClave) => {
  const clave = useClaveDeFirma();
  const campoRef = useRef<HTMLInputElement>(null);

  const { requerida, listaParaEnviar, sinSesionCentral, limpiar } = clave;
  const modoDesconocido = clave.cargando || clave.errorModo;

  /**
   * Las funciones que viajan por `ref` y no por dependencias: quien monta puede pasarlas en línea,
   * y `limpiar` cambia de identidad si alguien envuelve el hook. Con ellas en las dependencias, los
   * efectos de abajo se dispararían sin parar.
   */
  const onEstadoRef = useRef(onEstado);
  const limpiarRef = useRef(limpiar);
  const registrarLectorRef = useRef(registrarLectorClave);
  /**
   * La clave lista para enviar, tal cual la entrega el hook, para que el lector la lea en el
   * instante en que se le pide. Vive lo mismo que el estado del hook: se vacía al desmontar.
   */
  const claveParaEnviarRef = useRef(clave.claveParaEnviar);
  useEffect(() => {
    onEstadoRef.current = onEstado;
    limpiarRef.current = limpiar;
    registrarLectorRef.current = registrarLectorClave;
    claveParaEnviarRef.current = clave.claveParaEnviar;
  });

  useEffect(() => {
    onEstadoRef.current?.({
      requerida,
      listaParaEnviar,
      sinSesionCentral,
      modoDesconocido,
    });
  }, [requerida, listaParaEnviar, sinSesionCentral, modoDesconocido]);

  /**
   * El lector se registra una vez. Al desmontar, la clave no sobrevive al paso: se borra del hook,
   * se vacía la copia del lector y el lector registrado deja de devolver nada.
   */
  useEffect(() => {
    registrarLectorRef.current?.(() => claveParaEnviarRef.current);
    return () => {
      claveParaEnviarRef.current = undefined;
      registrarLectorRef.current?.(() => undefined);
      limpiarRef.current();
    };
  }, []);

  /**
   * Al terminar el envío: la clave no sobrevive al acto para el que se pidió. Se mira la
   * TRANSICIÓN de `true` a `false` y no el valor, para no borrar lo tecleado en el primer pintado.
   */
  const enviandoAntes = useRef(enviando);
  useEffect(() => {
    if (enviandoAntes.current && !enviando) limpiarRef.current();
    enviandoAntes.current = enviando;
  }, [enviando]);

  /**
   * Un fallo de firma nuevo: el envío terminó sin firma, así que la clave se borra (aunque la
   * transición de `enviando` no se haya llegado a ver). Tras un fallo el campo SIEMPRE está vacío.
   */
  useEffect(() => {
    if (errorFirma) limpiarRef.current();
  }, [errorFirma]);

  /**
   * Estado E (A4): tras un rechazo de la clave el foco va al campo, que es donde está el remedio.
   * Se espera a que el envío termine: un campo apagado no puede recibir el foco.
   */
  const claveIncorrecta = errorFirma?.claveIncorrecta === true;
  useEffect(() => {
    if (claveIncorrecta && !enviando) campoRef.current?.focus();
  }, [claveIncorrecta, enviando, errorFirma]);

  return (
    <section
      aria-labelledby={ID_TITULO}
      aria-busy={enviando}
      className="flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6"
    >
      <h3 id={ID_TITULO} className="app-section-heading">
        {ROTULO_PASO_FIRMA}
      </h3>

      <CampoClaveCertificado
        requerida={requerida}
        sesionCentral={clave.sesionCentral}
        cargando={clave.cargando}
        errorModo={clave.errorModo}
        onReintentarModo={clave.reintentarModo}
        avisoSinFirmador={AVISO_SIN_FIRMADOR.generacion}
        value={clave.clave}
        disabled={enviando}
        inputRef={campoRef}
        error={claveIncorrecta ? ERROR_CLAVE_INCORRECTA : undefined}
        onChange={(valor) => {
          clave.setClave(valor);
          onEditarClave?.();
        }}
      />
    </section>
  );
};

export default PasoFirmaClave;
