/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: El Gestor de Notificaciones — la tarjeta de forma de la fila expandida (Fase 03.20,
 *   Plan 06, §2.3-§2.6 del contrato de UI)
 * Archivo: TarjetaFormaNotificacion.tsx
 * Responsabilidad: Pintar UNA de las tres formas de notificación de una fila del Gestor, con sus
 *   0..N despachos dentro.
 *
 *   ── 🔴 LAS TRES TARJETAS SE PINTAN SIEMPRE ──────────────────────────────────────────────────
 *   Las gobierna el CATÁLOGO FIJO de formas (`ORDEN_FORMAS_NOTIFICACION`), no el array de
 *   despachos: `despachos[]` sólo decide qué hay DENTRO de cada una. Medido el 2026-09-25: **156 de
 *   157** administrados no tienen ninguna forma aceptada, así que la tarjeta VACÍA es el caso
 *   NORMAL, no el borde. Copiar el render de Resolución daría, en esas 156 filas, una fila expandida
 *   con cero tarjetas y un vacío genérico que no explica nada y parece una pantalla rota.
 *
 *   ── COMPONENTE TONTO, A PROPÓSITO ───────────────────────────────────────────────────────────
 *   Recibe los despachos de su forma, el interruptor del envío y dos callbacks; **no llama a ningún
 *   servicio y no conoce ningún diálogo**. Así se monta en prueba con todas las combinaciones sin
 *   tocar la red, y la página (Plan 07) conserva el control de la confirmación y de la recarga.
 *
 *   ── 🔴 LO QUE NO SE PINTA, Y POR QUÉ (D-23) ─────────────────────────────────────────────────
 *   El analog de Resolución lleva un `+` en la cabecera de cada tarjeta que abre un despacho nuevo
 *   de esa forma. **No se porta, y no es una cuestión de alcance**: lo que hace —declarar una forma
 *   de notificación— está **PROHIBIDO** desde esta pantalla (D-01/D-02: las formas vienen del Core y
 *   se cambian **únicamente por acta de Secretaría General**), no diferido. Un control apagado «con
 *   su motivo» diría «esto será posible más adelante», que es falso. Y serían **30 controles muertos
 *   por página** (3 tarjetas × 10 filas). A diferencia del botón de registrar —que la captura
 *   muestra activo y que por eso sí se pinta apagado con su motivo—, este `+` **nunca ha existido en
 *   Ejecución**: no hay expectativa que honrar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-28
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-09/D-21, UI-SPEC §9: la prop
 *   `despachoBloqueadoPorFirma` y `MOTIVO_SIN_FIRMA` (§10.11), la PRIMERA regla del botón de correo).
 */
import type { FC } from "react";
import Boton from "../common/Boton";
import BadgePriority from "../common/BadgePriority";
import { ETIQUETA_FORMA_TARJETA } from "../../utils/notificacionEjecucion.util";
import { DatetimeUtil } from "../../utils/datetime.util";
import type {
  DespachoGestor,
  FormaNotificacion,
} from "../../services/NotificacionEjecucionService";

/**
 * El texto del chip de cada estado. Va aquí y no en el catálogo de formas porque es COPY de esta
 * pantalla (§5.3), y porque `BadgePriority` capitaliza por CSS: sin este mapa el chip diría
 * `pendiente` en el árbol accesible y en cualquier prueba, y sólo se vería `Pendiente` mirándolo.
 */
const ETIQUETA_ESTADO_DESPACHO: Record<string, string> = {
  pendiente: "Pendiente",
  notificado: "Notificado",
  rechazado: "Rechazado",
};

/** Los cuatro motivos de §2.6 / §5.8, verbatim. Los redacta el contrato, no este componente. */
const MOTIVO_PAPEL =
  "Registrar la notificación en papel llega en una fase posterior. Hoy el Gestor solo muestra.";
const MOTIVO_ENVIO_APAGADO =
  "El envío de correo está desactivado en este entorno.";
