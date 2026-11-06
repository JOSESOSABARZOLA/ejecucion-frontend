/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: «Mis Expedientes» — la bandeja del decisor como TABLA (Fase 03.19, Plan 17)
 * Archivo: MisAsignadosPage.tsx
 * Responsabilidad: Enseñar al funcionario decisor los expedientes que el sorteo le asignó, en una
 *   tabla con filtro por columna, paginado de servidor y total real, y ofrecer sobre cada fila las
 *   TRES acciones de la captura: ver la ficha (`👁`), abrir la línea de tiempo (`⑂`) y el submenú
 *   `⋮` con las doce entradas del catálogo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-10
 * Modificado por: Andrés Miño — 2026-09-17 (quick 260917-anx: el anexo libre pasa a «Adjuntar
 *   documento»).
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 02 — D-05/D-06: las dos columnas de
 *   orden de pago y su celda. La bandeja ABSORBE la pantalla aparte de órdenes de pago: se teclea
 *   el número en la fila y se confirma con `Enter`, sin botón y sin salir de aquí.)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: la columna «Materia» —la materia DEL
 *   EXPEDIENTE, no la submateria del reparto— con filtro de catálogo cuyas opciones salen de
 *   `GET /materias`; entra tras «Creado en», primera tras el pliegue. El array de dependencias del
 *   memo de columnas no cambia.)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: la columna del g35 se parte en DOS, «Materia»
 *   —la materia PADRE— y «Submateria», ambas del expediente y con su filtro de catálogo remoto
 *   por id. El array de dependencias del memo de columnas sigue sin cambiar.)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: solo comentarios. La ficha deja la
 *   pestaña de multas compulsorias; `rolName` sigue viajando porque decide la descarga.)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-16/D-17: «Materia» y
 *   «Submateria» pintan las DEDUCIDAS del código de las infracciones y filtran por CÓDIGO del
 *   diccionario CAT v1.3 (`materiaCod`, `submateriaCod`); entra la columna «Infracciones» con
 *   `CeldaInfracciones` y filtro de texto `infraccion`. El memo de columnas no gana dependencias.)
 * Modificado por: Andrés Miño — 2026-09-22 (Fase 03.19, Plan 17 — D-05, D-09, D-10, D-11, D-12:
 *   la pantalla deja de ser una lista de tarjetas desplegables agrupadas por sublote y pasa a ser
 *   la tabla de `docs/mis-expedientes.jpeg`. Se paga además la deuda de reglas de hooks: la guardia
 *   de usuario baja POR DEBAJO de los hooks, que es lo que permitía que cada hook nuevo sumara un
 *   error de lint.)
 *
 * ── QUÉ SE MUDÓ Y ADÓNDE, PARA QUE NADIE LO BUSQUE AQUÍ ──────────────────────────────────────
 * Esta página pasó de 1.022 a 852 líneas, y de 772 a 556 líneas de CÓDIGO —lo demás es comentario,
 * que creció a propósito— porque casi nada de lo que tenía era suyo:
 *
 *   · El cuerpo del desplegable —datos ricos, documentos, notificaciones e impugnación— vive en la
 *     FICHA (`ModalExpedienteLote`, Plan 10), que el `👁` abre con `bandeja: "decisor"`. Con ella
 *     se mudó la REGLA DE LAS DOS FASES (sin aceptar, resumen mínimo). La serie compulsoria, que
 *     también se mudó entonces, salió de la ficha el 2026-10-14 (quick 261014-kn3) y vive solo en
 *     la página de la obligación de hacer.
 *   · El chip de plazo es `ChipPlazo` (Plan 07). El bloque en línea que había aquí se RETIRA: caía
 *     a `plazoDias` cuando faltaba `plazoVenceAt`, y `plazoDias` es el plazo CONCEDIDO al sortear,
 *     no el que queda — un expediente sorteado hace un mes decía «Aceptación automática en 7 días»
 *     para siempre. Un número falso y creíble es peor que ninguno.
 *   · Las doce entradas del `⋮` son `ACCIONES_DEL_EPAS` + `accionesDeLaFila` (Plan 11). Esta página
 *     sólo entrega los DIEZ disparadores; no decide ninguna habilitación y no redacta ningún motivo.
 *
 * ── 🔴 LO QUE NO SE PUEDE ROMPER AL TOCAR ESTE ARCHIVO ───────────────────────────────────────
 * 1. `columnas` y `buscarBandeja` van MEMOIZADAS con dependencias estables. El efecto de carga de
 *    `Table.tsx` depende de las dos (C7 del Plan 06): una identidad nueva en cada render es un
 *    BUCLE DE PETICIONES contra un endpoint que lleva cédulas y direcciones en cada página.
 *    Por eso la señal de recarga de documentos y el cerrojo de la descarga viven en `useRef` y no
 *    en estado: nadie los pinta, y en las dependencias costarían una petición por cada anexo.
 * 2. NINGÚN VOLCADO A CONSOLA del listado ni de la fila (T-03.19-75). La fila trae cédula,
 *    teléfono, dirección y razón social del administrado. El `console.error` que acompañaba a la
 *    excusa se retira por eso mismo.
 * 3. La frase de que la firma del acta se hace en «Actas de Sorteo» VIVE EN EL SUBTÍTULO. Era lo
 *    único que lo decía, y lo decía la cabecera de sublote que la tabla plana elimina.
 *
 * Modificado por: Andrés Miño — 2026-10-20 (Fase 03.24, Plan 11, D-05): la columna «Infracciones»
 *   pinta, debajo de `CeldaInfracciones`, el aviso `AvisoDatosResolucion` («Datos de Resolución
 *   incompletos») cuando el servidor manda `datosResolucionFaltantes`. Ni la columna ni su filtro
 *   cambian; el aviso informa y no bloquea nada.
 * Modificado por: Andrés Miño — 2026-10-30 (quick 261030-m29: ENLACE PROFUNDO de la campana.
 *   `?eeje=&exp=[&pestana=documentos]` —la ruta que arma `rutaMisExpedientes` en el backend— abre la
 *   ficha de ese expediente y limpia la query. Va en un efecto aparte con su propia petición: ni
 *   `columnas` ni `buscarBandeja` ganan dependencias.)
 * Modificado por: Andrés Miño — 2026-11-04 (revisión 261030-m29, IN-07: la respuesta del enlace solo
 *   abre la ficha y limpia la query si ese enlace sigue vigente y la página montada)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29, Task 4b: junto al número de expediente,
 *   «N nuevos» —documentos que el usuario no ha abierto—. Tras cada carga de página `buscarBandeja`
 *   pide `DocumentosLecturaService.contar` con los ids de ESA página —sin otra petición a la
 *   bandeja— y el mapa llega a la celda por un CONTEXTO, no por las dependencias de `columnas`: su
 *   identidad no cambia y no hay bucle. Si el conteo falla la tabla se ve igual. Se recalcula con
 *   cada recarga de la bandeja, también la del cierre de la ficha.)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: «Materia» y «Submateria» son las de
 *   Sorteo y filtran por id (`materiaId`, `submateriaId`); la celda añade «Sin materia» con
 *   `etiquetaConSinMateria`. El memo de columnas no gana dependencias.)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import DialogoModal from "../components/common/DialogoModal";
