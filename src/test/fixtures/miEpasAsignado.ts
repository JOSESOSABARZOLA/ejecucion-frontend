/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/sorteo (frontend)
 * Feature: fixtures de prueba — la bandeja del decisor (Fase 03.19, Plan 01)
 * Archivo: miEpasAsignado.ts
 * Responsabilidad: Ser el ÚNICO sitio donde se construye un `MiEpasAsignado` de prueba.
 *
 *   ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 *   Hoy cada prueba que necesita una fila de la bandeja del decisor se fabrica el objeto a mano, con
 *   los campos que esa prueba mira y ningún otro. El DTO tiene 25 campos opcionales: añadir uno
 *   obliga a repasar todas esas construcciones para saber cuáles quedaron mintiendo. Con la factoría,
 *   el campo nuevo se añade AQUÍ una vez y toda prueba que no hable de él lo hereda coherente.
 *
 *   ── LOS ONCE CAMPOS YA ESTÁN (2026-09-21, Plan 10) ───────────────────────────────────────────
 *   Esta cabecera decía hasta hoy que `caseId`, `admiName`, `admiLastname`, `admiTelephone`,
 *   `admiBusinessName`, `admiAddress`, `admiEmail`, `expZone`, `expCreatedAt`, `expFojas` y
 *   `expMedidaCautelar` NO se inventaban aquí, porque `MiEpasAsignado` todavía no los declaraba y
 *   adelantarlos habría sido escribir en un fixture un contrato que el servicio no tenía. **El Plan
 *   03 los añadió al DTO del backend y el Plan 10 los declaró en el servicio**, así que la condición
 *   que los mantenía fuera se cumplió y el caso base los cubre. La regla que sigue viva es la de
 *   siempre: un campo se inventa aquí cuando el TIPO lo admite, nunca antes.
 *
 *   `obligacionHacer` tampoco viene poblado por defecto, y es deliberado: el propio DTO distingue
 *   «se miró y no lleva correctivo» (`tiene: false`) de «esta respuesta no lo trae» (ausente). El
 *   caso base es un EPAS pecuniario sin correctivo; quien pruebe la rama del hacer lo pasa por
 *   `overrides` y dice así, en su propia prueba, que ese expediente sí lo lleva.
 *
 *   ── DATOS INVENTADOS, NUNCA REALES (T-03.19-01) ──────────────────────────────────────────────
 *   🔴 Prohibido copiar filas de EjecucionDB a un fixture versionado. La cédula es `0000000000` y
 *   los nombres son ficticios a propósito: esto se commitea y se lee en cada revisión.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-21 (Plan 10: el caso base cubre los once campos del Plan 03
 *   y entra `crearMiEpasAsignadoSinCaseId`, el caso MAYORITARIO de la base de hoy).
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 02 — D-06: entra
 *   `crearMiEpasAsignadoConOrdenes`. El campo `ordenes` lo declaró `SorteoService` en este mismo
 *   plan, así que la condición de la regla de arriba —«un campo se inventa aquí cuando el TIPO lo
 *   admite, nunca antes»— se cumple).
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-g35: el caso base ganó el id y el nombre de
 *   la materia del expediente, que `SorteoService` declaró en el mismo quick).
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys: el caso base pasó a una submateria del
 *   catálogo local de entonces y ganó `expSubmateria`).
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-16/D-17: el caso base pierde el
 *   id de materia del expediente y la submateria del reparto, que el contrato retiró, y lleva la
 *   materia y submateria DEDUCIDAS del código con su bloque `infracciones`).
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: el resumen del caso base lleva los ids
 *   de Sorteo —`materiaIds` [26], `submateriaIds` [54]— y `sinMateria: false`)
 */

import type { MiEpasAsignado } from "../../services/SorteoService";

/** Un día en milisegundos. Lo usa el caso pendiente para situar el vencimiento respecto de hoy. */
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * EL CASO BASE: un EPAS **aceptado a mano** por su decisor.
 *
 * Cuenta la historia normal de la bandeja: el expediente se sorteó el 1 de septiembre con tres días
 * de plazo, el decisor lo aceptó al día siguiente —antes de que el plazo venciera, por eso
 * `aceptadoImplicito` es falso y `aceptadoExplicito` verdadero— y desde entonces el trámite avanzó
 * hasta la providencia de inicio. Es el caso que la segunda fase de la bandeja (expediente completo)
 * espera encontrar.
 *
 * Las fechas son constantes, no relativas a hoy: una prueba que dependa del reloj falla sola dentro
 * de un mes y el fallo no se parece a su causa.
 */
