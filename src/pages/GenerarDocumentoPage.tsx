/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/generacion-documento (frontend)
 * Feature: La página de generación de documentos (Fase 03.19, Plan 16 — D-03, D-04, D-05, D-06, D-12)
 * Archivo: GenerarDocumentoPage.tsx
 * Responsabilidad: Ser el MARCO de la generación: cuatro pasos, una barra de acciones al pie y el
 *   orden en que se escribe en el servidor. Todo lo que se redacta —tipo, cabecera, cuadro de horas,
 *   prueba exigida y el cuerpo con formato— vive en `CompositorProvidencia`, que esta página
 *   ENVUELVE y no toca.
 *
 *   ── 🔴 LO QUE ESTA PÁGINA APORTA Y NINGUNA DE SUS PIEZAS PODÍA APORTAR ───────────────────────
 *   Las cinco piezas que monta (la ruta, el compositor, el stepper con su barra, los pasos 3 y 4 y
 *   la sección de documentos anteriores) se construyeron contra un contrato cada una. Lo que solo
 *   aquí existe es el PEGAMENTO, y son cuatro decisiones:
 *
 *     1. **El orden de las dos escrituras.** Guardar las formas de notificación ocurre ANTES de
 *        emitir, porque el servidor abre un despacho por cada forma **ya persistida** en el momento
 *        de emitir (RESEARCH §3.2). Al revés, el acto quedaría emitido, nadie notificado y ningún
 *        plazo corriendo — y eso no se descubre hasta que el plazo que debía correr no corrió
 *        (T-03.19-70). No se confía en el orden de unas líneas: viaja por `antesDeEmitir`, que el
 *        compositor ejecuta dentro de su propio `try` y que ABORTA la emisión si rechaza.
 *     2. **Qué paso se ve, y hasta dónde se puede llegar.** El stepper no guarda estado y el
 *        compositor no sabe en qué paso está la página. El paso máximo GANADO es MONÓTONO: una
 *        vez ganado, no se pierde, para que volver atrás a corregir una coma no cueste el derecho a
 *        seguir. Pero lo que se OFRECE al stepper se recorta mientras la salida de un paso anterior
 *        esté cerrada (falta el tipo, la prueba exigida, el cuerpo o —desde el quick 261026-ft2— el
 *        dato de un canal de notificación marcado): si no, lo ganado con un tipo
 *        servía de puerta trasera para llegar a «Firma» con otro que exige un papel que no está.
 *        Reparada la condición, lo ganado vuelve sin repetir «Siguiente» paso a paso.
 *     3. **A dónde va el foco al cambiar de paso.** Lo dejó pendiente el Plan 13 y es de aquí: sin
 *        esto, pulsar «Siguiente» deja el foco en un botón que ahora dice otra cosa y quien no ve la
 *        pantalla no se entera de que el contenido cambió entero.
 *     4. **Qué pasa al salir sin emitir.** Lo redactado se guarda solo en el SERVIDOR (quick
 *        261006-el5): el compositor lo escribe 2 s después del último cambio y lo recupera al volver
 *        a este expediente. Por eso solo se pregunta al salir si hay cambios PENDIENTES del guardado,
 *        y «Salir» los guarda ANTES de irse; si ese guardado falla, el diálogo lo dice y ofrece salir
 *        sin guardar. Con todo guardado, «Cancelar» y «atrás» vuelven a quien abrió la página (la
 *        bandeja, o la ficha de la obligación de hacer) sin preguntar.
 *
 *   ── 🔴 LA FIRMA: LA PÁGINA NO VE LA CLAVE (Fase 03.21, D-04/D-07/D-12/D-16) ─────────────────
 *   El paso 4 existe siempre. Con el firmador apagado lo DICE y el botón de generar sigue
 *   habilitado (D-06). Con el firmador encendido, la providencia se firma en el mismo acto de
 *   emitir, y la clave del paso 4 llega al servidor sin pasar por el estado de esta página: el paso
 *   registra un LECTOR (`registrarLectorClave`), la página lo guarda en una ref y se lo da al
 *   compositor como GETTER (`obtenerClaveDeFirma`), que lo llama en el instante de emitir. El canal
 *   `onEstado` del paso sigue llevando solo booleanos.
 *     · Sin sesión central (estado C) no se puede firmar: «Generar documento» se apaga con su motivo.
 *     · Un fallo `APP-FIRMA-*` lo reclama la página (`alFallarFirma`): la confirmación se cierra; si
 *       fue la clave, SOLO el campo del paso 4 queda marcado, con su línea y con el foco; si no, el
 *       aviso compuesto sale en el aviso flotante (regla de mensajes 261028-kmg). Cualquier otro
 *       rechazo sigue el patrón de la 03.19.
 *
 *   ── LO QUE NO SE PUDO HONRAR DEL CONTRATO, DICHO AQUÍ Y NO ESCONDIDO ────────────────────────
 *   · **El sobre de error de UI-SPEC §5.8** («No se pudo generar el documento: {motivo}. Revise el
 *     paso «{paso}»…») se aplica donde esta página es dueña del error —el guardado de formas—. El
 *     rechazo de la EMISIÓN lo pinta el compositor con el mensaje del servidor tal cual, como lleva
 *     haciendo desde la Fase 03.14. La excepción son los fallos de firma (Fase 03.21): la clave
 *     rechazada se dice bajo el campo del paso 4 y el resto, en el aviso flotante.
 *   · **El foco al primer campo inválido** no hace falta y no se implementa: «Siguiente» está
 *     APAGADO mientras falte algo, y lo que falta se lee como texto junto a la barra. No hay
 *     intento de avanzar que corregir. Lo mismo vale, desde el quick 261006-dw9, para «Generar
 *     documento» en el paso 4: apagado, enseña junto a la barra un motivo por condición que falta
 *     y el paso donde se arregla.
 *   · **Los pasos 3 y 4 se montan ENCIMA del compositor**, no dentro de su columna izquierda: el
 *     compositor es dueño de su maquetación de dos columnas y este plan tiene prohibido
 *     reestructurarla. Con los grupos del compositor ocultos, el efecto visible es el mismo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-dw9 — UAT 03.15 paso 8: «sí pide agregar el
 *   comprobante, pero no lo hace obligatorio»). La prueba que exige el tipo cierra la salida del
 *   paso 1, por «Siguiente» y por el stepper; los motivos del stepper se acumulan por destino; y el
 *   máximo ganado se recorta con las puertas para que no sirva de puerta trasera. Y «Generar
 *   documento», cuando está apagado, DICE en pantalla qué falta (los motivos del compositor más el
 *   de la clave de firma, que pone esta página) y en qué paso se arregla.
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-el5 — el borrador se guarda en el servidor).
 *   El compositor se monta con `autoguardado` y `key={caso.eejeId}`; la salida pregunta solo con
 *   cambios pendientes del guardado y con el copy de D-06; «Salir» guarda antes de irse; y la
 *   salvaguarda de «atrás» se arma con una condición ESTABLE y decide dentro de su manejador.
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: la vuelta deja de ser fija: con el
 *   origen de la obligación de hacer, las cinco salidas y la miga llevan a esa ficha; sin parámetro
 *   o con uno fuera de la lista cerrada, a «Mis Expedientes» como siempre. La vuelta se resuelve
 *   UNA vez con `resolverVueltaGeneracion` y lo que depende de ella depende de la RUTA como texto,
 *   no del objeto, para no rearmar la salvaguarda de «atrás» en cada render (DP-12).)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-lhu: el botón de vuelta sale del componente
 *   común `BotonVolver`, compartido con la ficha de la obligación de hacer: mismo marcado, misma
 *   conducta)
 * Modificado por: Andrés Miño — 2026-10-26 (quick 261026-ft2: la puerta de pasos —`CondicionesAvance`,
 *   `motivoParaAvanzar`, `motivoParaLlegarA`, `topeDeLasPuertas`— sale a `config/generacionGating`,
 *   pura y con pruebas. Y la salida del paso 3 se cierra con un canal de notificación MARCADO sin su
 *   dato (D-15 del servidor): por «Siguiente», por el stepper y, si la lectura de formas llega con
 *   el decisor ya en el paso 4, en «Generar documento». Ninguna forma marcada sigue libre (D-12).)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10: la firma en el mismo acto. El
 *   paso 4 registra el lector de la clave y la página se lo da al compositor como getter; los fallos
 *   `APP-FIRMA-*` cierran la confirmación y vuelven al campo; el estado C apaga «Generar documento»
 *   con `MOTIVO_SIN_SESION`; la fila «Firma» de la confirmación dice lo que VA a pasar (UI-SPEC
 *   §3.2, C7) y la descripción añade la frase de UI-SPEC §10.6. El paso 3 no se toca.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: mientras el modo de firma no se
 *   conoce, «Generar documento» se apaga con `MOTIVO_MODO_FIRMA_DESCONOCIDO`, no con «falta la clave».)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: un fallo de firma que no es la clave se
 *   dice en el aviso flotante; la clave rechazada, solo bajo el campo del paso 4.)
 */