import type { ColumnDef } from "@tanstack/react-table";
import { useUser } from "../context/UserContext";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";
import { SorteoService, type MiEpasAsignado } from "../services/SorteoService";
import EpasService from "../services/EpasService";
import { DocumentosLecturaService } from "../services/DocumentosLecturaService";
import Table, { type PaginationAndFilters } from "../components/tabla/Table";
// 🔴 Import POR EFECTO SECUNDARIO: `ITableFilter.ts` lleva el `declare module` que añade
// `filterType`, `catalogKey` y `pinnedRight` al `ColumnMeta` de TanStack. Sin esta línea las
// columnas de abajo no tiparían su `meta` y la fila de filtros caería entera a «texto».
import "../interfaces/ITableFilter";
import MenuAccionesCaso from "../components/common/MenuAccionesCaso";
import BotonAccionFila from "../components/common/BotonAccionFila";
import ChipPlazo from "../components/common/ChipPlazo";
import BadgePriority from "../components/common/BadgePriority";
import ObligacionesVivas from "../components/common/ObligacionesVivas";
import CeldaOrden from "../components/ordenes-pago/CeldaOrden";
import CeldaInfracciones from "../components/infracciones/CeldaInfracciones";
import AvisoDatosResolucion from "../components/infracciones/AvisoDatosResolucion";
import HeaderPage from "../components/common/HeaderPage";
import Alert, { type AlertVariant } from "../components/common/Alert";
import Boton from "../components/common/Boton";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import {
  accionesDeLaFila,
  type DisparadoresDelEpas,
} from "../config/accionesDelEpas";
import { etiquetaEstadoEpas } from "../config/estadosEpas";
import type { UserActions } from "../interfaces/IUser";
import type { DatosLineaDeTiempo } from "../interfaces/IModal";
import { MODAL_KEY as EXCUSARME } from "../components/modals/ModalExcusa";
import { MODAL_KEY as ANEXAR_DOCUMENTO } from "../components/modals/ModalAnexarDocumento";
import {
  MODAL_KEY as EXPEDIENTE_LOTE,
  type TabFicha,
} from "../components/modals/ModalExpedienteLote";
import RegistrarAcogimientoModal from "../components/trabajo-comunitario/RegistrarAcogimientoModal";
import SolicitarProrrogaModal from "../components/trabajo-comunitario/SolicitarProrrogaModal";
import RegistrarCumplimientoModal from "../components/trabajo-comunitario/RegistrarCumplimientoModal";
import CoactivaModal from "../components/coactiva/CoactivaModal";
import RegistrarPagoModal from "../components/pago/RegistrarPagoModal";
import { DatetimeUtil } from "../utils/datetime.util";
import { etiquetaConSinMateria } from "../utils/materia.util";

/**
 * Los estilos de la tabla. Es lo que produce el scroll en los DOS ejes de la captura, y es lo que
 * hace segura la columna de acciones fijada: se puede mandar contenido más allá del pliegue sin que
 * las tres acciones se vayan con él (UI-SPEC §1.1 y §1.6).
 */
const ESTILOS_TABLA = {
  containerStyle: "relative overflow-x-auto min-h-96",
  tableStyle: "table mt-0 w-full text-sm md:text-base",
};

/**
 * Las acciones que la TABLA resuelve por su cuenta: ninguna, y queda escrito por qué.
 *
 * Esta bandeja monta `hideActionsColumn` y define su propia columna (camino B de RESEARCH §8.3).
 * `RowActions` sólo sabe abrir modales y dos de las doce entradas NAVEGAN; y el `⋮` se dibuja en un
 * portal `position: fixed`, imprescindible dentro de un contenedor con scroll en los dos ejes: un
 * desplegable en flujo se recortaría contra el borde del contenedor.
 *
 * Las dos son CONSTANTES DE MÓDULO y no literales en el render: `tableOptions` no entra en el
 * efecto de carga, pero `resolveActionsPerRow` se llama por fila y un array nuevo por render sería
 * trabajo tirado en cada pulsación de un filtro.
 */
const SIN_ACCIONES_DE_TABLA: UserActions[] = [];
const SIN_RESOLVER_DE_FILA = (): UserActions[] => [];

/** Los dos vacíos de la bandeja, con el copy literal de UI-SPEC §5.1. */
const VACIO_SIN_FILTROS = {
  texto: "No tiene expedientes asignados",
  pista: "Cuando el sorteo le asigne un EPAS aparecerá aquí.",
};

const VACIO_CON_FILTROS = {
  texto: "Ningún expediente coincide con los filtros",
  pista:
    "Quite algún filtro para ver más resultados. Hay filtros aplicados en columnas que pueden estar fuera de pantalla.",
};

/**
 * El ERROR DE CARGA (UI-SPEC §1.7 y §5.1), que hasta hoy NO EXISTÍA en ninguna pantalla de tabla.
 *
 * 🔴 QUÉ PASABA SIN ESTO, y por qué es un defecto y no una carencia estética: cuando `findRecordsFn`
 * RECHAZA, el `.then()` de `Table.tsx` no corre, el `.finally()` apaga el indicador y la tabla se
 * queda enseñando su estado vacío — es decir, **un fallo de red se lee como «no tiene expedientes
 * asignados»**. El decisor concluye que no le han asignado nada y se va.
 *
 * El patrón es el que el Plan 09 dejó escrito en `vacioHonesto` (`ModalTimeline.tsx`): dos
 * afirmaciones distintas —«no hay nada» y «no me respondieron»— nunca se dicen con la misma frase,
 * el botón de «Reintentar» sólo aparece para la segunda, y el vacío sólo se afirma cuando nadie
 * falló. Aquí se aplica sin desmontar la tabla: se queda montada y OCULTA, para que reintentar
 * vuelva a pedir la misma página con los mismos filtros en vez de empezar de cero.
 */
const ERROR_DE_CARGA_ENCABEZADO = "No se pudieron cargar sus expedientes.";
const ERROR_DE_CARGA_PISTA =
  "Vuelva a intentarlo. Si el problema continúa, comuníquelo al administrador del sistema.";

/** Cómo se nombra una fila en las etiquetas accesibles. Nunca queda en blanco. */
const nombreDeLaFila = (row: MiEpasAsignado): string =>
  row.expNumber ?? `EPAS ${row.eejeId ?? "—"}`;

/**
 * Documentos sin leer por EPAS de la página visible (quick 261030-m29): eejeId → número.
 *
 * 🔴 VIAJA POR CONTEXTO A PROPÓSITO. Si la celda lo leyera por cierre, el mapa entraría en las
 * dependencias de `columnas`, y una identidad nueva de `columnas` vuelve a disparar la carga de la
 * tabla: cada conteo pediría la bandeja otra vez, y cada bandeja otro conteo. Por contexto, la celda
 * se repinta sola y `columnas` no se entera. No se exporta (`react-refresh/only-export-components`).
 */
const NoLeidosContext = createContext<Readonly<Record<number, number>>>({});

/**
 * La celda del EXPEDIENTE: el número y, si el usuario tiene documentos sin abrir en ese EPAS,
 * «N nuevos». El texto ya se lee solo; el `title` añade de qué son.
 */
const CeldaExpediente = ({ row }: { row: MiEpasAsignado }) => {
  const noLeidos = useContext(NoLeidosContext);
  const n = row.eejeId != null ? (noLeidos[row.eejeId] ?? 0) : 0;
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono whitespace-nowrap">
        {row.expNumber ?? "—"}
      </span>
      {n > 0 && (
        <span
          className="badge badge-accent badge-sm whitespace-nowrap"
          title="Documentos del expediente que todavía no ha abierto"
        >
          {n} {n === 1 ? "nuevo" : "nuevos"}
        </span>
      )}
    </span>
  );
};