const MOTIVO_VIA_AGOTADA = "Vía agotada: ya consta la razón de imposibilidad.";
/**
 * Fase 03.21, D-09 — UI-SPEC §10.11, verbatim. Es defensa en profundidad: con el todo o nada de la
 * firma, lo emitido con el firmador encendido siempre sale firmado, así que esto atrapa una
 * anomalía y por eso pide avisar a soporte en vez de prometer un remedio desde la pantalla.
 */
const MOTIVO_SIN_FIRMA =
  "No se despacha: el documento notificado requería firma y no la tiene. Avise a soporte.";
/** §5.6 — el copy que explica el hueco en vez de disimularlo. */
const FRASE_FORMA_NO_DECLARADA =
  "El administrado no ha declarado esta forma de notificación.";

type TarjetaFormaNotificacionProps = {
  /** La forma de esta tarjeta. Elige el título, el rótulo de fecha y qué botón se puede encender. */
  forma: FormaNotificacion;
  /** Los despachos de ESTA forma. Vacío es el caso normal, no un error. */
  despachos: DespachoGestor[];
  /** Va en los nombres accesibles: con tres tarjetas por fila hay hasta 30 controles por página. */
  expNumber?: string;
  /**
   * 🔴 Llega del SERVIDOR en la raíz de la respuesta del Gestor y se usa TAL CUAL (D-20 / CH-5).
   * Este componente no lo deduce, no le pone valor por defecto y no lo deriva del rol: un botón
   * encendido en un entorno con el envío apagado ofrece mandar una notificación jurídica que no va a
   * salir.
   */
  correoEnvioHabilitado: boolean;
  /**
   * 🔴 Fase 03.21, D-09/D-21 — llega del SERVIDOR en la fila (`fila.despachoBloqueadoPorFirma`) y se
   * usa TAL CUAL, con la misma doctrina que `correoEnvioHabilitado`: este componente no lo deduce
   * de las firmas ni de nada. Con `true` el botón de correo se apaga con `MOTIVO_SIN_FIRMA`.
   */
  despachoBloqueadoPorFirma: boolean;
  /**
   * Lo pide la fila de un despacho de correo pendiente. Entrega el despacho COMPLETO porque quien
   * monta la confirmación (Plan 07) necesita su dirección y su contador de intentos; su `despId` es
   * el identificador con el que se llama al servicio.
   */
  onEnviarCorreo: (despacho: DespachoGestor) => void;
  /** **D-21**: el salto a la pantalla de formas aceptadas desde la tarjeta sin despacho. */
  onVerFormas: () => void;
};

/** Lo que hay que saber del botón de una fila, resuelto en un solo sitio. */
interface EstadoDelBoton {
  texto: string;
  apagado: boolean;
  /** Sólo cuando está apagado. Cuando no, el envoltorio muestra la etiqueta. */
  motivo?: string;
}

/**
 * Decide el botón de una fila de despacho. La regla de fondo es la del patrón de la casa —apagado
 * con su motivo, nunca ausente— con una sola excepción, el estado D, que no tiene fila.
 *
 * ⚠️ El botón de correo se enciende **sólo** si el despacho está pendiente Y el servidor dice que el
 * envío está habilitado. Un estado que este frontend no conozca cae al lado apagado a propósito: en
 * la duda, no se ofrece mandar una notificación.
 */
