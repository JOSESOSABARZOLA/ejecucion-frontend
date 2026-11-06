/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: La línea de tiempo del expediente — las TRES trazas fundidas (D-07, D-08)
 * Archivo: ModalTimeline.tsx
 * Responsabilidad: Enseñar la vida del expediente juntando la bitácora INTERNA del módulo
 *   (`GET /epas/:eejeId/bitacora`, la traza del art. 82 CRE), el historial del caso en
 *   ASIGNACIONES (`GET /sorteo/caso/:caseId/historial`) y el historial de ÓRDENES DE PAGO
 *   (`GET /ordenes-pago/:eejeId/historial`, anuladas incluidas), y **decir cuál de las tres le
 *   falta** cuando le falta alguna.
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-07
 * Modificado por: Andrés Miño — 2026-09-21 (re-apuntado a la bitácora del EPAS y al historial de
 *   Asignaciones, D-07/D-08)
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 03 — D-07: el historial de órdenes
 *   como TERCER origen, y C4)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 20 — G-04: la nota antes del sorteo
 *   en vez del aviso de «sin identificador»; A12: el foco vuelve al disparador al cerrar)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-ft7: en la tabla de cambios, una fecha ISO
 *   se lee «6 nov 2026, 09:30» y no en crudo)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-tlo: la línea de tiempo se enseña con lo
 *   más nuevo arriba y lo más antiguo abajo)
 *
 *   ── QUÉ SE CONSERVA Y QUÉ CAMBIA ─────────────────────────────────────────────────────────────
 *   Se CONSERVA el cascarón del modal, la lista de línea de tiempo de daisyUI, la fecha en
 *   monoespaciada y la tabla plegable de cambios: es exactamente la forma que D-08 pide y no había
 *   nada que rehacer ahí.
 *
 *   CAMBIA de dónde salen los datos. Llamaba a la ruta de línea de tiempo del módulo heredado
 *   `case-administration` —el árbol roto del backlog 999.1— con el `eres_id` de Resolución, y
 *   volcaba a la consola del navegador el objeto de eventos COMPLETO, con datos personales del
 *   administrado dentro. (La ruta no se cita literal a propósito: la guarda del Plan 02 lee líneas.)
 *
 *   ── 🔴 EL ESTADO DEGRADADO ES EL ESTADO NORMAL ───────────────────────────────────────────────
 *   Medido sobre EjecucionDB el 2026-09-21: solo **9 de 72** reflejos de sorteo tienen `case_id`.
 *   Para los otros 63 no hay mitad de Asignaciones que pedir, y el modal lo DICE en vez de fingir
 *   que la traza está completa. Sin `caseId` **la petición ni siquiera se dispara**: pegarle a la
 *   ruta con un valor no definido produciría un error del servidor disfrazado de «no hay historial».
 *
 *   Y un fallo parcial —en cualquiera de las dos direcciones— **nunca deja el modal en blanco**: la
 *   mitad que sí llegó se enseña con su aviso y su «Reintentar». Fundir en el servidor ataría la
 *   traza normativa interna a la disponibilidad de un servicio externo; por eso se funde aquí.
 */
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import type { CambioTraza, OrigenTraza } from "../../interfaces/ICase";
import type { DatosLineaDeTiempo } from "../../interfaces/IModal";
import { EpasService } from "../../services/EpasService";
import { OrdenPagoService } from "../../services/OrdenPagoService";
import { SorteoService } from "../../services/SorteoService";
import {
  fundirLineaDeTiempo,
  type EventoLinea,
} from "../../utils/lineaDeTiempo.util";
import Alert from "../common/Alert";
import EmptyState from "../common/EmptyState";
import Iconos from "../common/Iconos";
import Loading from "../common/Loading";
import { DatetimeUtil } from "../../utils/datetime.util";

interface ModalTimelineProps {
  caseData: DatosLineaDeTiempo;
  onClose: () => void;
}

interface ChangeListProps {
  cambios: CambioTraza[];
}

interface TimelineListProps {
  eventos: EventoLinea[];
}