import {
  ErrorParaUsuario,
  mensajeParaUsuario,
} from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import Alert from "../components/common/Alert";
import Boton from "../components/common/Boton";
import BotonVolver from "../components/common/BotonVolver";
import EmptyState from "../components/common/EmptyState";
import CompositorProvidencia, {
  type ControlBorrador,
  type EstadoBorradorServidor,
  type EstadoCompositor,
  type MotivoNoEmitir,
} from "../components/providencia/CompositorProvidencia";
import GeneracionStepper, {
  type PasoGeneracion,
} from "../components/providencia/GeneracionStepper";
import BarraAccionesGeneracion from "../components/providencia/BarraAccionesGeneracion";
import PasoNotificacion from "../components/providencia/PasoNotificacion";
import PasoFirmaClave, {
  type ErrorFirmaPaso,
  type EstadoPasoFirma,
} from "../components/providencia/PasoFirmaClave";
import SeccionDocumentosSimilares from "../components/providencia/SeccionDocumentosSimilares";
import {
  MOTIVO_FORMAS_NO_LEIDAS,
  type SeleccionFormas,
} from "../components/notificacion/FormasNotificacionCuerpo";
import { NotificacionEjecucionService } from "../services/NotificacionEjecucionService";
import { SorteoService, type MiEpasAsignado } from "../services/SorteoService";
import { useToast } from "../hooks/useToast";
import { resolverVueltaGeneracion } from "../config/rutasGeneracionDocumento";
import {
  motivoParaLlegarA,
  topeDeLasPuertas,
  type CondicionesAvance,
} from "../config/generacionGating";
import {
  CONSECUENCIA_FALLO_FIRMA,
  FRASE_CONFIRMACION_CON_FIRMA,
  MOTIVO_SIN_SESION_CENTRAL,
  esClaveIncorrecta,
  esErrorDeFirma,
  mensajeDeFalloDeFirma,
} from "../config/firmaCopy";

/** La clase que OCULTA un paso sin desmontarlo (UI-SPEC §4.2, Plan 13). */
const OCULTO = "app-modules-docs-page-step-hidden";

/** Los rótulos del stepper, para nombrar la región del paso activo. Mismo orden que el acto. */
const ROTULO_PASO: Record<PasoGeneracion, string> = {
  1: "Información General",
  2: "Edición del Documento",
  3: "Notificación",
  4: "Firma",
};

