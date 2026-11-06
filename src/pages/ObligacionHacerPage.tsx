/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: El correctivo de UN expediente, por pasos (Fase 03.18, Plan 07)
 * Archivo: ObligacionHacerPage.tsx
 * Responsabilidad: Que el decisor abra un expediente y vea EN QUÉ PELDAÑO ESTÁ su obligación de
 *   hacer: qué se declaró, si hay informe, cómo va la serie
 *   compulsoria, qué diligencias de la ejecución sustitutoria se intentaron y cuánto queda del
 *   término para alegar. Y que desde ahí pueda hacer lo que le toque —o vea, apagado y con su
 *   motivo, lo que todavía no le toca—.
 *
 *   ── POR QUÉ UNA PANTALLA Y NO DIEZ (D-4) ─────────────────────────────────────────────────────
 *   Lo acota el backend, no una preferencia: los diez actos de escritura de la rama cuelgan TODOS
 *   de un expediente (`/obligacion-hacer/:eejeId/...`). Diez pantallas serían diez formas de decir
 *   lo mismo, y ninguna podría enseñar el recorrido. Todas las lecturas y todos los actos de la
 *   rama cuelgan de un expediente.
 *
 *   La única lectura ajena a la rama es la fila del expediente en la bandeja del decisor, y solo
 *   para los dos hechos de la aceptación —si el decisor ya aceptó el caso y si no tiene una excusa
 *   pendiente— que gatean «Generar providencia» (quick 261014-kn3). El detalle de la rama no los
 *   trae; la bandeja sí, y es la misma lectura que ya hace el asistente de generación.
 *
 *   ── 🔴 LO QUE SE ADOPTA DE `SustanciacionPage` Y LO QUE NO ───────────────────────────────────
 *   Se adopta la FORMA de trabajar un expediente por pasos: cabecera, plazos y acciones.
 *   **NO se adopta su `resolveActionsPerRow`**, que razona en el navegador con tres funciones de
 *   gating propias. Aquí el resolver no razona: compone las diez acciones y las pasa por
 *   `aplicarVeredicto`. Lo que vuelve deshabilitado se PINTA APAGADO CON SU MOTIVO; lo que vuelve
 *   nulo no se pinta. El decisor tiene derecho a ver el procedimiento entero aunque un paso no le
 *   toque todavía: un botón que se esfuma no deja ni la pregunta de qué haría falta para encenderlo.
 *
 *   ── 🔴 ESTA PÁGINA NO CALCULA NADA ───────────────────────────────────────────────────────────
 *   Ni plazos (los cuenta el servidor contra el calendario de feriados), ni el ordinal del peldaño
 *   del art. 240 (está prohibido guardarlo y prohibido deducirlo, para que el número que ve la
 *   pantalla y el que imprime el acto notificado sean el mismo), ni importes (el recargo del
 *   art. 239 lo liquida el servidor). Tampoco lee ni compara el estado del EPAS: la rama de hacer
 *   no es una máquina de estados y está escrito que nunca lo será.
 *
 *   ── LA VUELTA (quick 261014-lhu) ─────────────────────────────────────────────────────────────
 *   «Volver» se ofrece arriba, abajo y en el error, y su destino lo decide el ROL, nunca la URL: el
 *   decisor vuelve SIEMPRE a «Mis Expedientes» (si usara el historial, al volver del asistente de
 *   generación «atrás» sería la generación); secretario y director —que solo llegan tecleando la
 *   URL— vuelven a la pantalla anterior de la app si la hay, y si no al Dashboard.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-jcy: se retira el sello de clausura
 *   —sección, acción y lectura—, pedido del usuario)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: botón «Generar providencia»: abre el
 *   asistente de generación con todos los tipos y vuelve aquí, gateado por la misma regla del `⋮`)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: «Volver» arriba y abajo —y en el error—
 *   al destino de cada rol: el decisor a Mis Expedientes; secretario y director a la pantalla
 *   anterior de la app o al Dashboard)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el motor recibe el estado del EPAS
 *   que trae el detalle, así que en EN_IMPUGNACION los actos salen apagados con el motivo de la
 *   suspensión; con la suspensión abierta, aviso arriba y —para el decisor con su fila— la sección del
 *   recurso montada aquí mismo, para resolverlo también desde esta rama)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import Alert from "../components/common/Alert";