const resolverBoton = (
  despacho: DespachoGestor,
  esCorreo: boolean,
  correoEnvioHabilitado: boolean,
  despachoBloqueadoPorFirma: boolean,
  fechaEnvio: string,
): EstadoDelBoton => {
  if (!esCorreo) {
    // D-18: el Gestor sólo muestra en esta fase. El backend ya tiene con qué registrar, así que esto
    // es un añadido pendiente, no un bloqueo — y por eso el botón se pinta, apagado y con su motivo.
    return { texto: "Registrar", apagado: true, motivo: MOTIVO_PAPEL };
  }

  // Fase 03.21, D-09 (UI-SPEC §9): va primero: si el documento no puede salir, ninguna otra razón
  // importa. Ni el interruptor del envío ni el estado del despacho cambian eso.
  if (despachoBloqueadoPorFirma) {
    return { texto: "Enviar correo", apagado: true, motivo: MOTIVO_SIN_FIRMA };
  }

  const estado = String(despacho.estado ?? "").toLowerCase();

  if (estado === "notificado") {
    return {
      texto: "Enviar correo",
      apagado: true,
      // Sin fecha de envío el motivo se queda SIN fecha en vez de dejar un hueco puntuado: no se
      // inventa un instante que la base no tiene.
      motivo: fechaEnvio
        ? `Ya notificado por correo el ${fechaEnvio}.`
        : "Ya notificado por correo.",
    };
  }

  if (estado === "rechazado") {
    // Reintentar una vía agotada reabriría un plazo ya arrancado.
    return { texto: "Enviar correo", apagado: true, motivo: MOTIVO_VIA_AGOTADA };
  }

  const pendiente = estado === "pendiente";
  const apagado = !(pendiente && correoEnvioHabilitado);

  return {
    texto: "Enviar correo",
    apagado,
    motivo: apagado ? MOTIVO_ENVIO_APAGADO : undefined,
  };
};

