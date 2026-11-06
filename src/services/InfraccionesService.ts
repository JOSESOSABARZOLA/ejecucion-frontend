/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: La infracción manda — servicio y contrato de tipos (Fase 03.23, Plan 11, D-14/D-17)
 * Archivo: InfraccionesService.ts
 * Responsabilidad: Consumir las lecturas del módulo de infracciones del backend: el catálogo de
 *   materias y submaterias de SORTEO (`GET /infracciones/materias`), que alimenta los filtros de
 *   materia de las bandejas y del buscador; el catálogo de infracciones de CORE
 *   (`GET /infracciones/catalogo`), que consulta el buscador flotante; y la ficha de infracciones de
 *   un EPAS (`GET /epas/:eejeId/infracciones`). Declara también los tipos del contrato, COPIADOS
 *   palabra por palabra de `ejecucion-backend — src/modules/ejecucion/infracciones/interfaces/
 *   infraccion.interface.ts` y `catalogos-externos.interface.ts`: si el backend cambia una forma,
 *   cambia aquí con el mismo nombre de campo.
 *
 *   Sustituye al servicio del catálogo LOCAL de materias, retirado con su aptitud por materia
 *   (D-13/D-14): la aptitud para trabajo comunitario la decide la infracción en CORE, no una tabla
 *   que el administrador declaraba a mano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: se retira el diccionario CAT v1.3 local;
 *   entran `materias()` y `catalogo()`, servidos desde Sorteo y CORE por el backend; el resumen y la
 *   ficha llevan ids y nombres de Sorteo y el estado «Sin materia»)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-bo0: `FundamentoLegalInfraccion` —artículo,
 *   literal, subliteral, numeral y tipificación de CORE— y la infracción de la ficha la lleva)
 */
import httpClient from "../api/httpClient";
import type { IInfraccionCatalogo } from "../interfaces/IInfraccionCatalogo";

/**
 * Tipo de persona del administrado, DERIVADO de su identificación por el 3.er dígito (D-00f).
 * NATURAL = cédula o RUC 0-5; PUBLICA = RUC 6; SOCIEDAD = RUC 9.
 */
export type TipoPersona = "NATURAL" | "SOCIEDAD" | "PUBLICA";

/**
 * Estado de la última lectura de CORE para el caso del EPAS (D-10). `DEMO` cuenta como leído: es la
 * foto sembrada sin red.
 */
export type EstadoLecturaCore =
  | "PENDIENTE"
  | "LEIDO"
  | "SIN_CASO"
  | "NO_ENCONTRADO"
  | "DEMO";

/** Por qué el trabajo comunitario está bloqueado, en el orden en que se presentan (D-13). */
export type CodigoBloqueoTc =
  | "PENDIENTE_CORE"
  | "SIN_INFRACCIONES"
  | "CONFLICTO_CODIGOS"
  | "DESCUADRE"
  | "NINGUNA_APTA";

/** Un motivo de bloqueo con el mensaje que verá el usuario. */
export interface MotivoBloqueoTc {
  codigo: CodigoBloqueoTc;
  mensaje: string;
}

/**
 * Lo que viaja en cada fila de bandeja (Plan 04): los códigos de las infracciones del EPAS, los ids
 * de Sorteo de sus materias y submaterias (los de los filtros), si alguna está «sin materia», el
 * estado de la lectura de CORE y los dos avisos.
 *
 * ⚠️ `descuadre` también es `true` cuando el EPAS no tiene NINGUNA infracción (`codigos` vacío): para
 * el backend, una multa sin filas que la sumen no cuadra. La pantalla debe decir «sin infracciones»
 * en ese caso, no «descuadre» — mirar `codigos.length` antes que `descuadre`.
 */
export interface ResumenInfracciones {
  codigos: string[];
  /** subIds de Sorteo de las infracciones con materia resuelta, distintos y ascendentes. */
  materiaIds: number[];
  /** ids de submateria de Sorteo (ssubId de CORE), distintos y ascendentes. */
  submateriaIds: number[];
  /** `true` si alguna infracción del EPAS está «sin materia» (quick 261104-jh1). */
  sinMateria: boolean;
  estadoCore: EstadoLecturaCore;
  conflicto: boolean;
  descuadre: boolean;
}

/** Alertas que la ficha muestra sobre las infracciones del EPAS. */
export type CodigoAlertaInfracciones =
  | "PENDIENTE_CORE"
  | "SIN_INFRACCIONES"
  | "CONFLICTO_CODIGOS"
  | "DESCUADRE"
  | "SIN_MATERIA"
  | "CORE_NO_DISPONIBLE"
  | "CORE_CAMBIO_TRAS_SELLO"
  | "IDENTIFICACION_NO_RECONOCIDA";

/** Una alerta con su mensaje para el usuario. */
export interface AlertaInfracciones {
  codigo: CodigoAlertaInfracciones;
  mensaje: string;
}

/**
 * La BASE LEGAL de una infracción (quick 261106-bo0), tal como la publica step-2 de CORE en cada
 * ítem de `data.selected.infractions[]` (y Resolución la copia en el `step2` de cada caso del lote).
 * La autoridad es el catálogo de CORE: el decisor solo elige la infracción y el monto. Cada campo vale
 * `null` si no vino (o vino vacío o con otro tipo): nunca se fabrica.
 */
export interface FundamentoLegalInfraccion {
  /** Artículo (`article` de step-2 de CORE). */
  articulo: string | null;
  /** Literal (`literal` de step-2 de CORE). */
  literal: string | null;
  /** Subliteral (`subliteral` de step-2 de CORE). */
  subliteral: string | null;
  /** Numeral (`numeral` de step-2 de CORE). */
  numeral: string | null;
  /** Tipificación (`tipification` de step-2 de CORE). */
  tipificacion: string | null;
}