import EmptyState from "../components/common/EmptyState";
import BotonVolver from "../components/common/BotonVolver";
import { RUTA_DE_REFUGIO } from "../components/common/RutaProtegida";
import Collapse from "../components/collapse/Collapse";
import Iconos from "../components/common/Iconos";
import TerminoAlegacionPlazo from "../components/common/TerminoAlegacionPlazo";
import { ImpugnacionAcciones } from "../components/impugnacion/ImpugnacionAcciones";
import MultasCompulsoriasExpediente from "../components/multas-compulsorias/MultasCompulsoriasExpediente";
import { resolverModalDeAccion } from "../components/tabla/RowActions";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import { ObligacionHacerService } from "../services/ObligacionHacerService";
import { SorteoService, type MiEpasAsignado } from "../services/SorteoService";
import { aplicarVeredicto } from "../config/inboxActionStatusRules";
import { hechosDeObligacionHacer, hechosDelEpas } from "../config/accionesHechos";
import {
  RUTA_GENERAR_DOCUMENTO_DESDE,
  VUELTA_BANDEJA_DECISOR,
} from "../config/rutasGeneracionDocumento";
import type {
  ObligacionHacerDetalle,
  ResultadoDiligencia,
} from "../interfaces/IObligacionHacer";
import type { UserActions } from "../interfaces/IUser";
import type { ModalType } from "../interfaces/IModal";
import { DatetimeUtil } from "../utils/datetime.util";

/** `Collapse<T>` exige `permittedActions`; esta pantalla pinta sus propias acciones. */
const SIN_ACCIONES_DE_COLLAPSE = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

/** Cómo se lee el resultado de una diligencia. FALLIDA es un caso normal, no una anomalía. */
const ETIQUETA_DILIGENCIA: Record<ResultadoDiligencia, string> = {
  EJECUTADA: "Ejecutada",
  FALLIDA: "Fallida",
  INNECESARIA: "Innecesaria (el administrado cumplió antes)",
};

/**
 * LAS DIEZ ACCIONES DEL MENÚ DE LA RAMA, compuestas como `UserActions` para que el motor las juzgue.
 *
 * 🔴 Los ocho primeros nombres son, letra por letra, los de `POLITICA_ACCIONES` y los de
 * `ACCION_A_MODAL`. `acreditarCumplimiento` y `constatarIncumplimiento` NO están en el menú
 * (2026-10-14): se deciden al subir el informe desde `ModalAdjuntarInforme`, o al reabrirlo si el
 * informe quedó sin conclusión (el bloque trae `informeSinConclusion`). La novena,
 * `registrarMultaCompulsoria`, NO es de esos diez endpoints —la multa se registra por el camino que ya
 * existía, dentro de la serie compulsoria— pero sí era un gate de botón CRUDO: hasta hoy
 * la serie compulsoria recibía `permiteRegistrar` en `true` SIEMPRE. Aquí lo decide el motor, que es
 * para lo que el motor existe.
 *
 * La décima, `generarDocumento`, NO es de la rama: es la MISMA entrada «Generar documento» del `⋮`
 * de la bandeja, con su MISMA regla del motor, y NAVEGA al asistente pidiendo volver aquí (quick
 * 261014-kn3). Aquí se rotula «Generar providencia» porque eso es lo que el decisor viene a hacer
 * desde el correctivo (la providencia que resuelve la alegación, entre otras); el asistente ofrece
 * igualmente TODOS los tipos que el servidor dé para el expediente.
 *
 * `actiId` negativo por la misma razón que en `useEpasInboxActions`: no vienen del backend de
 * permisos, las inyecta la interfaz.
 */
