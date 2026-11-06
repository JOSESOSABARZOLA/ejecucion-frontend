/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Bandeja de Salida — tres pestañas, despacho POR LOTE (2026-09-17, ampliada el 09-18)
 * Archivo: BandejaSalidaPage.tsx
 * Responsabilidad: La superficie del CIERRE del flujo local. Reescrita el 2026-09-17: donde antes
 *   listaba LOTES que llegaban por sync y ofrecía «Enviar a SG» sobre cada uno, ahora lista los
 *   EXPEDIENTES pendientes de despacho y el botón GENERA un lote con los elegidos.
 *
 *     · «Envío a SG» — expedientes en PENDIENTE_ARCHIVO: su trámite terminó y el físico espera
 *       salir al archivo. Despacharlos crea un lote FINALIZADO, lo remite por el seam de SG y —solo
 *       si SG acepta— ARCHIVA cada expediente.
 *     · «Devolución a DMR» — expedientes devueltos a Resolución: ya se devolvieron uno a uno desde
 *       la Bandeja de Entrada, o por providencia de nulidad; lo que faltaba era el lote.
 *     · «Devolución a DMIT» — lo mismo, para los que vuelven a Instrucción. Aquí SOLO llegan los
 *       devueltos por NULIDAD de autoridad competente: el triage de la Entrada devuelve siempre a
 *       la DMR.
 *
 *   ⟳ 2026-10-12 (261012-giz): las TRES pestañas reciben además los RECURSOS ACEPTADOS con ese
 *   destino (Archivo → SG, Resolución → DMR, Instrucción → DMIT). La fila lo dice con la etiqueta
 *   «Recurso aceptado», porque en cada pestaña se mezclan ya dos actos.
 *
 *   🔴 LA UNIDAD QUE SE ELIGE ES EL EXPEDIENTE; EL LOTE ES EL RESULTADO. Es lo contrario de la
 *   Bandeja de Entrada, donde el lote llega hecho de fuera y el usuario lo acciona entero. Aquí el
 *   lote NACE en Ejecución al despachar, con su número propio — y el prefijo distingue las tres
 *   salidas (DME-SG-… / DME-DMR-… / DME-DMIT-…), porque `envl_tipo` NO las distingue: las dos
 *   devoluciones son `DEVOLUCION`.
 *
 *   🔴 LA REVISIÓN DEL DIRECTOR (2026-09-18, encargo del área). En las dos pestañas de devolución
 *   cada fila lleva su botón «Observaciones (N)»: el director ve lo que el secretario abogado anotó
 *   y aprueba o rechaza cada cosa. Lo aprobado se imprime en el memorando; lo rechazado no viaja. Y
 *   mientras quede una sin revisar, la casilla de esa fila está APAGADA — el backend rechaza el
 *   despacho igual, y apagarla aquí evita elegir treinta expedientes para recibir el error al
 *   confirmar. Si el director las rechaza todas, el expediente se cae de la devolución y vuelve a la
 *   Bandeja de Entrada: la fila desaparece, y por eso el modal lo dice con un aviso.
 *
 *   🔴 LA FIRMA DEL MEMORANDO DE DEVOLUCIÓN (Fase 03.21, D-19/D-24). Hacia la DMR o la DMIT el lote
 *   sale con un memorando que firma el DIRECTOR en el mismo acto de despachar, así que esas dos
 *   devoluciones son solo suyas: para otro rol el botón se apaga y su envoltorio dice por qué (el
 *   backend lo rechaza igual). La clave se pide DENTRO de la confirmación (`CampoClaveCertificado`
 *   como hijo de `ConfirmationDetail`, el patrón del combo de actas) y nunca en SG, que no genera
 *   memorando. Si la firma falla no queda nada hecho: ni lote ni memorando, y el aviso lo dice.
 *   `ConfirmationDetail` apaga su botón mientras haya aviso, y no se toca: escribir en el campo
 *   retira el aviso y eso es lo que rearma el reintento. La clave vive en el estado del hook, se
 *   borra al cerrar la confirmación y al terminar cada envío, y no va al almacenamiento del
 *   navegador, a la consola ni a ningún aviso.
 *
 *   Toma de Resolución (SentCasesPage) y de la Bandeja de Entrada la misma receta: HeaderPage +
 *   panel con pestañas + buscador y rango de fechas en el servidor + Pagination compartida. Solo
 *   componentes del kit; sin tablas ni botones a mano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-17 (reescrita: dos pestañas y despacho por lote).
 * Modificado por: Andrés Miño — 2026-09-18 (tercera pestaña: devolución por nulidad a la DMIT).
 * Modificado por: Andrés Miño — 2026-09-18 (el director revisa las observaciones antes de devolver).
 * Modificado por: Andrés Miño — 2026-10-12 (la DMIT es Instrucción; los recursos aceptados salen por aquí).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14: la devolución a DMR/DMIT solo la
 *   despacha el director, con su clave de firma en la confirmación; el fallo de firma se reintenta
 *   escribiendo en el campo, y el aviso de éxito dice si el memorando salió firmado).
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: la clave rechazada se dice solo bajo el
 *   campo, con el foco, sin el mensaje de la confirmación; el resto de fallos los lleva
 *   ConfirmationDetail al aviso flotante)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useUser } from "../context/UserContext";