/** Lo que una pasada de carga deja: la lista fundida y qué fuente —si alguna— no llegó. */
interface TrazasCargadas {
  eventos: EventoLinea[];
  fallaInterna: boolean;
  fallaAsignaciones: boolean;
  fallaOrdenes: boolean;
}

/**
 * Copy de los cinco estados degradados y del vacío — UI-SPEC §5.3, literal.
 *
 * Vive en una constante y no incrustado en el JSX porque es CONTRATO: son las frases con las que el
 * módulo admite que no tiene toda la historia, y tienen que poder compararse con el documento sin
 * leer el render.
 */
const COPY = {
  sinCaseId:
    "Este expediente no tiene identificador de asignación resuelto: se muestra únicamente la traza interna del módulo.",
  fallaAsignaciones:
    "No se pudo consultar la traza de Asignaciones. Se muestra únicamente la traza interna del módulo.",
  fallaInterna: "No se pudo cargar la traza del expediente.",
  fallaOrdenes:
    "No se pudo consultar el historial de órdenes de pago. Se muestran las demás trazas del expediente.",
  sinEventos: "Todavía no hay movimientos registrados en este expediente.",
} as const;

/**
 * 🔴 EL ORIGEN LLEVA ETIQUETA DE TEXTO, no solo icono y color (UI-SPEC §3.3). Tres fuentes distintas
 * contando la vida del mismo expediente es exactamente el caso donde un matiz no basta: quien mire
 * la traza tiene que poder decir en voz alta de quién es cada hecho.
 */
const ETIQUETA_ORIGEN: Record<OrigenTraza, string> = {
  interna: "Módulo de Ejecución",
  asignaciones: "Asignaciones",
  ordenes: "Órdenes de pago",
};

/** El punto de la línea: icono del dominio, pedido por nombre al único envoltorio de iconos. */
const ICONO_ORIGEN: Record<OrigenTraza, string> = {
  interna: "expediente",
  asignaciones: "recepcion",
  // `pago` (faMoneyBillWave) YA EXISTE en el mapa de iconos y es con el que el módulo habla de
  // dinero en el resto de pantallas. Esta fase no añade ni un icono.
  ordenes: "pago",
};

/**
 * Color del punto. Acompaña a la etiqueta; NUNCA la sustituye.
 *
 * 🔴 `ordenes` va en `text-base-content` y NO en un color, y es una decisión MEDIDA (UI-SPEC §3.1).
 * WCAG 1.4.11 pide 3:1 a un icono: `text-success` da 1,8:1 en claro y `text-warning` 2,5:1, así que
 * los dos quedan fuera; `text-base-content` da 11,8:1 en claro y 16,4:1 en oscuro y es el único que
 * despeja los DOS temas sin inventar un hex nuevo para el módulo. Que el punto quede neutro no
 * pierde nada: el origen ya va con icono propio y con etiqueta de texto, y el color es el tercer
 * canal, redundante.
 *
 * ⚠️ `asignaciones` arrastra 1,6:1 en tema oscuro — defecto HEREDADO de la 03.19, anotado y no
 * arreglado aquí: cambiarlo es repintar un origen que esta fase no toca.
 */
const COLOR_ORIGEN: Record<OrigenTraza, string> = {
  interna: "h-5 w-5 text-primary",
  asignaciones: "h-5 w-5 text-secondary",
  ordenes: "h-5 w-5 text-base-content",
};

