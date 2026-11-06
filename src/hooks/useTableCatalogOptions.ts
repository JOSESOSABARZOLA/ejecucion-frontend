/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/tabla (frontend)
 * Feature: Las opciones que alimentan un filtro de catálogo (Fase 03.19, Plan 06, D-09)
 * Archivo: useTableCatalogOptions.ts
 * Responsabilidad: Entregar a `CatalogFilterInput` las opciones de su catálogo con una sola forma de
 *   retorno (`{ options, isLoading, error }`): las de un catálogo LOCAL, derivadas de código y listas
 *   al primer render; las de un catálogo REMOTO, cargadas del servidor (hoy, las materias y las
 *   submaterias de Sorteo, `GET /infracciones/materias`).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: se USA la costura que esta cabecera
 *   anunciaba. El catálogo de materias se carga de `GET /materias` para el filtro «Materia» de
 *   «Mis expedientes»; los catálogos locales siguen exactamente igual. Ver abajo
 *   «LA COSTURA, USADA»)
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: dos catálogos remotos —`materiaId` de
 *   `GET /materias` y `submateriaId` de `GET /materias/submaterias`— en lugar de la clave del id
 *   de materia del g35)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-14/D-17: las dos claves pasan a
 *   `materiaCod` y `submateriaCod` y se cargan de `InfraccionesService.diccionario()`; el catálogo
 *   local de materias se retiró. Entra la COALESCENCIA del diccionario: ver «LA COSTURA, USADA»)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: las claves vuelven a `materiaId` y
 *   `submateriaId`, ids de Sorteo cargados de `InfraccionesService.materias()` con la misma
 *   coalescencia; `disponible: false` es un error del catálogo; fuera el diccionario CAT v1.3)
 *
 * ── DE DÓNDE VIENE Y QUÉ SE LE AMPUTÓ ────────────────────────────────────────────────────────
 * Portado SIMPLIFICADO de `resolucion-frontend @ origin/dev — src/shared/hooks/useTableCatalogOptions.ts`.
 * El original es un cargador asíncrono con caché por clave y coalescencia de peticiones en vuelo
 * (dos `Map` de módulo, `useState` + `useEffect`, bandera `isMounted`). Aquí se reduce a un
 * `useMemo` sobre una constante local, y las ~60 líneas de esa maquinaria se amputan.
 *
 * 🔴 **NO se porta `CaseAdministrationCatalogService`**, que es lo que el original llama. Apunta a
 * `/case-administration/catalogs/*`, del módulo roto del backlog 999.1, y su propio código declara
 * `USE_MOCK_TABLE_CATALOGS = true`: es decir, la caché, la coalescencia y el `error` de la rama
 * envuelven hoy a una constante hardcodeada. Portar la maquinaria habría sido portar el disfraz de
 * una llamada que no se hace.
 *
 * ── POR QUÉ SE CONSERVA LA FORMA DEL RETORNO ─────────────────────────────────────────────────
 * En un catálogo LOCAL, `isLoading` y `error` se devuelven siempre en `false`/`null`, y aun así se
 * devuelven. `CatalogFilterInput` los consume para deshabilitar el disparador y para decir «Cargando...»; el día que
 * exista un endpoint de catálogos —el camino honesto para que ZONAL tenga desplegable, ver
 * `ITableCatalog.ts`— solo cambia el cuerpo de este hook, y ni el componente ni sus pruebas se
 * enteran. Es la costura barata: el consumidor ya está escrito contra la forma asíncrona.
 *
 * ── LA COSTURA, USADA (quick 261006-g35) ─────────────────────────────────────────────────────
 * El primer catálogo remoto no fue ZONAL sino MATERIA: una FK a `t_materia`, catálogo cerrado que el
 * administrador gestiona desde Parámetros, servido por `GET /materias` (que el backend abrió en
 * LECTURA al funcionario decisor). Lo que se escribió es lo mínimo que esa clave necesita —un
 * cargador por clave, `useState` + `useEffect` con bandera de vigencia— y NO la caché ni la
 * coalescencia del original: con una sola pantalla que monta una sola celda, no hay a quién
 * ahorrarle una petición. Las opciones cargadas se REGISTRAN en `tableCatalogDefaults.ts` para que
 * la barra de «filtros aplicados» lea la etiqueta. Si la carga falla, `error` deja de ser `null` y
 * el disparador dice «No disponible»; la tabla carga igual, porque la carga vive en la celda del
 * filtro y no en la página.
 *
 * Quick 261104-jh1: los dos catálogos remotos —materia y submateria— salen de UNA sola respuesta,
 * las materias de Sorteo (`GET /infracciones/materias`). Como «Mis expedientes» monta las dos celdas
 * a la vez, pedirlo dos veces sería pedir lo mismo dos veces; por eso hay UNA promesa EN VUELO a
 * nivel de módulo (`materiasEnVuelo`) que comparten las cargas simultáneas. Es
 * COALESCENCIA, no caché: en cuanto la petición se resuelve —o falla— la promesa se suelta, y el
 * siguiente montaje vuelve a pedir. Así no se sirve nada viejo, un fallo no queda guardado, y las
 * pruebas no se filtran estado entre sí.
 */

import { useEffect, useMemo, useState } from "react";
import {
  TABLE_CATALOG_DEFAULTS,
  esCatalogoLocal,
  registrarOpcionesRemotas,
} from "../config/tableCatalogDefaults";
import {
  InfraccionesService,
  type CatalogoMateriasRespuesta,
} from "../services/InfraccionesService";
import type {
  ICatalogOption,
  TableCatalogKey,
  TableCatalogKeyRemoto,
} from "../interfaces/ITableCatalog";

