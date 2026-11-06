/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada-lotes (frontend)
 * Feature: Bandeja de Entrada (ingresos) por rol + modal Resultado del sorteo REUSADO (D-07/D-08, Fase 3.8)
 * Archivo: BandejaEntradaPage.tsx
 * Responsabilidad: La superficie que el usuario ve de la ENTRADA lote-céntrica. Reemplaza el
 *   PlaceholderPage de 3.7 en la ruta `entrada`. Con la receta de SorteadosPage:
 *
 *     · UNA vista por ROL (RESEARCH Q3, NO merge): director → EntradaLotesService.bandejaDirector()
 *       (lotes EN_REVISION sin sellar); secretario → EntradaLotesService.bandejaSecretario() (lotes ya
 *       remitidos). El decisor no tiene bandeja de entrada.
 *     · Lista Collapse<EnvioLoteDto>: cabecera con la identidad del lote (nº de memo, estado, tipo,
 *       nº de casos, fecha) y cuerpo THIN con las referencias de los casos (sin N+1, scroll cliente).
 *     · ACCIONES gateadas por rol (Plan 03, isEntradaActionVisible, role-only): el SECRETARIO ve
 *       "Aprobar y enviar a sorteo"; el DIRECTOR ve "Remitir al secretario". Cada acción
 *       confirma con ConfirmationDetail — el PADRE es dueño del `message` (error inline), cierra SOLO en
 *       éxito + toast y refetch. El gating de UI es CONVENIENCIA; la autorización real vive en el backend.
 *     · El botón "Resultado del sorteo" aparece SOLO cuando `lote.envlAmasId != null` (D-08, degradación
 *       honesta: sin sorteo, sin botón) y abre el ModalAssignmentResult EXISTENTE (reuse, NO rebuild) vía
 *       el adapter sorteoLoteToModalData: lee SorteoService.lotes(), FILTRA por `envlAmasId` (único join
 *       válido, Plan 01) y compone el shape que el modal consume. El header del modal muestra el nº de
 *       memo de ENTRADA; los usuarios asignados vienen del SORTEO.
 *
 *   Solo componentes compartidos (HeaderPage, Collapse, Boton, BadgePriority, EmptyState, Alert,
 *   ConfirmationDetail, Loading) — idioma Resolución, sin tablas/botones a mano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 * Modificado por: Andrés Miño — 2026-09-17 (quick 260917-anx: el anexo libre deja de ser un
 *   formulario incrustado bajo la lista de documentos y pasa a «Adjuntar documento», un botón en la
 *   cabecera de la fila del caso que abre `ModalAnexarDocumento`).
 * Modificado por: Andrés Miño — 2026-09-17 (reunión del 16-09). Seis cambios sobre esta pantalla,
 *   todos pedidos ahí y todos tomando Resolución como referencia:
 *     1. PAGINADO, BUSCADOR y RANGO DE FECHAS, los tres EN EL SERVIDOR. La bandeja ya no trae todos
 *        los lotes con todos sus casos: pide una página (`Pagination`, el componente compartido, ya
 *        con el envoltorio de Resolución) y el backend filtra. El buscador es uno solo y cubre las
 *        cuatro cosas que se pidieron —nº de lote, nº de expediente, nombre y cédula del
 *        administrado—, con rebote de 350 ms para no consultar por cada tecla.
 *     2. EL MEMO DEL LOTE: el ojo de la cabecera abre el memorando con que la DMR remitió el lote.
 *        Solo aparece si el lote lo trae (`docUrl`) — hoy, solo los de prueba.
 *     3. LA FICHA DEL EXPEDIENTE: el ojo de cada fila abre `ModalExpedienteLote`, con
 *        «Información del Expediente» y «Documentación» por Dirección metropolitana. Con él se fue
 *        de aquí la lista de documentos que colgaba bajo cada fila.
 *     4. «Enviado» pasa a «Sin revisar» (y a color neutro) en la bandeja del director.
 *     5. LA DEVOLUCIÓN A LA DMR ES POR EXPEDIENTE. El botón de lote —y su diálogo— se RETIRARON;
 *        cada fila tiene el suyo y abre el `ModalReturnToDmr` que ya servía a las otras bandejas.
 * Modificado por: Andrés Miño — 2026-10-07 (quick 261007-jrr: la fila de cada expediente enseña
 *   «Materia · Submateria» tras la zona, en la bandeja del director y en la del secretario abogado;
 *   entonces era un dato a la vista, sin filtro ni búsqueda — ver la entrada del 2026-10-16).
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 12, D-16/D-17). La infracción manda:
 *     · La materia y la submateria de la fila son las DEDUCIDAS del código de infracción que manda el
 *       servidor (`expMateria`/`expSubmateria`); la regla visual de 261007-jrr no cambia.
 *     · Cada caso que ya es EPAS enseña sus infracciones con `CeldaInfracciones` —la misma celda de
 *       «Mis expedientes»—, con las alertas a la vista (CORE pendiente, conflicto, descuadre, sin
 *       infracciones) ANTES de remitir o devolver. La celda traduce el bloque del servidor; esta
 *       pantalla no pide nada a CORE ni a la ficha.
 *     · Filtro «Materia» (desplegable con las materias del catálogo, valor = id; desde la quick
 *       261104-jh1, de Sorteo y como `materiaId`), y el buscador general encuentra también por código de infracción (lo
 *       resuelve el servidor).
 * Modificado por: Andrés Miño — 2026-10-16 (UAT 03.23-14). Tres fallos de la prueba con el usuario:
 *     · DENTRO del lote se enseñan solo los expedientes que casan con el buscador o la materia
 *       (`coincideFiltro`, que calcula el servidor con la misma regla con que elige los lotes); la
 *       cabecera dice «N de M caso(s)» y el cuerpo avisa de que las acciones del lote siguen
 *       valiendo para el lote entero.
 *     · La barra de filtros es UNA fila (`flex-wrap` + `items-end`): BUSCAR, MATERIA, las dos
 *       fechas y «Limpiar filtros» alineados abajo. Eran dos grupos flex anidados, y el de la derecha
 *       se partía en dos filas en cuanto entró el desplegable de materia: «Limpiar filtros» caía
 *       debajo de MATERIA y BUSCAR se alineaba con la segunda fila. Los rótulos son bloques con la
 *       misma altura (DaisyUI 5 ya no define `form-control` ni `label-text`).
 *     · El buscador anuncia que encuentra también por MATERIA (por su nombre, sin tildes), y el
 *       vacío con solo la materia puesta la nombra: «No hay lotes con infracciones de …».
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 07). La sincronización con Resolución
 *   pasa a ser AUTOMÁTICA:
 *     · D-09 — fuera el botón de sincronización manual del secretario, su modal de confirmación, su
 *       estado y su manejador. El secretario conserva su bandeja por su acción propia
 *       (`aprobarEnviarSorteo`), y su título pasa a «Lotes para enviar a sorteo».
 *     · D-13 — bajo el título, para director y secretario, UNA línea con la última sincronización
 *       (`LineaSincronizacion`, alimentada por `useEstadoSincronizacion`, que refresca cada 60 s).
 *       Con la integración apagada la línea no se pinta (D-10): la pantalla queda como estaba.
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05): en la misma celda que
 *   `CeldaInfracciones`, y debajo de ella, `AvisoDatosResolucion` dice «Datos de Resolución
 *   incompletos» cuando el servidor manda `datosResolucionFaltantes`. Traduce; no bloquea nada ni
 *   sustituye ningún aviso de la 03.23.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 18, G-13): junto a la línea de estado,
 *   `AvisoDatosNuevos`. Cuando el sondeo trae una pasada nueva con casos, la bandeja se recarga sola
 *   por `refreshLotes` (filtros y página intactos, sin velo) si es SEGURO —sin modal abierto, sin
 *   confirmación, sin acción de siembra, sin selección de casos y sin carga en curso—; si no, sale
 *   «Hay datos nuevos de Resolución · Recargar». Sin hooks nuevos: `modal` sale de la llamada a
 *   `useModal` que ya existía.
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 20, G-04): el `👁` de la fila pasa a
 *   `BotonAccionFila` con nombre accesible, y a su lado el `⑂` abre la línea de tiempo (con
 *   `momento: "antesDelSorteo"` mientras el EPAS no se haya sorteado, vía `estaAntesDelSorteo`).
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 24, G-01): el estado de la fila lo
 *   elige `marcaDeLaFila` con los campos del servidor —«Por devolver» > «Reingresado · observaciones
 *   por verificar» (ámbar, `--app-plazo-fg-fuerte`) > el chip de estado más la etiqueta baja
 *   «Reingresado»—; «Marcar revisado» se esconde con verificaciones pendientes, y el aviso de la
 *   remisión dice cuántos reingresados se quedaron por verificar si el servidor manda la cifra.
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261029-kl0): «Aprobar y enviar a sorteo» con
 *   expedientes que se quedaron con el director lo dice en UNA advertencia con las dos cifras; la
 *   fila del director ofrece «Remitir al secretario» por caso (`puedeRemitirCasoSuelto`) para lo que
 *   una observación le devolvió y él ya revisó.
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1): el filtro «Materia» lista las materias
 *   de Sorteo y viaja como `materiaId`; la materia de la fila es la de Sorteo y dice «Sin materia»
 *   (`etiquetaConSinMateria`) cuando alguna infracción no la tiene.
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import { etiquetaConSinMateria } from "../utils/materia.util";
import {
  EntradaLotesService,
  type EnvioLoteDto,
  type EnvioLoteCaso,
} from "../services/EntradaLotesService";
import { InboxCasesService } from "../services/InboxCasesService";
import { SorteoService } from "../services/SorteoService";
import { EpasService } from "../services/EpasService";
import { sorteoLoteToModalData } from "../utils/sorteoLoteToModalData";
import {
  EPAS_ESTADO_POR_REVISAR,
  EPAS_ESTADO_REVISADO,
  isInboxActionVisible,
} from "../config/inboxActionStatusRules";
import { isEntradaActionVisible } from "../config/entradaGating";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import { MODAL_KEY as ANEXAR_DOCUMENTO } from "../components/modals/ModalAnexarDocumento";
// Reunión del 2026-09-16: la ficha del expediente (punto 5) y la devolución POR EXPEDIENTE (último
// punto), que reusa el modal de devolución que ya servía a las otras dos bandejas.
import { MODAL_KEY as EXPEDIENTE_LOTE } from "../components/modals/ModalExpedienteLote";
import { MODAL_KEY as RETURN_TO_DMR } from "../components/modals/ModalReturnToDmr";
import Pagination from "../components/common/Pagination";
import Alert, { type AlertVariant } from "../components/common/Alert";
import Collapse from "../components/collapse/Collapse";
import ResolucionOrigen from "../components/common/ResolucionOrigen";
import Boton from "../components/common/Boton";
import BotonAccionFila from "../components/common/BotonAccionFila";
import BadgePriority from "../components/common/BadgePriority";
import CeldaInfracciones from "../components/infracciones/CeldaInfracciones";
import AvisoDatosResolucion from "../components/infracciones/AvisoDatosResolucion";
import LineaSincronizacion from "../components/entrada/LineaSincronizacion";
import AvisoDatosNuevos from "../components/entrada/AvisoDatosNuevos";
import {
  CHIP_REINGRESO_POR_VERIFICAR,
  ETIQUETA_REINGRESADO,
  fraseRetenidosPorVerificar,
  marcaDeLaFila,
  tituloChipReingreso,
  tituloPorDevolverNoCumplidas,
  tituloReingresadoBaja,
} from "../components/entrada/reingreso";
import { useEstadoSincronizacion } from "../hooks/useEstadoSincronizacion";
import { useTableCatalogOptions } from "../hooks/useTableCatalogOptions";
import {
  estaAntesDelSorteo,
  etiquetaEstadoEpas,
} from "../config/estadosEpas";
import type { DatosLineaDeTiempo } from "../interfaces/IModal";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import { DatetimeUtil } from "../utils/datetime.util";
import {
  contarProgresoSorteo,
  noQuedaNadaPorSortear,
  seMuestraEnSorteo,
} from "../config/loteSorteoProgreso";
import { puedeRemitirCasoSuelto } from "../components/entrada/remisionCaso";