/**
 * El copy del abandono. El título es el de UI-SPEC §5.4; el cuerpo y los botones, los de la D-06 del
 * usuario del 2026-10-06 (quick 261006-el5): el borrador ya está en el servidor, así que el diálogo
 * deja de anunciar una pérdida que no ocurre. La variante «sin guardar» solo se usa cuando lo último
 * escrito NO está a salvo, y entonces sí lo dice.
 */
const COPY_ABANDONO = {
  titulo: "Salir sin generar el documento",
  cuerpo:
    "Su borrador queda guardado; lo encontrará al volver a este expediente.",
  seguir: "Seguir editando",
  salir: "Salir",
  cuerpoSinGuardar:
    "No se pudo guardar su borrador en el servidor. Si sale ahora, perderá lo último que escribió.",
  salirSinGuardar: "Salir sin guardar",
  guardando: "Guardando…",
} as const;

/** El copy de la confirmación de generación (UI-SPEC §5.8). */
const COPY_CONFIRMACION = {
  statusCopy: "Este acto se notifica al administrado.",
  descriptionCopy:
    "Al confirmar se emitirá la providencia, se guardará en el expediente y se abrirá un despacho de notificación por cada forma aceptada. Revise el borrador antes de continuar.",
  boton: "Generar documento",
  botonEnviando: "Generando…",
} as const;

/**
 * El motivo que añade ESTA página a los del compositor (quick 261006-dw9): la clave de firma, cuando
 * el firmador está encendido. Lo pone la página porque es la única que conoce las dos mitades del
 * «se puede generar» —las reglas del acto y la firma—. El campo se rotula «Clave de firma».
 */
const MOTIVO_FIRMA_PENDIENTE: MotivoNoEmitir = {
  paso: 4,
  texto: "Falta escribir la clave de firma.",
};

/**
 * Estado C (Fase 03.21, D-12): el firmador está encendido y la sesión no viene del Auth central, así
 * que no se puede firmar. Sustituye a `MOTIVO_FIRMA_PENDIENTE`: pedir una clave que no puede usarse
 * sería pedirla de más (el paso 4 ni siquiera pinta el campo).
 */
const MOTIVO_SIN_SESION: MotivoNoEmitir = {
  paso: 4,
  texto: MOTIVO_SIN_SESION_CENTRAL,
};

/**
 * El modo de firma todavía no se conoce (se está leyendo o no se pudo leer; revisión 03.21, WR-01).
 * Sustituye a `MOTIVO_FIRMA_PENDIENTE`: no se sabe aún si hará falta la clave, y el paso 4 dice por
 * qué y cómo reintentarlo.
 */
const MOTIVO_MODO_FIRMA_DESCONOCIDO: MotivoNoEmitir = {
  paso: 4,
  texto: "Todavía no se sabe si la firma digital está activa.",
};

/** Cómo se leen las formas elegidas en la ficha de la confirmación (UI-SPEC §4.8). */
const resumirFormas = (seleccion: SeleccionFormas | null): string => {
  // 🔴 «Sin declarar» era MENTIRA y era la peligrosa. El paso 3 no publica nada hasta haber leído
  // bien, así que la ausencia de selección no significa «el decisor no marcó nada»: significa que
  // no se sabe qué hay en el expediente. Dicho como estaba, la ficha invitaba a confirmar.
  if (!seleccion)
    return `No se pudieron leer — revise el paso «${ROTULO_PASO[3]}»`;
  const marcadas = [
    seleccion.aceptaCorreo ? "Correo electrónico" : null,
    seleccion.aceptaCasillero ? "Casillero judicial" : null,
    seleccion.aceptaFisico ? "Domicilio físico" : null,
  ].filter((forma): forma is string => forma !== null);

  return marcadas.length > 0
    ? marcadas.join(" · ")
    : "Ninguna — nadie quedará notificado";
};