/** Fecha larga con hora, en monoespaciada: es la que se cita cuando la traza se usa como prueba. */
const fechaLegible = (iso: string): string => {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Fecha ISO completa (con hora) tal como la guarda la bitácora: «2026-11-06T14:30:00.000Z». */
const PATRON_FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Un valor de la tabla de cambios, legible: una fecha ISO sale «6 nov 2026, 09:30»; lo demás, tal
 * cual. Solo cambia la PRESENTACIÓN: el valor lo decidió el servidor.
 */
const valorLegible = (valor: string): string =>
  PATRON_FECHA_ISO.test(valor)
    ? DatetimeUtil.formatFechaHoraCorta(valor) || valor
    : valor;

/**
 * La tabla plegable de cambios de un evento.
 *
 * 🔴 Solo se monta SI HAY CAMBIOS. Antes se montaba siempre, así que cada evento de Asignaciones
 * —que nunca trae diff— y cada hito interno sin campos cambiados pintaban una caja «Cambios
 * realizados» vacía. Una caja vacía no es un dato ausente: es ruido que hace dudar de los demás.
 */
const ChangesList: FC<ChangeListProps> = ({ cambios }) => (
  <div className="bg-base-200 border border-base-300 rounded-lg p-4 w-full md:w-96">
    <div>
      <p className="text-base-content font-semibold mb-3">Cambios realizados</p>

      {/* Detalle de cambios colapsable */}
      <div className="collapse collapse-arrow bg-base-100 border border-base-300">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium">
          Ver {cambios.length} cambios realizados
        </div>
        <div className="collapse-content pt-2">
          <div className="overflow-x-auto">
            <table className="table table-xs w-full">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                {cambios.map((cambio, i) => (
                  <tr key={`${cambio.campo}-${i}`}>
                    <td className="font-bold">{cambio.campo}</td>
                    <td className="text-error line-through">
                      {valorLegible(cambio.antes)}
                    </td>
                    <td className="text-success font-semibold">
                      {valorLegible(cambio.despues)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/** La lista de eventos ya fundida. La `key` es la clave estable del evento, no su posición. */
const TimelineList: FC<TimelineListProps> = ({ eventos }) => (
  <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical mt-3">
    {eventos.map((evento, index) => (
      <li key={evento.clave}>
        {index > 0 && <hr />}
        <div className="timeline-start mb-10">
          <time className="font-mono italic">{fechaLegible(evento.fecha)}</time>
          {/* Cuerpo/700 de la escala de la fase. Antes era `text-lg font-black`, fuera de escala. */}
          <div className="text-[0.95rem] font-bold">{evento.titulo}</div>
          <div className="mt-1">
            {/*
             * 🔴 C4 — UNA LÍNEA QUE ARREGLA LOS TRES ORÍGENES. Este `span` es único y su texto lo
             * resuelve `ETIQUETA_ORIGEN[evento.origen]`, así que la clase vale para todos.
             * Llevaba el modificador informativo de color y el tamaño extra pequeño, y medía
             * ~2,3:1 en tema claro: falla AA con cualquier espacio de color. Sin modificador de
             * color, `badge-soft` cae a `--color-base-content` y sube a ~10,3:1 manteniendo el peso
             * visual callado que buscaba; el tamaño pequeño saca el texto de los 10px, que están
             * fuera de la escala declarada. No se pasa al relleno sólido —que también pasaría— para
             * no llenar el modal de chips de color, uno por evento.
             */}
            <span className="badge badge-soft badge-sm">
              {ETIQUETA_ORIGEN[evento.origen]}
            </span>
          </div>
          <p className="text-sm">{`Actor: ${evento.actor}`}</p>
          {evento.detalle && (
            <p className="text-sm opacity-80">{evento.detalle}</p>
          )}
        </div>

        <div className="timeline-middle">
          <Iconos
            nombre={ICONO_ORIGEN[evento.origen]}
            estilo={COLOR_ORIGEN[evento.origen]}
          />
        </div>

        <div className="timeline-end mb-10">
          {evento.cambios && evento.cambios.length > 0 && (
            <ChangesList cambios={evento.cambios} />
          )}
        </div>

        {index < eventos.length - 1 && <hr />}
      </li>
    ))}
  </ul>
);

/**
 * El modal de la línea de tiempo. Pide las dos mitades EN PARALELO y con `allSettled`: que una falle
 * no puede impedir que la otra se pinte, y eso es una decisión de diseño, no una tolerancia.
 */
export const ModalTimeline: FC<ModalTimelineProps> = ({
  caseData,
  onClose,
}) => {
  const { eejeId, caseId, expNumber, momento } = caseData;

  /**
   * AL DESMONTAR, EL FOCO VUELVE A QUIEN ABRIÓ EL MODAL (A12 del 03.19, Fase 03.24 Plan 20).
   *
   * `ModalContainer` no lo hace. Sin esto, cerrar con el teclado deja el foco en el `<body>` y quien
   * navega sin ratón tiene que recorrer la tabla entera para volver al `⑂` de su fila. Es el mismo
   * efecto que la ficha (`ModalExpedienteLote`), y de paso arregla «Mis expedientes». Si el
   * disparador ya salió del documento (la fila se recargó), no se le intenta devolver nada.
   */
  useEffect(() => {
    const disparador = document.activeElement as HTMLElement | null;
    return () => {
      if (
        disparador &&
        disparador.isConnected &&
        typeof disparador.focus === "function"
      ) {
        disparador.focus();
      }
    };
  }, []);

  const [eventos, setEventos] = useState<EventoLinea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallaInterna, setFallaInterna] = useState(false);
  const [fallaAsignaciones, setFallaAsignaciones] = useState(false);
  const [fallaOrdenes, setFallaOrdenes] = useState(false);

  // El modal se desmonta al cerrarlo y las dos peticiones pueden llegar después. Sin esta marca, la
  // respuesta tardía de un REINTENTO intentaría pintar sobre un componente que ya no existe (la
  // carga inicial se protege con su propia bandera de efecto, más abajo).
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  /**
   * Pide las tres fuentes y devuelve lo que llegó. **No toca el estado**: quien lo aplica es el
   * llamador, desde el `then`. Separarlo no es ceremonia — un `setState` síncrono dentro de un
   * efecto encadena un render de más, y ésta es la forma que el resto de los modales del módulo ya
   * usa para cargar (`ModalExpedienteLote`).
   */
  const pedirTrazas = useCallback(async (): Promise<TrazasCargadas> => {
    // 🔴 LA GUARDA: sin `caseId` no hay a qué caso pedirle historial, así que NO se pide. Es la
    // misma guarda que la bandeja usa para aceptar, y por el mismo motivo: pegarle a la ruta con un
    // valor no definido devuelve un error del servidor que se leería como «este caso no tiene
    // historial», que es una afirmación distinta y falsa.
    //
    // 🔴 LA ASIMETRÍA DE LA TERCERA ES DELIBERADA — NO LA «ARREGLE». El historial de órdenes va
    // SIN guarda y SIN ternario: el `eejeId` siempre está, y condicionar la llamada a que la fila
    // tenga orden vigente escondería justo el caso que D-07 quiere iluminar —por qué este
    // expediente tuvo dos números—, porque las ANULADAS no se ven en la fila y solo salen aquí.
    const [interna, asignaciones, ordenes] = await Promise.allSettled([
      EpasService.bitacora(eejeId),
      caseId != null
        ? SorteoService.historialCaso(caseId)
        : Promise.resolve([]),
      OrdenPagoService.historial(eejeId),
    ]);

    const trazaInterna =
      interna.status === "fulfilled" ? (interna.value ?? []) : [];
    const trazaAsignaciones =
      asignaciones.status === "fulfilled" ? (asignaciones.value ?? []) : [];
    const trazaOrdenes =
      ordenes.status === "fulfilled" ? (ordenes.value ?? []) : [];

    return {
      // La fusión ordena de lo más antiguo a lo más nuevo; el modal lo enseña al revés, con lo
      // último arriba (quick 261106-tlo). El desempate por clave sigue siendo determinista.
      eventos: fundirLineaDeTiempo(
        trazaInterna,
        trazaAsignaciones,
        trazaOrdenes,
      ).reverse(),
      fallaInterna: interna.status === "rejected",
      // Solo es un FALLO si se llegó a pedir: sin `caseId` la mitad no falta por avería.
      fallaAsignaciones: caseId != null && asignaciones.status === "rejected",
      // Aquí sí es siempre un fallo: la petición se hace siempre, así que un rechazo es una avería.
      fallaOrdenes: ordenes.status === "rejected",
    };
  }, [eejeId, caseId]);

  /** Vuelca a la pantalla lo que llegó. Un solo sitio, para que los cuatro estados no se desincronicen. */
  const aplicar = useCallback((trazas: TrazasCargadas) => {
    setEventos(trazas.eventos);
    setFallaInterna(trazas.fallaInterna);
    setFallaAsignaciones(trazas.fallaAsignaciones);
    setFallaOrdenes(trazas.fallaOrdenes);
    setCargando(false);
  }, []);

  useEffect(() => {
    let vigente = true;
    void pedirTrazas().then((trazas) => {
      if (!vigente) return;
      aplicar(trazas);
    });
    return () => {
      vigente = false;
    };
  }, [pedirTrazas, aplicar]);

  /** «Reintentar»: vuelve a encender el indicador y repite las dos peticiones. */
  const reintentar = () => {
    setCargando(true);
    void pedirTrazas().then((trazas) => {
      if (!vivo.current) return;
      aplicar(trazas);
    });
  };

  // Antes del sorteo no hay identificador de asignación que resolver: su ausencia no es un aviso.
  const antesDelSorteo = momento === "antesDelSorteo";
  const sinMitadDeAsignaciones = caseId == null && !antesDelSorteo;
  // El vacío solo se afirma cuando las TRES respondieron: si una falló, «no hay movimientos» sería
  // mentira y además taparía la avería. La tercera bandera cuenta igual que las otras dos.
  const vacioHonesto =
    !cargando &&
    eventos.length === 0 &&
    !(fallaInterna || fallaAsignaciones || fallaOrdenes);

  return (
    <div className="modal-box max-w-5xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        {/* Encabezado del modal con título y botón de cerrar */}
        <div className="app-modules-modal-header">
          <div className="min-w-0">
            <p className="app-modules-modal-kicker">
              {expNumber ? `Expediente ${expNumber}` : "Expediente"}
            </p>
            <h2 className="app-modules-modal-title">Línea de tiempo</h2>
          </div>
          <div className="app-modules-modal-meta">
            <button
              type="button"
              className="app-modules-modal-close"
              onClick={onClose}
              aria-label="Cerrar modal de línea de tiempo"
            >
              ×
            </button>
          </div>
        </div>

        <div className="app-modules-modal-body">
          <div className="app-modules-modal-content">
            {cargando && <Loading />}

            {!cargando && (
              <div className="flex flex-col gap-2">
                {/*
                 * Antes del sorteo (Bandeja de Entrada, G-04) no se pinta NADA: ni el aviso de «sin
                 * identificador», que sería falso, ni una nota propia (el usuario pidió quitarla el
                 * 2026-10-21, en la verificación del Plan 30). Solo los movimientos.
                 */}

                {/* (b) El expediente no tiene identidad en Asignaciones: no es una avería. */}
                {sinMitadDeAsignaciones && (
                  <Alert variant="info" message={COPY.sinCaseId} />
                )}

                {/* (c) Se pidió y no respondió: avería del externo, con reintento. */}
                {fallaAsignaciones && (
                  <Alert
                    variant="warning"
                    message={COPY.fallaAsignaciones}
                    buttonFunction={reintentar}
                  />
                )}

                {/*
                 * (c bis) El tercer origen no respondió. Un fallo suyo NUNCA tumba la traza
                 * normativa interna ni deja el modal en blanco: la lista se enseña igual con lo que
                 * sí llegó. Y el expediente SIN ninguna orden no pinta nada —ni evento, ni aviso,
                 * ni un «sin órdenes»—: es el caso de 156 de 157, y un aviso por expediente sería
                 * ruido que no informa.
                 */}
                {fallaOrdenes && (
                  <Alert
                    variant="warning"
                    message={COPY.fallaOrdenes}
                    buttonFunction={reintentar}
                  />
                )}

                {/* (d) Falló la traza propia. Lo de Asignaciones, si llegó, se enseña igualmente. */}
                {fallaInterna && (
                  <Alert
                    variant="error"
                    message={COPY.fallaInterna}
                    buttonFunction={reintentar}
                  />
                )}

                {/* (a) La lista fundida. Se pinta aunque haya avisos: media historia es historia. */}
                {eventos.length > 0 && <TimelineList eventos={eventos} />}

                {/* (e) Ninguna de las dos trae eventos, y ninguna falló. */}
                {vacioHonesto && <EmptyState text={COPY.sinEventos} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