const TarjetaFormaNotificacion: FC<TarjetaFormaNotificacionProps> = ({
  forma,
  despachos,
  expNumber,
  correoEnvioHabilitado,
  despachoBloqueadoPorFirma,
  onEnviarCorreo,
  onVerFormas,
}) => {
  const rotuloForma = ETIQUETA_FORMA_TARJETA[forma];
  const esCorreo = forma === "CORREO";
  const sufijoExpediente = expNumber ? `, expediente ${expNumber}` : "";

  return (
    <article className="app-table-expanded-type-card card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-3">
        <header className="flex items-center justify-between gap-1">
          {/* Cuerpo / peso 700 (§ Typography). `truncate` se conserva: la tarjeta es de ancho fijo
              y un rótulo más largo no debe romper la rejilla. */}
          <h5 className="card-title min-w-0 truncate text-sm font-bold text-base-content md:text-[0.95rem]">
            {rotuloForma}
          </h5>
        </header>

        {despachos.length === 0 ? (
          <>
            {/* 🔴 ESTADO D — el caso NORMAL (156 de 157 filas). La frase es HERMANA del título de la
                tarjeta y no hija de ninguna etiqueta de control: una nota dentro de un `<label>`
                pasa a ser parte del nombre del control, y es la regla que la Fase 03.22 aprendió. */}
            <p className="rounded-xl border border-dashed border-base-300 px-3 py-2 text-xs leading-snug text-base-content/70">
              {FRASE_FORMA_NO_DECLARADA}
            </p>
            {/* D-21 — el salto, no sólo la frase: sin él el secretario leería la explicación sin
                ningún control para actuar, en el caso que hoy es el normal. No contradice D-01: las
                formas siguen viniendo del Core y cambiándose por acta de Secretaría General; esto
                sólo lleva al sitio donde se ven y se registran, que ya existe. Quien monta el
                diálogo es la página. */}
            <div className="flex">
              <Boton
                deshabilitado={false}
                estilos="btn btn-link btn-sm h-auto min-h-0 justify-start p-0 text-xs"
                texto="Ver formas de notificación"
                etiquetaAccesible={`Ver las formas de notificación aceptadas para declarar ${rotuloForma}${sufijoExpediente}`}
                titulo="Ver las formas de notificación aceptadas del administrado"
                onClick={onVerFormas}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {despachos.map((despacho) => {
              // 🔴 EL RÓTULO DE LA FECHA LO DECIDE LA FORMA, NO DOS COLUMNAS. Casillero y dirección
              // física son canales de REGISTRO: lo que consta es cuándo se ENTREGÓ, y ése es el
              // instante de `resueltoAt`. Del correo el sistema sabe cuándo lo MANDÓ, y no hay acuse
              // de recibo — el servicio devuelve aceptado o rechazado, no entrega.
              // 🔴 Y la fecha de resolución NO se reutiliza bajo el rótulo de envío: «se envió» y «se
              // resolvió» no son el mismo instante —el registro manual admite fecha del pasado— así
              // que pintar una de registro bajo «Envío» sería meter una fecha falsa en un
              // procedimiento sancionador. Sin fecha de envío, la tarjeta de correo no pinta fecha.
              const fechaEnvio = DatetimeUtil.formatFechaCorta(
                despacho.enviadoAt,
              );
              const fechaEntrega = DatetimeUtil.formatFechaCorta(
                despacho.resueltoAt,
              );
              const rotuloFecha = esCorreo ? "Envío" : "Entrega";
              const fecha = esCorreo ? fechaEnvio : fechaEntrega;

              const boton = resolverBoton(
                despacho,
                esCorreo,
                correoEnvioHabilitado,
                despachoBloqueadoPorFirma,
                fechaEnvio,
              );
              const etiquetaBoton = `${boton.texto} — ${rotuloForma}${sufijoExpediente}`;

              return (
                <div
                  key={despacho.despId}
                  className="app-table-expanded-item app-table-expanded-despacho-row flex flex-row items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 transition-[border-color,background-color,box-shadow] duration-180 hover:border-primary/35 hover:bg-primary/5"
                >
                  {/* C3 — la línea meta sube del tamaño de 11px del analog a 12px (`text-xs`) y su
                      opacidad de la del analog a la del contrato: 3,2:1 → 4,8:1 en el peor caso, que
                      es el tema claro sobre el fondo de la tarjeta. */}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-tight text-base-content/70">
                    {/* C1 — el chip sube del tamaño extra pequeño del analog al de 12px: 10px → 12px,
                        y por debajo de 12px está prohibido por la regla heredada del contrato padre. */}
                    <BadgePriority
                      text={
                        ETIQUETA_ESTADO_DESPACHO[
                          String(despacho.estado ?? "").toLowerCase()
                        ] ?? despacho.estado
                      }
                      priority={String(despacho.estado ?? "")}
                      size="sm"
                    />
                    {fecha && (
                      <span className="whitespace-nowrap">{`${rotuloFecha}: ${fecha}`}</span>
                    )}
                    {/* La meta de intentos SÓLO con el contador en uno o más, y compuesta del dato.
                        Un cero es ruido —nadie ha intentado nada y eso ya lo dice el chip— y un
                        número escrito a mano es la señal de alarma que la investigación nombró. */}
                    {despacho.intentos >= 1 && (
                      <span className="whitespace-nowrap">{`Intentos: ${despacho.intentos}`}</span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center">
                    {/* 🔴 EL MOTIVO VA EN ESTE DIV ENVOLTORIO, NUNCA EN EL BOTÓN. Dos razones
                        medidas: un `<button disabled>` no recibe eventos de puntero, así que una
                        burbuja colgada de él no se dispararía nunca —es la regla que
                        `BotonAccionFila` dejó escrita en su cabecera—; y la burbuja hacia abajo
                        caería sobre la banda de la tarjeta siguiente, que fue un hallazgo del UAT de
                        la Fase 03.22. De ahí `tooltip-left`. */}
                    <div
                      className="tooltip tooltip-left"
                      data-tip={boton.motivo ?? etiquetaBoton}
                    >
                      {/* C2 — el botón sube del tamaño extra pequeño al pequeño: 11px/24px →
                          12px/32px, y 32px iguala la altura de la fila. */}
                      <Boton
                        deshabilitado={boton.apagado}
                        estilos="btn btn-soft btn-primary btn-sm shrink-0"
                        texto={boton.texto}
                        etiquetaAccesible={etiquetaBoton}
                        titulo={boton.motivo ?? etiquetaBoton}
                        onClick={(e) => {
                          // La tarjeta vive dentro de una fila expandida de la tabla, que tiene su
                          // propio manejador de clic. El de la acción se queda aquí.
                          e?.stopPropagation();
                          onEnviarCorreo(despacho);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
};

export default TarjetaFormaNotificacion;