const GenerarDocumentoPage = () => {
  const { eejeId: eejeIdParam } = useParams<{ eejeId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { search } = useLocation();
  const eejeId = Number(eejeIdParam);

  /**
   * A DÓNDE SE VUELVE (quick 261014-kn3): la ficha de la obligación de hacer si se entró desde ella
   * con un origen de la lista cerrada, y la vuelta por defecto —la bandeja— en cualquier otro caso.
   * Se resuelve una vez por expediente y query; lo que navega depende de `rutaVuelta`, un TEXTO, y
   * no del objeto (DP-12: la salvaguarda de «atrás» se rearma con cada cambio de sus dependencias).
   */
  const vuelta = useMemo(
    () => resolverVueltaGeneracion(eejeId, search),
    [eejeId, search],
  );
  const rutaVuelta = vuelta.ruta;

  const [caso, setCaso] = useState<MiEpasAsignado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [paso, setPaso] = useState<PasoGeneracion>(1);
  const [pasoMaximo, setPasoMaximo] = useState<PasoGeneracion>(1);

  // El estado del compositor, en PRIMITIVOS sueltos: su canal publica desde un efecto y un objeto
  // nuevo en cada render haría un bucle (contrato del Plan 12).
  const [emitiendo, setEmitiendo] = useState(false);
  const [tipoElegido, setTipoElegido] = useState(false);
  const [cuerpoConContenido, setCuerpoConContenido] = useState(false);
  const [motivoPrueba, setMotivoPrueba] = useState<string | undefined>(
    undefined,
  );

  const [seleccionFormas, setSeleccionFormas] =
    useState<SeleccionFormas | null>(null);
  /**
   * Lo que le falta a un canal MARCADO del paso 3 (D-15), ya redactado con la frase del servidor;
   * `undefined` = ninguno, incluida la selección vacía (quick 261026-ft2). Un primitivo, como el
   * resto de canales: una cadena igual no vuelve a pintar.
   */
  const [motivoFormas, setMotivoFormas] = useState<string | undefined>(
    undefined,
  );
  const [firmaRequerida, setFirmaRequerida] = useState(false);
  const [firmaLista, setFirmaLista] = useState(true);
  const [firmaSinSesion, setFirmaSinSesion] = useState(false);
  const [firmaModoDesconocido, setFirmaModoDesconocido] = useState(false);
  /**
   * El último fallo de firma (Fase 03.21): el paso 4 lo usa para vaciar la clave y, si fue la clave,
   * para el estado E. Solo el texto compuesto y si fue la clave; nunca la clave.
   */
  const [errorFirma, setErrorFirma] = useState<ErrorFirmaPaso | null>(null);
  /**
   * 🔴 El LECTOR de la clave que registra el paso 4, no la clave (D-16). Se llama solo en el
   * instante de emitir, desde el compositor.
   */
  const lectorClaveRef = useRef<(() => string | undefined) | null>(null);

  const [pidiendoAbandono, setPidiendoAbandono] = useState(false);
  /** El guardado forzado al pulsar «Salir» falló: el diálogo pasa a la variante «sin guardar». */
  const [falloAlGuardar, setFalloAlGuardar] = useState(false);
  const [guardandoAlSalir, setGuardandoAlSalir] = useState(false);

  /**
   * Si lo redactado está a salvo en el servidor (quick 261006-el5). Lo publica el compositor por
   * `onEstado`; arranca en «sin-cambios» porque, antes de su primera publicación, no hay nada
   * redactado.
   */
  const [estadoBorrador, setEstadoBorrador] =
    useState<EstadoBorradorServidor>("sin-cambios");
  /** El control del borrador que entrega el compositor (`guardarYa`). Estable; vive en un ref. */
  const controlBorradorRef = useRef<ControlBorrador | null>(null);

  /**
   * Ya se emitió: desde ese instante salir no pierde nada y no hay que preguntar. Es un `ref` y no
   * estado porque quien lo lee es la salvaguarda de `beforeunload`, que se crea una vez.
   */
  const emitidaRef = useRef(false);

  /**
   * Hay cambios que el servidor todavía NO tiene (quick 261006-el5). Es lo que decide si se pregunta
   * al salir: con todo guardado, salir no pierde nada — el borrador espera en el servidor.
   */
  const hayCambiosSinGuardar =
    estadoBorrador !== "sin-cambios" && !emitidaRef.current;

  /**
   * Hay algo redactado y no emitido. Es la condición ESTABLE con que se arma la salvaguarda de
   * «atrás» (DP-12): `hayCambiosSinGuardar` OSCILA en cada ciclo pendiente → guardado, y armada con
   * él la salvaguarda empujaría una entrada de historial por ciclo.
   */
  const hayAlgoRedactado = cuerpoConContenido && !emitidaRef.current;

  /** Espejo de `hayCambiosSinGuardar` para el manejador de «atrás», que se arma una sola vez. */
  const hayCambiosSinGuardarRef = useRef(hayCambiosSinGuardar);
  useEffect(() => {
    hayCambiosSinGuardarRef.current = hayCambiosSinGuardar;
  }, [hayCambiosSinGuardar]);

  /** La lectura del expediente. Es la bandeja del decisor: si no está, no es suyo o no existe. */
  const cargar = useCallback(async () => {
    if (!Number.isFinite(eejeId)) {
      setCaso(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    try {
      // 🔴 SE PIDE LA PÁGINA MÁS GRANDE QUE EL SERVIDOR CONCEDE, Y NO LA POR DEFECTO.
      //
      // Desde el Plan 03 `GET /sorteo/mis-asignados` PAGINA, y su tamaño por defecto es **10**. Esta
      // lectura se escribió contra el endpoint viejo, que devolvía la bandeja entera: pedirla sin
      // parámetros hacía que un decisor con once expedientes viera «Este expediente no está entre
      // los suyos» en el undécimo —una negación falsa y creíble, que es la peor clase de negación—.
      // No hay endpoint de UN expediente ni filtro por `eeje_id` en la allowlist, así que se pide la
      // página máxima (100, el tope de `acotarLimit`) y se busca dentro.
      const sobre = await SorteoService.misAsignados({
        pageIndex: 0,
        pageSize: 100,
      });
      const encontrado = sobre.data.find((fila) => fila.eejeId === eejeId);
      setCaso(encontrado ?? null);

      // 🔴 Y SI NO ESTÁ Y ADEMÁS LA BANDEJA NO CABÍA ENTERA, NO SE DICE «NO ES SUYO». Con más de
      // cien expedientes asignados, la ausencia en esta página no demuestra nada sobre la propiedad
      // del expediente: afirmarla sería inventarse una conclusión que el dato no sostiene.
      if (!encontrado && sobre.total > sobre.data.length) {
        setErrorCarga(
          `No se pudo comprobar este expediente: su bandeja tiene ${sobre.total} expedientes y esta pantalla sólo puede mirar los primeros ${sobre.data.length}. Entre desde la fila en «Mis Expedientes».`,
        );
      }
    } catch (err) {
      setErrorCarga(
        mensajeParaUsuario(err, "No se pudo cargar el expediente. Vuelva a intentarlo."),
      );
    } finally {
      setCargando(false);
    }
  }, [eejeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ── LOS CANALES DE SOLO LECTURA DE LAS PIEZAS ─────────────────────────────────────────────
  // Las tres van memorizadas sin dependencias, como exigen los contratos de los planes 12 y 14.

  const recordarEstadoCompositor = useCallback((estado: EstadoCompositor) => {
    setEmitiendo(estado.emitiendo);
    setTipoElegido(estado.tipoElegido);
    // `puedeEmitir` NO se copia a estado: la barra lo recibe del compositor en el mismo render, y
    // guardarlo aquí crearía una segunda copia que llegaría siempre un render tarde.
    setCuerpoConContenido(!!estado.cuerpoConContenido);
    // Una CADENA, no la lista de pruebas: un primitivo igual no vuelve a pintar (quick 261006-dw9).
    setMotivoPrueba(estado.motivoPrueba);
    // Quick 261006-el5. Si llegara ausente (un compositor sin autoguardado), la red de seguridad es
    // la regla de antes: con cuerpo, «sin-guardar».
    setEstadoBorrador(
      estado.estadoBorrador ??
        (estado.cuerpoConContenido ? "sin-guardar" : "sin-cambios"),
    );
  }, []);

  /** Guarda el control del borrador. Memorizado sin dependencias, como los otros canales. */
  const recordarControlBorrador = useCallback((control: ControlBorrador) => {
    controlBorradorRef.current = control;
  }, []);

  const recordarFirma = useCallback((estado: EstadoPasoFirma) => {
    setFirmaRequerida(estado.requerida);
    setFirmaLista(estado.listaParaEnviar);
    setFirmaSinSesion(estado.sinSesionCentral);
    setFirmaModoDesconocido(estado.modoDesconocido);
  }, []);

  // ── LA CLAVE Y SUS FALLOS (Fase 03.21) ────────────────────────────────────────────────────

  /** Guarda el lector que registra el paso 4. Memorizado sin dependencias. */
  const registrarLectorClave = useCallback(
    (leer: () => string | undefined) => {
      lectorClaveRef.current = leer;
    },
    [],
  );

  /** El getter que el compositor llama en el instante de emitir: lee, no guarda. */
  const obtenerClaveDeFirma = useCallback(
    () => lectorClaveRef.current?.(),
    [],
  );

  /**
   * Un fallo `APP-FIRMA-*` es de esta página (DIVERGE de la 03.19) y el compositor cierra la
   * confirmación. Regla de mensajes 261028-kmg: si fue la clave, se dice SOLO bajo el campo del
   * paso 4 (estado E, con el foco); si no, la consecuencia de la superficie más el texto del
   * servidor van al aviso flotante. Cualquier otro rechazo se le devuelve al compositor, que deja la
   * confirmación abierta con su mensaje.
   */
  const alFallarFirma = useCallback(
    (err: unknown): boolean => {
      if (!esErrorDeFirma(err)) return false;
      const mensaje = mensajeDeFalloDeFirma(
        CONSECUENCIA_FALLO_FIRMA.generacion,
        err,
      );
      const claveIncorrecta = esClaveIncorrecta(err);
      if (!claveIncorrecta) addToast("error", mensaje);
      setErrorFirma({ mensaje, claveIncorrecta });
      return true;
    },
    [addToast],
  );

  /** El decisor vuelve a escribir la clave o pulsa «Generar documento»: el aviso se retira. */
  const limpiarErrorFirma = useCallback(() => setErrorFirma(null), []);

  // `setSeleccionFormas` ya es estable; se envuelve solo para que el tipo sea el del contrato.
  const recordarFormas = useCallback(
    (seleccion: SeleccionFormas) => setSeleccionFormas(seleccion),
    [],
  );

  // Canal de solo lectura, como el de arriba: la validez de lo marcado viaja APARTE de la selección,
  // que es el cuerpo exacto del guardado (quick 261026-ft2).
  const recordarMotivoFormas = useCallback(
    (motivo: string | undefined) => setMotivoFormas(motivo),
    [],
  );

  // ── NAVEGACIÓN ENTRE PASOS ────────────────────────────────────────────────────────────────

  const condiciones: CondicionesAvance = {
    tipoElegido,
    cuerpoConContenido,
    motivoPrueba,
    motivoFormas,
  };

  const motivoSiguiente =
    paso < 4
      ? motivoParaLlegarA((paso + 1) as PasoGeneracion, condiciones)
      : undefined;

  // 🔴 LA PUERTA TRASERA DEL MÁXIMO MONÓTONO (quick 261006-dw9). Con el máximo ganado pasado tal
  // cual, bastaba con llegar al paso 4 con un tipo sin prueba, volver al 1, cambiar al tipo 3 y
  // pulsar «Firma» en el stepper para plantarse en el paso 4 sin comprobante. Lo GANADO sigue siendo
  // monótono en el estado (`pasoMaximo`, `irAlPaso` no cambian); lo que se OFRECE al stepper se
  // recorta al primer paso cuya salida está cerrada. Reparada la condición, el derecho vuelve solo.
  const pasoAlcanzable = Math.min(
    pasoMaximo,
    topeDeLasPuertas(condiciones),
  ) as PasoGeneracion;

  const irAlPaso = useCallback((destino: PasoGeneracion) => {
    setPaso(destino);
    // MONÓTONO: solo sube. Volver atrás nunca quita el derecho de seguir adelante.
    setPasoMaximo((maximo) => (destino > maximo ? destino : maximo));
  }, []);

  const avanzar = () => {
    if (motivoSiguiente || paso === 4) return;
    irAlPaso((paso + 1) as PasoGeneracion);
  };

  const retroceder = () => {
    if (paso === 1) return;
    setPaso((actual) => (actual - 1) as PasoGeneracion);
  };

  /**
   * EL FOCO AL CAMBIAR DE PASO. Va a la región del paso, que se nombra con su número y su rótulo.
   *
   * No se enfoca el primer campo: en el paso 2 sería el editor, y aterrizar dentro de un
   * `contenteditable` deja a quien usa lector de pantalla en modo de escritura sin haber oído qué
   * paso es. La región lo anuncia y desde ahí se tabula con normalidad.
   *
   * La primera pintada se salta a propósito: robar el foco al abrir una página es una molestia, no
   * una ayuda.
   */
  const regionRef = useRef<HTMLElement | null>(null);
  const primeraPintada = useRef(true);
  useEffect(() => {
    if (primeraPintada.current) {
      primeraPintada.current = false;
      return;
    }
    regionRef.current?.focus();
  }, [paso]);

  // ── SALIR CON TRABAJO SIN EMITIR ──────────────────────────────────────────────────────────

  const volverAlOrigen = useCallback(() => {
    emitidaRef.current = true; // desarma las salvaguardas antes de navegar
    navigate(rutaVuelta);
  }, [navigate, rutaVuelta]);

  const pedirAbandono = () => {
    if (!hayCambiosSinGuardar) {
      volverAlOrigen();
      return;
    }
    setFalloAlGuardar(false);
    setPidiendoAbandono(true);
  };

  /** La variante del diálogo que NO promete nada: lo último escrito no está a salvo. */
  const abandonoSinGuardar = estadoBorrador === "sin-guardar" || falloAlGuardar;

  /**
   * «Salir» (D-06). En la variante normal se GUARDA lo pendiente ANTES de irse; si el servidor no lo
   * acepta, el diálogo se queda abierto y pasa a decir que se perderá. En la variante «sin guardar»
   * se sale sin más: ya se avisó de lo que cuesta.
   */
  const salirDelAbandono = async () => {
    if (abandonoSinGuardar) {
      volverAlOrigen();
      return;
    }
    setGuardandoAlSalir(true);
    const control = controlBorradorRef.current;
    const guardado = control ? await control.guardarYa() : true;
    setGuardandoAlSalir(false);
    if (guardado) {
      volverAlOrigen();
    } else {
      setFalloAlGuardar(true);
    }
  };

  /** Cerrar la pestaña o recargar. El navegador pone su propio texto; el nuestro no se puede. */
  useEffect(() => {
    if (!hayCambiosSinGuardar) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambiosSinGuardar]);

  /**
   * EL BOTÓN «ATRÁS» DEL NAVEGADOR.
   *
   * ⚠️ `useBlocker` de react-router NO está disponible: la aplicación monta `BrowserRouter` +
   * `useRoutes` (`main.tsx`, `App.tsx`), y ese gancho exige un enrutador de datos. Cambiar el
   * enrutador de toda la aplicación para esto sería un precio desproporcionado y fuera de plan.
   *
   * Lo que se hace en su lugar es la salvaguarda clásica: se empuja una entrada de historial con la
   * MISMA dirección, de modo que la primera pulsación de «atrás» la consume sin que el enrutador
   * cambie de sitio; ahí se pregunta y se vuelve a armar. Si el decisor confirma, se navega a la
   * pantalla de origen —que es exactamente a donde «atrás» le llevaba—.
   *
   * 🔴 HISTORIAL CONTAMINADO (quick 261006-el5, DP-12). Desde que el borrador se guarda solo, «hay
   * cambios sin guardar» OSCILA en cada ciclo pendiente → guardado. Si la salvaguarda se armara con
   * esa condición, cada ciclo empujaría OTRA entrada de historial y el decisor tendría que pulsar
   * «atrás» media docena de veces para salir. Se arma con una condición ESTABLE —hay algo redactado
   * y no emitido— y decide DENTRO del manejador: con cambios pendientes, vuelve a armar y pregunta;
   * sin ellos, vuelve a la pantalla de origen, que es a donde «atrás» llevaba.
   */
  useEffect(() => {
    if (!hayAlgoRedactado) return;
    window.history.pushState(null, "", window.location.href);
    const alVolver = () => {
      if (!hayCambiosSinGuardarRef.current) {
        volverAlOrigen();
        return;
      }
      window.history.pushState(null, "", window.location.href);
      setFalloAlGuardar(false);
      setPidiendoAbandono(true);
    };
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, [hayAlgoRedactado, volverAlOrigen]);

  // ── LA EMISIÓN, EN EL ORDEN QUE HACE QUE LA NOTIFICACIÓN EXISTA ───────────────────────────

  /**
   * 🔴 PASO 2 DE LA ORQUESTACIÓN: persistir las formas. Se ejecuta DESPUÉS de que el decisor
   * confirme y ANTES del `POST` de emisión, porque el compositor lo llama dentro de su propio
   * `try`. Si el servidor rechaza, esto lanza: la emisión NO ocurre y la confirmación se queda
   * abierta con el sobre de error del contrato (UI-SPEC §5.8).
   */
  const guardarFormasAntesDeEmitir = useCallback(async () => {
    if (!Number.isFinite(eejeId)) return;
    // 🔴 SIN SELECCIÓN NO SE ESCRIBE, Y ADEMÁS SE ABORTA LA EMISIÓN.
    //
    // El paso 3 solo publica su selección después de leer bien las formas del expediente. Que aquí
    // no haya ninguna significa, por tanto, que esa lectura no llegó a buen puerto — y el paso 3
    // está OCULTO mientras el decisor confirma desde el paso 4, así que su caja de error no se ve.
    // Seguir adelante tenía dos salidas y las dos malas: escribir tres «no» que nadie declaró
    // —borrando las formas del secretario— o emitir saltándose el guardado. En ambas el acto queda
    // emitido, nadie notificado y ningún plazo corriendo, y eso no se descubre hasta semanas
    // después (T-03.19-70). Se corta aquí, con el sobre de error de UI-SPEC §5.8 que nombra el paso.
    if (!seleccionFormas) {
      throw new ErrorParaUsuario(
        `No se pudo generar el documento: ${MOTIVO_FORMAS_NO_LEIDAS}. Revise el paso «${ROTULO_PASO[3]}» y vuelva a intentarlo.`,
      );
    }
    try {
      await NotificacionEjecucionService.guardarFormas(eejeId, seleccionFormas);
    } catch (err) {
      const motivo =
        mensajeParaUsuario(
          err,
          "no se pudieron guardar las formas de notificación",
        ).replace(/\.+$/, "");
      throw new ErrorParaUsuario(
        `No se pudo generar el documento: ${motivo}. Revise el paso «${ROTULO_PASO[3]}» y vuelva a intentarlo.`,
      );
    }
  }, [eejeId, seleccionFormas]);

  const alEmitir = useCallback(() => {
    emitidaRef.current = true;
    navigate(rutaVuelta);
  }, [navigate, rutaVuelta]);

  // ── ESTADOS PREVIOS AL STEPPER (UI-SPEC §4.1) ─────────────────────────────────────────────

  const cabecera = (
    <HeaderPage
      headerKicker={`${vuelta.miga} / Generar documento`}
      title="Generar documento"
      subtitle={
        caso
          ? `Expediente ${caso.expNumber ?? `EPAS ${eejeId}`} · ${caso.administrado ?? "administrado sin nombre en el expediente"}`
          : "El expediente sobre el que se genera el documento."
      }
    />
  );

  const botonVolver = (
    <BotonVolver texto={vuelta.rotulo} onVolver={() => navigate(rutaVuelta)} />
  );

  if (cargando) {
    return (
      <div className="app-data-container">
        {cabecera}
        <Loading />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="app-data-container">
        {cabecera}
        <Alert variant="error" message={errorCarga} />
        <div className="flex flex-wrap gap-2">
          <Boton
            estilos="btn btn-primary"
            texto="Reintentar"
            deshabilitado={false}
            onClick={() => void cargar()}
          />
          {botonVolver}
        </div>
      </div>
    );
  }

  if (!caso) {
    return (
      <div className="app-data-container">
        {cabecera}
        <EmptyState
          text="Este expediente no está entre los suyos"
          hint="Puede que ya no esté a su cargo, que el identificador de la dirección no sea correcto o que nunca se le haya asignado. Vuelva a Mis Expedientes y entre desde la fila."
        />
        {botonVolver}
      </div>
    );
  }

  // ── LA PÁGINA, CON EL EXPEDIENTE CARGADO ──────────────────────────────────────────────────

  return (
    <div className="app-data-container">
      {cabecera}

      <GeneracionStepper
        pasoActivo={paso}
        pasoMaximoAlcanzable={pasoAlcanzable}
        onCambiarPaso={irAlPaso}
        bloqueado={emitiendo}
        // Acumulados: el motivo de cada paso es el de la PRIMERA salida cerrada antes de él. Sin
        // ninguna, el 4 cae en el texto por defecto del stepper, como hasta ahora.
        motivosBloqueo={{
          2: motivoParaLlegarA(2, condiciones),
          3: motivoParaLlegarA(3, condiciones),
          4: motivoParaLlegarA(4, condiciones),
        }}
      />

      <section
        ref={regionRef}
        tabIndex={-1}
        aria-label={`Paso ${paso} de 4: ${ROTULO_PASO[paso]}`}
        className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 p-4 sm:p-6"
      >
        {/* 🔴 LOS PASOS 3 Y 4 SE OCULTAN, NO SE DESMONTAN. Desmontar el 3 volvería a pedir las
            formas al servidor y perdería lo marcado; desmontar el 4 BORRA la clave de firma, que es
            justo lo que `PasoFirmaClave` hace al desmontarse. Van encima del compositor para que la
            barra de acciones —que es suya y va al pie— quede al final en los cuatro pasos. */}
        <div className={paso === 3 ? "" : OCULTO}>
          <PasoNotificacion
            eejeId={caso.eejeId}
            enviando={emitiendo}
            onSeleccion={recordarFormas}
            onMotivoFormasIncompletas={recordarMotivoFormas}
          />
        </div>

        <div className={paso === 4 ? "" : OCULTO}>
          <PasoFirmaClave
            enviando={emitiendo}
            onEstado={recordarFirma}
            registrarLectorClave={registrarLectorClave}
            errorFirma={errorFirma}
            onEditarClave={limpiarErrorFirma}
          />
        </div>

        <CompositorProvidencia
          // DP-15: si la ruta cambiara de EPAS sin desmontar la página, el borrador de uno no puede
          // acabar guardado bajo el otro. Con la `key`, otro expediente es otro compositor.
          key={caso.eejeId}
          caso={caso}
          paso={paso}
          // Quick 261006-el5: el borrador se guarda en el servidor. Solo aquí: el modal no lo pone.
          autoguardado
          onControlBorrador={recordarControlBorrador}
          onCancelar={pedirAbandono}
          onEmitida={alEmitir}
          onEstado={recordarEstadoCompositor}
          antesDeEmitir={guardarFormasAntesDeEmitir}
          obtenerClaveDeFirma={obtenerClaveDeFirma}
          alFallarFirma={alFallarFirma}
          confirmacion={{
            headerKicker: `Expediente ${caso.expNumber ?? `EPAS ${eejeId}`}`,
            headerTitle: "Generar documento",
            statusCopy: COPY_CONFIRMACION.statusCopy,
            // Con el firmador encendido, la confirmación añade qué pasa si la firma no se aplica
            // (UI-SPEC §10.6): no se emite nada.
            descriptionCopy: firmaRequerida
              ? `${COPY_CONFIRMACION.descriptionCopy} ${FRASE_CONFIRMACION_CON_FIRMA}`
              : COPY_CONFIRMACION.descriptionCopy,
            informacionExtra: {
              Administrado:
                caso.administrado ?? "No consta en el expediente",
              "Formas de notificación": resumirFormas(seleccionFormas),
              // D-06: con el firmador apagado, la confirmación lo DICE. Que el documento salga sin
              // firma criptográfica no puede descubrirse después de emitirlo. Encendido, dice lo
              // que VA a pasar y no lo que aún no ocurrió (UI-SPEC §3.2, Fase 03.21).
              Firma: firmaRequerida
                ? "Se firmará con su certificado"
                : "Sin firma criptográfica",
            },
            confirmButtonText: COPY_CONFIRMACION.boton,
            confirmButtonLoadingText: COPY_CONFIRMACION.botonEnviando,
          }}
          renderExtrasEdicion={(contexto) => (
            <SeccionDocumentosSimilares
              // 🔴 La CLASE del paso 1. Vacía ⇒ `undefined`, y la sección lo dice sin consultar.
              tipoCodigo={contexto.tipoCodigo || undefined}
              // 🔴 EL CUERPO VIVO, no una cadena de conveniencia: es la única entrada que decide si
              // se pide confirmación antes de pisar lo redactado (T-03.19-68).
              cuerpoActual={contexto.cuerpoActual}
              onImportar={contexto.importarCuerpo}
              nombreTipo={contexto.nombreTipo}
              deshabilitado={contexto.emitiendo}
            />
          )}
          renderBarraAcciones={(acciones) => {
            // Lo que impide generar: lo que dice el compositor, más la firma si falta. Se calcula
            // aquí, en el MISMO render en que llega `acciones`: copiarlo a estado lo haría llegar
            // siempre un render tarde (ver `recordarEstadoCompositor`).
            //
            // Quick 261026-ft2: también el motivo de FORMAS. Cubre la lectura de formas que
            // resuelve con el decisor ya en el paso 4 —el stepper recorta lo ALCANZABLE pero no
            // expulsa del paso actual—. Así «sin motivos ⇒ habilitado» sigue valiendo en la página
            // y no se emite con un canal marcado sin su dato.
            const motivosGenerar: readonly MotivoNoEmitir[] = [
              ...(acciones.motivosNoEmitir ?? []),
              ...(motivoFormas ? [{ paso: 3 as const, texto: motivoFormas }] : []),
              // Fase 03.21 (D-12): en el estado C el motivo es la sesión, no la clave.
              ...(firmaModoDesconocido
                ? [MOTIVO_MODO_FIRMA_DESCONOCIDO]
                : firmaSinSesion
                  ? [MOTIVO_SIN_SESION]
                  : firmaLista
                    ? []
                    : [MOTIVO_FIRMA_PENDIENTE]),
            ];
            return (
              <div className="flex flex-col">
                {/* Lo que falta, como TEXTO. El `title` de un botón apagado no lo alcanza nadie por
                    teclado —el mismo problema que el Plan 13 resolvió en el stepper—, y aquí el
                    botón apagado es el que gobierna todo el avance. Vale para «Siguiente» en los
                    pasos 1-3 y, desde el quick 261006-dw9, para «Generar documento» en el 4: un
                    motivo por condición, y el paso donde se arregla cuando no es el que se ve. */}
                {paso < 4 && motivoSiguiente && (
                  <p
                    role="status"
                    className="px-4 pb-1 text-right text-sm opacity-70"
                  >
                    {motivoSiguiente}
                  </p>
                )}
                {paso === 4 && !emitiendo && motivosGenerar.length > 0 && (
                  <div
                    role="status"
                    className="px-4 pb-1 text-right text-sm opacity-70"
                  >
                    <p>Todavía no se puede generar el documento:</p>
                    <ul>
                      {motivosGenerar.map((motivo) => (
                        <li key={motivo.texto}>
                          {motivo.paso === paso
                            ? motivo.texto
                            : `${motivo.texto} Revise el paso «${ROTULO_PASO[motivo.paso]}».`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <BarraAccionesGeneracion
                  paso={paso}
                  // El primario del paso 4 lo gatean DOS cosas: las reglas del acto (del
                  // compositor) y la clave de firma cuando el firmador está encendido (del paso 4).
                  // Se combinan aquí, que es el único sitio donde se conocen las dos; y con ellas,
                  // sus motivos, para que «sin motivos ⇒ habilitado» valga también en la página.
                  acciones={{
                    ...acciones,
                    puedeEmitir:
                      acciones.puedeEmitir &&
                      firmaLista &&
                      !firmaSinSesion &&
                      !motivoFormas,
                    motivosNoEmitir: motivosGenerar,
                    // UI-SPEC §3.3 punto 4: un nuevo «Generar documento» retira el aviso de fallo.
                    pedirConfirmacion: () => {
                      limpiarErrorFirma();
                      acciones.pedirConfirmacion();
                    },
                  }}
                  onAtras={retroceder}
                  onSiguiente={avanzar}
                  motivoSiguienteBloqueado={motivoSiguiente}
                />
              </div>
            );
          }}
        />
      </section>

      {/* LA CONFIRMACIÓN DE ABANDONO (UI-SPEC §5.4). Es una superposición corriente, sin elemento
          de diálogo nativo: esta es una página y no hay ningún diálogo dentro del que anidarse. */}
      {pidiendoAbandono && (
        <div className="modal modal-open">
          <div
            role="alertdialog"
            aria-labelledby="abandono-titulo"
            aria-describedby="abandono-cuerpo"
            className="modal-box"
          >
            <h2 id="abandono-titulo" className="text-lg font-bold">
              {COPY_ABANDONO.titulo}
            </h2>
            <p id="abandono-cuerpo" className="py-4">
              {abandonoSinGuardar
                ? COPY_ABANDONO.cuerpoSinGuardar
                : COPY_ABANDONO.cuerpo}
            </p>
            <div className="modal-action">
              <Boton
                estilos={
                  abandonoSinGuardar
                    ? "btn btn-error btn-outline"
                    : "btn btn-outline"
                }
                texto={
                  abandonoSinGuardar
                    ? COPY_ABANDONO.salirSinGuardar
                    : guardandoAlSalir
                      ? COPY_ABANDONO.guardando
                      : COPY_ABANDONO.salir
                }
                deshabilitado={guardandoAlSalir}
                onClick={() => void salirDelAbandono()}
              />
              <Boton
                estilos="btn btn-primary"
                texto={COPY_ABANDONO.seguir}
                // Mientras se guarda para salir, «Seguir editando» no puede cancelar la salida a
                // medias: el guardado terminaría y la página se iría igual.
                deshabilitado={guardandoAlSalir}
                onClick={() => setPidiendoAbandono(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerarDocumentoPage;