const ACCIONES_DE_LA_RAMA: UserActions[] = [
  {
    actiId: -101,
    submId: 9,
    actiName: "declararHacer" as ModalType,
    actiLabel: "Declarar la obligación de hacer",
    actiContext: "page",
    actiIconName: "expediente",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
  },
  {
    actiId: -102,
    submId: 9,
    actiName: "deshacerHacer" as ModalType,
    actiLabel: "Deshacer la declaración",
    actiContext: "page",
    actiIconName: "papelera",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -103,
    submId: 9,
    actiName: "adjuntarInforme" as ModalType,
    actiLabel: "Adjuntar el informe de control de verificación",
    actiContext: "page",
    actiIconName: "documentacion",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: true,
  },
  {
    actiId: -106,
    submId: 9,
    actiName: "registrarAlegacion" as ModalType,
    actiLabel: "Ingresar el escrito de alegación del administrado",
    actiContext: "page",
    actiIconName: "escritos",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -108,
    submId: 9,
    actiName: "ordenarSustitutoria" as ModalType,
    actiLabel: "Ordenar la ejecución sustitutoria",
    actiContext: "page",
    actiIconName: "enviarExpediente",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -109,
    submId: 9,
    actiName: "registrarDiligencia" as ModalType,
    actiLabel: "Registrar una diligencia de la sustitutoria",
    actiContext: "page",
    actiIconName: "lineaDeTiempo",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -110,
    submId: 9,
    actiName: "registrarRespaldoCostos" as ModalType,
    actiLabel: "Adjuntar el respaldo de los costos",
    actiContext: "page",
    actiIconName: "providencia",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -111,
    submId: 9,
    actiName: "registrarGastosSustitutoria" as ModalType,
    actiLabel: "Liquidar los gastos de la sustitutoria (art. 239)",
    actiContext: "page",
    actiIconName: "alertasGestion",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -112,
    submId: 9,
    actiName: "registrarMultaCompulsoria" as ModalType,
    actiLabel: "Registrar una multa compulsoria (art. 240)",
    actiContext: "page",
    actiIconName: "notificacion",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
  {
    actiId: -113,
    submId: 9,
    actiName: "generarDocumento" as ModalType,
    actiLabel: "Generar providencia",
    actiContext: "page",
    actiIconName: "providencia",
    actiCreatedAt: null,
    actiUpdatedAt: null,
    actiIsPrioritary: false,
  },
];

/**
 * El nombre del acto que NO abre modal: se registra en la serie compulsoria de la sección 3.
 *
 * 🔴 El `as ModalType` NO es cosmético y por eso queda anotado: este nombre **no es una clave del
 * registro de modales**, y no lo va a ser — la multa se registra por el camino que ya existía. El
 * tipo de `actiName` es el del registro, así que sin la aserción la comparación no compilaría
 * precisamente porque los dos conjuntos no se solapan, que es justo lo que se quiere decir.
 */
const MULTA_COMPULSORIA = "registrarMultaCompulsoria" as ModalType;

/**
 * El nombre del acto que NAVEGA en vez de abrir un modal: el asistente de generación (quick
 * 261014-kn3).
 *
 * 🔴 Mismo porqué del `as ModalType` que la multa: `generarDocumento` **no es una clave del
 * registro de modales** —en la bandeja es un enlace del `⋮`, y aquí una navegación—, y
 * `resolverModalDeAccion` no lo encontraría. Por eso `despachar` lo atiende ANTES de resolver el
 * modal.
 */
const GENERAR_PROVIDENCIA = "generarDocumento" as ModalType;

/**
 * El único rol que admite la lectura de la bandeja del decisor. 🔴 Es un HECHO DEL ENDPOINT, no una
 * regla de oferta: `GET /sorteo/mis-asignados` se declara con `@Roles('funcionario decisor')`, así
 * que a los otros dos roles que entran en esta página les respondería 403. Quien decide si el botón
 * se ofrece sigue siendo el motor, que a esos roles ya se lo apaga por rol.
 *
 * Segundo uso (quick 261014-lhu): por el mismo hecho del endpoint, es el único rol que tiene la
 * bandeja «Mis Expedientes» a la que volver. A los otros dos esa bandeja les saldría vacía con un
 * 403, así que la vuelta de la ficha los manda a otro sitio.
 */
const ROL_LECTOR_BANDEJA_DECISOR = "funcionario decisor";

/**
 * A dónde vuelve la ficha, con qué rótulo lo ofrece y qué dice su miga. `ruta: null` significa UN
 * PASO ATRÁS en el historial de la app.
 */
type VueltaDeLaFicha = {
  ruta: string | null;
  rotulo: string;
  miga: string;
};

/**
 * La clave que react-router da a la PRIMERA entrada que carga la SPA: URL tecleada, pestaña nueva,
 * recarga sin estado. Cualquier navegación hecha dentro de la app trae su propia clave, así que
 * «la clave no es esta» quiere decir «hay una pantalla anterior DE LA APP a la que volver», y no
 * una página ajena del navegador.
 */
const CLAVE_ENTRADA_INICIAL = "default";

/** Un paso atrás, a la pantalla de la app de la que se vino. */
const VUELTA_ATRAS: VueltaDeLaFicha = {
  ruta: null,
  rotulo: "Volver a la pantalla anterior",
  miga: "Ejecución",
};

/** El tablero: la ruta que todos los roles pueden ver (la misma del guard de rutas por rol). */
const VUELTA_AL_TABLERO: VueltaDeLaFicha = {
  ruta: RUTA_DE_REFUGIO,
  rotulo: "Volver al Dashboard",
  miga: "Ejecución",
};

/**
 * Resuelve la vuelta de la ficha (quick 261014-lhu). Ningún destino sale de la URL: o una constante
 * o un paso atrás dentro de la app.
 *
 * 🔴 EL DECISOR NUNCA USA EL HISTORIAL. Llega aquí desde su bandeja, pero también VUELVE aquí desde
 * el asistente de generación («Generar providencia» → asistente → «Volver a la obligación de
 * hacer»): en ese recorrido el «atrás» del historial es la generación, no la bandeja. Por eso para
 * él la vuelta es siempre «Mis Expedientes», con los mismos textos que el asistente.
 *
 * Secretario y director NO tienen ninguna entrada a esta ficha en la interfaz: el único enlace es el
 * «Ver obligación de hacer» del `⋮` de la bandeja del decisor. Llegan tecleando la URL. Para ellos
 * el historial es seguro —el asistente es solo del decisor, así que la generación nunca está detrás
 * de ellos—: si hay una pantalla anterior de la app, se vuelve a ella; si no (URL tecleada, pestaña
 * nueva), al Dashboard, que es la ruta que todos los roles pueden ver. Y si mañana otra pantalla
 * enlaza la ficha para ellos, la vuelta ya funciona sin tocar esta página.
 *
 * @param lectorDeLaBandeja Si quien lee la ficha es el rol que tiene la bandeja del decisor.
 * @param hayHistorialEnLaApp Si la entrada actual la creó una navegación dentro de la app.
 * @returns La ruta (o `null` = un paso atrás), el rótulo del botón y la miga de la cabecera.
 */
const resolverVueltaDeLaFicha = (
  lectorDeLaBandeja: boolean,
  hayHistorialEnLaApp: boolean,
): VueltaDeLaFicha => {
  if (lectorDeLaBandeja) return VUELTA_BANDEJA_DECISOR;
  return hayHistorialEnLaApp ? VUELTA_ATRAS : VUELTA_AL_TABLERO;
};

/** El ancla de la sección de la serie compulsoria, para poder llevar allí al decisor. */
const ANCLA_SERIE = "seccion-serie-compulsoria";

/**
 * Lo que la pantalla de origen puede pasarle a ésta al navegar.
 *
 * ⚠️ Es OPCIONAL y la página no depende de ello: el contrato de la rama no tiene lectura de «dame
 * este expediente», y añadirle una sería tocar el backend, que esta fase no hace. Cuando la bandeja
 * del decisor navega aquí (Plan 08) lo pasa; cuando alguien llega tecleando la URL, la cabecera se
 * nombra con el identificador del EPAS y no se inventa un administrado.
 */
type ContextoDeNavegacion = {
  expNumber?: string;
  administrado?: string;
};

const ObligacionHacerPage = () => {
  const { eejeId: eejeIdParam } = useParams<{ eejeId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();

  const eejeId = Number(eejeIdParam);
  const contexto = (location.state ?? {}) as ContextoDeNavegacion;

  const [detalle, setDetalle] = useState<ObligacionHacerDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * La fila del expediente en la bandeja del decisor, o `null` si no se leyó, no está o falló la
   * lectura. Solo alimenta los hechos de la aceptación de «Generar providencia».
   */
  const [filaEpas, setFilaEpas] = useState<MiEpasAsignado | null>(null);

  /** Lee el correctivo entero: una sola lectura, el detalle del expediente. */
  const cargar = useCallback(async () => {
    if (!Number.isFinite(eejeId)) {
      setError("La dirección no trae un expediente válido.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const datos = await ObligacionHacerService.detalle(eejeId);
      setDetalle(datos);
    } catch (err) {
      // 🔴 SE MUESTRA EL MENSAJE DEL SERVIDOR, no un armazón vacío. La pertenencia la impone el
      // backend y la interfaz no puede deducirla del rol: si dice que el expediente no le
      // corresponde, eso es lo que hay que leer en pantalla.
      setError(
        mensajeParaUsuario(err, "No se pudo leer el correctivo de este expediente."),
      );
      setDetalle(null);
    } finally {
      setCargando(false);
    }
  }, [eejeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const rolNormalizado = (user?.rolName ?? "").trim().toLowerCase();

  /**
   * LA FILA DE LA BANDEJA, PARA LOS HECHOS DE LA ACEPTACIÓN (quick 261014-kn3).
   *
   * El detalle de la rama NO trae si el decisor aceptó el caso ni si tiene una excusa pendiente, y
   * son las dos condiciones de la regla `generarDocumento`. La bandeja del decisor sí las trae en
   * cada fila. Se lee APARTE de `cargar` porque `cargar` es también el `refetchFn` de los modales:
   * tras un acto de la rama se relee el correctivo, no la bandeja, cuya aceptación no cambia por eso.
   *
   * Se pide la página máxima (100) y se busca dentro, que es la misma lectura y el mismo límite que
   * ya usa `GenerarDocumentoPage`: no hay endpoint de un expediente ni filtro por `eeje_id`. Con más
   * de cien expedientes la fila puede no estar: entonces el botón se queda apagado con el motivo de
   * «no se puede decidir aquí», que es la degradación correcta —igual que el asistente dice que no
   * puede comprobarlo—. Un rechazo tampoco rompe la página: la fila se queda en `null`.
   */
  useEffect(() => {
    setFilaEpas(null);
    if (rolNormalizado !== ROL_LECTOR_BANDEJA_DECISOR) return;
    if (!Number.isFinite(eejeId)) return;
    let cancelado = false;
    SorteoService.misAsignados({ pageIndex: 0, pageSize: 100 })
      .then((sobre) => {
        if (cancelado) return;
        setFilaEpas(sobre.data.find((fila) => fila.eejeId === eejeId) ?? null);
      })
      .catch(() => {
        if (!cancelado) setFilaEpas(null);
      });
    return () => {
      cancelado = true;
    };
  }, [eejeId, rolNormalizado]);

  /** La vuelta de la ficha: la decide el rol y, para los que no son decisor, si hay historial. */
  const vuelta = useMemo(
    () =>
      resolverVueltaDeLaFicha(
        rolNormalizado === ROL_LECTOR_BANDEJA_DECISOR,
        location.key !== CLAVE_ENTRADA_INICIAL,
      ),
    [rolNormalizado, location.key],
  );

  const volver = useCallback(() => {
    if (vuelta.ruta === null) {
      navigate(-1);
      return;
    }
    navigate(vuelta.ruta);
  }, [navigate, vuelta]);

  /** Mismo patrón que la miga del asistente (`{origen} / Generar documento`). */
  const migaDeLaFicha = `${vuelta.miga} / Obligación de hacer`;

  const botonVolver = <BotonVolver texto={vuelta.rotulo} onVolver={volver} />;

  /**
   * Las diez, pasadas por el motor.
   *
   * 🔴 SIN EL DETALLE NO SE ADIVINA. `hechosDeObligacionHacer(null)` devuelve la bolsa vacía, y toda
   * condición sobre un hecho ausente es INDECIDIBLE: el motor las apaga con su motivo, que es
   * exactamente lo correcto mientras la lectura no haya llegado.
   *
   * 🔴 Y SIN LA FILA NO SE LLAMA AL ADAPTADOR DE LA ACEPTACIÓN. `hechosDelEpas` escribe SIEMPRE el
   * hecho de «sin excusa pendiente»; llamado con nada, lo fabricaría de la nada. Sin fila, los dos
   * hechos faltan y el motor apaga «Generar providencia» diciendo que aquí no se puede decidir.
   *
   * ⟳ quick 261028-mtg: el motor recibe además el ESTADO del EPAS que trae el detalle. La página no
   * lo compara: se lo pasa al motor, que es quien sabe que en EN_IMPUGNACION los actos de la rama
   * quedan suspendidos y los apaga con su motivo. Ninguna regla de esta rama mira el estado, así que
   * en cualquier otro los veredictos no cambian.
   */
  const acciones = useMemo(() => {
    const hechos = {
      ...(filaEpas ? hechosDelEpas(filaEpas) : {}),
      ...hechosDeObligacionHacer(detalle),
    };
    return ACCIONES_DE_LA_RAMA.flatMap(
      (accion) =>
        aplicarVeredicto(accion, {
          rol: user?.rolName ?? "",
          estado: detalle?.eejeStatus ?? null,
          hechos,
        }) ?? [],
    );
  }, [detalle, filaEpas, user?.rolName]);

  /**
   * Con qué `permiteRegistrar` se monta la serie compulsoria. Sale del MISMO veredicto que pinta el
   * botón: antes era un `true` suelto escrito a mano en la bandeja del decisor.
   */
  const permiteRegistrarMulta = useMemo(() => {
    const accion = acciones.find((a) => a.actiName === MULTA_COMPULSORIA);
    return !!accion && !accion.actiIsDisabled;
  }, [acciones]);

  /**
   * Despacha una acción. Ocho abren su modal por el mismo camino que las bandejas; la novena no
   * tiene modal —la multa se registra en el formulario de la serie compulsoria— y lleva allí; la
   * décima NAVEGA al asistente de generación, pidiéndole volver a esta ficha (quick 261014-kn3).
   */
  const despachar = useCallback(
    (accion: UserActions) => {
      if (accion.actiIsDisabled) return;

      if (accion.actiName === MULTA_COMPULSORIA) {
        const seccion = document.getElementById(ANCLA_SERIE);
        seccion?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        addToast(
          "info",
          "La multa compulsoria se registra en la serie del expediente, con la resolución que la impuso.",
        );
        return;
      }

      if (accion.actiName === GENERAR_PROVIDENCIA) {
        navigate(RUTA_GENERAR_DOCUMENTO_DESDE(eejeId, "obligacion-hacer"));
        return;
      }

      const modal = resolverModalDeAccion(accion.actiName);
      if (!modal) {
        addToast(
          "error",
          "Acción no disponible, porfavor comuníquese con el administrador",
          "Error de configuración",
        );
        return;
      }

      openModal(
        modal,
        {
          eejeId,
          expNumber: contexto.expNumber,
          administrado: contexto.administrado,
          obligacionHacer: detalle
            ? {
                ...detalle.obligacionHacer,
                terminoAlegacion: detalle.terminoAlegacion,
              }
            : undefined,
        },
        { refetchFn: cargar },
      );
    },
    [addToast, cargar, contexto.administrado, contexto.expNumber, detalle, eejeId, navigate, openModal],
  );

  const nombreExpediente = contexto.expNumber ?? `EPAS #${eejeIdParam ?? "—"}`;

  if (cargando) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <HeaderPage
          headerKicker={migaDeLaFicha}
          title="Obligación de hacer"
          subtitle="El correctivo impuesto por la resolución de origen."
        />
        <Alert variant="error" message={error} />
        {botonVolver}
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState text="Este expediente no tiene correctivo que mostrar." />
        {botonVolver}
      </div>
    );
  }

  const { obligacionHacer, serieCompulsorias, diligencias, terminoAlegacion } = detalle;
  const { peldano } = serieCompulsorias;
  /** La suspensión abierta por la impugnación, tal como la lee el servidor (quick 261028-mtg). */
  const suspension = detalle.suspensionImpugnacion ?? null;

  return (
    <div className="flex flex-col gap-4">
      <HeaderPage
        headerKicker={migaDeLaFicha}
        title={nombreExpediente}
        subtitle={
          contexto.administrado
            ? `Correctivo de ${contexto.administrado}. Todo lo que se ve aquí lo derivó el servidor: la pantalla no cuenta días, ni peldaños, ni importes.`
            : "El correctivo del expediente, peldaño a peldaño. Todo lo que se ve aquí lo derivó el servidor: la pantalla no cuenta días, ni peldaños, ni importes."
        }
      />

      {/* LA VUELTA, arriba: donde el asistente pinta la suya, justo bajo la cabecera (quick
          261014-lhu). El destino lo decide el rol, no la URL. */}
      {botonVolver}

      {/* LA SUSPENSIÓN POR IMPUGNACIÓN (quick 261028-mtg, D-2/D-5). Es ESTADO DEL CASO, no el
          resultado de una acción: va en línea, arriba, y explica por qué los actos están apagados.
          Con la fila del decisor, el recurso se resuelve aquí mismo; sin ella, se dice dónde. */}
      {suspension && (
        <div className="flex flex-col gap-2">
          <Alert
            variant="warning"
            rol="note"
            message={`Expediente suspendido por impugnación desde el ${DatetimeUtil.formatDate(
              suspension.desde,
            )}: los actos de esta rama se reanudan cuando la Procuraduría resuelva el recurso.${
              filaEpas
                ? ""
                : " El recurso se resuelve en «Mis expedientes → ⋮ → Recursos»."
            }`}
          />
          {filaEpas && (
            <div className="rounded-lg border border-base-200">
              <h2 className="px-4 pt-3 text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
                Recurso de apelación
              </h2>
              <ImpugnacionAcciones row={filaEpas} onChanged={cargar} />
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 1 — CABECERA. No se pliega: una cabecera que hay que desplegar no es una cabecera.
          El término va en modo compacto porque aquí es CONTEXTO; la sección 5 lo da entero. */}
      <div className="rounded-lg border border-base-200 px-4 py-3">
        <TerminoAlegacionPlazo termino={terminoAlegacion} compacto />
      </div>

      {/* SECCIÓN 6 — LAS ACCIONES, arriba: es a lo que se viene. */}
      <div className="rounded-lg border border-base-200 px-4 py-3">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
          Actos de la rama
        </h2>
        <p className="mb-3 text-xs text-base-content/60">
          Las que no proceden se ven apagadas con su motivo, no desaparecidas: el procedimiento
          entero está a la vista aunque un paso todavía no toque.
        </p>
        <div className="flex flex-wrap gap-2">
          {acciones.map((accion) => (
            <button
              key={accion.actiName}
              type="button"
              data-testid={`accion-${accion.actiName}`}
              className={`btn btn-sm ${
                accion.actiIsPrioritary ? "btn-primary" : "btn-outline"
              }`}
              disabled={accion.actiIsDisabled ?? false}
              title={accion.actiIsDisabled ? accion.actiDisabledHint : accion.actiLabel}
              onClick={() => despachar(accion)}
            >
              <Iconos nombre={accion.actiIconName} />
              <span>{accion.actiLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN 2 — LA OBLIGACIÓN */}
      <Collapse
        data="La obligación de hacer"
        permittedActions={SIN_ACCIONES_DE_COLLAPSE}
        headerRender={(titulo) => (
          <span className="font-semibold">{titulo as string}</span>
        )}
        contentRender={() => (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-base-content/60">Correctivo declarado:</dt>
              <dd>{obligacionHacer.tiene ? "sí" : "no"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-base-content/60">Cumplida:</dt>
              <dd>
                {obligacionHacer.cumplida
                  ? `sí, el ${DatetimeUtil.formatDate(obligacionHacer.cumplidaAt)}`
                  : "no consta cumplida"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-base-content/60">
                Informe de control de verificación:
              </dt>
              {obligacionHacer.informeSinConclusion ? (
                <dd>
                  adjuntado
                  {obligacionHacer.informeDocId != null &&
                    ` (documento ${obligacionHacer.informeDocId})`}
                  , sin conclusión registrada
                  <span className="block text-sm text-base-content/60">
                    Regístrela desde «Adjuntar el informe de control de
                    verificación»: abre directo en la conclusión.
                  </span>
                </dd>
              ) : (
                <dd>{obligacionHacer.tieneInforme ? "adjuntado" : "sin adjuntar"}</dd>
              )}
            </div>
            <div className="flex gap-2">
              <dt className="text-base-content/60">Ejecución sustitutoria:</dt>
              <dd>
                {obligacionHacer.sustitutoriaOrdenada ? "ordenada" : "sin ordenar"}
              </dd>
            </div>
          </dl>
        )}
      />

      {/* SECCIÓN 3 — LA SERIE COMPULSORIA */}
      <div id={ANCLA_SERIE}>
        <Collapse
          data="La serie compulsoria (art. 240)"
          permittedActions={SIN_ACCIONES_DE_COLLAPSE}
          headerRender={(titulo) => (
            <span className="font-semibold">{titulo as string}</span>
          )}
          contentRender={() => (
            <div className="flex flex-col gap-3 px-4 py-3 text-sm">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-base-content/60">Registradas:</dt>
                  <dd>{peldano.registradas}</dd>
                </div>
                <div className="flex gap-2">
                  {/* 🔴 EL ORDINAL NO SE CUENTA AQUÍ. Se pinta el que derivó el servidor, que es el
                      mismo que imprime la cabecera del acto notificado. */}
                  <dt className="text-base-content/60">Peldaño siguiente:</dt>
                  <dd data-testid="peldano-siguiente">
                    {peldano.ordinalSiguiente === null
                      ? "la serie del COA ya está completa"
                      : `${peldano.ordinalSiguiente}.ª`}
                  </dd>
                </div>
              </dl>

              {/* ⚠️ INFORMATIVO, NO UNA PUERTA: nada impide registrar una cuarta multa. Si la DME la
                  impuso, el hecho ocurrió y el expediente tiene que poder contarlo. */}
              {peldano.serieAgotada && (
                <Alert
                  variant="info"
                  message="La escalera que prevé el COA está completa. Es información, no un impedimento: si la DME impone otra, se registra igual."
                />
              )}

              {!peldano.incumplimientoConstatadoDespuesDeLaUltimaMulta && (
                <p className="text-xs text-base-content/60">
                  No consta un incumplimiento constatado después de la última multa.
                </p>
              )}

              <MultasCompulsoriasExpediente
                eejeId={eejeId}
                permiteRegistrar={permiteRegistrarMulta}
              />
            </div>
          )}
        />
      </div>

      {/* SECCIÓN 4 — LA EJECUCIÓN SUSTITUTORIA */}
      <Collapse
        data="La ejecución sustitutoria"
        permittedActions={SIN_ACCIONES_DE_COLLAPSE}
        headerRender={(titulo) => (
          <span className="font-semibold">{titulo as string}</span>
        )}
        contentRender={() => (
          <div className="flex flex-col gap-3 px-4 py-3 text-sm">
            <p>
              {obligacionHacer.sustitutoriaOrdenada
                ? "Consta ordenada sobre este expediente."
                : "No consta ordenada sobre este expediente."}
            </p>
            {diligencias.length === 0 ? (
              <p className="text-base-content/60">
                No consta ninguna diligencia. Que no haya ninguna no es un fallo: la sustitutoria se
                ordena antes de que salga la cuadrilla.
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {diligencias.map((diligencia) => (
                  <li
                    key={diligencia.dsusId}
                    className="rounded-lg border border-base-200 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {ETIQUETA_DILIGENCIA[diligencia.resultado]}
                      </span>
                      <span className="text-xs tabular-nums opacity-60">
                        {DatetimeUtil.formatDate(diligencia.actoAt)}
                      </span>
                    </div>
                    {/* En FALLIDA el motivo ES el contenido del acto: por qué no se pudo. */}
                    <p>{diligencia.motivo}</p>
                    <p className="text-xs opacity-60">
                      Acta del expediente n.º {diligencia.docId}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      />

      {/* SECCIÓN 5 — EL TÉRMINO Y LA ALEGACIÓN */}
      <Collapse
        data="El término para alegar y la alegación"
        permittedActions={SIN_ACCIONES_DE_COLLAPSE}
        headerRender={(titulo) => (
          <span className="font-semibold">{titulo as string}</span>
        )}
        contentRender={() => (
          <div className="px-4 py-3">
            <TerminoAlegacionPlazo termino={terminoAlegacion} />
            {/* 🔴 LA PROVIDENCIA QUE RESUELVE LA ALEGACIÓN NO SALE DE AQUÍ: se emite por el camino
                genérico de providencias —al que esta pantalla lleva con «Generar providencia»
                (quick 261014-kn3)—. Esta pantalla informa de que falta; no duplica el emisor. */}
          </div>
        )}
      />

      {/* …y abajo: quien llega al final de la ficha no tiene que subir para salir. */}
      {botonVolver}
    </div>
  );
};

export default ObligacionHacerPage;