type UseTableCatalogOptionsResult = {
  options: ICatalogOption[];
  isLoading: boolean;
  error: Error | null;
};

/** Mensaje del error cuando el backend responde que Sorteo no está disponible. */
export const MENSAJE_MATERIAS_NO_DISPONIBLES =
  "El catálogo de materias de Sorteo no responde ahora";

/**
 * La petición de materias EN VUELO, compartida por las cargas simultáneas (coalescencia, ver la
 * cabecera). `null` cuando no hay ninguna: se suelta al resolverse y al fallar, así que nunca hace de
 * caché.
 */
let materiasEnVuelo: Promise<CatalogoMateriasRespuesta> | null = null;

const pedirMaterias = (): Promise<CatalogoMateriasRespuesta> => {
  if (!materiasEnVuelo) {
    const peticion = InfraccionesService.materias();
    const soltar = (): void => {
      if (materiasEnVuelo === peticion) materiasEnVuelo = null;
    };
    peticion.then(soltar, soltar);
    materiasEnVuelo = peticion;
  }
  return materiasEnVuelo;
};

/** Las materias si el backend las sirvió; `disponible: false` es un fallo del catálogo. */
const materiasDisponibles = async (): Promise<CatalogoMateriasRespuesta> => {
  const respuesta = await pedirMaterias();
  if (!respuesta.disponible) {
    return Promise.reject(new Error(MENSAJE_MATERIAS_NO_DISPONIBLES));
  }
  return respuesta;
};

/**
 * Cómo se carga cada catálogo REMOTO. `Record` TOTAL sobre `TableCatalogKeyRemoto`: declarar una
 * clave remota sin darle cargador no compila.
 */
const CARGADORES_REMOTOS: Record<
  TableCatalogKeyRemoto,
  () => Promise<ICatalogOption[]>
> = {
  // Quick 261104-jh1: los dos niveles salen de la MISMA respuesta. El `value` es el id de Sorteo en
  // texto (es lo que viaja en el query string y el DTO del backend lo convierte a entero); el orden
  // es el del servidor. La submateria se etiqueta con su materia para distinguir homónimas
  // (AMBIENTE existe como submateria de FAUNA URBANA y como materia).
  materiaId: async () =>
    (await materiasDisponibles()).materias.map((m) => ({
      value: String(m.id),
      label: m.nombre,
    })),
  submateriaId: async () => {
    const { materias, submaterias } = await materiasDisponibles();
    const nombreMateria = new Map(materias.map((m) => [m.id, m.nombre]));
    return submaterias.map((s) => {
      const materia = nombreMateria.get(s.materiaId);
      return {
        value: String(s.id),
        label: materia ? `${s.nombre} · ${materia}` : s.nombre,
      };
    });
  },
};

/** Array vacío con identidad ESTABLE: un `[]` literal sería nuevo en cada render. */
const SIN_OPCIONES: ICatalogOption[] = [];

export const useTableCatalogOptions = (
  catalogKey: TableCatalogKey,
): UseTableCatalogOptionsResult => {
  const esLocal = esCatalogoLocal(catalogKey);

  // La copia del `readonly` a array mutable es lo que obliga a que haya `useMemo`: sin él, cada
  // render devolvería un array nuevo y el `options` del componente cambiaría de identidad en cada
  // pasada, que es justo el tipo de cosa que en esta tabla acaba en una petición de más.
  const opcionesLocales = useMemo(
    () =>
      esCatalogoLocal(catalogKey)
        ? [...TABLE_CATALOG_DEFAULTS[catalogKey]]
        : SIN_OPCIONES,
    [catalogKey],
  );

  // El estado REMOTO existe siempre (reglas de los hooks: los mismos hooks en cada render), pero
  // solo arranca CARGANDO si la clave es remota.
  const [remoto, setRemoto] = useState<UseTableCatalogOptionsResult>(() => ({
    options: SIN_OPCIONES,
    isLoading: !esLocal,
    error: null,
  }));

  useEffect(() => {
    if (esCatalogoLocal(catalogKey)) {
      return;
    }

    // Bandera de VIGENCIA: si la celda se desmonta (o cambia de clave) antes de que llegue la
    // respuesta, la respuesta tardía no escribe en un estado que ya no es de nadie.
    let vigente = true;

    // Sin caché, a propósito: una petición por montaje (las celdas que montan a la vez comparten la
    // misma, ver `pedirMaterias`). Una caché de módulo filtraría estado entre pruebas y serviría
    // un catálogo viejo tras un despliegue. Nada se vuelca a la consola (T-03.19-75).
    CARGADORES_REMOTOS[catalogKey]().then(
      (opciones) => {
        if (!vigente) return;
        registrarOpcionesRemotas(catalogKey, opciones);
        setRemoto({ options: opciones, isLoading: false, error: null });
      },
      (motivo: unknown) => {
        if (!vigente) return;
        setRemoto({
          options: SIN_OPCIONES,
          isLoading: false,
          error:
            motivo instanceof Error
              ? motivo
              : new Error("No se pudo cargar el catálogo"),
        });
      },
    );

    return () => {
      vigente = false;
    };
  }, [catalogKey]);

  if (esLocal) {
    return { options: opcionesLocales, isLoading: false, error: null };
  }

  return remoto;
};