/**
 * La celda de la columna ACCIONES: los tres controles de `docs/acciones-expedientes.png`.
 *
 * Está fuera del componente de página —y no es un `cell` en línea— para que el cuerpo del `useMemo`
 * de las columnas se pueda leer de un vistazo. No se exporta: exportar algo que no es un componente
 * desde un archivo de componente dispara `react-refresh/only-export-components`.
 */
const CeldaAcciones = ({
  row,
  rolName,
  disparadores,
  onVerFicha,
  onLineaDeTiempo,
}: {
  row: MiEpasAsignado;
  rolName: string;
  disparadores: DisparadoresDelEpas;
  onVerFicha: (row: MiEpasAsignado) => void;
  onLineaDeTiempo: (row: MiEpasAsignado) => void;
}) => {
  const nombre = nombreDeLaFila(row);

  return (
    <div className="app-data-table-actions flex items-center gap-2">
      {/*
        🔴 `tooltip-left` NO ES ESTÉTICA: es el gap 4 del UAT de la 03.22 («no se sobrepone a la
        columna y se muestra detrás»). Con el valor por defecto del componente la burbuja sale HACIA
        ABAJO, a 0,5rem del borde del botón —y el botón sólo tiene 0,4724rem de relleno por debajo—,
        así que la burbuja entera cae FUERA de la banda de su fila: en la de la fila siguiente, cuya
        celda fija empata en capa y gana por orden del documento; y en la última fila visible, fuera
        del recuadro de la tabla, que la RECORTA. El recorte no lo arregla ninguna capa. Saliendo de
        lado, la burbuja queda centrada en el botón y se queda dentro de la banda de su propia fila.
      */}
      <BotonAccionFila
        icono="mirar"
        etiqueta={`Ver expediente ${nombre}`}
        posicionTooltip="tooltip-left"
        onClick={() => onVerFicha(row)}
      />
      {/*
        ⚠️ DESVIACIÓN DECLARADA DE UI-SPEC §2.1, que dice «`⑂` deshabilitado nunca».
        La frase se escribió pensando en `caseId`, y para ESE caso se cumple: sin identidad en
        Asignaciones el modal abre igual y degrada por dentro diciéndolo (§3.4). Pero sin `eejeId`
        no hay NADA que pedir —ni la bitácora interna— y abrir un modal que sólo puede enseñar su
        propio fallo no es degradar, es fingir. Se apaga con su motivo, que es la doctrina de la
        fase. El tooltip sale a la IZQUIERDA porque este botón queda pegado al borde fijado.
      */}
      <BotonAccionFila
        icono="lineaDeTiempo"
        etiqueta={`Línea de tiempo de ${nombre}`}
        deshabilitado={row.eejeId == null}
        motivo="Este caso todavía no tiene un expediente resuelto: no hay traza que mostrar."
        posicionTooltip="tooltip-left"
        onClick={() => onLineaDeTiempo(row)}
      />
      <MenuAccionesCaso
        etiqueta={`Acciones del EPAS ${nombre}`}
        acciones={accionesDeLaFila(row, rolName, disparadores)}
      />
    </div>
  );
};