import { useToast } from "../hooks/useToast";
import {
  EntradaLotesService,
  type DestinoSalida,
  type ExpedientePendienteSalida,
} from "../services/EntradaLotesService";
import { isSalidaActionVisible } from "../config/salidaGating";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert, { type AlertVariant } from "../components/common/Alert";
import Boton from "../components/common/Boton";
import Pagination from "../components/common/Pagination";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import ModalExpedienteLote from "../components/modals/ModalExpedienteLote";
import { DatetimeUtil } from "../utils/datetime.util";
import { etiquetaEstadoEpas } from "../config/estadosEpas";
import CampoClaveCertificado from "../components/sorteo/CampoClaveCertificado";
import { useClaveDeFirma } from "../hooks/useClaveDeFirma";
import {
  AVISO_SIN_FIRMADOR,
  CONSECUENCIA_FALLO_FIRMA,
  ERROR_CLAVE_INCORRECTA,
  esClaveIncorrecta,
  esErrorDeFirma,
  mensajeDeFalloDeFirma,
} from "../config/firmaCopy";

/**
 * Por qué el botón de despacho está apagado en DMR/DMIT para quien no es director (Fase 03.21, D-24):
 * el memorando de devolución lo firma él en el mismo acto. Va en el `data-tip` del ENVOLTORIO.
 */
const MOTIVO_SOLO_DIRECTOR_DEVOLUCION =
  "Solo el director despacha y firma el memorando de devolución.";

/** El estado del recurso aceptado (2026-10-12): la única fila que la pantalla tiene que distinguir. */
const RECURSO_ACEPTADO = "RECURSO_ACEPTADO";

/**
 * NOMBRE LARGO de cada destino, para el campo «Destino» de la confirmación.
 *
 * 🔴 UN MAPA Y NO UN TERNARIO. Con dos destinos el ternario cabía en una línea; con tres, encadenar
 * ternarios es justo donde se cuela la dirección equivocada en la pantalla que confirma a dónde sale
 * un expediente. Es el mismo mapa que el backend tiene en el builder del memorando, y por el mismo
 * motivo: la dirección se escribe en un solo sitio.
 */
const NOMBRE_DEL_DESTINO: Record<DestinoSalida, string> = {
  SG: "Secretaría General",
  DMR: "Dirección Metropolitana de Resolución",
  DMIT: "Dirección Metropolitana de Instrucción",
};