const MI_EPAS_ACEPTADO: MiEpasAsignado = {
  eejeId: 4101,
  eejeStatus: "EN_EJECUCION",
  expNumber: "EPAS-2026-04101",
  amasId: 9001,
  cassId: 55001,
  subId: 17,
  userId: 6389,
  sorteoAt: "2026-09-01T14:00:00.000Z",
  plazoDias: 3,
  plazoVenceAt: "2026-09-04T14:00:00.000Z",
  aceptadoImplicito: false,
  aceptado: true,
  aceptadoExplicito: true,
  aceptadoAt: "2026-09-02T09:30:00.000Z",
  excusaPendiente: false,
  tieneImpugnacion: false,
  estadoTramite: "Providencia de inicio de ejecución",
  estadoTramiteAt: "2026-09-03T11:15:00.000Z",
  administrado: "Comercial Ficticia del Valle S.A.",
  cedula: "0000000000",
  multaImpuesta: 470,
  resolucionNumero: "GADDMQ-AMC-DMR-2026-0470-R",
  resolucionFecha: "2026-08-20T00:00:00.000Z",

  // ── Los ONCE del Plan 03, ya declarados por el servicio (Plan 10) ───────────────────────────
  //
  // `caseId` viene POBLADO en el caso base a propósito: el caso base es el expediente COMPLETO, y
  // de él se espera la línea de tiempo entera. Quien pruebe la degradación pide el ayudante que la
  // nombra (`crearMiEpasAsignadoSinCaseId`), en vez de borrar el campo a mano y dejar a la
  // siguiente lectura preguntándose si la ausencia era el caso probado o un descuido.
  //
  // El administrado es JURÍDICO —tiene `admiBusinessName`—, coherente con `administrado`: la ficha
  // identifica por razón social cuando la hay, y un caso base que se contradijera consigo mismo
  // haría pasar pruebas por la rama equivocada sin que nadie lo notara.
  caseId: 8801,
  admiName: "Gabriela Ficticia",
  admiLastname: "Pérez Inventada",
  admiTelephone: "0990000000",
  admiBusinessName: "Comercial Ficticia del Valle S.A.",
  admiAddress: "Av. Inventada N00-00 y Calle Ficticia",
  admiEmail: "correo.ficticio@ejemplo.invalid",
  expZone: "Eugenio Espejo",
  expCreatedAt: "2026-08-25T00:00:00.000Z",
  expFojas: 42,
  expMedidaCautelar: "Clausura temporal del establecimiento",

  // Quick 261104-jh1: la materia y la submateria de SORTEO que el servidor resolvió por la submateria
  // de las infracciones del EPAS (LUAE = 54, de LICENCIAMIENTO = 26) y el bloque `infracciones`
  // (D-16), coherente con ellas. Ya no hay id de materia
  // del expediente ni submateria del reparto: el contrato los retiró. `subId` (17) sigue siendo el id
  // CRUDO de Asignaciones y no tiene nada que ver con estas dos.
  expMateria: "LICENCIAMIENTO",
  expSubmateria: "LUAE",
  infracciones: {
    codigos: ["LIC-LU-X-124-1947A-02"],
    materiaIds: [26],
    submateriaIds: [54],
    sinMateria: false,
    estadoCore: "LEIDO",
    conflicto: false,
    descuadre: false,
  },
};

/**
 * La factoría. Devuelve el caso base y deja sobreescribir cualquier campo.
 *
 * Los `overrides` se aplican ENCIMA, no al lado: una prueba que quiera un expediente sin aceptar
 * escribe `crearMiEpasAsignado({ aceptado: false })` y hereda el resto coherente. Pasar
 * `undefined` explícito en una clave la borra del objeto resultante sólo en apariencia (queda
 * presente con valor `undefined`), que es exactamente lo que el DTO opcional significa.
 */
export const crearMiEpasAsignado = (
  overrides: Partial<MiEpasAsignado> = {},
): MiEpasAsignado => ({ ...MI_EPAS_ACEPTADO, ...overrides });

/**
 * EL CASO QUE LA BANDEJA EXISTE PARA PEDIR: sorteado y **todavía sin aceptar**, con el plazo vivo.
 *
 * 🔴 Aquí las fechas SÍ son relativas a hoy, y por el motivo contrario al del caso base: lo que esta
 * fila representa es «quedan seis días», y eso sólo es cierto si se mide contra el reloj de quien
 * corre la prueba. Un `plazoVenceAt` constante en el pasado convertiría este fixture, con el tiempo,
 * en un caso vencido —que es justo el otro caso— sin que nadie tocara una línea.
 *
 * Seis días y no uno: es el margen en que el chip de plazo todavía no avisa, así que quien pruebe el
 * aviso tiene que pedirlo explícitamente (`{ plazoVenceAt: ... }`) en vez de heredarlo por descuido.
 */