// Collapse<T> exige permittedActions; esta bandeja renderiza sus propias acciones, así que pasa los
// tres contextos vacíos (igual que SorteadosPage / AprobacionSorteoPage).
const EMPTY_COLLAPSE_ACTIONS = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

// El progreso de sorteo del lote vive en un módulo puro y probado (loteSorteoProgreso). Se deriva
// por NEGACIÓN —pendiente es solo lo que TODAVÍA puede sortearse— porque enumerar los estados de
// destino hacía que el lote retrocediera a «Por sortear» en cuanto un caso avanzaba más allá de
// ASIGNADO_DECISOR. Ver la cabecera de ese archivo.

/**
 * Deriva el BADGE del lote (label + color) a partir de su estado + si el master de sorteo ya fue
 * aprobado por el director (sorteoAprobado). Espeja el diseño de reso.jpg:
 *   EN_REVISION → "Sin revisar" · APROBADO → "Por sortear" ·
 *   ENVIADO_SORTEO → "En Sorteo" (master pendiente) / "Sorteado" (master aprobado) · FINALIZADO → "Finalizado".
 * La clave de color (priority) está mapeada en BADGE_GROUPS (BadgePriority).
 */
function resolveLoteBadge(lote: EnvioLoteDto): {
  label: string;
  priority: string;
} {
  switch (String(lote.envlStatus)) {
    case "EN_REVISION":
      // «Sin revisar», no «Enviado» (reunión del 2026-09-16, punto 6). Es el estado en que el lote
      // RECIÉN LLEGA a Ejecución, y solo lo ve el director: la bandeja del secretario excluye
      // EN_REVISION, así que cambiar la etiqueta aquí no le toca nada a él.
      //
      // «Enviado» describía el acto desde la orilla de QUIEN LO MANDÓ (la DMR ya lo envió). Quien
      // mira esta bandeja está en la otra orilla y lo que necesita saber es qué le falta hacer a él.
      //
      // El color cambia con la etiqueta, y a propósito: `enviado` era VERDE, y un lote que nadie ha
      // mirado todavía pintado de verde se lee como «ya está». `recibido` es neutro — que es lo que
      // el lote es hasta que el director lo abre.
      return { label: "Sin revisar", priority: "recibido" };
    case "APROBADO": {
      // El sorteo POR CASO no avanza envl_status; deriva el badge de los casos: si NO queda ninguno
      // pendiente, muestra "En Sorteo" aunque el lote siga APROBADO en BD (el master aún no se
      // aprueba → no es "Sorteado"). Si falta alguno por sortear, sigue "Por sortear".
      const progreso = contarProgresoSorteo(lote.casos ?? []);
      return seMuestraEnSorteo(progreso)
        ? { label: "En Sorteo", priority: "en sorteo" }
        : { label: "Por sortear", priority: "en revisión" };
    }
    case "ENVIADO_SORTEO":
      return lote.sorteoAprobado
        ? { label: "Sorteado", priority: "sorteado" }
        : { label: "En Sorteo", priority: "en sorteo" };
    case "FINALIZADO":
      return { label: "Finalizado", priority: "finalizado" };
    case "DEVUELTO":
      return { label: "Devuelto", priority: "rechazado" };
    case "ENVIADO_SG":
      return { label: "Enviado a SG", priority: "enviado" };
    default:
      return { label: String(lote.envlStatus), priority: "default" };
  }
}

/** Etiqueta humana del tipo del lote (gobierna el ruteo: DEVOLUCION | FINALIZADO | ENVIO). */
const TIPO_LABEL: Record<string, string> = {
  ENVIO: "Envío",
  DEVOLUCION: "Devolución",
  FINALIZADO: "Finalización",
};

/**
 * MATERIA Y SUBMATERIA de la fila del expediente (quick 261007-jrr). Devuelve lo que se pinta
 * (`texto`) y lo que dice el `title` (`detalle`), o `null` si no se sabe ninguna de las dos.
 *
 * Desde la quick 261104-jh1 las dos son las de SORTEO que el servidor resolvió por la submateria de
 * cada infracción, ya unidas (materias con « / », submaterias con «, »). «Sin materia» es un flag
 * aparte (`caso.infracciones.sinMateria`) que se añade a la materia con `etiquetaConSinMateria`.
 * Aquí no se deduce nada; solo se aplica la regla visual de siempre, que no cambia:
 *
 *   · Lo que falta se OMITE (J-03): es el estilo de esta fila, donde nombre, cédula y zona
 *     desaparecen cuando no vienen. Sin ninguna de las dos, no se pinta nada — ni «—».
 *   · Si la submateria se llama igual que su materia (Ambiente/Ambiente, Metro de Quito/Metro de
 *     Quito), el nombre sale UNA vez (J-04): «Metro de Quito · Metro de Quito» se lee como un error.
 *     Es criterio propio, no un pedido del área; revertirlo es quitar la comparación.
 *   · El `title` rotula SIEMPRE las partes conocidas, sin deduplicar (J-05): resuelve la duda de
 *     «solo se ve una, ¿es materia o submateria?» sin añadir texto a la fila, y con el mismo nombre
 *     no se pierde nada.
 */
