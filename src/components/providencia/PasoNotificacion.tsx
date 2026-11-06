/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Paso 3 de la página de generación — Notificación (D-05)
 * Archivo: PasoNotificacion.tsx
 * Responsabilidad: Declarar, dentro de la página de generación, POR DÓNDE se notificará el
 *   documento que se está redactando — y decir en voz alta lo que pasa si no se declara ninguna.
 *
 *   ── POR QUÉ ESTE PASO NO TRAE NI UN ENDPOINT NUEVO ───────────────────────────────────────────
 *   Emitir YA es notificar desde la Fase 03.14.3: el servidor abre un despacho por cada forma
 *   aceptada en el momento de emitir. Así que este paso no inventa ningún contrato: lo único que
 *   cambia respecto de antes es QUIÉN declara las formas y CUÁNDO. Antes era el secretario desde su
 *   bandeja, o el decisor desde el «⋮»; ahora, además, el decisor las declara aquí, justo antes de
 *   emitir, que es el momento en que la decisión importa. Cero endpoints nuevos, cero cambios de
 *   contrato, y la 03.14.3 sigue haciendo exactamente lo que hacía.
 *
 *   ── EL PASO NO GUARDA. LEVANTA ───────────────────────────────────────────────────────────────
 *   Persistir aquí guardaría las formas de un documento que quizá no se llegue a emitir. La
 *   selección se levanta por `onSeleccion` y la página la persiste al confirmar, ANTES de emitir.
 *   Por eso este archivo no nombra el guardado de formas en ninguna línea, y por eso monta el
 *   cuerpo SIN `renderPie`: sin pie, el cuerpo no expone su `guardar()` a nadie.
 *
 *   ── SE PUEDE AVANZAR SIN NINGUNA FORMA, PERO NO EN SILENCIO ──────────────────────────────────
 *   🔴 Un documento emitido sin despachos existe, pero no notifica a nadie y no arranca ningún
 *   plazo — y eso no se descubre hasta que el plazo que debía correr no corrió. El servidor lo
 *   tolera, así que la pantalla no bloquea: AVISA, con un aviso persistente y con el texto del
 *   contrato de copy. Apagar el avance aquí —con la selección VACÍA— sería inventarse una regla que
 *   el servidor no tiene.
 *
 *   Lo que SÍ cierra la salida es un canal MARCADO sin su dato (correo sin dirección vigente,
 *   casillero sin número, físico sin dirección): esa regla el servidor la tiene (D-15) y la aplica al
 *   guardar las formas justo antes de emitir. Desde el quick 261026-ft2 el cuerpo la dice en línea
 *   bajo el canal culpable y la sube por `onMotivoFormasIncompletas`; la página cierra con ella el
 *   paso 3.
 *
 *   Cabecera de la tarjeta y apagado durante el envío siguen la carcasa del paso de notificación de
 *   la rama de Resolución; su cuerpo NO se porta —los contratos de notificación de los dos módulos
 *   no se solapan— y en su lugar va el nuestro, el de la Fase 03.14.3.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-26 (quick 261026-ft2: prop `onMotivoFormasIncompletas`, que pasa
 *   tal cual al cuerpo: la validez de lo marcado viaja aparte de la selección).
 */

import FormasNotificacionCuerpo, {
  type SeleccionFormas,
} from "../notificacion/FormasNotificacionCuerpo";

/** Rótulo de la tarjeta y nombre accesible de la sección (UI-SPEC §4.6). */
export const ROTULO_PASO_NOTIFICACION = "Formas de notificación";

/**
 * El aviso cuando no hay ninguna forma marcada, palabra por palabra como lo fija el contrato de
 * copy (UI-SPEC §5.5). Dice las dos consecuencias —nadie queda notificado, ningún plazo empieza—
 * porque la segunda es la que tiene precio y la que nadie deduce de la primera.
 */
export const AVISO_SIN_FORMAS =
  "No hay ninguna forma de notificación aceptada. El documento se generará, pero nadie quedará notificado y no empezará a correr ningún plazo.";

export interface PropsPasoNotificacion {
  /** Expediente sobre el que se declaran las formas. */
  eejeId?: number;
  /** Hay una emisión en vuelo: el contenido entero se apaga. */
  enviando?: boolean;
  /**
   * Único canal hacia la página: lo marcado, en el formato exacto que espera el guardado. Se llama
   * tras leer las formas CON ÉXITO y en cada cambio posterior. Memorizar la función (`useCallback`)
   * para no repintar de más.
   *
   * 🔴 Si la lectura falla no se llama nunca, y esa ausencia es información: la página la usa para
   * negarse a emitir en vez de escribir una selección que nadie declaró.
   */
  onSeleccion: (seleccion: SeleccionFormas) => void;
  /**
   * El primer motivo por el que un canal MARCADO no tiene su dato (frase del servidor, D-15), o
   * `undefined` si se puede avanzar. Se pasa tal cual al cuerpo: mismas reglas de silencio que
   * `onSeleccion`. Memorizar la función.
   */
  onMotivoFormasIncompletas?: (motivo: string | undefined) => void;
}

const ID_TITULO = "paso-notificacion-titulo";

const PasoNotificacion = ({
  eejeId,
  enviando = false,
  onSeleccion,
  onMotivoFormasIncompletas,
}: PropsPasoNotificacion) => (
  <section
    aria-labelledby={ID_TITULO}
    aria-busy={enviando}
    className="flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6"
  >
    <h3 id={ID_TITULO} className="app-section-heading">
      {ROTULO_PASO_NOTIFICACION}
    </h3>

    <FormasNotificacionCuerpo
      eejeId={eejeId}
      deshabilitado={enviando}
      onSeleccion={onSeleccion}
      onMotivoFormasIncompletas={onMotivoFormasIncompletas}
      mensajeSinFormas={AVISO_SIN_FORMAS}
    />
  </section>
);

export default PasoNotificacion;