/** Las tres pestañas, en el orden en que se pidieron. */
const PESTANAS: {
  destino: DestinoSalida;
  label: string;
  titulo: string;
  vacio: string;
  /** Copy de la confirmación: qué se va a hacer, dicho sin prometer integración real. */
  confirmar: { titulo: string; estado: string; descripcion: string; boton: string };
}[] = [
  {
    destino: "SG",
    label: "Envío a SG",
    titulo: "Expedientes listos para archivar",
    vacio:
      "No hay expedientes pendientes de archivo. Llegan aquí cuando se emite la providencia de archivo o de prescripción, y también los recursos aceptados con destino Archivo.",
    confirmar: {
      titulo: "Generar lote y enviar a Secretaría General",
      estado: "Listo para remitir",
      descripcion:
        "Se generará un lote NUEVO con los expedientes seleccionados (pendientes de archivo y recursos aceptados con destino Archivo) y se remitirá a Secretaría General para su archivo. Si Secretaría General lo acepta, cada expediente quedará ARCHIVADO y dejará de aparecer en las bandejas de Ejecución.",
      boton: "Sí, generar y enviar",
    },
  },
  {
    destino: "DMR",
    label: "Devolución a DMR",
    titulo: "Expedientes por devolver a Resolución",
    vacio:
      "No hay expedientes por devolver. Llegan aquí los que se devuelven desde la Bandeja de Entrada, y también los recursos aceptados con destino Resolución.",
    confirmar: {
      titulo: "Generar lote de devolución a la DMR",
      estado: "Listo para devolver",
      descripcion:
        "Se generará un lote NUEVO con los expedientes seleccionados para remitirlos a la Dirección Metropolitana de Resolución. Los expedientes ya constan como devueltos (o con el recurso aceptado hacia Resolución); lo que se crea aquí es el lote con el que se remiten.",
      boton: "Sí, generar el lote",
    },
  },
  {
    destino: "DMIT",
    label: "Devolución a DMIT",
    titulo: "Expedientes por devolver a Instrucción",
    vacio:
      "No hay expedientes por devolver a Instrucción. Llegan aquí los devueltos por NULIDAD de autoridad competente y los recursos aceptados con destino Instrucción, no los del triage de la Bandeja de Entrada: esos van a la DMR.",
    confirmar: {
      titulo: "Generar lote de devolución a la DMIT",
      estado: "Listo para devolver",
      descripcion:
        "Se generará un lote NUEVO con los expedientes seleccionados para remitirlos a la Dirección Metropolitana de Instrucción. Los expedientes ya constan como devueltos por nulidad (o con el recurso aceptado hacia Instrucción); lo que se crea aquí es el lote con el que se remiten.",
      boton: "Sí, generar el lote",
    },
  },
];