function materiaDeLaFila(
  caso: EnvioLoteCaso,
): { texto: string; detalle: string } | null {
  const conEstado = etiquetaConSinMateria(
    caso.expMateria,
    caso.infracciones?.sinMateria,
  );
  const materia = conEstado === "—" ? undefined : conEstado;
  const submateria = caso.expSubmateria?.trim() || undefined;
  if (!materia && !submateria) {
    return null;
  }

  const mismoNombre =
    materia !== undefined &&
    submateria !== undefined &&
    materia.toLocaleLowerCase("es") === submateria.toLocaleLowerCase("es");
  const texto =
    materia && submateria && !mismoNombre
      ? `${materia} · ${submateria}`
      : (materia ?? submateria ?? "");

  const detalle = [
    materia ? `Materia: ${materia}` : null,
    submateria ? `Submateria: ${submateria}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { texto, detalle };
}

/**
 * UAT 03.23-14 — los casos del lote que se ENSEÑAN. El usuario lo pidió así: «con el filtro de
 * materia los lotes salen bien, pero dentro del lote siguen todos los expedientes».
 *
 * Cuando la bandeja se pidió con buscador o materia, el servidor marca cada caso con
 * `coincideFiltro` —calculado con la MISMA regla con que elige qué lotes salen— y aquí se enseñan
 * solo los que traen `true`. Sin filtro el campo no viene y se enseñan todos.
 *
 * 🔴 ES SOLO LO QUE SE VE. `lote.casos` sigue entero y de él siguen saliendo el progreso del sorteo,
 * el badge del lote y los contadores de los diálogos: las acciones de lote («Remitir», «Aprobar y
 * enviar a sorteo») valen para el lote completo, no para lo filtrado.
 *
 * Se decide por lo que trae la RESPUESTA y no por los filtros de la pantalla: mientras llega la
 * consulta nueva, la lista que se ve sigue siendo coherente con la que la pidió.
 */
function casosQueSeEnsenan(casos: EnvioLoteCaso[]): {
  visibles: EnvioLoteCaso[];
  filtrado: boolean;
} {
  const filtrado = casos.some((caso) => caso.coincideFiltro !== undefined);
  return {
    visibles: filtrado
      ? casos.filter((caso) => caso.coincideFiltro === true)
      : casos,
    filtrado,
  };
}

/**
 * Clases del rótulo de cada filtro de la barra. Es un BLOQUE de altura fija (`h-4`): con DaisyUI 5
 * ya no existen `form-control` ni `label-text`, y un `<span>` en línea ignoraba el `mb-1` y medía
 * distinto que el de BUSCAR, que lleva además el indicador de carga (también de 1rem).
 */
const ROTULO_FILTRO =
  "mb-1 flex h-4 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80";

/** Texto del buscador: lo que de verdad encuentra (lo resuelve el servidor). */
const PLACEHOLDER_BUSCADOR =
  "Nº de lote o de expediente, materia, código de infracción, nombre o cédula";

/** Acción de lote pendiente de confirmar (secretario: aprobar-enviar; director: remitir). */
type LoteActionKind = "aprobarEnviar" | "approveDirector";

/** Acción de datos de prueba pendiente de confirmación (ninguna = sin diálogo abierto). */
type SeedAction = "generar" | "purgar" | null;

const BandejaEntradaPage = () => {
  const { user } = useUser();
  // `modal` (Plan 18, G-13): con un modal abierto la bandeja no se recarga sola.
  const { openModal, modal } = useModal();
  const { addToast } = useToast();

  /**
   * Materia elegida, por su ID de Sorteo (quick 261104-jh1). Vacío = todas, y entonces no viaja. Las
   * opciones salen de `GET /infracciones/materias` por el mismo hook que los filtros de «Mis
   * expedientes»: una sola fuente para las materias.
   *
   * Van ANTES del `return null` sin usuario para que se llamen en cada render (reglas de los
   * hooks); el resto de los filtros sigue más abajo, donde ya estaba.
   */
  const [materiaId, setMateriaId] = useState("");
  const catalogoMaterias = useTableCatalogOptions("materiaId");
  /** Estado de la sincronización automática con Resolución (Fase 03.24, D-13); null = no se pinta. */
  const estadoSincronizacion = useEstadoSincronizacion();
  /**
   * quick 261029-kl0: el caso cuyo «Remitir al secretario» (director) está en vuelo. Antes del
   * `return null` por la misma razón que los de arriba (reglas de los hooks).
   */
  const [remitiendoId, setRemitiendoId] = useState<number | null>(null);

  if (!user) {
    return null;
  }

  const rolName = user.rolName ?? "";

  // Reparto por rol (role-only, Plan 03): del gate salen TANTO la bandeja a leer como las acciones.
  const canAprobarEnviar = isEntradaActionVisible(
    "aprobarEnviarSorteo",
    rolName,
  );
  const canApproveDirector = isEntradaActionVisible(
    "approveDirectorEntrada",
    rolName,
  );
  // Devolver a la DMR es COMPARTIDA por ambos roles (director + secretario abogado).
  const canDevolver = isEntradaActionVisible("devolverDmr", rolName);
  // El director lee su bandeja; el secretario la suya. NO se mezclan (RESEARCH Q3).
  const esDirector = canApproveDirector;
  // El secretario tiene bandeja por su acción propia (la sincronización manual ya no existe, D-09).
  const esSecretario = canAprobarEnviar;
  const tieneBandeja = esDirector || esSecretario;

  const [lotes, setLotes] = useState<EnvioLoteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── PAGINADO + FILTROS (reunión del 2026-09-16, puntos 1, 3 y 7) ──────────────────────────────
  //
  // 🔴 TODO ESTO VIVE EN EL SERVIDOR, no aquí. La bandeja ya no trae «todos los lotes con todos sus
  // casos» para que la pantalla recorte: pide UNA página y el backend filtra. Es lo que hace que el
  // buscador siga siendo útil cuando haya mil lotes, en vez de encontrar rápido dentro de lo poco
  // que cupo en la primera carga.
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  /**
   * Lo que el usuario está TECLEANDO en el buscador. No es lo que se consulta: eso es
   * `searchAplicado`, que va un tirón por detrás (ver el efecto de rebote más abajo).
   */
  const [search, setSearch] = useState("");
  /**
   * El término que REALMENTE viaja al servidor. Se separa de `search` para no disparar una consulta
   * por cada tecla: escribir «Gabriela» son ocho peticiones, y las ocho compiten por llegar — con lo
   * que la lista puede acabar mostrando el resultado de «Gabrie» porque llegó la última.
   */
  const [searchAplicado, setSearchAplicado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  // La MATERIA (`materiaId`) y su catálogo se declaran arriba, antes del `return null` sin
  // usuario: son los primeros hooks de esta pantalla que se llaman siempre, en el mismo orden.

  /**
   * ¿El rango de fechas está al revés (desde > hasta)? No se consulta con él: devolvería cero lotes
   * y el usuario leería «no hay nada» cuando lo que hay es un rango imposible. Se le dice.
   */
  const rangoInvertido =
    fechaDesde !== "" && fechaHasta !== "" && fechaDesde > fechaHasta;

  const hayFiltros =
    searchAplicado.trim().length > 0 ||
    fechaDesde !== "" ||
    fechaHasta !== "" ||
    materiaId !== "";

  /**
   * ¿YA se cargó la bandeja alguna vez? Gobierna el velo de carga a pantalla completa.
   *
   * 🔴 ESTO ES LO QUE ARREGLA EL PARPADEO (2026-09-17). `<Loading />` no es un spinner pequeño: es un
   * `<div>` absoluto que tapa de borde a borde con el logo a `clamp(12rem, 30vw, 26rem)`. Pintarlo en
   * CADA consulta hacía que la pantalla entera se apagara y se encendiera a cada búsqueda y a cada
   * cambio de página. Ahora solo se ve la PRIMERA vez —cuando de verdad no hay nada que enseñar—; a
   * partir de ahí la lista se queda en su sitio y la recarga se anuncia atenuándola.
   */
  const [yaCargoAlgunaVez, setYaCargoAlgunaVez] = useState(false);

  /**
   * Nº de la última petición LANZADA. Es el guardia contra respuestas viejas: cada consulta se queda
   * con su número y, al volver, solo escribe en el estado si sigue siendo la última.
   *
   * Hace falta porque el buscador dispara consultas encadenadas y la red no garantiza el orden: la de
   * «Gabri» puede llegar DESPUÉS de la de «Gabriela» y dejar la lista mostrando resultados de un
   * término que ya no está en el cuadro. El rebote lo hace raro, no imposible.
   */
  const peticionRef = useRef(0);

  // Rebote del buscador: 350 ms sin teclear y recién entonces se consulta. El `clearTimeout` de la
  // limpieza cancela el anterior, así que solo sobrevive la última pulsación.
  //
  // Vuelve a la PRIMERA PÁGINA en el mismo gesto, y no en un efecto aparte: los dos `setState` caen
  // en el mismo lote de React, así que sale UNA sola consulta. Separados, el cambio de término y el
  // de página se veían como dos renders y la bandeja pedía dos veces (la primera, con la página
  // vieja) — el doble de peticiones y una carrera entre ellas.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchAplicado(search);
      setPageIndex(0);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  /**
   * Cambia un filtro de FECHA y vuelve a la primera página, en un solo gesto (misma razón que arriba:
   * un único render ⇒ una única consulta). Sin el reinicio, filtrar estando en la página 4 de una
   * bandeja que ahora tiene una sola página deja la pantalla vacía sobre un resultado que sí existe.
   */
  const cambiarFecha = (
    set: (valor: string) => void,
    valor: string,
  ): void => {
    set(valor);
    setPageIndex(0);
  };

  /**
   * Cambia la MATERIA y vuelve a la primera página, en un solo gesto: mismo patrón y misma razón que
   * `cambiarFecha` (un único render ⇒ una única consulta).
   */
  const cambiarMateria = (valor: string): void => {
    setMateriaId(valor);
    setPageIndex(0);
  };

  /**
   * NOMBRE de la materia elegida (UAT 03.23-14), del mismo catálogo que el desplegable; si el
   * catálogo aún no lo trae, el id. Vacío con «Todas». Lo usan el `title` del desplegable y el
   * vacío que nombra la materia.
   */
  const nombreMateriaElegida =
    materiaId === ""
      ? ""
      : (catalogoMaterias.options.find((opcion) => opcion.value === materiaId)
          ?.label ?? materiaId);

  /**
   * El vacío dice POR QUÉ está vacío. Con SOLO la materia puesta, la nombra (UAT 03.23-14): «0
   * lote(s)» con ESPECTÁCULOS PÚBLICOS elegida es que no hay lotes de esa materia, no que el filtro
   * falle. Con cualquier otra combinación, el mensaje general.
   */
  const textoBandejaVacia = !hayFiltros
    ? "No hay lotes en su bandeja de entrada."
    : materiaId !== "" &&
        searchAplicado.trim() === "" &&
        fechaDesde === "" &&
        fechaHasta === ""
      ? `No hay lotes con infracciones de ${nombreMateriaElegida}.`
      : "Ningún lote coincide con la búsqueda, la materia o el rango de fechas.";

  // SORTEO PER-CASO (secretario, sobre lotes APROBADO): selección de casos VERIFICADO (revisados) para
  // sortearlos, y el caso cuyo "Marcar revisado" (VERIFICAR) está en vuelo. Espeja la Bandeja de Sorteo.
  const [seleccionCasos, setSeleccionCasos] = useState<Set<number>>(new Set());
  const [revisandoId, setRevisandoId] = useState<number | null>(null);

  /**
   * Contador de recargas de la lista de documentos, POR EPAS (quick 260917-anx). Sube uno cada vez
   * que el modal de anexos termina bien, y `ExpedienteDocumentos` —que lo lleva en las dependencias
   * de su efecto— vuelve a pedir la lista de ESE caso. No se recarga la bandeja entera: sería pedir
   * de nuevo todos los lotes por un documento de un solo expediente.
   */
  const [recargaDocs, setRecargaDocs] = useState<Record<number, number>>({});
  const [sortearSubmitting, setSortearSubmitting] = useState(false);

  // Confirmación de una acción de lote (aprobar-enviar / remitir); el padre es dueño del error.
  const [confirmAction, setConfirmAction] = useState<{
    lote: EnvioLoteDto;
    kind: LoteActionKind;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);
  // Datos de prueba (solo DIRECTOR, y solo si SEED_ENABLED está encendido en el backend).
  const [seedEnabled, setSeedEnabled] = useState(false);
  const [seedAction, setSeedAction] = useState<SeedAction>(null);
  const [seedMessage, setSeedMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  const fetchLotes = useCallback(async () => {
    if (!tieneBandeja) {
      setLotes([]);
      setTotal(0);
      setPages(0);
      return;
    }
    // Rango imposible: no se consulta (el servidor devolvería cero y parecería «no hay lotes»).
    if (rangoInvertido) {
      return;
    }
    // Esta consulta se queda con su número de turno; al volver, solo escribe si sigue siendo la
    // última lanzada. Ver `peticionRef`.
    const miTurno = ++peticionRef.current;
    setLoading(true);
    setError(null);
    try {
      const filtros = {
        search: searchAplicado,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        // Solo con valor: «Todas» no es una materia en blanco, es un filtro que no está.
        ...(materiaId !== "" ? { materiaId } : {}),
        limit: pageSize,
        offset: pageIndex * pageSize,
      };
      const respuesta = esDirector
        ? await EntradaLotesService.bandejaDirector(filtros)
        : await EntradaLotesService.bandejaSecretario(filtros);
      if (miTurno !== peticionRef.current) return;
      setLotes(respuesta.data);
      setTotal(respuesta.total);
      setPages(respuesta.pages);
      setYaCargoAlgunaVez(true);
    } catch (err) {
      if (miTurno !== peticionRef.current) return;
      setError(
        mensajeParaUsuario(err, "No se pudo cargar la Bandeja de Entrada. Intente más tarde."),
      );
    } finally {
      // El `loading` lo apaga SOLO la última consulta: si lo apagara una vieja al volver, la lista
      // dejaría de verse ocupada mientras la buena sigue en vuelo.
      if (miTurno === peticionRef.current) setLoading(false);
    }
  }, [
    esDirector,
    tieneBandeja,
    rangoInvertido,
    searchAplicado,
    fechaDesde,
    fechaHasta,
    materiaId,
    pageIndex,
    pageSize,
  ]);

  useEffect(() => {
    void fetchLotes();
  }, [fetchLotes]);

  const refreshLotes = useCallback(async () => {
    await fetchLotes();
  }, [fetchLotes]);

  // Consulta el gate de /seed ANTES de pintar los botones: ofrecer una acción que responderá 403 es
  // peor que no ofrecerla. Solo el DIRECTOR; si el gate está apagado (o la consulta falla), sin botones.
  useEffect(() => {
    if (!esDirector) {
      setSeedEnabled(false);
      return;
    }
    InboxCasesService.isSeedEnabled()
      .then(setSeedEnabled)
      // Degradación limpia: si el backend no responde el gate, se asume deshabilitado.
      .catch(() => setSeedEnabled(false));
  }, [esDirector]);

  /** Abre la confirmación de una acción de datos de prueba (el error se muestra dentro del diálogo). */
  const openSeedDialog = (action: SeedAction) => {
    setSeedMessage(null);
    setSeedAction(action);
  };

  // GENERA (añade) o PURGA (borra todo) los LOTES de la Bandeja de Entrada, avisa con un toast (con
  // los conteos) y REFRESCA la bandeja. Usa los verbos LOTE-céntricos de EntradaLotesService
  // (dev/generar, dev/purge) — el viejo InboxCasesService.generateSeed/resetInboxCases sembraba
  // EXPEDIENTES del modelo anterior y NO tocaba t_envio_lote, por eso la bandeja no se sembraba. El
  // error se muestra inline en el diálogo, que permanece abierto (contrato parent-owns-error de
  // ConfirmationDetail); solo el éxito lo cierra.
  //
  // 🔴 Los dos botones son ASIMÉTRICOS a propósito (2026-09-17): «Generar» SUMA y «Purgar» BORRA. Lo
  // que había antes era un «Generar» que purgaba por dentro, con lo que no existía forma de acumular
  // expedientes ni de saber, leyendo el botón, que uno iba a perder lo que tenía.
  const confirmarSeed = async () => {
    try {
      if (seedAction === "generar") {
        const { sincronizados } =
          await EntradaLotesService.generarLotesDePrueba();
        addToast(
          "success",
          `Datos de prueba generados: se añadieron ${sincronizados.lotesSincronizados} lote(s) ` +
            `con ${sincronizados.casosSincronizados} caso(s). Lo que ya había en la bandeja se conserva.`,
        );
      } else {
        const { lotes, casos } =
          await EntradaLotesService.purgarLotesDePrueba();
        addToast(
          "success",
          `Datos de prueba purgados: ${lotes} lote(s) y ${casos} caso(s) eliminados.`,
        );
      }

      setSeedAction(null);
      await refreshLotes();
    } catch (err) {
      setSeedMessage({
        variant: "error",
        message:
          mensajeParaUsuario(err, "No se pudo completar la operación sobre los datos de prueba"),
      });
    }
  };

  // --- Acción de lote: aprobar-enviar (secretario) / remitir al secretario (director) ---
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionMessage(null);
    const { lote, kind } = confirmAction;
    try {
      if (kind === "aprobarEnviar") {
        const res = await EntradaLotesService.aprobarEnviarSorteo(lote.envlId);
        // 🔴 quick 261029-kl0: lo que está con el director (observaciones por revisar o sin remitir)
        // NO se sortea, y hay que DECIRLO en un solo aviso que se queda: el lote sigue abierto.
        const excluidos = res?.excluidos ?? 0;
        if (excluidos > 0) {
          addToast(
            "warning",
            `Lote ${lote.envlNumeroLote}: ${res.sorteados ?? 0} expediente(s) enviados al sorteo. ` +
              `${excluidos} no se sortearon: están de vuelta con el director —con observaciones ` +
              "por revisar o sin remitir—. El lote sigue abierto hasta que se resuelvan.",
          );
        } else {
          addToast(
            "success",
            `Lote ${lote.envlNumeroLote} aprobado y enviado al sorteo.`,
          );
        }
            } else {
        const res = await EntradaLotesService.approveDirector(lote.envlId);
        // 🔴 LOS MARCADOS «POR DEVOLVER» NO VIAJAN (2026-09-18), y hay que DECIRLO: el director
        // acaba de remitir un lote de treinta y tres se han quedado. Callarlo es el fallo que se
        // descubre semanas después, cuando alguien pregunta por un expediente que no llegó.
        addToast(
          "success",
          `Lote ${lote.envlNumeroLote} remitido al secretario.` +
            (res.retenidos > 0
              ? ` ${res.retenidos} expediente(s) marcados «Por devolver» NO se remitieron: ` +
                "quedan a la espera de su devolución."
              : "") +
            // Fase 03.24 (G-01, UI-SPEC §1.6): los reingresados con observaciones por verificar
            // tampoco viajan. La cifra la manda el servidor; sin ella no se añade nada.
            fraseRetenidosPorVerificar(res.retenidosPorVerificar),
        );
      }
      setConfirmAction(null);
      await refreshLotes();
    } catch (err) {
      setActionMessage({
        variant: "error",
        message:
          mensajeParaUsuario(err, "No se pudo completar la acción. Intente más tarde."),
      });
    }
  };

  /**
   * Abre el ModalAssignmentResult EXISTENTE (reuse) con el resultado del sorteo del lote. Solo se llega
   * aquí cuando `envlAmasId != null` (el botón no existe si no). Lee TODOS los lotes del sorteo, FILTRA
   * por `envlAmasId` (único join válido — Plan 01, PROHIBIDO matchear por numero_lote/counts) y compone
   * el shape del modal con el adapter. Degrada con gracia si el sorteo no está disponible.
   */
  const handleVerResultado = async (lote: EnvioLoteDto) => {
    if (lote.envlAmasId == null) return;
    try {
      const todos = await SorteoService.lotes();
      const filtrados = todos.filter((sl) => sl.amasId === lote.envlAmasId);
      const data = sorteoLoteToModalData(lote, filtrados);
      openModal("seeAssignmentResults", data, { refetchFn: refreshLotes });
    } catch {
      addToast(
        "info",
        "No se pudo cargar el resultado del sorteo en este momento. Intente más tarde.",
      );
    }
  };

  // --- SORTEO PER-CASO del secretario (dentro del lote APROBADO) ---
  /** ¿El secretario puede sortear casos de este lote? (rol + lote APROBADO, aún sin enviar a sorteo). */
  const puedeSortearPorCaso = (lote: EnvioLoteDto): boolean =>
    esSecretario && lote.envlStatus === "APROBADO" && lote.envlAmasId == null;

  /**
   * Un caso es SORTEABLE (seleccionable) solo si está revisado y aterrizado (eeje_id). El estado se
   * compara contra la constante del contrato compartido, no contra una cadena escrita aquí:
   * `eejeStatus` viaja como `string` y un literal mal escrito no da error de compilación (Fase 03.15).
   * Sobre por qué este predicado se queda FUERA del motor de acciones, ver el bloque D-6 de SorteoPage.
   */
  const esCasoSorteable = (caso: EnvioLoteCaso): boolean =>
    caso.eejeId != null && caso.eejeStatus === EPAS_ESTADO_REVISADO;

  const toggleCaso = (eejeId: number) => {
    setSeleccionCasos((prev) => {
      const next = new Set(prev);
      if (next.has(eejeId)) next.delete(eejeId);
      else next.add(eejeId);
      return next;
    });
  };

  /**
   * «Adjuntar documento» (quick 260917-anx): abre el modal del anexo libre sobre ESTE caso y, al
   * terminar bien, sube la señal de su lista de documentos.
   *
   * La ventana en que se puede anexar (desde que hay decisor asignado hasta la remisión a SG) la
   * hace cumplir el BACKEND, y aquí NO se replica: el botón se ofrece siempre que el caso haya
   * aterrizado, y si no procede, el modal enseña la frase con que el servidor lo explica.
   */
  const handleAnexarDocumento = (eejeId: number) => {
    openModal(
      ANEXAR_DOCUMENTO,
      { eejeId },
      {
        onSuccess: () =>
          setRecargaDocs((previo) => ({
            ...previo,
            [eejeId]: (previo[eejeId] ?? 0) + 1,
          })),
      },
    );
  };

  /**
   * «Ver memorando» de la cabecera del lote (reunión del 2026-09-16, punto 4): abre en el visor PDF
   * el memo con el que la DMR remitió el lote. Reusa el `documentViewer` de siempre — es el mismo
   * visor con que se abre cualquier otro documento del módulo.
   *
   * Solo se llega aquí si `docUrl` existe: sin memo, la cabecera NO pinta el botón.
   */
  const handleVerMemo = (lote: EnvioLoteDto) => {
    if (!lote.docUrl) return;
    openModal("documentViewer", {
      docName: lote.docName ?? `Memorando del lote ${lote.envlNumeroLote}`,
      docUrl: lote.docUrl,
    });
  };

  /**
   * «Ver expediente» (el ojo de cada fila, punto 5 de la reunión): abre la ficha con las dos
   * pestañas. Se le pasa el caso TAL CUAL lo tiene la bandeja —ya trae todo lo de la primera
   * pestaña— más la señal de recarga de documentos, para que un anexo nuevo se vea sin cerrar el
   * modal.
   */
  const handleVerExpediente = (caso: EnvioLoteCaso) => {
    if (caso.eejeId == null) return;
    openModal(
      EXPEDIENTE_LOTE,
      {
        ...caso,
        recargaSenal: recargaDocs[caso.eejeId] ?? 0,
        // 🔴 EL DIRECTOR REVISA AQUÍ (2026-09-18): la ficha es el mismo sitio donde el secretario
        // anotó, y es donde él tiene delante el dato que se observó mientras decide. Su `usu_id` va
        // con ello porque sobre lo que anotó él mismo no hay veredicto que dar.
        puedeRevisar: esDirector,
        usuarioId: user.usuId,
      },
      // La ficha ESCRIBE desde el 2026-09-18 (observaciones por campo y por documento), así que al
      // cerrarla la bandeja tiene que volver a pedir: el badge «Por devolver» lo calcula el servidor
      // y la lista no se entera de lo anotado hasta su siguiente lectura.
      { refetchFn: refreshLotes },
    );
  };

  /**
   * El `⑂` de la fila (Fase 03.24, Plan 20 — G-04): la línea de tiempo del expediente, antes del
   * sorteo incluida, para que el director vea el rastro de lo que hizo Resolución (D-08) donde
   * decide. Desde aquí NO viaja `caseId` —`EnvioLoteCaso` no lo trae—; mientras no haya sorteo eso
   * no es una carencia, y `momento` se lo dice al modal. Es de solo lectura: sin `refetchFn`.
   */
  const handleVerLineaDeTiempo = (caso: EnvioLoteCaso) => {
    if (caso.eejeId == null) return;
    const datos: DatosLineaDeTiempo = {
      eejeId: caso.eejeId,
      expNumber: caso.expNumber,
      momento: estaAntesDelSorteo(caso.eejeStatus) ? "antesDelSorteo" : undefined,
    };
    openModal("timeLine", datos);
  };

  /**
   * «Devolver a la DMR» de UN expediente (reunión del 2026-09-16, último punto: la devolución pasa a
   * ser por expediente y deja de ser por lote).
   *
   * 🔴 REUSA `ModalReturnToDmr`, que ya existía y ya devolvía un caso suelto (lo usan la Bandeja de
   * Sorteo y «Mis EPAS Asignados»). No se construye un diálogo nuevo: el acto es el mismo —transición
   * DEVOLVER_DMR con su motivo—, y ese modal además consulta el estado de notificación antes de
   * dejar devolver, que es información que el director necesita y el diálogo de lote no daba.
   *
   * Se le pasa lo mínimo que lee (`eejeId` y `expNumber`): el resto de `EpasListItem` no lo toca.
   */
  const handleDevolverExpediente = (caso: EnvioLoteCaso) => {
    if (caso.eejeId == null) return;
    openModal(
      RETURN_TO_DMR,
      { eejeId: caso.eejeId, expNumber: caso.expNumber },
      { refetchFn: refreshLotes },
    );
  };

  /**
   * «Remitir al secretario» de UN caso (director, quick 261029-kl0) → PATCH /epas/:id/approve-director.
   * Para lo que una observación devolvió al director y él ya revisó (o lo retenido que se liberó): el
   * lote ya está remitido, así que la remisión es por caso. El servidor vuelve a exigir rol, estado y
   * que no quede nada retenido.
   */
  const handleRemitirCaso = async (caso: EnvioLoteCaso) => {
    if (caso.eejeId == null) return;
    setRemitiendoId(caso.eejeId);
    try {
      await EpasService.aprobarPorDirector(caso.eejeId);
      addToast(
        "success",
        `Expediente ${caso.expNumber ?? caso.eejeId} remitido al secretario.`,
      );
      await refreshLotes();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo remitir el expediente al secretario."),
      );
    } finally {
      setRemitiendoId(null);
    }
  };

  /** "Marcar revisado" de UN caso: transición REAL VERIFICAR (RECIBIDO → VERIFICADO). Acto del secretario. */
  const handleMarcarRevisado = async (eejeId: number) => {
    setRevisandoId(eejeId);
    try {
      await EpasService.marcarRevisado(eejeId);
      addToast("success", "Expediente marcado como revisado.");
      await refreshLotes();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo marcar el expediente como revisado."),
      );
    } finally {
      setRevisandoId(null);
    }
  };

  /**
   * Sortea los casos VERIFICADO seleccionados de TODOS los lotes en una sola tanda (POST /sorteo): la
   * selección es cross-lote (se pueden enviar a sorteo casos de varios lotes juntos). Excluye los no
   * revisados. El botón vive en la cabecera del section, no por lote.
   */
  const handleSortearSeleccionados = async () => {
    const seleccionados = lotes
      .flatMap((l) => l.casos ?? [])
      .filter(
        (c) => esCasoSorteable(c) && seleccionCasos.has(c.eejeId as number),
      );
    if (seleccionados.length === 0) return;
    setSortearSubmitting(true);
    try {
      await SorteoService.sortear({
        items: seleccionados.map((c) => ({
          eejeId: c.eejeId as number,
          caseId: c.envlcCaseRef as number,
        })),
      });
      addToast(
        "success",
        `${seleccionados.length} caso(s) enviado(s) al sorteo.`,
      );
      setSeleccionCasos(new Set());
      await refreshLotes();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudieron sortear los expedientes. Intente más tarde."),
      );
    } finally {
      setSortearSubmitting(false);
    }
  };

  const tituloBandeja = esDirector
    ? "Lotes por remitir"
    : "Lotes para enviar a sorteo";

  // Casos VERIFICADO seleccionados a lo largo de TODOS los lotes (la selección es cross-lote): alimenta
  // el contador y el estado deshabilitado del botón "Sortear seleccionados" de la cabecera del section.
  const totalSeleccionadosSorteo = lotes
    .flatMap((l) => l.casos ?? [])
    .filter(
      (c) => esCasoSorteable(c) && seleccionCasos.has(c.eejeId as number),
    ).length;

  /**
   * Cabecera de la card del lote: identidad (nº de memo, estado, tipo, casos, fecha) + "Resultado del
   * sorteo" cuando el lote ya está ligado a un sorteo (envlAmasId). El botón vive dentro del <summary>:
   * preventDefault/stopPropagation para que su click no despliegue la card.
   */
  const renderLoteHeader = (lote: EnvioLoteDto, i: number): ReactNode => {
    const tipo = String(lote.envlTipo);
    const casos = lote.casos ?? [];
    // El color lo manda `pendientes`, no `total - sorteados`: un caso DEVUELTO_DMR nunca va a
    // sortearse, así que el lote está al día aunque la cuenta no llegue al total.
    const { sorteados, total, pendientes, descartados } =
      contarProgresoSorteo(casos);
    // UAT 03.23-14: con filtro, la cabecera dice cuántos casan de cuántos tiene el lote.
    const { visibles, filtrado } = casosQueSeEnsenan(casos);

    return (
      <div className="app-collapse-alert-header">
        <div className="app-inbox-document-header-left">
          <div className="app-inbox-document-info">
            <h3 className="app-collapse-alert-title app-inbox-document-name">
              <span className="app-collapse-alert-index">{i + 1}.</span>
              {lote.envlNumeroLote}
            </h3>
            <div className="app-inbox-document-meta">
              <span className="badge badge-outline whitespace-nowrap">
                {TIPO_LABEL[tipo] ?? tipo}
              </span>
              <span
                className="app-inbox-document-count"
                title={
                  filtrado
                    ? "Expedientes del lote que coinciden con el filtro, de todos los del lote"
                    : undefined
                }
              >
                {filtrado
                  ? `${visibles.length} de ${casos.length} caso(s)`
                  : `${casos.length} caso(s)`}
              </span>

              {lote.envlIncomeAt && (
                <span className="app-inbox-document-date">
                  Ingresó: {DatetimeUtil.formatDate(lote.envlIncomeAt)}
                </span>
              )}

              {total > 0 && (
                <span
                  className={`badge badge-sm whitespace-nowrap ${
                    pendientes === 0
                      ? "badge-success"
                      : "badge-warning badge-outline"
                  }`}
                >
                  {sorteados}/{total} sorteados
                  {descartados > 0 && ` · ${descartados} devuelto(s)`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="app-collapse-alert-header-right app-inbox-document-header-right">
          {/* EL MEMO DEL LOTE (reunión del 2026-09-16, punto 4). El ojo abre el memorando con el que
              la DMR remitió el lote —donde consta la información de todo el lote y sus expedientes—,
              igual que el "Ver documento" de la bandeja de Resolución.

              🔴 SOLO SI EL LOTE TRAE MEMO. Hoy lo traen los lotes de PRUEBA (el reseed lo genera) y
              no los del sync real: el contrato con Resolución sigue [ASSUMED] y `documentoUrl` viaja
              en null. Sin URL no hay botón — misma degradación honesta que "Resultado del sorteo",
              y por la misma razón: ofrecer un ojo que abre una pantalla en blanco es peor que no
              ofrecerlo.

              preventDefault/stopPropagation porque vive DENTRO del <summary>: sin ellos, pulsarlo
              desplegaría además la card del lote. */}
          {lote.docUrl && (
            <div className="flex flex-wrap gap-2">
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                icono="mirar"
                texto="Ver memorando"
                deshabilitado={false}
                onClick={(e) => {
                  e?.preventDefault();
                  e?.stopPropagation();
                  handleVerMemo(lote);
                }}
              />
            </div>
          )}
          {/* "Resultado del sorteo": una LECTURA, y SOLO si el lote fue enviado a sorteo (envlAmasId).
              Sin amas_id no hay botón (degradación honesta D-08). */}
          {lote.envlAmasId != null && (
            <div className="flex flex-wrap gap-2">
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                texto="Resultado del sorteo"
                deshabilitado={false}
                onClick={(e) => {
                  e?.preventDefault();
                  e?.stopPropagation();
                  void handleVerResultado(lote);
                }}
              />
            </div>
          )}
          <BadgePriority
            text={resolveLoteBadge(lote).label}
            priority={resolveLoteBadge(lote).priority}
            size="md"
            capitalize={false}
          />
          <span className="app-collapse-alert-chevron">
            <svg
              className="app-collapse-alert-chevron-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>
    );
  };

  /**
   * Cuerpo de la card: lista THIN de los casos del lote (solo referencias — RESEARCH Q3 Pitfall 2, sin
   * detalle rico ni N+1; scroll cliente), y DEBAJO la acción gateada por rol. Los botones viven FUERA
   * del <summary> (Collapse los renderiza en el <div> del contenido): no necesitan preventDefault.
   */
  const renderLoteContent = (lote: EnvioLoteDto): ReactNode => {
    const casos = lote.casos ?? [];
    // El secretario puede sortear casos sueltos de este lote (APROBADO): checkbox + "Marcar revisado".
    // El botón "Sortear seleccionados" (cross-lote) vive en la cabecera del section, no aquí.
    const sortearPorCaso = puedeSortearPorCaso(lote);
    // Si NO queda ningún caso pendiente de sortear, no se ofrece "Aprobar y enviar a sorteo" (evita
    // re-sortear un lote ya completo mientras su envl_status sigue APROBADO). Se cuenta por negación:
    // un caso que ya avanzó a EN_VERIFICACION_PAGO o CUMPLIDO tampoco está pendiente.
    const todoSorteado = noQuedaNadaPorSortear(contarProgresoSorteo(casos));
    // UAT 03.23-14: lo que se ENSEÑA (con filtro, solo lo que casa). Lo de arriba sigue sobre el lote
    // entero a propósito: ver `casosQueSeEnsenan`.
    const { visibles: casosVisibles, filtrado } = casosQueSeEnsenan(casos);

    // Acciones gateadas por rol Y ESTADO:
    //  · EN_REVISION ("Sin revisar"): es del DIRECTOR — Remitir al secretario / Devolver a DMR.
    //  · APROBADO ("Por sortear"): ya es del SECRETARIO — el director NO acciona (solo Ver memorando);
    //    el secretario sortea (per-caso / lote) y puede devolver antes de sortear.
    const esEnRevision = lote.envlStatus === "EN_REVISION";
    const esAprobado = lote.envlStatus === "APROBADO";
    const sinSortear = lote.envlAmasId == null;
    const puedeRemitir = canApproveDirector && esEnRevision;
    const puedeAprobarEnviar =
      canAprobarEnviar && esAprobado && sinSortear && !todoSorteado;
    /**
     * ¿Se puede devolver a la DMR desde este lote? (reunión del 2026-09-16, último punto.)
     *
     * 🔴 LA CONDICIÓN ES LA MISMA QUE TENÍA LA DEVOLUCIÓN DE LOTE; lo que cambia es DÓNDE se ofrece:
     * antes un botón al pie de la card devolvía el lote entero, ahora hay uno por FILA y devuelve
     * ese expediente. El gate no se relaja por el camino — devolver de uno en uno no es una acción
     * distinta, es la misma con otro alcance.
     *
     * Se calcula por LOTE porque los dos términos que lo componen son del lote: quién lo tiene en su
     * bandeja (`esEnRevision` → director, `esAprobado` → secretario) y si ya fue a sorteo. Pero NO
     * basta: falta el estado del CASO, y eso lo añade `casoDevolvible`.
     */
    const puedeDevolverLote =
      canDevolver &&
      sinSortear &&
      ((esDirector && esEnRevision) || (esSecretario && esAprobado));

    /**
     * 🔴 EL DIRECTOR CONSERVA LO QUE MARCÓ, AUNQUE EL LOTE YA SE HAYA REMITIDO (2026-09-21).
     *
     * Desde que el secretario dejó de ver los expedientes marcados, el reparto de arriba abría un
     * agujero: en un lote APROBADO devolver era acto SOLO del secretario, y a él esas filas ya no le
     * llegan — nadie podría devolverlas nunca. El lote pasa al secretario MENOS lo apartado, así que
     * lo apartado sigue siendo del director hasta que lo devuelva.
     *
     * Acotado a lo MARCADO a propósito: sobre el resto del lote APROBADO el director sigue sin
     * accionar, que es el reparto RECE-08 de siempre.
     */
    const devolverMarcadoDelDirector = (caso: EnvioLoteCaso) =>
      canDevolver && sinSortear && esDirector && Boolean(caso.porDevolver);

    /**
     * ¿Se puede devolver ESTE caso? Lo del lote MÁS el estado del expediente (2026-09-18).
     *
     * 🔴 AQUÍ FALTABA LA MITAD, Y EL ÁREA LA ENCONTRÓ: «Transición inválida: no se puede aplicar
     * DEVOLVER_DMR desde DEVUELTO_DMR». Este gate se calculaba SOLO por lote, y lo que decía el
     * comentario de al lado —«el estado del caso lo comprueba el backend en la transición»— era
     * exactamente el defecto: el backend lo comprueba, sí, pero ya con el usuario delante del
     * diálogo y respondiendo con el error crudo de la máquina de estados. Pasa en cuanto un lote
     * lleva un caso ya devuelto: los lotes de tipo DEVOLUCION dejan a TODOS sus casos en
     * `DEVUELTO_DMR` al entrar (el ruteo del sync), y esa fila seguía ofreciendo «Devolver a DMR».
     *
     * Se resuelve con `isInboxActionVisible` y NO con una comparación a mano: la regla —devolver es
     * legal desde RECIBIDO y VERIFICADO— ya vive en `inboxActionStatusRules` y es la misma que usan
     * Recepción y Sorteo, que sí la aplicaban. Repetirla aquí sería tener dos versiones de la misma
     * regla esperando a divergir.
     */
    const casoDevolvible = (caso: EnvioLoteCaso) =>
      (puedeDevolverLote || devolverMarcadoDelDirector(caso)) &&
      isInboxActionVisible("DEVOLVER_DMR", caso.eejeStatus, rolName);

    return (
      <div className="app-collapse-alert-body">
        <div className="flex flex-col gap-4 p-3 text-sm">
          {filtrado && casos.length > 0 && (
            <p className="text-xs text-base-content/70">
              Se muestran {casosVisibles.length} de {casos.length} expedientes
              del lote: los que coinciden con el filtro. Las acciones del lote
              siguen valiendo para el lote completo.
            </p>
          )}
          {casos.length === 0 ? (
            <EmptyState text="El lote no tiene casos aterrizados todavía." />
          ) : casosVisibles.length === 0 ? (
            <EmptyState text="Ningún expediente de este lote coincide con el filtro." />
          ) : (
            <div>
              <div className="app-item-list mt-1">
                {casosVisibles.map((caso, idx) => {
                  // Un caso ATERRIZADO (eeje_id) trae el detalle rico hidratado por el backend
                  // (LEFT JOIN al EPAS). Uno sin aterrizar solo tiene su referencia de origen.
                  const aterrizado = caso.eejeId != null;
                  // Persona jurídica → su razón social ES su identidad; si no, nombre + apellido.
                  const nombre =
                    caso.admiBusinessName ??
                    [caso.admiName, caso.admiLastname]
                      .filter(Boolean)
                      .join(" ");
                  // «Materia · Submateria» del expediente (quick 261007-jrr); null si no se sabe.
                  const materiaFila = materiaDeLaFila(caso);
                  // EL ESTADO DE LA FILA, Y ES UNO SOLO (Fase 03.24, G-01): lo decide el servidor.
                  const marca = marcaDeLaFila(caso);
                  const estadoLegible = caso.eejeStatus
                    ? etiquetaEstadoEpas(caso.eejeStatus)
                    : "—";

                  return (
                    <div
                      key={caso.envlcId ?? caso.envlcCaseRef ?? idx}
                      className="flex flex-col gap-1"
                    >
                      <div className="flex items-start gap-2">
                        {/* Checkbox del caso (secretario, lote APROBADO): solo VERIFICADO es seleccionable. */}
                        {sortearPorCaso && (
                          <span
                            className="pt-3"
                            title={
                              esCasoSorteable(caso)
                                ? undefined
                                : "Marque el caso como revisado para poder sortearlo."
                            }
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-sm"
                              checked={
                                caso.eejeId != null &&
                                seleccionCasos.has(caso.eejeId)
                              }
                              disabled={!esCasoSorteable(caso)}
                              onChange={() =>
                                caso.eejeId != null && toggleCaso(caso.eejeId)
                              }
                              aria-label={`Seleccionar el caso de ${nombre || caso.eejeId}`}
                            />
                          </span>
                        )}
                        <div className="app-item-list-row app-item-list-row--with-actions flex-1 rounded border border-base-300">
                          <span className="app-item-list-index">
                            {idx + 1}.
                          </span>

                          <div className="app-item-list-primary">
                            <div className="app-item-list-identifying">
                              {caso.expNumber ??
                                (aterrizado
                                  ? `EPAS #${caso.eejeId}`
                                  : `Ref. origen #${caso.envlcCaseRef ?? "—"}`)}
                            </div>
                            {caso.expCreatedAt && (
                              <div className="app-item-list-complementary">
                                {DatetimeUtil.formatDate(caso.expCreatedAt)}
                              </div>
                            )}
                          </div>

                          <div className="app-item-list-secondary">
                            {nombre && (
                              <span className="app-item-list-info--alta">
                                {nombre}
                              </span>
                            )}
                            {caso.admiIdentification && (
                              <span className="app-item-list-info--baja">
                                {caso.admiIdentification}
                              </span>
                            )}
                            {caso.expZone && (
                              <span className="app-item-list-info--baja">
                                {caso.expZone}
                              </span>
                            )}
                            {/* MATERIA Y SUBMATERIA (quick 261007-jrr), justo tras la zona: las
                                dos dicen de qué y de dónde es el expediente; los chips que siguen
                                dicen cómo está. Si no se sabe ninguna, no se pinta nada. */}
                            {materiaFila && (
                              <span
                                className="app-item-list-info--baja"
                                title={materiaFila.detalle}
                              >
                                {materiaFila.texto}
                              </span>
                            )}
                            {/* LAS INFRACCIONES (Fase 03.23, D-16), junto a la materia que sale de
                                ellas. Solo en un caso que ya es EPAS y con el bloque del servidor:
                                un caso THIN no tiene infracciones que enseñar, y sin bloque la
                                celda diría «Sin infracciones», que es afirmar algo que no llegó.
                                La celda TRADUCE el bloque; no pide nada a CORE ni a la ficha.
                                Debajo, en la MISMA celda, el aviso de D-05 (Fase 03.24): los datos
                                que Resolución no mandó, según el servidor. La guarda de la celda
                                también se abre por él, para que un EPAS sin bloque de infracciones
                                no esconda el aviso. */}
                            {aterrizado &&
                              (caso.infracciones ||
                                (caso.datosResolucionFaltantes?.length ?? 0) >
                                  0) && (
                                <span className="app-item-list-info--baja">
                                  {caso.infracciones && (
                                    <CeldaInfracciones
                                      resumen={caso.infracciones}
                                    />
                                  )}
                                  <AvisoDatosResolucion
                                    faltantes={caso.datosResolucionFaltantes}
                                  />
                                </span>
                              )}
                            {/* EL ESTADO DE LA FILA, Y ES UNO SOLO.
                                🔴 2026-09-21 (reportado por el área: «se queda con dos estados:
                                Recibido y por devolver»). La marca vivía en un chip APARTE, al lado
                                del estado, y dos chips seguidos con la misma forma se leen como dos
                                estados del mismo expediente — que es justo lo que no es: el estado
                                dice dónde está en derecho y la marca dice qué se decidió hacer con
                                él. Mientras esté marcado manda la MARCA, porque es la que dice qué
                                va a pasar; el estado no se pierde, se lee en el `title`.
                                ⟳ 2026-10-21 (Fase 03.24, G-01, UI-SPEC §1.2): la PRECEDENCIA la
                                decide `marcaDeLaFila`, y cada condición la decide el servidor —
                                (1) `porDevolver` ⇒ «Por devolver» en rojo; (2) `reingreso.porVerificar
                                > 0` ⇒ «Reingresado · observaciones por verificar» en ámbar, que NO
                                se lee como «Por devolver» (L-2); (3) si no, el chip de estado de
                                siempre, más la etiqueta baja «Reingresado» si el expediente volvió. */}
                            {marca === "POR_DEVOLVER" ? (
                              <span
                                className="app-item-list-info--media text-error font-semibold"
                                title={
                                  caso.reingreso &&
                                  caso.reingreso.noCumplidas > 0
                                    ? tituloPorDevolverNoCumplidas(
                                        estadoLegible,
                                        caso.reingreso.noCumplidas,
                                      )
                                    : `Estado: ${estadoLegible}. Tiene ${
                                        caso.observacionesTotal
                                      } ${
                                        caso.observacionesTotal === 1
                                          ? "observación anotada"
                                          : "observaciones anotadas"
                                      } en su ficha, así que se devuelve a la DMR.`
                                }
                              >
                                Por devolver
                              </span>
                            ) : marca === "REINGRESO_POR_VERIFICAR" &&
                              caso.reingreso ? (
                              <span
                                className="app-item-list-info--media font-semibold text-[color:var(--app-plazo-fg-fuerte)]"
                                title={tituloChipReingreso(
                                  estadoLegible,
                                  caso.reingreso,
                                )}
                              >
                                {CHIP_REINGRESO_POR_VERIFICAR}
                              </span>
                            ) : (
                              /* El estado con su etiqueta legible y su chip (quick 260929-mbo).
                                 Un caso THIN no tiene estado que pintar: conserva su texto. */
                              caso.eejeStatus ? (
                                <BadgePriority
                                  text={etiquetaEstadoEpas(caso.eejeStatus)}
                                  priority={caso.eejeStatus}
                                  size="md"
                                  capitalize={false}
                                />
                              ) : (
                                <span className="app-item-list-info--media">
                                  {aterrizado
                                    ? "Aterrizado"
                                    : "Sin EPAS aterrizado"}
                                </span>
                              )
                            )}
                            {/* «Reingresado», BAJA y solo detrás del chip de estado (UI-SPEC §1.2):
                                quien remite tiene que saber que el expediente ya fue y volvió, también
                                con todo cumplido o sin observaciones. No es un segundo estado. */}
                            {marca === "ESTADO" && caso.reingreso != null && (
                              <span
                                className="app-item-list-info--baja"
                                title={tituloReingresadoBaja(caso.reingreso)}
                              >
                                {ETIQUETA_REINGRESADO}
                              </span>
                            )}
                            {/* ESTADO DEL TRÁMITE (2026-09-03): la última providencia emitida. Va junto al
                                estado legal porque son dos cosas distintas y las dos importan: aquel dice
                                dónde está el expediente en derecho; este, qué se hizo por última vez. */}
                            {caso.estadoTramite && (
                              <span
                                className="app-item-list-info--media"
                                title="Última providencia emitida"
                              >
                                {caso.estadoTramite}
                              </span>
                            )}
                            {/* 2026-09-08: la multa y la resolución con la que llega el expediente.
                                Es la bandeja donde se decide qué se remite y qué se devuelve, así
                                que las dos cifras van en la FILA, sin abrir nada. Se omiten solas
                                mientras Resolución no las mande. */}
                            <ResolucionOrigen
                              multa={caso.multaImpuesta}
                              numero={caso.resolucionNumero}
                              fecha={caso.resolucionFecha}
                              className="app-item-list-info--baja"
                            />
                          </div>
                          {/* Acciones del expediente, en la CABECERA DE LA FILA. */}
                          {caso.eejeId != null && (
                            <div className="app-item-list-actions">
                              {/* EL OJO DEL EXPEDIENTE (reunión del 2026-09-16, punto 5). Abre la
                                  ficha con «Información del Expediente» y «Documentación», como
                                  hace Resolución en su bandeja. Va el PRIMERO de las acciones: es
                                  lo que más se pulsa —mirar antes de decidir— y lo que las tres
                                  capturas del acta enseñan en esa posición.

                                  Fase 03.24, Plan 20 (UI-SPEC §2.1): pasa a `BotonAccionFila`, con
                                  nombre accesible y tooltip propios. Era un `Boton` sin nombre con
                                  el `title` en un <span>, y un lector lo anunciaba solo como
                                  «botón». `BotonAccionFila` ya corta la propagación del clic; el
                                  `preventDefault` de antes no hacía nada aquí, porque la fila vive
                                  en el cuerpo del <details> y no en su <summary>. */}
                              <BotonAccionFila
                                icono="mirar"
                                etiqueta={
                                  caso.expNumber
                                    ? `Ver expediente ${caso.expNumber}`
                                    : `Ver expediente del EPAS ${caso.eejeId}`
                                }
                                estilos="btn btn-sm btn-square btn-soft btn-primary"
                                posicionTooltip="tooltip-left"
                                onClick={() => handleVerExpediente(caso)}
                              />
                              {/* LA LÍNEA DE TIEMPO (Fase 03.24, Plan 20 — G-04). Lo decidió el
                                  usuario: «el director sí debería poder ver la línea de tiempo»;
                                  también la ve el secretario abogado (UI-SPEC §2.2, a confirmar).
                                  Va justo después del `👁`, en el orden del 03.19, y SOLO aquí:
                                  abrirla desde la ficha la sustituiría y tiraría las observaciones
                                  sin guardar (Pitfall 11). Es de solo lectura: sin callbacks.
                                  Antes del sorteo no hay identificador de asignación y el modal
                                  enseña la nota neutra en vez del aviso. */}
                              <BotonAccionFila
                                icono="lineaDeTiempo"
                                etiqueta={
                                  caso.expNumber
                                    ? `Línea de tiempo de ${caso.expNumber}`
                                    : `Línea de tiempo del EPAS ${caso.eejeId}`
                                }
                                estilos="btn btn-sm btn-square btn-soft btn-primary"
                                posicionTooltip="tooltip-left"
                                onClick={() => handleVerLineaDeTiempo(caso)}
                              />
                              {/* DEVOLVER A LA DMR, POR EXPEDIENTE (último punto de la reunión).
                                  Sustituye al botón que devolvía el LOTE ENTERO: ahora se devuelve
                                  el expediente que tiene el problema y el resto del lote sigue su
                                  curso. El gate es el MISMO que tenía la acción de lote
                                  (`canDevolver`, director o secretario abogado) más el estado del
                                  lote: no se devuelve nada de un lote ya enviado a sorteo.

                                  El modal que abre (`ModalReturnToDmr`) ya existía y ya hacía esto
                                  para las otras dos bandejas — incluida la consulta del estado de
                                  notificación antes de dejar devolver, que el diálogo de lote no
                                  hacía. */}
                              {casoDevolvible(caso) && (
                                <Boton
                                  estilos="btn btn-xs btn-outline btn-error"
                                  texto="Devolver a DMR"
                                  deshabilitado={false}
                                  onClick={(e) => {
                                    e?.preventDefault();
                                    e?.stopPropagation();
                                    handleDevolverExpediente(caso);
                                  }}
                                />
                              )}
                              {/* 🔴 «REMITIR AL SECRETARIO», POR CASO (quick 261029-kl0, 2026-10-29).
                                  Una observación viva sobre un expediente remitido y sin sortear
                                  se lo devuelve al director; él la revisa en la ficha (el `👁`) y,
                                  si rechaza todas, lo remite de nuevo desde aquí. El resto del
                                  lote APROBADO sigue siendo del secretario: la regla la decide
                                  `puedeRemitirCasoSuelto` con lo que manda el servidor. */}
                              {puedeRemitirCasoSuelto({
                                rolName,
                                loteEnRevision: esEnRevision,
                                loteSinSortear: sinSortear,
                                caso,
                              }) && (
                                <Boton
                                  estilos="btn btn-xs btn-outline btn-primary"
                                  texto="Remitir al secretario"
                                  deshabilitado={remitiendoId === caso.eejeId}
                                  onClick={(e) => {
                                    e?.preventDefault();
                                    e?.stopPropagation();
                                    void handleRemitirCaso(caso);
                                  }}
                                />
                              )}
                              {/* «Adjuntar documento» (quick 260917-anx): sustituye al formulario
                                  que se incrustaba debajo de la lista de documentos. Va aquí, con
                                  el resto de acciones del expediente, y no bajo la lista: el acto
                                  es ocasional y no merecía cuatro controles permanentes por fila.

                                  ⚠️ preventDefault/stopPropagation aunque esta fila viva en el
                                  CONTENIDO del Collapse y no en su <summary>: el mismo botón se
                                  repite en «Mis EPAS Asignados», donde sí está dentro del summary,
                                  y una fila anidada en otra card colapsable lo volvería a
                                  necesitar. Cuesta dos líneas y evita el clic que pliega la fila.

                                  🔴 SE ESCONDE hasta que el expediente tenga decisor asignado, y se
                                  vuelve a esconder una vez remitido a Secretaría General (decisión
                                  del usuario, 2026-09-17). Antes se ofrecía siempre y era el
                                  BACKEND quien lo rechazaba con su frase.

                                  El gate NO se deduce de `eejeStatus`: viene calculado en
                                  `puedeAnexar`, por la MISMA condición que lo impone el servidor.
                                  Deducirlo aquí obligaría a APROXIMAR —el estado en que el
                                  expediente se reparte y aquel en que ya tiene decisor son
                                  distintos, y la remisión a SG no tiene estado propio— y una regla
                                  aproximada en la pantalla divergiría de la de verdad.

                                  ⚠️ Esconder va contra «apagar y no esconder» (criterio 7 de la
                                  Fase 03.18, y WR-05 ya lista nueve incumplimientos). Se hace así
                                  porque el usuario lo pidió expresamente tras ver la pantalla; el
                                  coste asumido es que quien mire un expediente sin decisor no verá
                                  que la acción existe ni por qué no puede usarla. */}
                              {caso.puedeAnexar === true && (
                                <Boton
                                  estilos="btn btn-xs btn-ghost text-primary"
                                  texto="Adjuntar documento"
                                  deshabilitado={false}
                                  onClick={(e) => {
                                    e?.preventDefault();
                                    e?.stopPropagation();
                                    handleAnexarDocumento(caso.eejeId as number);
                                  }}
                                />
                              )}
                              {/* "Marcar revisado" (secretario, caso RECIBIDO) → transición VERIFICAR.

                                  🔴 SE ESCONDE MIENTRAS HAYA OBSERVACIONES (2026-09-18, encargo del
                                  área). Marcar revisado es decir «este expediente está bien y puede
                                  ir a sorteo»; una observación viva dice lo contrario sobre el mismo
                                  expediente, y ofrecer las dos cosas a la vez es ofrecer mandar a
                                  sorteo algo que alguien ya decidió devolver. Vuelve a aparecer solo
                                  cuando no queda ninguna —borradas, o rechazadas por el director—,
                                  que es justo lo que `porDevolver` significa. El backend lo impide
                                  además en la transición: esto es conveniencia, no la regla.
                                  ⟳ Fase 03.24 (G-01): marcar revisado es decir «puede ir a sorteo», y
                                  con observaciones de la devolución anterior por verificar quedan
                                  verificaciones pendientes. */}
                              {sortearPorCaso &&
                                !caso.porDevolver &&
                                !((caso.reingreso?.porVerificar ?? 0) > 0) &&
                                caso.eejeStatus === EPAS_ESTADO_POR_REVISAR && (
                                  <Boton
                                    estilos="btn btn-xs btn-outline btn-primary"
                                    texto="Marcar revisado"
                                    deshabilitado={revisandoId === caso.eejeId}
                                    onClick={() =>
                                      handleMarcarRevisado(
                                        caso.eejeId as number,
                                      )
                                    }
                                  />
                                )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 🔴 LA LISTA DE DOCUMENTOS YA NO VA AQUÍ (reunión del 2026-09-16, punto 5):
                          se pidió que fuera «como lo está haciendo Resolución», y en Resolución vive
                          DENTRO del modal del expediente, agrupada por Dirección metropolitana y con
                          el visor al lado. Está en la pestaña «Documentación» del ojo de esta misma
                          fila.

                          No se dejan las dos. Una lista suelta bajo cada fila y otra dentro del modal
                          son dos sitios donde mirar lo mismo, y el de fuera además estiraba la card
                          del lote: con 96 expedientes, la bandeja se volvía una tira de listas de
                          documentos por la que había que bajar para llegar a los botones del lote.

                          `recargaDocs` sobrevive: lo lleva el modal (`recargaSenal`) para releer la
                          lista cuando «Adjuntar documento» termina bien. */}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* La decisión, DESPUÉS del detalle. Gateada por rol (Plan 03) Y por estado: un lote YA enviado
              a sorteo (envlAmasId != null) no vuelve a aprobarse/enviarse ni a devolverse — solo conserva
              "Resultado del sorteo" en el encabezado. */}
          {(puedeRemitir || puedeAprobarEnviar || sortearPorCaso) && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-3">
              {/* 🔴 «Devolver a DMR» YA NO ESTÁ AQUÍ (reunión del 2026-09-16, último punto): la
                  devolución pasó a ser POR EXPEDIENTE y su botón vive en cada FILA, arriba. Se
                  retira el de lote a propósito y no se dejan los dos: con ambos convivían dos
                  alcances para el mismo verbo bajo la misma etiqueta, y pulsar el de abajo habría
                  devuelto los 96 expedientes de un lote cuando el usuario quería devolver uno.

                  El diálogo de lote (`kind: "devolver"`, con su textarea) sigue en el archivo por
                  ahora, sin nadie que lo abra; se retirará cuando se confirme en UAT que ningún
                  flujo pide devolver el lote completo. */}
              {/* Remitir al secretario: SOLO el director y SOLO sobre EN_REVISION ("Sin revisar"). */}
              {puedeRemitir && (
                <Boton
                  estilos="btn btn-sm btn-primary"
                  texto="Remitir al secretario"
                  deshabilitado={false}
                  onClick={() => {
                    setActionMessage(null);
                    setConfirmAction({ lote, kind: "approveDirector" });
                  }}
                />
              )}
              {puedeAprobarEnviar && (
                <Boton
                  estilos="btn btn-sm btn-primary"
                  texto="Aprobar y enviar a sorteo"
                  deshabilitado={false}
                  onClick={() => {
                    setActionMessage(null);
                    setConfirmAction({ lote, kind: "aprobarEnviar" });
                  }}
                />
              )}
              {/* "Sortear seleccionados" se movió a la cabecera del section (selección cross-lote). */}
            </div>
          )}
        </div>
      </div>
    );
  };

  const actionCopy = useMemo(() => {
    if (!confirmAction) return null;
    const { lote, kind } = confirmAction;
    if (kind === "aprobarEnviar") {
      return {
        headerTitle: "Aprobar y enviar a sorteo",
        statusCopy: "Listo para enviar a sorteo",
        descriptionCopy:
          "¿Confirma aprobar el lote y enviarlo al sorteo? Se ligará el lote de entrada con el master del sorteo (envl_amas_id) y sus casos entrarán al reparto.",
        confirmButtonText: "Sí, enviar a sorteo",
        confirmButtonLoadingText: "Enviando…",
        informationData: {
          Lote: lote.envlNumeroLote,
          Expedientes: (lote.casos ?? []).length,
        } as Record<string, string | number>,
      };
    }
    return {
      headerTitle: "Remitir al secretario",
      statusCopy: "Listo para remitir",
      descriptionCopy:
        "¿Confirma remitir el lote al secretario? Se sella el reenvío director→secretario (RECE-08): el lote saldrá de su bandeja y pasará a la del secretario.",
      confirmButtonText: "Sí, remitir",
      confirmButtonLoadingText: "Remitiendo…",
      informationData: {
        Lote: lote.envlNumeroLote,
        Expedientes: (lote.casos ?? []).length,
      } as Record<string, string | number>,
    };
  }, [confirmAction]);

  return (
    <div className="app-data-container">
      <HeaderPage
        headerKicker="Bandeja de ingreso"
        title="Bandeja de Entrada"
        subtitle="Los lotes que ingresan a Ejecución. Revíselos, remítalos o envíelos al sorteo según su rol, y consulte el resultado del sorteo cuando el lote ya fue enviado."
      />

      {/* Entre el header de la página y el panel: acceso a los resultados de todos los sorteos enviados
          (modal con el acta de cada uno). Visible para director y secretario. */}
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <Boton
          estilos="btn btn-sm btn-outline btn-primary"
          texto="Ver resultados de sorteos"
          deshabilitado={false}
          onClick={() => openModal("resultadosSorteos", {})}
        />
      </div>

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
                {tituloBandeja}
              </h2>
              {/* El contador cuenta lo que hay EN LA BANDEJA (o en lo filtrado), no lo que cupo en
                  esta página: con paginado, `lotes.length` decía «10 lote(s)» sobre una bandeja de
                  47. El total lo manda el servidor junto con la página. */}
              <span className="badge badge-primary badge-outline whitespace-nowrap">
                {total} lote(s)
                {hayFiltros && total !== 0 ? " encontrado(s)" : ""}
              </span>
            </div>
            {/* La última sincronización con Resolución (D-13), para los dos roles, y a su lado el
                aviso de datos nuevos (G-13). Los dos se ocultan solos con la integración apagada
                (D-10), y `empty:hidden` evita que el contenedor vacío deje un hueco. La recarga sola
                solo ocurre si es SEGURO; si no, el aviso deja decidir al usuario (T-03.24-70). */}
            <div className="flex flex-wrap items-center gap-2 empty:hidden">
              <LineaSincronizacion estado={estadoSincronizacion} />
              {tieneBandeja && (
                <AvisoDatosNuevos
                  estado={estadoSincronizacion}
                  seguro={
                    !modal.isOpen &&
                    confirmAction == null &&
                    seedAction == null &&
                    seleccionCasos.size === 0 &&
                    !loading
                  }
                  onRecargar={refreshLotes}
                  marcaDeRecarga={lotes}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Sortear seleccionados (secretario): cross-lote — envía a sorteo los casos VERIFICADO
                marcados en CUALQUIER lote APROBADO, en una sola tanda. Vive en la cabecera porque la
                selección abarca varios lotes. */}
            {esSecretario && (
              <Boton
                estilos="btn btn-sm btn-primary"
                icono="expediente"
                texto={`Sortear seleccionados${
                  totalSeleccionadosSorteo > 0
                    ? ` (${totalSeleccionadosSorteo})`
                    : ""
                }`}
                deshabilitado={
                  totalSeleccionadosSorteo === 0 || sortearSubmitting
                }
                onClick={() => void handleSortearSeleccionados()}
              />
            )}
            {/* Datos de prueba: solo el DIRECTOR y solo si SEED_ENABLED está encendido en el backend.
                Se movieron aquí desde la Bandeja de Recepción (que quedó fuera del menú). */}
            {seedEnabled && esDirector && (
              <>
                <Boton
                  estilos="btn btn-sm btn-primary"
                  icono="providencia"
                  texto="Generar datos de prueba"
                  deshabilitado={loading}
                  onClick={() => openSeedDialog("generar")}
                />
                <Boton
                  estilos="btn btn-sm btn-ghost text-error"
                  icono="papelera"
                  texto="Purgar datos de prueba"
                  deshabilitado={loading}
                  onClick={() => openSeedDialog("purgar")}
                />
              </>
            )}
            <Boton
              estilos="btn btn-sm btn-ghost text-primary"
              texto="Actualizar"
              deshabilitado={loading}
              onClick={() => {
                void refreshLotes();
              }}
            />
          </div>
        </div>

        {/* ── BUSCADOR GENERAL + MATERIA + RANGO DE FECHAS (reunión del 2026-09-16, puntos 3 y 7;
            materia: Fase 03.23, D-16) ──────────────────────────────────────────────────────────
            Van en una franja propia bajo la cabecera y no entre los botones de acción: son
            controles de LECTURA (cambian lo que se ve) y mezclarlos con «Remitir» o «Sortear»
            —que cambian el expediente— invita a pulsar uno creyendo pulsar el otro.

            🔴 TODOS FILTRAN EN EL SERVIDOR. No recortan la página que ya está en pantalla:
            vuelven a pedir la bandeja entera con el filtro puesto. Es lo que hace que buscar una
            cédula la encuentre esté en la página que esté.

            UAT 03.23-14: UNA sola fila con `flex-wrap` e `items-end`, y no dos grupos anidados. Con
            el desplegable de materia el grupo de la derecha ya no cabía y se partía: «Limpiar
            filtros» caía debajo de MATERIA y BUSCAR se alineaba con esa segunda fila. Ahora todos
            los controles son hermanos y se alinean por abajo; el buscador crece (`flex-1`) y en
            pantallas estrechas ocupa su propia fila y el resto pasa debajo, sin descolocarse. */}
        {tieneBandeja && (
          <div
            role="search"
            aria-label="Filtros de la bandeja"
            className="flex flex-wrap items-end gap-3 border-b border-base-300 px-6 py-3"
          >
            <label className="flex w-full flex-col xl:w-auto xl:min-w-[12rem] xl:flex-1">
              <span className={ROTULO_FILTRO}>
                Buscar
                {/* La señal de «estoy consultando» vive AQUÍ, junto al cuadro donde el usuario acaba
                    de teclear, y no como un velo sobre la pantalla: es pequeña, no tapa la lista y
                    no hace parpadear nada. `loading` ya está desacoplado del velo (ver
                    `yaCargoAlgunaVez`). Mide lo mismo que el rótulo: la fila no salta. */}
                {loading && yaCargoAlgunaVez && (
                  <span className="loading loading-spinner loading-xs" />
                )}
              </span>
              <input
                type="search"
                className="input input-bordered input-sm w-full"
                placeholder={PLACEHOLDER_BUSCADOR}
                title={PLACEHOLDER_BUSCADOR}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar por número de lote, expediente, materia, código de infracción, nombre o cédula"
              />
            </label>

            {/* MATERIA (quick 261104-jh1). Las opciones son las materias de Sorteo —el valor es el
                id, que es lo que el backend valida y filtra—. Si el catálogo no carga, el
                desplegable lo dice y se apaga; la bandeja carga igual, sin ese filtro. Ancho FIJO:
                si siguiera al texto elegido, la fila se movería cada vez que se cambia de materia. */}
            <label className="flex flex-col">
              <span className={ROTULO_FILTRO}>Materia</span>
              <select
                className="select select-bordered select-sm w-60"
                value={materiaId}
                title={nombreMateriaElegida || undefined}
                onChange={(e) => cambiarMateria(e.target.value)}
                disabled={
                  catalogoMaterias.isLoading || catalogoMaterias.error != null
                }
                aria-label="Filtrar por materia"
              >
                {catalogoMaterias.error != null ? (
                  <option value="">No disponible</option>
                ) : catalogoMaterias.isLoading ? (
                  <option value="">Cargando…</option>
                ) : (
                  <>
                    <option value="">Todas</option>
                    {catalogoMaterias.options.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
            <label className="flex flex-col">
              <span className={ROTULO_FILTRO}>Ingreso desde</span>
              <input
                type="date"
                className="input input-bordered input-sm w-36"
                value={fechaDesde}
                onChange={(e) => cambiarFecha(setFechaDesde, e.target.value)}
                aria-label="Fecha de ingreso desde"
              />
            </label>
            <label className="flex flex-col">
              <span className={ROTULO_FILTRO}>Ingreso hasta</span>
              <input
                type="date"
                className="input input-bordered input-sm w-36"
                value={fechaHasta}
                onChange={(e) => cambiarFecha(setFechaHasta, e.target.value)}
                aria-label="Fecha de ingreso hasta"
              />
            </label>
            {/* «Limpiar» solo existe cuando hay algo que limpiar: un botón permanentemente
                deshabilitado ocupa el mismo sitio y no dice nada. Va en la MISMA fila, al final,
                alineado por abajo con los controles. */}
            {(search !== "" ||
              fechaDesde !== "" ||
              fechaHasta !== "" ||
              materiaId !== "") && (
              <Boton
                estilos="btn btn-sm btn-ghost text-primary"
                texto="Limpiar filtros"
                deshabilitado={loading}
                onClick={() => {
                  setSearch("");
                  setFechaDesde("");
                  setFechaHasta("");
                  setMateriaId("");
                  setPageIndex(0);
                }}
              />
            )}
          </div>
        )}

        <div className="app-data-panel-body px-2 pb-4 pt-2 md:px-4">
          {!tieneBandeja && (
            <EmptyState text="Su rol no tiene una bandeja de entrada asignada." />
          )}

          {/* Rango al revés: se dice en vez de consultar. Con `desde > hasta` el servidor
              devolvería cero lotes y la pantalla mostraría «No hay lotes», que culpa a la bandeja
              de un error que está en el filtro. */}
          {tieneBandeja && rangoInvertido && (
            <Alert
              variant="warning"
              message="El rango de fechas está invertido: la fecha «desde» es posterior a la «hasta». Corrija el rango para ver resultados."
            />
          )}

          {tieneBandeja && error && !loading && (
            <Alert variant="error" message={error} />
          )}

          {/* El vacío se explica distinto según haya filtros o no: «no hay lotes» sobre una
              búsqueda sin resultados haría pensar que la bandeja está vacía.

              ⚠️ Se mantiene VISIBLE durante las recargas (`|| yaCargoAlgunaVez`), no se oculta como
              antes. Con una búsqueda sin resultados, ocultarlo en cada tecla lo hacía aparecer y
              desaparecer — el mismo parpadeo del velo, en pequeño. En la carga INICIAL no se pinta:
              ahí `yaCargoAlgunaVez` es false y todavía no se sabe si la bandeja está vacía. */}
          {tieneBandeja &&
            (!loading || yaCargoAlgunaVez) &&
            !error &&
            !rangoInvertido &&
            lotes.length === 0 && <EmptyState text={textoBandejaVacia} />}

          {tieneBandeja && lotes.length > 0 && (
            /* La lista NO se desmonta mientras se recarga: se queda con los resultados anteriores y
               se ATENÚA. Es lo contrario de lo que hacía el velo a pantalla completa —vaciar y
               volver a llenar en cada tecla—, y es lo que quita el parpadeo: el contenido no se va a
               ninguna parte, solo baja de intensidad mientras llega el siguiente.

               `pointer-events-none` mientras carga, para que no se pulse «Remitir» sobre un lote que
               está a punto de ser sustituido por otro. La transición la pone `app-data-list-busy`
               (180 ms, la cadencia del resto del proyecto). */
            <div
              className={`app-data-list mb-2 app-data-list-busy ${
                loading && yaCargoAlgunaVez ? "is-busy" : ""
              }`}
              aria-busy={loading}
            >
              {lotes.map((lote, i) => (
                <Collapse<EnvioLoteDto>
                  key={lote.envlId}
                  data={lote}
                  // El índice que se pinta es el de la BANDEJA, no el de la página: en la página 2
                  // el primer lote es el 11, y numerarlo «1.» haría que dos lotes distintos
                  // llevaran el mismo número.
                  index={pageIndex * pageSize + i}
                  permittedActions={EMPTY_COLLAPSE_ACTIONS}
                  headerRender={renderLoteHeader}
                  contentRender={renderLoteContent}
                  className="app-collapse-alert app-inbox-alert-item"
                  summaryClassName="app-collapse-alert-summary"
                  contentClassName="app-collapse-alert-content"
                />
              ))}
            </div>
          )}

          {/* Paginación con el componente compartido, ya con el envoltorio de Resolución (punto 1).
              Solo cuando hay más de una página: un paginador de una sola página es ruido. */}
          {tieneBandeja && pages > 1 && (
            <Pagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalPages={pages}
              onPageChange={setPageIndex}
              onPageSizeChange={(nuevo) => {
                setPageSize(nuevo);
                // Cambiar el tamaño mueve la frontera de todas las páginas: quedarse en la 4ª de
                // un reparto que ya no existe es aterrizar en cualquier sitio.
                setPageIndex(0);
              }}
              disabled={loading}
              totalRecords={total}
            />
          )}
        </div>
      </section>

      {/* Confirmación de la acción de lote (aprobar-enviar / remitir). El padre es dueño del error. */}
      {confirmAction && actionCopy && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmAction(null)}
        >
          <ConfirmationDetail
            headerKicker="Bandeja de ingreso"
            headerTitle={actionCopy.headerTitle}
            statusCopy={actionCopy.statusCopy}
            descriptionCopy={actionCopy.descriptionCopy}
            informationData={actionCopy.informationData}
            onConfirm={handleConfirmAction}
            onClose={() => setConfirmAction(null)}
            message={actionMessage ?? undefined}
            confirmButtonText={actionCopy.confirmButtonText}
            confirmButtonLoadingText={actionCopy.confirmButtonLoadingText}
          />
        </DialogoModal>
      )}


      {/* Confirmación de los datos de prueba (mismo ConfirmationDetail). La PURGA borra datos: el texto
          dice exactamente QUÉ se borra y QUÉ no, porque no se puede deshacer. */}
      {seedAction && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setSeedAction(null)}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME · Datos de prueba"
            headerTitle={
              seedAction === "generar"
                ? "Generar datos de prueba"
                : "Purgar datos de prueba"
            }
            statusCopy={
              seedAction === "generar"
                ? "Solo para pruebas"
                : "Acción destructiva"
            }
            descriptionCopy={
              seedAction === "generar"
                ? "Se AÑADIRÁN lotes de prueba nuevos a la Bandeja de Entrada, en estado EN_REVISIÓN, con sus expedientes. NO se borra nada: los lotes y expedientes que ya tenga se conservan tal y como están. Para vaciar la bandeja, use «Purgar datos de prueba»."
                : "Se BORRARÁN todos los lotes y casos de la Bandeja de Entrada (t_envio_lote y su puente) — no solo los de prueba. NO se tocan expedientes, usuarios, roles, permisos ni catálogos. Esta acción no se puede deshacer."
            }
            informationData={
              seedAction === "generar"
                ? {
                    Efecto: "Añade lotes nuevos (no borra los existentes)",
                    "Estado inicial": "EN_REVISIÓN",
                    Origen: "Generador de datos de prueba",
                  }
                : {
                    "Se elimina": "Lotes y casos de la Bandeja de Entrada",
                    "Se conserva":
                      "Expedientes, usuarios, roles, permisos y catálogos",
                    Reversible: "No",
                  }
            }
            onConfirm={confirmarSeed}
            onClose={() => setSeedAction(null)}
            message={seedMessage ?? undefined}
            confirmButtonText={
              seedAction === "generar" ? "Sí, generar" : "Sí, purgar"
            }
            confirmButtonLoadingText={
              seedAction === "generar" ? "Generando…" : "Purgando…"
            }
          />
        </DialogoModal>
      )}

      {/* 🔴 EL VELO, SOLO LA PRIMERA VEZ (2026-09-17: «parpadea toda la pantalla al buscar»).
          `<Loading />` tapa de borde a borde con el logo a `clamp(12rem, 30vw, 26rem)`; con
          `{loading && …}` a secas se montaba y desmontaba en CADA búsqueda y en CADA cambio de
          página, y la pantalla entera se apagaba y encendía a cada tecla.

          Ahora solo aparece mientras no hay NADA que enseñar —la carga inicial—. A partir de ahí la
          recarga se anuncia donde no estorba: el spinner junto al cuadro de búsqueda y la lista
          atenuada. */}
      {loading && !yaCargoAlgunaVez && <Loading />}
    </div>
  );
};

export default BandejaEntradaPage;