/**
 * Una infracción tal como la pinta la ficha (Plan 05). Lleva la base legal (quick 261106-bo0): los
 * cinco campos siempre presentes, `null` si no hay.
 */
export interface InfraccionFicha extends FundamentoLegalInfraccion {
  codigo: string;
  /** Nombre de la materia en Sorteo (quick 261104-jh1); `null` = sin materia. */
  materia: string | null;
  /** Nombre de la submateria en Sorteo; `null` = sin materia. */
  submateria: string | null;
  /** subId de Sorteo; `null` = sin materia. */
  materiaId: number | null;
  /** id de la submateria de Sorteo = ssubId de CORE; `null` = sin materia. */
  submateriaId: number | null;
  /** `true` si la infracción no tiene materia de Sorteo resuelta («Sin materia»). */
  sinMateria: boolean;
  /** De CORE. */
  sancion: string | null;
  /** De Resolución. */
  multa: number | null;
  enResolucion: boolean;
  enCore: boolean;
  admiteTc: boolean;
  motivoNoAdmite: string | null;
  /** De CORE. */
  obligacionHacer: string | null;
}

/** Respuesta de `GET /epas/:eejeId/infracciones` (Plan 05). */
export interface FichaInfracciones {
  eejeId: number;
  estadoCore: EstadoLecturaCore;
  /** ISO-8601 de la última lectura de CORE. */
  coreLeidoAt: string | null;
  coreDisponible: boolean;
  /**
   * SOLO nombres de materia resueltos en Sorteo, unidos con « / »; `null` si ninguno. Nunca lleva la
   * etiqueta «Sin materia» (puede acabar en providencias y actas): eso lo dice `infraccionesSinMateria`.
   */
  materia: string | null;
  /** Nombres de submateria resueltos, ordenados. */
  submaterias: string[];
  /** Infracciones de la foto sin materia de Sorteo (quick 261104-jh1). */
  infraccionesSinMateria: number;
  tipoPersona: TipoPersona;
  avisoIdentificacion: string | null;
  multaTotal: number | null;
  sumaMultas: number | null;
  infracciones: InfraccionFicha[];
  evaluacionTc: {
    estado: "APTA" | "BLOQUEADA";
    motivos: MotivoBloqueoTc[];
    multaConmutable: number | null;
  };
  alertas: AlertaInfracciones[];
  /** ISO-8601 desde cuándo CORE cambió tras el sello (D-09); `null` si no cambió. */
  avisoCoreCambio: { desde: string } | null;
}

/** Una materia de Sorteo. `id` = subId de Sorteo. */
export interface MateriaSorteo {
  id: number;
  nombre: string;
}

/** Una submateria de Sorteo. `id` = id del subtopic = ssubId de CORE; `materiaId` = subId. */
export interface SubmateriaSorteo {
  id: number;
  materiaId: number;
  nombre: string;
}

/** Respuesta de `GET /infracciones/materias`. */
export interface CatalogoMateriasRespuesta {
  disponible: boolean;
  origen: "SORTEO" | "SIMULADO" | null;
  materias: MateriaSorteo[];
  submaterias: SubmateriaSorteo[];
}

/** Respuesta de `GET /infracciones/catalogo`. */
export interface PaginaCatalogoInfracciones {
  disponible: boolean;
  origen: "CORE" | "SIMULADO" | null;
  items: IInfraccionCatalogo[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}

/** Consulta del buscador a `GET /infracciones/catalogo`; los ausentes no viajan. */
export interface ConsultaCatalogoInfracciones {
  search?: string;
  materiaId?: number;
  submateriaId?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Copy de cada estado de la lectura de CORE. UNA sola redacción: la pintan la bandeja y la ficha, y
 * si cada una tecleara la suya acabarían diciendo cosas distintas del mismo EPAS.
 */
export const ETIQUETA_ESTADO_CORE: Record<EstadoLecturaCore, string> = {
  PENDIENTE: "Pendiente de lectura",
  LEIDO: "Infracciones leídas",
  SIN_CASO: "Sin caso enlazado",
  NO_ENCONTRADO: "Caso no encontrado",
  DEMO: "Datos de demostración",
};

export const InfraccionesService = {
  /** Materias y submaterias de Sorteo (filtros). `disponible: false` si Sorteo no responde. */
  async materias(): Promise<CatalogoMateriasRespuesta> {
    const { data } = await httpClient.get<CatalogoMateriasRespuesta>(
      "/infracciones/materias",
    );
    return data;
  },

  /**
   * Una página del catálogo de infracciones de CORE, con búsqueda y paginación del lado del
   * servidor. Solo viajan los parámetros presentes.
   */
  async catalogo(
    consulta: ConsultaCatalogoInfracciones = {},
  ): Promise<PaginaCatalogoInfracciones> {
    const params: Record<string, string | number> = {};
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== "") {
        params[clave] = valor as string | number;
      }
    }
    const { data } = await httpClient.get<PaginaCatalogoInfracciones>(
      "/infracciones/catalogo",
      { params },
    );
    return data;
  },

  /**
   * La ficha de infracciones de un EPAS. El backend comprueba la pertenencia antes de leer, y cada
   * llamada puede refrescar la foto de CORE (TTL del servidor).
   */
  async ficha(eejeId: number): Promise<FichaInfracciones> {
    const { data } = await httpClient.get<FichaInfracciones>(
      `/epas/${eejeId}/infracciones`,
    );
    return data;
  },
};

export default InfraccionesService;