export const crearMiEpasAsignadoPendiente = (
  overrides: Partial<MiEpasAsignado> = {},
): MiEpasAsignado => {
  const ahora = Date.now();

  return crearMiEpasAsignado({
    eejeId: 4102,
    eejeStatus: "SORTEADO",
    expNumber: "EPAS-2026-04102",
    cassId: 55002,
    sorteoAt: new Date(ahora - UN_DIA_MS).toISOString(),
    plazoDias: 7,
    plazoVenceAt: new Date(ahora + 6 * UN_DIA_MS).toISOString(),
    aceptado: false,
    aceptadoExplicito: false,
    aceptadoImplicito: false,
    aceptadoAt: undefined,
    estadoTramite: undefined,
    estadoTramiteAt: undefined,
    ...overrides,
  });
};

/**
 * EL CASO MAYORITARIO DE LA BASE DE HOY: un reflejo **sin `caseId`**.
 *
 * 🔴 No es un caso raro ni un borde: medido contra `EjecucionDB` el 2026-09-21, **63 de los 72**
 * reflejos no tienen `case_id` —sólo lo traen los nueve del 21-09 (`eeje_id` 46, 47, 49-55)—, porque
 * la columna es posterior a casi toda la siembra. Un expediente así conserva ENTERA su bitácora
 * interna y pierde sólo la traza de Asignaciones: quién lo tuvo antes, quién se excusó.
 *
 * Existe con nombre propio para que la degradación se pida, no se improvise. Construirla a mano
 * (`crearMiEpasAsignado({ caseId: undefined })`) funciona igual de bien y dice la mitad: el lector
 * de la prueba no sabe si esa ausencia ES el caso que se prueba o el descuido de quien lo escribió.
 * Lo usan los Planes 09 y 17 para fijar que la línea de tiempo lo DICE en vez de ocultar la fila.
 */
export const crearMiEpasAsignadoSinCaseId = (
  overrides: Partial<MiEpasAsignado> = {},
): MiEpasAsignado =>
  crearMiEpasAsignado({
    eejeId: 4103,
    expNumber: "EPAS-2026-04103",
    cassId: 55003,
    caseId: undefined,
    ...overrides,
  });

/**
 * EL CASO CON LAS DOS ÓRDENES DE PAGO YA REGISTRADAS (Fase 03.22, D-06): la multa `REGISTRADA` y el
 * remanente `PAGADA`, con la marca de escritura en verdadero.
 *
 * 🔴 EL CASO BASE **NO** GANA EL BLOQUE POR DEFECTO, por la misma razón por la que no gana
 * `obligacionHacer`: el tipo distingue «se miró y no hay orden» (bloque presente, mitades ausentes)
 * de «esta respuesta no lo trae» (bloque ausente), y el caso normal de la bandeja es un expediente
 * SIN órdenes — medido, 1 de 157 tiene orden de multa vigente. Quien pruebe las ramas de la orden
 * pide este ayudante y dice así, en su propia prueba, que ese expediente sí las lleva.
 *
 * Las dos en el mismo expediente y con estados DISTINTOS a propósito: es lo que permite fijar los
 * dos badges en un solo montaje sin que una prueba herede el estado de la otra.
 *
 * 🔴 Números INVENTADOS (T-03.19-01): `SAO-2026-…` es un formato plausible y ficticio. Prohibido
 * copiar filas de EjecucionDB a un fixture versionado.
 */
export const crearMiEpasAsignadoConOrdenes = (
  overrides: Partial<MiEpasAsignado> = {},
): MiEpasAsignado =>
  crearMiEpasAsignado({
    ordenes: {
      multa: {
        ordpId: 7001,
        tipo: "MULTA",
        numero: "SAO-2026-0001",
        estado: "REGISTRADA",
        registradaAt: "2026-09-10T15:00:00.000Z",
        registradaBy: 6389,
      },
      remanente: {
        ordpId: 7002,
        tipo: "REMANENTE",
        numero: "SAO-2026-0002",
        estado: "PAGADA",
        registradaAt: "2026-09-11T15:00:00.000Z",
        registradaBy: 6389,
      },
      editable: true,
    },
    ...overrides,
  });