const MisAsignadosPage = () => {
  const { user } = useUser();
  const { openModal } = useModal();
  const { addToast } = useToast();

  /**
   * 🔴 EL ROL SE LEE CON CAÍDA, Y LA GUARDIA DE USUARIO ESTÁ ABAJO (deuda saldada aquí).
   *
   * Hasta hoy este archivo empezaba con `if (!user) return null;` ENCIMA de los hooks, y por eso
   * `react-hooks/rules-of-hooks` denunciaba uno a uno los trece que venían detrás: cada hook nuevo
   * sumaba un error de lint, y la reconversión a tabla añade hooks sí o sí. La guardia se ha movido
   * por debajo de todos ellos (ver el final de este bloque) y el rol se lee con `?? ""`, que es lo
   * que el motor ya interpreta como «rol que no interviene» y niega con su motivo.
   */
  const rolName = user?.rolName ?? "";

  /** Caso cuyo modal de DESENLACE está abierto, y cuál. */
  const [desenlace, setDesenlace] = useState<{
    caso: MiEpasAsignado;
    tipo: "pago" | "trabajoComunitario" | "acogimiento" | "prorroga" | "coactiva";
  } | null>(null);

  // Confirmación de la ACEPTACIÓN EXPLÍCITA de un caso (RECE-06): sella epsor_aceptado_at/_by con el
  // actor derivado del JWT (cuerpo vacío). El padre es dueño del error (no se finge aceptación).
  const [confirmAceptar, setConfirmAceptar] = useState<MiEpasAsignado | null>(
    null,
  );
  const [aceptarMessage, setAceptarMessage] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  /** Detalle del último fallo de carga. `null` = la última lectura respondió. Ver el bloque de copy. */
  const [falloDeCarga, setFalloDeCarga] = useState<string | null>(null);

  /**
   * Tamaño de página que el SERVIDOR aplicó cuando no es el que se pidió. `null` = coinciden.
   *
   * 🔴 SE LEE DEL SOBRE, NUNCA SE DA POR BUENO EL PEDIDO. `acotarLimit` del backend tapa la página a
   * 100 y devuelve el aplicado. Hoy el paginador no ofrece más de 50, así que no puede pasar; pero
   * si pasara, la tabla contaría las páginas con el tamaño que pidió y habría filas que no se
   * alcanzan por ninguna página — desaparecidas, sin aviso. Decirlo cuesta una línea.
   */
  const [limiteAcotado, setLimiteAcotado] = useState<number | null>(null);

  /**
   * Señal de recarga de la lista de documentos, POR EPAS (quick 260917-anx). Sube uno cada vez que
   * el modal de anexos termina bien, y viaja DENTRO de los datos del caso hasta la ficha.
   *
   * 🔴 EN UNA `ref` Y NO EN ESTADO. Nadie la pinta —su único consumidor es la ficha, que la recibe
   * como dato al abrirse—, y en estado entraría en las dependencias de los manejadores de la fila,
   * de ahí en las de `columnas`, y de ahí en el efecto de carga de la tabla: una petición de la
   * bandeja entera por cada documento anexado.
   */
  const recargaDocsRef = useRef<Record<number, number>>({});

  /** Cerrojo de la descarga: impide dos ZIP a la vez. En `ref` por el mismo motivo que el anterior. */
  const descargaEnVueloRef = useRef(false);

  /**
   * La función con la que la tabla vuelve a pedir SIN REMONTARSE. Remontarla perdería los filtros
   * puestos y la página en la que se estaba, que es justo lo que no se quiere tras aceptar un caso
   * o tras reintentar una carga fallida.
   */
  const recargarRef = useRef<(() => Promise<void>) | null>(null);

  const recibirRecarga = useCallback((refetch: () => Promise<void>) => {
    recargarRef.current = refetch;
  }, []);

  const recargarBandeja = useCallback(async () => {
    await recargarRef.current?.();
  }, []);

  /**
   * Documentos sin leer de la página visible (quick 261030-m29). Lo pinta `CeldaExpediente` a
   * través de `NoLeidosContext` —ver allí por qué no por cierre—.
   */
  const [noLeidosPorEpas, setNoLeidosPorEpas] = useState<
    Record<number, number>
  >({});
  /**
   * Turno del último conteo pedido, en una `ref` (nadie lo pinta y no puede entrar en las
   * dependencias de `buscarBandeja`). Una respuesta de una página ya abandonada no pisa la actual.
   */
  const turnoConteoRef = useRef(0);

  /**
   * La lectura de la bandeja. 🔴 MEMOIZADA CON DEPENDENCIAS VACÍAS: entra en el efecto de carga de
   * la tabla y una identidad nueva por render sería un bucle de peticiones.
   *
   * 🔴 NO PROPAGA EL FALLO: lo convierte en bandera y devuelve una página vacía. Es lo que permite
   * distinguir «no hay expedientes» de «no me respondieron» sin tocar `Table.tsx`, que hoy no tiene
   * estado de error y cuyo `.then()` simplemente no corre.
   */
  const buscarBandeja = useCallback(
    async (
      params: PaginationAndFilters,
    ): Promise<{ data: MiEpasAsignado[]; total: number }> => {
      try {
        const sobre = await SorteoService.misAsignados({
          pageIndex: params.pageIndex,
          pageSize: params.pageSize,
          filterParams: params.filterParams,
        });

        setFalloDeCarga(null);
        setLimiteAcotado(
          sobre.limit < params.pageSize ? sobre.limit : null,
        );

        // El contador de documentos sin leer, en segundo plano y con los ids de ESTA página: ni
        // retrasa la tabla ni pide la bandeja otra vez. Si falla, la tabla se ve igual sin números.
        const turno = ++turnoConteoRef.current;
        const ids = sobre.data
          .map((fila) => fila.eejeId)
          .filter((id): id is number => typeof id === "number");
        DocumentosLecturaService.contar(ids)
          .then((mapa) => {
            if (turno === turnoConteoRef.current) setNoLeidosPorEpas(mapa);
          })
          .catch(() => {
            if (turno === turnoConteoRef.current) setNoLeidosPorEpas({});
          });

        return { data: sobre.data, total: sobre.total };
      } catch (err) {
        // El detalle del servidor se guarda para enseñarlo COMO DETALLE, debajo del encabezado
        // del UI-SPEC. No se manda a la consola: por ahí pasa la fila entera (T-03.19-75).
        setFalloDeCarga(
          mensajeParaUsuario(err, "El servidor no dio un motivo."),
        );
        return { data: [], total: 0 };
      }
    },
    [],
  );

  // ── LOS DIEZ DISPARADORES DEL SUBMENÚ ───────────────────────────────────────────────────────
  // Todos memoizados con dependencias estables, por lo dicho arriba. `openModal` lo es (viene de un
  // `useCallback` sin dependencias en `ModalProvider`) y `rolName` es una cadena.

  const abrirFichaEn = useCallback(
    (row: MiEpasAsignado, pestanaInicial?: TabFicha) => {
      openModal(
        EXPEDIENTE_LOTE,
        {
          ...row,
          // 🔴 LAS CUATRO COSAS VAN DENTRO DE `caseData`. `ModalContainer` sólo reparte tres props
          // (`caseData`, `onClose`, `refetchFn`): cualquier otra cosa entregada como prop suelta se
          // perdería por el camino sin que nada fallara. `bandeja` es lo que pone la ficha en modo
          // lectura y le añade las dos pestañas absorbidas; `rolName` es lo que deja que el MOTOR
          // —no la ficha— decida la descarga del expediente.
          bandeja: "decisor",
          rolName,
          recargaSenal: recargaDocsRef.current[row.eejeId ?? -1] ?? 0,
          pestanaInicial,
        },
        { refetchFn: recargarBandeja },
      );
    },
    [openModal, rolName, recargarBandeja],
  );

  const verFicha = useCallback(
    (row: MiEpasAsignado) => abrirFichaEn(row),
    [abrirFichaEn],
  );

  const verImpugnacion = useCallback(
    (row: MiEpasAsignado) => abrirFichaEn(row, "impugnacion"),
    [abrirFichaEn],
  );

  // ── ENLACE PROFUNDO DESDE LA CAMPANA (quick 261030-m29, D-CANAL) ───────────────────────────
  // La alerta lleva a `/home/mis-asignados?eeje=<id>&exp=<número>[&pestana=documentos]`. Se busca la
  // fila con UNA petición propia filtrada por número (página 0 de 20: el filtro es por texto y puede
  // traer números parecidos), se abre su ficha y se limpia la query para que recargar la página no
  // la vuelva a abrir.
  //
  // 🔴 UNA VEZ POR COMBINACIÓN: la clave atendida vive en una `ref`, así que un re-render —o el doble
  // efecto del modo estricto— no repite la petición ni abre la ficha dos veces. Cuando la query se
  // limpia la clave se olvida, y pulsar otra vez la MISMA alerta vuelve a abrirla.
  // 🔴 NO ES `buscarBandeja`: esa marca el fallo de carga de la TABLA, y un aviso que no encuentra su
  // expediente no es un fallo de la bandeja.
  // 🔴 SOLO SI SIGUE VIGENTE (revisión 261030-m29, IN-07): si mientras la petición iba el usuario
  // pulsó otra alerta o salió de la página, la respuesta vieja ni abre su ficha ni limpia la query
  // (borraría la del enlace siguiente o la de la página actual).
  const [parametrosUrl, setParametrosUrl] = useSearchParams();
  const enlaceAtendidoRef = useRef<string | null>(null);
  const montadaRef = useRef(true);
  useEffect(() => {
    montadaRef.current = true;
    return () => {
      montadaRef.current = false;
    };
  }, []);
  const eejeEnlace = parametrosUrl.get("eeje");
  const expEnlace = parametrosUrl.get("exp");
  const pestanaEnlace = parametrosUrl.get("pestana");

  useEffect(() => {
    if (eejeEnlace == null) {
      enlaceAtendidoRef.current = null;
      return;
    }

    const clave = `${eejeEnlace}|${expEnlace ?? ""}|${pestanaEnlace ?? ""}`;
    if (enlaceAtendidoRef.current === clave) return;
    enlaceAtendidoRef.current = clave;

    const limpiarEnlace = () => setParametrosUrl({}, { replace: true });
    const vigente = () =>
      montadaRef.current && enlaceAtendidoRef.current === clave;
    const eejeId = Number(eejeEnlace);
    if (!Number.isSafeInteger(eejeId) || eejeId <= 0) {
      limpiarEnlace();
      return;
    }
    const exp = expEnlace?.trim() || null;

    void (async () => {
      try {
        const sobre = await SorteoService.misAsignados({
          pageIndex: 0,
          pageSize: 20,
          filterParams: exp ? { expNumber: exp } : {},
        });
        if (!vigente()) return;
        const fila = sobre.data.find((f) => f.eejeId === eejeId);
        if (fila) {
          abrirFichaEn(
            fila,
            pestanaEnlace === "documentos" ? "documentos" : undefined,
          );
        } else {
          addToast(
            "warning",
            exp
              ? `El expediente ${exp} ya no está en su bandeja.`
              : "El expediente ya no está en su bandeja.",
          );
        }
      } catch (err) {
        if (!vigente()) return;
        addToast(
          "error",
          mensajeParaUsuario(err, "No se pudo abrir el expediente del aviso."),
        );
      } finally {
        if (vigente()) {
          limpiarEnlace();
        }
      }
    })();
  }, [
    eejeEnlace,
    expEnlace,
    pestanaEnlace,
    abrirFichaEn,
    addToast,
    setParametrosUrl,
  ]);

  /**
   * El `⑂`. 🔴 `caseId` VIAJA, y es la mitad del valor de esta acción: es la identidad del caso en
   * Asignaciones y sin ella el modal enseña su aviso de «media traza» incluso sobre los expedientes
   * que SÍ la tienen. `MiEpasAsignado` lo trae desde el Plan 03; tirarlo aquí sería tirar la traza
   * externa entera por no escribir una línea.
   *
   * ⚠️ Medido sobre la base el 2026-09-21: sólo 9 de 72 reflejos tienen `case_id`. En los otros 63
   * el aviso es el resultado CORRECTO, no un fallo de este cableado.
   */
  const verLineaDeTiempo = useCallback(
    (row: MiEpasAsignado) => {
      if (row.eejeId == null) return;
      const datos: DatosLineaDeTiempo = {
        eejeId: row.eejeId,
        caseId: row.caseId,
        expNumber: row.expNumber,
      };
      openModal("timeLine", datos);
    },
    [openModal],
  );

  const pedirAceptacion = useCallback((row: MiEpasAsignado) => {
    setAceptarMessage(null);
    setConfirmAceptar(row);
  }, []);

  const abrirExcusa = useCallback(
    (row: MiEpasAsignado) => {
      // El `onError` que había aquí volcaba el fallo a la consola con `console.error`. Se retira:
      // por ese canal viaja la excusa —y con ella la fila— y la consola del navegador no es un
      // sitio donde puedan estar los datos del administrado (T-03.19-75). El modal ya enseña el
      // fallo en pantalla, que es donde tiene que verse.
      openModal(EXCUSARME, row, { refetchFn: recargarBandeja });
    },
    [openModal, recargarBandeja],
  );

  /**
   * «Adjuntar documento»: abre el modal del anexo libre y, al terminar bien, sube la señal de ESE
   * EPAS. No se recarga la bandeja entera —sería pedir de nuevo todos los casos por un documento de
   * uno solo—. La ventana en que se puede anexar la hace cumplir el BACKEND.
   */
  const adjuntarDocumento = useCallback(
    (row: MiEpasAsignado) => {
      const eejeId = row.eejeId;
      // La entrada ya va apagada con su motivo cuando falta el expediente; esto es el cinturón.
      if (eejeId == null) return;
      openModal(
        ANEXAR_DOCUMENTO,
        { eejeId, expNumber: row.expNumber },
        {
          onSuccess: () => {
            recargaDocsRef.current = {
              ...recargaDocsRef.current,
              [eejeId]: (recargaDocsRef.current[eejeId] ?? 0) + 1,
            };
          },
        },
      );
    },
    [openModal],
  );

  /**
   * Baja el expediente COMPLETO en UN PDF FOLIADO para certificarlo FUERA del módulo. No mueve el
   * estado del EPAS ni refresca la bandeja: no cambia nada del expediente.
   *
   * El backend puede negarse con una razón —el caso típico es un sorteo aún sin firma, que no tiene
   * acta definitiva—. Esa razón se muestra TAL CUAL: la regla vive en un solo sitio, el servidor.
   */
  const descargarExpediente = useCallback(
    async (row: MiEpasAsignado) => {
      if (descargaEnVueloRef.current) return;
      const eejeId = row.eejeId;
      if (eejeId == null) return;

      descargaEnVueloRef.current = true;
      try {
        const { blob, nombreArchivo } =
          await EpasService.descargarExpediente(eejeId);
        // Descarga por enlace efímero: se suelta la URL en cuanto el navegador la toma, o cada
        // expediente bajado deja su PDF retenido en memoria.
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
        addToast("success", `Expediente descargado como ${nombreArchivo}.`);
      } catch (error) {
        addToast(
          "warning",
          mensajeParaUsuario(error, "No se pudo descargar el expediente."),
        );
      } finally {
        descargaEnVueloRef.current = false;
      }
    },
    [addToast],
  );

  /**
   * 🔴 EL `Record` ES TOTAL, y el compilador lo cobra. Una entrada nueva que ACTÚE obliga a esta
   * pantalla a declarar qué hace: sin eso, el modo de fallo sería una opción que se pinta, se puede
   * pulsar y no hace nada — el peor de todos, porque no se distingue de un fallo del servidor.
   *
   * Las dos entradas que NAVEGAN —«Generar documento» y «Obligación de hacer»— no están aquí: el
   * catálogo las dibuja como enlaces de verdad con su ruta, que es lo que permite abrirlas en otra
   * pestaña sin perder la bandeja.
   */
  const disparadores = useMemo<DisparadoresDelEpas>(
    () => ({
      aceptarCaso: pedirAceptacion,
      excusarme: abrirExcusa,
      adjuntarDocumento,
      pago: (row) => setDesenlace({ caso: row, tipo: "pago" }),
      acogimiento: (row) => setDesenlace({ caso: row, tipo: "acogimiento" }),
      trabajoComunitario: (row) =>
        setDesenlace({ caso: row, tipo: "trabajoComunitario" }),
      prorroga: (row) => setDesenlace({ caso: row, tipo: "prorroga" }),
      impugnacion: verImpugnacion,
      descargarExpediente: (row) => void descargarExpediente(row),
      coactiva: (row) => setDesenlace({ caso: row, tipo: "coactiva" }),
    }),
    [
      pedirAceptacion,
      abrirExcusa,
      adjuntarDocumento,
      verImpugnacion,
      descargarExpediente,
    ],
  );

  /**
   * LAS COLUMNAS (UI-SPEC §1.2). El CONJUNTO de las doce primeras y el pliegue los fija la captura;
   * el ORDEN, no: lo cambió el usuario el 2026-09-22 (UAT de la fase, prueba 2). La captura tenía
   * `EXPEDIENTE` en la 11.ª posición y él la quiso primera —«el numero del expediente debería ser la
   * segunda fila(luego del nro)»—, así que abre el array; el resto conserva su orden relativo.
   * `OBLIGACIONES` y `SUBLOTE` van tras el pliegue y `ACCIONES` va fijada a la derecha. `MATERIA`
   * (quick 261006-g35) es la primera tras el pliegue, entre «Creado en» y «Obligaciones»: su porqué
   * —fuente, catálogo remoto y posición— está en el comentario de su entrada.
   *
   * 🔴 `NRO.` NO SE DECLARA AQUÍ. La antepone `Table.tsx` en su `numberColumn` (líneas 433-446),
   * que además calcula el índice global con el desplazamiento de página. Declararla en esta página
   * pintaría dos cabeceras iguales: «segunda columna» en el encargo del usuario es la PRIMERA
   * entrada de este array.
   *
   * 🔴 SIN `size` POR COLUMNA salvo la de acciones. `daisyUI .table` usa `table-layout: auto`;
   * imponer anchos produce columnas vacías anchas y direcciones recortadas. El único control de
   * ancho es el truncado de `DIRECCIÓN`, que conserva el valor entero en su `title`.
   *
   * 🔴 LOS `id` SON LOS NOMBRES DE PARÁMETRO DEL BACKEND. `serializeColumnFilters` emite el `id` de
   * la columna como clave del filtro, y `FilterMisAsignadosDto` es una allowlist bajo
   * `forbidNonWhitelisted`: `admiIdentification` se llama así —y no `cedula`, que es como viaja el
   * valor en la fila— porque así lo declara el DTO. Una letra distinta es un 400 sin explicación.
   *
   * ── LAS DOS COLUMNAS DE ORDEN DE PAGO: POR QUÉ TRAS EL PLIEGUE Y SIN FILTRO (Fase 03.22, D-06) ─
   * Entran inmediatamente DESPUÉS de `obligaciones` y ANTES de `amasId`, y esa posición no es gusto:
   *   · EL PLIEGUE NO SE MUEVE. Insertar ahí no desplaza ni una de las columnas 1-12, que son las
   *     que caben antes del pliegue, así que el razonamiento que dejó escrito la Fase 03.19 —y con
   *     él la decisión del área usuaria sobre qué se lee sin desplazarse— sobrevive LITERAL.
   *   · `OBLIGACIONES` ya lleva la multa impuesta: el número de la orden que la cobra, a su derecha,
   *     forma un bloque de dinero que se lee de izquierda a derecha.
   *   · Hoy 1 DE 157 expedientes tiene orden de multa vigente. Darle sitio pre-pliegue a dos
   *     columnas que salen casi vacías, desplazando los datos de identidad por los que el decisor
   *     busca a diario, sería el peor canje posible.
   * ⚠️ El coste, dicho en voz alta: son las únicas columnas ACCIONABLES de la tabla y quedan tras el
   * pliegue. Se acepta porque `ACCIONES` va fijada y no se pierde de vista al desplazarse; si el
   * área usuaria las quiere pre-pliegue, es mover dos posiciones de este array.
   *
   * 🔴 LAS DOS VAN SIN FILTRO, y por eso NO se declaran en `FilterMisAsignadosDto` ni en
   * `FILTRO_A_SQL`. Filtrar por número de orden exigiría una subconsulta escalar que dejaría VACUA
   * —sin ponerse roja— la prueba de paridad del `WHERE` del backend, y una prueba que se vuelve
   * vacua es peor que una que falla. El precedente exacto de columna sin filtro en este mismo array
   * es `plazo`, y el de «no lo ofrezco porque el backend no lo declara» es `amasId`. Con el filtro
   * apagado el `id` es libre y desaparece la clase entera del 400 que no menciona su causa.
   *
   * ⚠️ PÉRDIDA FUNCIONAL HEREDADA, anotada y no reparada aquí: con la pantalla que se retira se van
   * el buscador por número de orden, el filtro por estado de la orden y la búsqueda por administrado
   * FUNDIDO. La búsqueda por expediente NO se pierde: `expNumber` ya está en el DTO y en el mapa.
   *
   * ── `EXPEDIENTE` VA FIJADA A LA IZQUIERDA (Fase 03.22, Plan 07 — gap 2 del UAT) ──────────────
   * El interruptor de fijación a la izquierda que declara su `meta` la deja quieta al desplazarse
   * en horizontal, igual que `ACCIONES` lo está a la derecha. Con 17 columnas, moverse a la derecha
   * para teclear una orden de pago hacía perder de vista de qué expediente era la fila.
   * 🔴 ESTO SUSTITUYE A LA PREGUNTA P2 DEL CONTRATO DE UI, y por eso las dos columnas de orden de
   * pago NO SE MOVIERON: reordenarlas contradiría lo que la Fase 03.19 decidió sobre qué se lee
   * antes del pliegue, y fijar el identificador sirve para las 17 columnas y no sólo para las dos
   * nuevas. El usuario eligió expresamente esta vía en lugar de reordenar.
   * 🔴 El bloque fijado incluye a la `Nro.` que antepone `Table.tsx` —que sigue sin declararse
   * aquí—: va delante, así que lidera pegada al borde y `EXPEDIENTE` se desplaza por su ancho.
   */
  const columnas = useMemo<ColumnDef<MiEpasAsignado>[]>(
    () => [
      {
        id: "expNumber",
        header: "Expediente",
        meta: { pinnedLeft: true },
        accessorFn: (fila) => fila.expNumber ?? "",
        // El número y, al lado, «N nuevos» (quick 261030-m29): el mapa llega por contexto.
        cell: (info) => <CeldaExpediente row={info.row.original} />,
      },
      {
        id: "plazo",
        header: "Plazo restante",
        enableColumnFilter: false,
        accessorFn: (fila) => fila.plazoVenceAt ?? "",
        cell: (info) => <ChipPlazo row={info.row.original} />,
      },
      {
        id: "eejeStatus",
        header: "Estatus",
        accessorFn: (fila) => fila.eejeStatus ?? "",
        // Filtro de catálogo LOCAL (los otros dos de la bandeja, «Materia» y «Submateria», son
        // remotos). Sus opciones se derivan de `estadosEpas.ts`, que es el espejo del enum del
        // backend, y el contrato admite selección múltiple (`= ANY($n)`).
        meta: {
          filterType: "catalog",
          catalogKey: "eejeStatus",
          filterParamKey: "eejeStatus",
        },
        cell: (info) => (
          <BadgePriority
            text={etiquetaEstadoEpas(info.row.original.eejeStatus)}
            // 🔴 EL VALOR CRUDO, EN MAYÚSCULAS. `BADGE_GROUPS` lleva los quince estados con sus
            // guiones bajos desde el Plan 07; pasarlo en minúsculas —como hacía la versión
            // anterior— los devolvería a todos al azul pálido por defecto.
            priority={info.row.original.eejeStatus ?? ""}
            size="md"
            // Varias etiquetas son frases («En verificación de pago»): con `capitalize` el CSS las
            // rompería en «En Verificación De Pago».
            capitalize={false}
          />
        ),
      },
      {
        id: "admiName",
        header: "Nombres",
        accessorFn: (fila) => fila.admiName ?? "",
        cell: (info) => info.row.original.admiName ?? "—",
      },
      {
        id: "admiLastname",
        header: "Apellidos",
        accessorFn: (fila) => fila.admiLastname ?? "",
        cell: (info) => info.row.original.admiLastname ?? "—",
      },
      {
        // El valor viaja en `cedula`; la CLAVE DEL FILTRO es la del DTO. Ver la cabecera del memo.
        id: "admiIdentification",
        header: "CI/RUC",
        accessorFn: (fila) => fila.cedula ?? "",
        cell: (info) => info.row.original.cedula ?? "—",
      },
      {
        id: "admiTelephone",
        header: "Teléfono",
        accessorFn: (fila) => fila.admiTelephone ?? "",
        cell: (info) => info.row.original.admiTelephone ?? "—",
      },
      {
        id: "admiBusinessName",
        header: "Negocio",
        accessorFn: (fila) => fila.admiBusinessName ?? "",
        cell: (info) => info.row.original.admiBusinessName ?? "—",
      },
      {
        id: "admiAddress",
        header: "Dirección",
        accessorFn: (fila) => fila.admiAddress ?? "",
        // Truncada con el valor entero en el `title`: una dirección completa desplaza todo lo demás
        // fuera de la pantalla, y es el dato que menos se lee y más ocupa.
        cell: (info) => (
          <span
            className="block max-w-[14rem] truncate"
            title={info.row.original.admiAddress ?? ""}
          >
            {info.row.original.admiAddress ?? "—"}
          </span>
        ),
      },
      {
        // 🔴 ZONAL LLEVA FILTRO DE TEXTO Y NO CATÁLOGO, contra lo que enseña la captura —que es de
        // Resolución, donde el dato está limpio—. Medido sobre EjecucionDB el 2026-09-21, `exp_zone`
        // es texto libre y está sucio: «Eugenio Espejo» 24 y «Eugenio Espejo (Norte)» 1, «Quitumbe»
        // 1. Un desplegable de tres opciones haría invisibles dos expedientes al filtrar y sin
        // avisar de que los esconde; el `ILIKE` del texto encuentra los dos «Eugenio Espejo».
        id: "expZone",
        header: "Zonal",
        accessorFn: (fila) => fila.expZone ?? "",
        cell: (info) => info.row.original.expZone ?? "—",
      },
      {
        id: "expCreatedAt",
        header: "Creado en",
        enableColumnFilter: true,
        // El único filtro de rango. El par de claves que emite —`expCreatedAtFrom` y
        // `expCreatedAtTo`— sale del `id` de la columna, y son exactamente las dos que el DTO
        // declara: por eso el `id` es `expCreatedAt` y no `creado`.
        meta: { filterType: "dateRange" },
        accessorFn: (fila) => fila.expCreatedAt ?? "",
        cell: (info) =>
          info.row.original.expCreatedAt
            ? DatetimeUtil.formatDate(info.row.original.expCreatedAt)
            : "—",
      },
      {
        // ── MATERIA y SUBMATERIA (quick 261104-jh1; antes Fase 03.23 y quick 261006-kys) ─────────
        // (a) 🔴 Las dos son las de SORTEO que el SERVIDOR resolvió por la submateria (ssubId) de
        //     cada infracción del EPAS y guardó en su foto (`expMateria`, `expSubmateria`): ya no se
        //     deducen del código. Si el EPAS tiene infracciones de varias, llegan todas unidas
        //     (D-00b) y se pintan tal cual: esta página NO parte ni recompone nada.
        // (b) «Sin materia» es un ESTADO aparte (`infracciones.sinMateria`), no un nombre: lo añade
        //     `etiquetaConSinMateria` al pintar. Sin infracciones ni flag, la celda dice «—».
        // (c) CATÁLOGO y no texto, al revés que ZONAL. Las opciones las carga la CELDA DEL FILTRO
        //     (`useTableCatalogOptions`, de `GET /infracciones/materias`), no esta página: por eso
        //     `columnas` NO gana dependencias y su identidad no cambia. Viaja el ID de Sorteo con
        //     las claves que declara `FilterMisAsignadosDto` (`materiaId`, `submateriaId`); las dos
        //     se combinan con Y, sin cascada.
        // (d) POSICIÓN: las primeras tras el pliegue, juntas, y justo detrás «Infracciones». No
        //     mueven ninguna de las doce primeras.
        id: "materiaId",
        header: "Materia",
        accessorFn: (fila) => fila.expMateria ?? "",
        meta: {
          filterType: "catalog",
          catalogKey: "materiaId",
          filterParamKey: "materiaId",
        },
        cell: (info) =>
          etiquetaConSinMateria(
            info.row.original.expMateria,
            info.row.original.infracciones?.sinMateria,
          ),
      },
      {
        // La SUBMATERIA de Sorteo: ver el bloque de «Materia» justo arriba.
        id: "submateriaId",
        header: "Submateria",
        accessorFn: (fila) => fila.expSubmateria ?? "",
        meta: {
          filterType: "catalog",
          catalogKey: "submateriaId",
          filterParamKey: "submateriaId",
        },
        cell: (info) =>
          etiquetaConSinMateria(
            info.row.original.expSubmateria,
            info.row.original.infracciones?.sinMateria,
            ", ",
          ),
      },
      {
        // ── INFRACCIONES (Fase 03.23, D-16) ──────────────────────────────────────────────────
        // Los códigos de las infracciones del EPAS y los avisos que el SERVIDOR calculó sobre
        // ellos (CORE pendiente, conflicto, descuadre), pintados por `CeldaInfracciones`, que no
        // decide nada. El filtro es TEXTO libre sobre los códigos: el `id` ES la clave que viaja
        // (`serializeColumnFilters` usa el `id` para el texto), y es `infraccion`, la que declara
        // `FilterMisAsignadosDto`; `filterParamKey` lo deja escrito para quien lea la columna.
        id: "infraccion",
        header: "Infracciones",
        accessorFn: (fila) => (fila.infracciones?.codigos ?? []).join(", "),
        meta: { filterType: "text", filterParamKey: "infraccion" },
        // Debajo, el aviso de D-05 (Fase 03.24): los datos que Resolución no mandó, según el
        // servidor. No pinta nada si el EPAS no vino de Resolución o no le falta nada.
        cell: (info) => (
          <>
            <CeldaInfracciones resumen={info.row.original.infracciones} />
            <AvisoDatosResolucion
              faltantes={info.row.original.datosResolucionFaltantes}
            />
          </>
        ),
      },
      {
        // TRAS EL PLIEGUE, y la primera de las dos: es el criterio 6 de la Fase 03.18 —el archivo
        // exige que las DOS obligaciones estén cumplidas, y una bandeja que enseña media hace creer
        // que falta la mitad del trabajo cuando falta la otra mitad—. Perderla al aplanar la fila
        // sería una regresión de la fase anterior, no una decisión de diseño.
        id: "obligaciones",
        header: "Obligaciones",
        enableColumnFilter: false,
        cell: (info) => (
          <ObligacionesVivas
            multaImpuesta={info.row.original.multaImpuesta}
            obligacionHacer={info.row.original.obligacionHacer}
          />
        ),
      },
      {
        // Las dos de la Fase 03.22 (D-05/D-06). SIN ACCESOR y sin ancho declarado: no hay nada que
        // ordenar ni filtrar por ellas, y un accesor sugeriría lo contrario; el ancho lo manda el
        // contenido, como en todas las demás. La `key` fuerza el remontaje de la
        // celda al cambiar de página o de filtro: React conserva el estado local POR POSICIÓN, y
        // sin ella un borrador a medio teclear podría «bajar» a la fila de otro expediente.
        id: "ordenMulta",
        header: "N.º orden (multa)",
        enableColumnFilter: false,
        cell: (info) => (
          <CeldaOrden
            key={`${info.row.original.eejeId}:MULTA`}
            row={info.row.original}
            tipo="MULTA"
            onRegistrada={recargarBandeja}
          />
        ),
      },
      {
        id: "ordenRemanente",
        header: "N.º orden (remanente)",
        enableColumnFilter: false,
        cell: (info) => (
          <CeldaOrden
            key={`${info.row.original.eejeId}:REMANENTE`}
            row={info.row.original}
            tipo="REMANENTE"
            onRegistrada={recargarBandeja}
          />
        ),
      },
      {
        id: "amasId",
        header: "Sublote",
        accessorFn: (fila) => fila.amasId ?? "",
        cell: (info) =>
          info.row.original.amasId != null
            ? `#${info.row.original.amasId}`
            : "—",
        // Va la última porque es una clave de AGRUPACIÓN: se usa para filtrar, y el filtro está en
        // su propia celda, así que no hace falta leerla para usarla.
        // ⚠️ El backend NO declara `amasId` en su allowlist de filtros, así que la columna no lo
        // ofrece: un filtro que devuelve 400 es peor que no tener filtro.
        enableColumnFilter: false,
      },
      {
        id: "acciones",
        header: "Acciones",
        enableColumnFilter: false,
        size: 160,
        // Lo que hace segura la tabla ancha: se puede mandar contenido más allá del pliegue sin que
        // las tres acciones se vayan con él.
        meta: { pinnedRight: true },
        cell: (info) => (
          <CeldaAcciones
            row={info.row.original}
            rolName={rolName}
            disparadores={disparadores}
            onVerFicha={verFicha}
            onLineaDeTiempo={verLineaDeTiempo}
          />
        ),
      },
    ],
    // `recargarBandeja` es un `useCallback` con dependencias VACÍAS: su identidad es estable y el
    // memo no se invalida por render, que es lo que este array tiene que seguir garantizando.
    [rolName, disparadores, verFicha, verLineaDeTiempo, recargarBandeja],
  );

  // ACEPTACIÓN EXPLÍCITA del caso (RECE-06). El actor sale del JWT (cuerpo vacío en SorteoService);
  // si el backend responde 400/error se muestra HONESTO en el modal —no se finge aceptación—.
  const aceptarCaso = useCallback(async () => {
    if (!confirmAceptar) return;
    setAceptarMessage(null);
    // GUARDA: sin cass_id no se puede aceptar por caso (la ruta es /sorteo/:cassId/aceptar). No se
    // dispara la llamada y se dice honesto en vez de pegarle a /sorteo/undefined/aceptar.
    if (confirmAceptar.cassId == null) {
      setAceptarMessage({
        variant: "error",
        message:
          "Este caso no tiene un identificador de asignación resuelto; no se puede aceptar. Actualice la bandeja e intente nuevamente.",
      });
      return;
    }
    try {
      await SorteoService.aceptarCaso(confirmAceptar.cassId);
      addToast("success", "Caso aceptado — su aceptación quedó registrada.");
      setConfirmAceptar(null);
      await recargarBandeja();
    } catch (err) {
      setAceptarMessage({
        variant: "error",
        message:
          mensajeParaUsuario(err, "No se pudo aceptar el caso. Intente más tarde."),
      });
    }
  }, [confirmAceptar, addToast, recargarBandeja]);

  // 🔴 LA GUARDIA, AQUÍ ABAJO. Ver el bloque de `rolName`: encima de los hooks convertía cada hook
  // nuevo en un error de `react-hooks/rules-of-hooks`, y esta reconversión añade nueve.
  if (!user) {
    return null;
  }

  const hayFallo = falloDeCarga !== null;

  return (
    <div className="app-data-container">
      <HeaderPage
        // El kicker NO es decorativo: es la ruta del menú lateral, y el menú lo siembra la base
        // (`t_modulo` / `t_submenus`). Se escribe con tildes: la falta de tildes en la siembra es un
        // defecto del dato, no un estilo que propagar.
        headerKicker="Recepción y Asignación / Mis expedientes"
        title="Mis Expedientes"
        // 🔴 LA FRASE DE LA FIRMA DEL ACTA VIVE AQUÍ. Sustituye a la cabecera de sublote que la
        // tabla plana elimina, y era el ÚNICO sitio donde constaba que la firma orden-1 se hace en
        // otra pantalla. Sin ella el decisor se queda esperando un botón que nunca va a aparecer.
        subtitle="Gestiona y revisa tus expedientes asignados — la firma del acta se realiza en «Actas de Sorteo»."
      />

      <section className="app-modules-panel app-data-panel app-shell-surface overflow-visible rounded-3xl border border-base-300 bg-base-100 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-[2px]">
        <div className="app-section-header flex flex-col gap-3 border-b border-base-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-section-heading text-sm font-bold uppercase tracking-[0.18em] text-primary/95">
            Bandeja de expedientes
          </h2>
        </div>

        <div className="app-data-panel-body relative px-2 pb-4 pt-2 md:px-4">
          {hayFallo && (
            <div className="mb-3 flex flex-col items-start gap-2">
              <Alert
                variant="error"
                message={`${ERROR_DE_CARGA_ENCABEZADO} ${ERROR_DE_CARGA_PISTA}`}
              />
              <p className="text-xs text-base-content/70">
                Detalle del servidor: {falloDeCarga}
              </p>
              <Boton
                estilos="btn btn-sm btn-primary"
                texto="Reintentar"
                deshabilitado={false}
                onClick={() => void recargarBandeja()}
              />
            </div>
          )}

          {limiteAcotado !== null && (
            <div className="mb-3">
              <Alert
                variant="warning"
                message={`El servidor acotó la página a ${limiteAcotado} expedientes. Baje «Registros/página» a ${limiteAcotado} o menos para que el paginado cuente bien.`}
              />
            </div>
          )}

          {/*
            🔴 LA TABLA SE OCULTA, NO SE DESMONTA, MIENTRAS HAY FALLO (UI-SPEC §1.7, deferred §19).
            Desmontarla perdería los filtros y la página, así que «Reintentar» volvería a la página 1
            sin filtros — castigando al usuario por un fallo de red. Oculta, sigue viva y reintentar
            vuelve a pedir EXACTAMENTE lo mismo. Y se oculta con el atributo `hidden`, no con una
            clase: `hidden` sale del árbol de accesibilidad, así que el lector de pantalla tampoco
            oye «No tiene expedientes asignados» encima del aviso de que la carga falló.
          */}
          <div hidden={hayFallo}>
            <NoLeidosContext.Provider value={noLeidosPorEpas}>
              <Table<MiEpasAsignado>
                styles={ESTILOS_TABLA}
                dataT={[]}
                columns={columnas}
                findRecordsFn={buscarBandeja}
                resolveActionsPerRow={SIN_RESOLVER_DE_FILA}
                tableOptions={SIN_ACCIONES_DE_TABLA}
                hideActionsColumn
                onRefetchReady={recibirRecarga}
                vacioSinFiltros={VACIO_SIN_FILTROS}
                vacioConFiltros={VACIO_CON_FILTROS}
              />
            </NoLeidosContext.Provider>
          </div>
        </div>
      </section>

      {desenlace?.tipo === "pago" && (
        <RegistrarPagoModal
          caso={desenlace.caso}
          onClose={() => setDesenlace(null)}
          // 🔴 POR QUÉ SIGUE REFRESCANDO, AUNQUE YA NO HAGA FALTA PARA LO MISMO (Fase 03.15, D-1).
          // Este refresco existía porque registrar el pago movía el EPAS a CUMPLIDO y el caso
          // DESAPARECÍA de la bandeja. Ya no se mueve —quien lo mueve es la providencia de archivo
          // por pago, que es un SEGUNDO ACTO—, así que el caso se queda aquí. Se conserva porque
          // ahora sirve para otra cosa: que la fila traiga el dato nuevo (comprobante acreditado).
          onResuelto={() => void recargarBandeja()}
        />
      )}

      {desenlace?.tipo === "acogimiento" && (
        <RegistrarAcogimientoModal
          caso={desenlace.caso}
          onClose={() => setDesenlace(null)}
          // La respuesta NO mueve el expediente, pero sí cambia lo que puede hacerse con él: tras el
          // «sí», la providencia de trabajo comunitario deja de estar bloqueada.
          onRegistrado={() => void recargarBandeja()}
        />
      )}

      {desenlace?.tipo === "coactiva" && (
        <CoactivaModal
          caso={desenlace.caso}
          onClose={() => setDesenlace(null)}
          // La baja MUEVE el expediente (a pago o a trabajo comunitario) y marcar el inicio cambia
          // lo que se puede hacer con él.
          onCambiado={() => void recargarBandeja()}
        />
      )}

      {desenlace?.tipo === "prorroga" && (
        <SolicitarProrrogaModal
          caso={desenlace.caso}
          onClose={() => setDesenlace(null)}
          onSolicitada={() => void recargarBandeja()}
        />
      )}

      {desenlace?.tipo === "trabajoComunitario" && (
        <RegistrarCumplimientoModal
          caso={desenlace.caso}
          onClose={() => setDesenlace(null)}
          // Mismo caso que el pago (Fase 03.15, D-1): registrar el cumplimiento ACREDITA las horas y
          // ya NO mueve el expediente. El refresco se queda para que la fila muestre las horas.
          onRegistrado={() => void recargarBandeja()}
        />
      )}

      {confirmAceptar && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setConfirmAceptar(null)}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle="Aceptar el caso asignado"
            statusCopy="Listo para aceptar"
            descriptionCopy="¿Confirma aceptar este caso? Su aceptación quedará registrada. Una vez aceptados (o excusados) todos los casos de su sublote podrá firmar como decisor."
            informationData={{
              Expediente: nombreDeLaFila(confirmAceptar),
              Estado: confirmAceptar.eejeStatus ?? "—",
            }}
            onConfirm={aceptarCaso}
            onClose={() => setConfirmAceptar(null)}
            message={aceptarMessage ?? undefined}
            confirmButtonText="Sí, aceptar"
            confirmButtonLoadingText="Aceptando…"
          />
        </DialogoModal>
      )}
    </div>
  );
};

export default MisAsignadosPage;