const BandejaSalidaPage = () => {
  const { user } = useUser();
  const { addToast } = useToast();

  const rolName = user?.rolName ?? "";
  const puedeDespachar = isSalidaActionVisible("enviarSg", rolName);
  /**
   * 🔴 SOLO EL DIRECTOR (2026-09-18). El secretario abogado comparte esta bandeja y despacha, pero
   * NO revisa: él es quien anotó las observaciones. El botón ni se ofrece; el backend lo cierra
   * igual con `@Roles('director')`.
   */
  const puedeRevisar = isSalidaActionVisible("revisarObservaciones", rolName);
  /**
   * 🔴 LA DEVOLUCIÓN A DMR/DMIT ES DEL DIRECTOR (Fase 03.21, D-24): su memorando lo firma él al
   * despachar. Mismo criterio de rol que el resto de la pantalla (minúsculas, cadena exacta).
   */
  const esDirector = rolName.trim().toLowerCase() === "director";

  // La clave de firma del director para el memorando de devolución (Fase 03.21, D-19).
  const clave = useClaveDeFirma();
  /** Estado E del campo: la última firma se rechazó por la clave. */
  const [errorClave, setErrorClave] = useState(false);
  /**
   * Tras un rechazo de la clave, el foco vuelve al campo. Por ref de callback y no por efecto:
   * mientras confirma, `ConfirmationDetail` desmonta su contenido, así que el campo VUELVE A MONTARSE
   * al terminar y es en ese montaje cuando hay que enfocarlo.
   */
  const pedirFocoClaveRef = useRef(false);
  const refCampoClave = useCallback((campo: HTMLInputElement | null) => {
    if (campo && pedirFocoClaveRef.current) {
      pedirFocoClaveRef.current = false;
      campo.focus();
    }
  }, []);

  const [destino, setDestino] = useState<DestinoSalida>("SG");
  const pestana = useMemo(
    () => PESTANAS.find((p) => p.destino === destino) ?? PESTANAS[0],
    [destino],
  );

  const [items, setItems] = useState<ExpedientePendienteSalida[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yaCargoAlgunaVez, setYaCargoAlgunaVez] = useState(false);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const [search, setSearch] = useState("");
  const [searchAplicado, setSearchAplicado] = useState("");

  /** Selección de expedientes, POR PESTAÑA: cambiar de pestaña no arrastra lo elegido en la otra. */
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  /** El expediente cuyas observaciones está revisando el director; `null` con el modal cerrado. */
  const [revisando, setRevisando] =
    useState<ExpedientePendienteSalida | null>(null);

  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  /** Guardia contra respuestas viejas (mismo motivo que en la Bandeja de Entrada). */
  const peticionRef = useRef(0);

  // Rebote del buscador; vuelve a la primera página en el mismo gesto (un render ⇒ una consulta).
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchAplicado(search);
      setPageIndex(0);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const fetchPendientes = useCallback(async () => {
    if (!puedeDespachar) {
      setItems([]);
      setTotal(0);
      setPages(0);
      return;
    }
    const miTurno = ++peticionRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await EntradaLotesService.pendientesSalida(destino, {
        search: searchAplicado,
        limit: pageSize,
        offset: pageIndex * pageSize,
      });
      if (miTurno !== peticionRef.current) return;
      setItems(res.data);
      setTotal(res.total);
      setPages(res.pages);
      setYaCargoAlgunaVez(true);
    } catch (err) {
      if (miTurno !== peticionRef.current) return;
      setError(
        mensajeParaUsuario(err, "No se pudo cargar la Bandeja de Salida. Intente más tarde."),
      );
    } finally {
      if (miTurno === peticionRef.current) setLoading(false);
    }
  }, [puedeDespachar, destino, searchAplicado, pageIndex, pageSize]);

  useEffect(() => {
    void fetchPendientes();
  }, [fetchPendientes]);

  /** Cambiar de pestaña reinicia página, búsqueda y selección: son universos distintos. */
  const cambiarPestana = (nuevo: DestinoSalida) => {
    if (nuevo === destino) return;
    setDestino(nuevo);
    setPageIndex(0);
    setSearch("");
    setSearchAplicado("");
    setSeleccion(new Set());
  };

  /** Las dos pestañas de devolución. El archivo en SG no lleva observaciones que revisar. */
  const esDevolucion = destino !== "SG";
  /** DMR/DMIT y quien mira no es el director: puede ver la bandeja, pero no despacharla (D-24). */
  const devolucionSoloDirector = esDevolucion && !esDirector;

  /** Cierra la confirmación y olvida la clave tecleada y el fallo anterior (UI-SPEC §2.3). */
  const cerrarConfirmacion = () => {
    setConfirmando(false);
    setMensaje(null);
    setErrorClave(false);
    clave.limpiar();
  };

  /**
   * Escribir en el campo es un intento nuevo: retira el aviso (lo único que rearma el botón de
   * `ConfirmationDetail`, UI-SPEC §6) y el estado E.
   */
  const editarClave = (valor: string) => {
    clave.setClave(valor);
    setMensaje(null);
    setErrorClave(false);
  };

  /**
   * 🔴 EL CANDADO DE LA REVISIÓN (2026-09-18). Un expediente con observaciones que el director
   * todavía no ha aprobado ni rechazado NO se despacha: el memorando las imprime y él lo firma. El
   * backend lo rechaza igual; apagarlo aquí es lo que evita elegir treinta expedientes y recibir el
   * error al confirmar.
   */
  const bloqueado = (i: ExpedientePendienteSalida) =>
    esDevolucion && i.observacionesPendientes > 0;

  const alternar = (i: ExpedientePendienteSalida) => {
    if (bloqueado(i)) return;
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(i.eejeId)) next.delete(i.eejeId);
      else next.add(i.eejeId);
      return next;
    });
  };

  /**
   * «Todos» marca o desmarca los de ESTA página, no los de toda la bandeja — y solo los que se
   * pueden despachar: los bloqueados se saltan, igual que su casilla.
   */
  const seleccionables = items.filter((i) => !bloqueado(i));
  const todosDeLaPagina =
    seleccionables.length > 0 &&
    seleccionables.every((i) => seleccion.has(i.eejeId));
  const alternarTodos = () => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const i of seleccionables) {
        if (todosDeLaPagina) next.delete(i.eejeId);
        else next.add(i.eejeId);
      }
      return next;
    });
  };

  /**
   * Despacha lo elegido. El padre es dueño del mensaje (contrato de ConfirmationDetail: lo dice en
   * el aviso flotante y bloquea el reintento): solo el éxito cierra el diálogo.
   *
   * ⚠️ `despachado: false` NO es un error del todo: el lote se creó con sus expedientes dentro y lo
   * que falló fue la remisión. Se dice tal cual, con un aviso y no con un error, porque el trabajo
   * de elegir treinta expedientes no se perdió.
   */
  const confirmarDespacho = async () => {
    setMensaje(null);
    setErrorClave(false);
    try {
      const res = await EntradaLotesService.despacharSalida(
        destino,
        [...seleccion],
        // Hacia SG no hay memorando que firmar: la clave no viaja.
        esDevolucion ? clave.claveParaEnviar : undefined,
      );
      if (res.despachado) {
        // En la DEVOLUCIÓN el memorando ES parte del acto, así que se dice si salió o no. Callarlo
        // dejaría al usuario sin saber que existe el documento con el que devolvió —o, peor, sin
        // saber que NO se generó, que es justo cuando tiene que hacer algo al respecto.
        //
        // 🔴 Pregunta «distinto de SG», como el backend: enumerar los destinos de devolución haría
        // que una cuarta dirección naciera sin aviso de memorando — el usuario no sabría que existe
        // ese documento, ni que no se generó.
        //
        // Fase 03.21 (UI-SPEC §10.7): y si salió FIRMADO. Con el firmador encendido rige el todo o
        // nada (D-07): un memorando que no se firma no deja lote, así que «no se pudo generar; el
        // lote queda creado» solo puede decirse con el firmador apagado.
        let memo = "";
        if (destino !== "SG") {
          if (res.memoFirmado) {
            memo = " Se generó y firmó el memorando de devolución.";
          } else if (res.memoUrl) {
            memo = " Se generó el memorando de devolución.";
          } else if (!clave.requerida) {
            memo =
              " El memorando de devolución no se pudo generar; el lote queda creado.";
          }
        }
        addToast(
          "success",
          `Lote ${res.numeroLote} generado con ${res.casos} expediente(s) y remitido.${memo}`,
        );
      } else {
        addToast(
          "info",
          `Lote ${res.numeroLote} generado con ${res.casos} expediente(s), pero la remisión no se ` +
            `completó: ${res.detalle ?? "sin detalle"}. Puede reintentarla.`,
        );
      }
      setConfirmando(false);
      setSeleccion(new Set());
      await fetchPendientes();
    } catch (err) {
      if (esClaveIncorrecta(err)) {
        // D-07: no se creó nada. Regla de mensajes 261028-kmg: la clave rechazada se dice SOLO bajo
        // el campo, que vuelve vacío, marcado y con el foco; sin el mensaje de la confirmación. El
        // botón queda apagado igual —la clave se vacía en el `finally` y `confirmDisabled` lo
        // apaga— y escribir en el campo lo rearma.
        pedirFocoClaveRef.current = true;
        setErrorClave(true);
      } else if (esErrorDeFirma(err)) {
        // D-07: no se creó nada. Se dice qué no se hizo y por qué, en el aviso flotante.
        setMensaje({
          variant: "error",
          message: mensajeDeFalloDeFirma(CONSECUENCIA_FALLO_FIRMA.despacho, err),
        });
      } else {
        setMensaje({
          variant: "error",
          message:
            mensajeParaUsuario(err, "No se pudo generar el lote. Intente más tarde."),
        });
      }
    } finally {
      // 🔴 La clave se borra al terminar cada envío, con éxito o con error (UI-SPEC §2.3, regla 2).
      clave.limpiar();
    }
  };

  if (!user) return null;

  const nombre = (i: ExpedientePendienteSalida) =>
    i.admiBusinessName ??
    [i.admiName, i.admiLastname].filter(Boolean).join(" ");

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Bandeja de salida"
        title="Bandeja de Salida"
        subtitle="Los expedientes que salen de Ejecución. Elija los que va a despachar y genere el lote con el que se remiten."
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
              {pestana.titulo}
            </h2>
            <span className="badge badge-primary badge-outline whitespace-nowrap">
              {total} expediente(s)
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {puedeDespachar && (
              // 🔴 El motivo del apagado por rol va en el ENVOLTORIO: un botón deshabilitado no
              // recibe el puntero y su burbuja no saldría nunca (03.19 §2.1).
              <div
                className={devolucionSoloDirector ? "tooltip tooltip-bottom" : undefined}
                data-tip={
                  devolucionSoloDirector
                    ? MOTIVO_SOLO_DIRECTOR_DEVOLUCION
                    : undefined
                }
              >
                <Boton
                  estilos="btn btn-sm btn-primary"
                  icono="expediente"
                  texto={`Generar lote${seleccion.size > 0 ? ` (${seleccion.size})` : ""}`}
                  deshabilitado={
                    seleccion.size === 0 || loading || devolucionSoloDirector
                  }
                  onClick={() => {
                    setMensaje(null);
                    setErrorClave(false);
                    clave.limpiar();
                    setConfirmando(true);
                  }}
                />
              </div>
            )}
            <Boton
              estilos="btn btn-sm btn-ghost text-primary"
              texto="Actualizar"
              deshabilitado={loading}
              onClick={() => void fetchPendientes()}
            />
          </div>
        </div>

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {/* Las dos pestañas, con el mismo idioma que la Bandeja de Entrada de Resolución. */}
          <div className="app-modules-tabs-container border-b border-transparent">
            <div className="flex">
              {PESTANAS.map((p) => (
                <button
                  key={p.destino}
                  type="button"
                  onClick={() => cambiarPestana(p.destino)}
                  className={`app-modules-tab-label ${
                    destino === p.destino ? "active" : ""
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {!puedeDespachar && (
            <EmptyState text="Su rol no tiene una bandeja de salida asignada." />
          )}

          {puedeDespachar && (
            <>
              <div className="flex flex-col gap-3 px-2 py-3 lg:flex-row lg:items-end lg:justify-between">
                <label className="form-control w-full lg:max-w-md">
                  <span className="label-text mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                    Buscar
                    {loading && yaCargoAlgunaVez && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                  </span>
                  <input
                    type="search"
                    className="input input-bordered input-sm w-full"
                    placeholder="Nº de expediente, nombre o cédula del administrado"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Buscar por número de expediente, nombre o cédula"
                  />
                </label>

                {items.length > 0 && (
                  <Boton
                    estilos="btn btn-sm btn-ghost text-primary"
                    texto={
                      todosDeLaPagina
                        ? "Quitar la selección de esta página"
                        : "Seleccionar todos los de esta página"
                    }
                    deshabilitado={loading}
                    onClick={alternarTodos}
                  />
                )}
              </div>

              {error && !loading && <Alert variant="error" message={error} />}

              {(!loading || yaCargoAlgunaVez) && !error && items.length === 0 && (
                <EmptyState
                  text={
                    searchAplicado.trim().length > 0
                      ? "Ningún expediente coincide con la búsqueda."
                      : pestana.vacio
                  }
                />
              )}

              {items.length > 0 && (
                <div
                  className={`app-data-list app-data-list-busy mb-2 ${
                    loading && yaCargoAlgunaVez ? "is-busy" : ""
                  }`}
                  aria-busy={loading}
                >
                  <div className="app-item-list mt-1">
                    {items.map((i, idx) => (
                      <div
                        key={i.eejeId}
                        className="flex items-start gap-2"
                      >
                        <span
                          className="pt-3"
                          title={
                            bloqueado(i)
                              ? `El director todavía no ha revisado ${i.observacionesPendientes} observación(es) de este expediente`
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={seleccion.has(i.eejeId)}
                            disabled={bloqueado(i)}
                            onChange={() => alternar(i)}
                            aria-label={`Seleccionar el expediente ${i.expNumber ?? i.eejeId}`}
                          />
                        </span>
                        <div className="app-item-list-row app-item-list-row--with-actions flex-1 rounded border border-base-300">
                          <span className="app-item-list-index">
                            {pageIndex * pageSize + idx + 1}.
                          </span>
                          <div className="app-item-list-primary">
                            <div className="app-item-list-identifying">
                              {i.expNumber ?? `EPAS #${i.eejeId}`}
                            </div>
                            {i.expCreatedAt && (
                              <div className="app-item-list-complementary">
                                {DatetimeUtil.formatDate(i.expCreatedAt)}
                              </div>
                            )}
                          </div>
                          <div className="app-item-list-secondary">
                            {nombre(i) && (
                              <span className="app-item-list-info--alta">
                                {nombre(i)}
                              </span>
                            )}
                            {i.admiIdentification && (
                              <span className="app-item-list-info--baja">
                                {i.admiIdentification}
                              </span>
                            )}
                            {i.expZone && (
                              <span className="app-item-list-info--baja">
                                {i.expZone}
                              </span>
                            )}
                            {i.resolucionNumero && (
                              <span className="app-item-list-info--baja">
                                {i.resolucionNumero}
                              </span>
                            )}
                            {/* Solo en SG, y solo si consta: es la fecha de la providencia que
                                ordenó la remisión, y dice desde cuándo espera este expediente. */}
                            {i.sgRemitidoAt && (
                              <span
                                className="app-item-list-info--media"
                                title="Fecha de la providencia que remite a Secretaría General"
                              >
                                Remitido: {DatetimeUtil.formatDate(i.sgRemitidoAt)}
                              </span>
                            )}
                            {/* 2026-10-12: en las tres pestañas se mezclan ya dos actos —lo de
                                siempre y el recurso aceptado con ese destino—, y la fila dice cuál
                                es. Solo para el recurso: las demás filas no cambian. */}
                            {i.eejeStatus === RECURSO_ACEPTADO && (
                              <span className="app-item-list-info--media">
                                {etiquetaEstadoEpas(i.eejeStatus)}
                              </span>
                            )}
                            {/* LA REVISIÓN, EN LA FILA (2026-09-18). El ámbar es el que bloquea: se
                                dice con el número, porque «sin revisar» a secas no distingue una
                                observación pendiente de ocho. Lo aprobado se dice también, porque es
                                lo que el memorando va a imprimir sobre este expediente. */}
                            {esDevolucion && i.observacionesPendientes > 0 && (
                              <span className="badge badge-sm badge-warning whitespace-nowrap">
                                {i.observacionesPendientes} sin revisar
                              </span>
                            )}
                            {esDevolucion && i.observacionesAprobadas > 0 && (
                              <span className="badge badge-sm badge-success whitespace-nowrap">
                                {i.observacionesAprobadas} aprobada(s)
                              </span>
                            )}
                            {esDevolucion && i.observacionesRechazadas > 0 && (
                              <span className="badge badge-sm badge-ghost whitespace-nowrap">
                                {i.observacionesRechazadas} rechazada(s)
                              </span>
                            )}
                          </div>

                          {/* El botón de la revisión vive en la fila porque es donde el director
                              tiene delante lo que está a punto de remitir. Solo en las pestañas de
                              devolución, y solo si hay algo que revisar. */}
                          {puedeRevisar &&
                            esDevolucion &&
                            i.observacionesPendientes +
                              i.observacionesAprobadas +
                              i.observacionesRechazadas >
                              0 && (
                              <div className="app-item-list-actions">
                                <Boton
                                  estilos={`btn btn-xs ${
                                    i.observacionesPendientes > 0
                                      ? "btn-warning"
                                      : "btn-ghost text-primary"
                                  }`}
                                  texto={`Observaciones (${
                                    i.observacionesPendientes +
                                    i.observacionesAprobadas +
                                    i.observacionesRechazadas
                                  })`}
                                  deshabilitado={loading}
                                  onClick={() => setRevisando(i)}
                                />
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pages > 1 && (
                <Pagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  totalPages={pages}
                  onPageChange={setPageIndex}
                  onPageSizeChange={(nuevo) => {
                    setPageSize(nuevo);
                    setPageIndex(0);
                  }}
                  disabled={loading}
                  totalRecords={total}
                />
              )}
            </>
          )}
        </div>
      </section>

      {confirmando && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={cerrarConfirmacion}
        >
          <ConfirmationDetail
            headerKicker="Bandeja de salida"
            headerTitle={pestana.confirmar.titulo}
            statusCopy={pestana.confirmar.estado}
            descriptionCopy={pestana.confirmar.descripcion}
            informationData={{
              Destino: NOMBRE_DEL_DESTINO[destino],
              Expedientes: seleccion.size,
            }}
            onConfirm={confirmarDespacho}
            onClose={cerrarConfirmacion}
            message={mensaje ?? undefined}
            confirmButtonText={pestana.confirmar.boton}
            confirmButtonLoadingText="Generando…"
            confirmDisabled={esDevolucion && !clave.listaParaEnviar}
          >
            {/* LA CLAVE DEL DIRECTOR (Fase 03.21, D-19): solo en DMR/DMIT, que es donde nace el
                memorando de devolución. Nunca en SG. */}
            {esDevolucion && (
              <CampoClaveCertificado
                requerida={clave.requerida}
                value={clave.clave}
                onChange={editarClave}
                error={errorClave ? ERROR_CLAVE_INCORRECTA : undefined}
                inputRef={refCampoClave}
                avisoSinFirmador={AVISO_SIN_FIRMADOR.memorando}
                sesionCentral={clave.sesionCentral}
                cargando={clave.cargando}
                errorModo={clave.errorModo}
                onReintentarModo={clave.reintentarModo}
              />
            )}
          </ConfirmationDetail>
        </DialogoModal>
      )}

      {/* LA REVISIÓN DEL DIRECTOR, EN LA FICHA DEL EXPEDIENTE (2026-09-18, encargo del área: «se le
          debe levantar el mismo modal que cuando se agregan las observaciones»).

          🔴 ES LA MISMA FICHA QUE ABRE EL OJO DE LA BANDEJA DE ENTRADA, y no un diálogo propio de
          esta pantalla. Hubo uno durante unas horas y se retiró: partía en dos el mismo acto y
          dejaba al director decidiendo sobre una lista de frases, sin el campo mal escrito ni el
          documento ilegible delante.

          ⚠️ La fila de la SALIDA trae menos datos que la de la Entrada (no hay teléfono, fojas ni
          medida cautelar en esta consulta): la ficha los pinta como «—», que es su conducta para
          todo dato ausente. Lo que la revisión necesita —las observaciones y los documentos— lo pide
          ella misma por `eejeId`.

          Al cerrar se relee: los conteos de la fila cambiaron y, si la devolución se cayó, la fila
          ya no existe — y se quita de la selección, porque un expediente revertido no puede ir en
          ningún lote. */}
      {revisando && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setRevisando(null)}
        >
          <ModalExpedienteLote
            caseData={{
              eejeId: revisando.eejeId,
              expNumber: revisando.expNumber,
              expZone: revisando.expZone,
              expCreatedAt: revisando.expCreatedAt,
              eejeStatus: revisando.eejeStatus,
              admiName: revisando.admiName,
              admiLastname: revisando.admiLastname,
              admiBusinessName: revisando.admiBusinessName,
              admiIdentification: revisando.admiIdentification,
              multaImpuesta: revisando.multaImpuesta,
              resolucionNumero: revisando.resolucionNumero,
              puedeRevisar: puedeRevisar,
              usuarioId: user.usuId,
            }}
            onClose={() => setRevisando(null)}
            refetchFn={async () => {
              setSeleccion((prev) => {
                const next = new Set(prev);
                next.delete(revisando.eejeId);
                return next;
              });
              await fetchPendientes();
            }}
          />
        </DialogoModal>
      )}

      {/* El velo, solo la primera vez: después la lista se atenúa (misma razón que en la Entrada). */}
      {loading && !yaCargoAlgunaVez && <Loading />}
    </div>
  );
};

export default BandejaSalidaPage;
