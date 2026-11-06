/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: La línea de tiempo del expediente, re-apuntada a los endpoints vivos (D-07/D-08) y
 *   ampliada con el historial de órdenes de pago (Fase 03.22)
 * Archivo: ModalTimeline.test.tsx
 * Responsabilidad: Fijar que este modal **dice la verdad cuando solo tiene media historia**, que es
 *   su estado NORMAL y no el excepcional.
 *
 *   ── LO QUE SE PRUEBA DE VERDAD ───────────────────────────────────────────────────────────────
 *   · Que las dos trazas salen INTERCALADAS por fecha y cada evento lleva su etiqueta de origen en
 *     TEXTO. Dos sistemas distintos cuentan la vida del mismo expediente: sin la etiqueta, un hecho
 *     de Asignaciones se leería como escrito por este módulo.
 *   · 🔴 Que SIN `caseId` la petición a Asignaciones NI SIQUIERA SE DISPARA, y el modal explica por
 *     qué falta esa mitad. Medido el 2026-09-21: 63 de 72 reflejos están así. Pegarle a la ruta con
 *     un valor no definido sería un 400 disfrazado de «no hay historial».
 *   · Que un FALLO PARCIAL nunca deja el modal en blanco: la mitad que llegó se enseña, con su
 *     aviso y su «Reintentar». Vale en las dos direcciones.
 *   · Que un asiento SIN ACTOR pinta «Sistema» y que un hito SIN DIFF se pinta igual, sin caja de
 *     cambios vacía. Ninguno de los dos se prueba solo: de las 404 filas reales de la bitácora,
 *     NINGUNA tiene el actor vacío —hay que forzarlo aquí— y las que no traen diff (la constatación
 *     del incumplimiento, la orden de sustitutoria) reventarían una interfaz que dé el diff por
 *     hecho.
 *
 *   ── EL TERCER ORIGEN (Fase 03.22, D-07) ──────────────────────────────────────────────────────
 *   · Que el historial de órdenes se pida SIEMPRE, sin guarda y sin ternario, aunque el expediente
 *     no tenga ninguna orden. Condicionarlo a «la fila tiene orden vigente» escondería justo el
 *     caso que D-07 quiere iluminar: las ANULADAS no se ven en la fila y solo salen aquí.
 *   · Que una orden anulada cuente sus DOS hechos con el motivo literal, y que queden intercalados.
 *   · Que un fallo del tercer origen degrade con aviso y NO tumbe la traza normativa interna.
 *   · Que el expediente SIN ninguna orden —156 de 157— no pinte nada relativo a órdenes.
 *   · C4: que el marcador de origen sea legible. La aserción es sobre un `span` ÚNICO, así que
 *     vale para los TRES orígenes a la vez.
 *
 *   El copy de los cinco estados degradados es el del UI-SPEC §5.3, literal: si alguien lo cambia
 *   en la pantalla sin cambiarlo en el contrato, estas pruebas lo dicen.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 03 — D-07 y C4)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 20 — G-04: la nota antes del sorteo;
 *   A12: la devolución del foco)
 * Modificado por: Andrés Miño — 2026-11-06 (quick 261106-ft7: la aprobación del director y su fecha legible)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ModalTimeline } from "./ModalTimeline";
import type { TimelineEvent } from "../../interfaces/ICase";
import type { OrdenPago } from "../../services/OrdenPagoService";
import type { HistorialCasoEntry } from "../../services/SorteoService";
import { DatetimeUtil } from "../../utils/datetime.util";

const mocks = vi.hoisted(() => ({
  bitacora: vi.fn(),
  historialCaso: vi.fn(),
  historialOrdenes: vi.fn(),
}));

vi.mock("../../services/EpasService", () => ({
  EpasService: { bitacora: mocks.bitacora },
  default: { bitacora: mocks.bitacora },
}));

vi.mock("../../services/SorteoService", () => ({
  SorteoService: { historialCaso: mocks.historialCaso },
}));

vi.mock("../../services/OrdenPagoService", () => ({
  OrdenPagoService: { historial: mocks.historialOrdenes },
  default: { historial: mocks.historialOrdenes },
}));

/** Copy exacto del UI-SPEC §5.3. Está aquí arriba para que se lea como el contrato que es. */
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
 * LA TRAZA INTERNA. Dos hechos con actor y uno sin él: el expediente se verificó, se asignó, y más
 * tarde el módulo constató por su cuenta que el correctivo no se cumplió —un acto sin persona
 * detrás y sin ningún campo que enseñar como cambiado—.
 */
const TRAZA_INTERNA: TimelineEvent[] = [
  {
    logId: 115,
    logCreatedAt: "2026-09-18T16:00:00.000Z",
    logUserId: 4,
    usuFullName: "Andrés Decisor",
    logTableName: "t_expediente_ejecucion",
    logRecordId: 105,
    logEvent: "EPAS verificado",
    logEventCodigo: "EPAS_VERIFICADO",
    cambios: [
      { campo: "Estado del EPAS", antes: "RECIBIDO", despues: "VERIFICADO" },
    ],
  },
  {
    logId: 121,
    logCreatedAt: "2026-09-20T09:00:00.000Z",
    logTableName: "t_expediente_ejecucion",
    logRecordId: 105,
    logEvent: "Se constató el incumplimiento del correctivo",
    logEventCodigo: "HACER_INCUMPLIMIENTO_CONSTATADO",
    // Ni `usuFullName` ni `cambios`: los dos casos que no se prueban solos.
  },
];

/** LA TRAZA DE ASIGNACIONES: una entrada, dos fechas — el caso se asignó y luego se liberó. */
const HISTORIAL: HistorialCasoEntry[] = [
  {
    historyOrder: 1,
    id: 7001,
    caseId: 3300,
    assignmentMasterId: 9001,
    userId: 6389,
    assignmentStatusName: "Asignado",
    assignedAt: "2026-09-18T17:00:00.000Z",
    unassignedAt: "2026-09-19T10:00:00.000Z",
    reason: "Conflicto de intereses",
  },
];

/** El expediente con las dos identidades resueltas: es el caso de 9 de los 72 reflejos de hoy. */
const CON_CASE_ID = { eejeId: 105, caseId: 3300, expNumber: "EPAS-2026-00105" };

/** El expediente SIN identidad en Asignaciones: hoy, 63 de 72. */
const SIN_CASE_ID = { eejeId: 105, expNumber: "EPAS-2026-00105" };

describe("ModalTimeline — la línea de tiempo re-apuntada (D-07/D-08)", () => {
  beforeEach(() => {
    mocks.bitacora.mockReset().mockResolvedValue(TRAZA_INTERNA);
    mocks.historialCaso.mockReset().mockResolvedValue(HISTORIAL);
    // 🔴 El expediente SIN ninguna orden es el caso de 156 de 157: ése es el valor por defecto, y
    // por eso las pruebas de la 03.19 siguen contando exactamente los mismos eventos que contaban.
    mocks.historialOrdenes.mockReset().mockResolvedValue([]);
  });

  it("las dos trazas salen intercaladas y cada evento dice de dónde viene", async () => {
    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");
    expect(mocks.bitacora).toHaveBeenCalledWith(105);
    expect(mocks.historialCaso).toHaveBeenCalledWith(3300);

    const eventos = screen.getAllByRole("listitem");
    expect(eventos).toHaveLength(4);

    // Lo más nuevo ARRIBA (quick 261106-tlo): incumplimiento constatado (20-09) → liberado (19-09) →
    // asignado en Asignaciones (18-09 17:00) → verificado (18-09 16:00).
    expect(eventos[0]).toHaveTextContent(
      "Se constató el incumplimiento del correctivo",
    );
    expect(eventos[1]).toHaveTextContent("Liberado del decisor");
    expect(eventos[2]).toHaveTextContent("Asignado al decisor");
    expect(eventos[3]).toHaveTextContent("EPAS verificado");

    // 🔴 El origen va en TEXTO, no solo en el color ni en el icono.
    expect(screen.getAllByText("Módulo de Ejecución")).toHaveLength(2);
    expect(screen.getAllByText("Asignaciones")).toHaveLength(2);

    // Las dos respondieron: no hay ningún aviso de mitad ausente.
    expect(screen.queryByText(COPY.sinCaseId)).not.toBeInTheDocument();
    expect(screen.queryByText(COPY.fallaAsignaciones)).not.toBeInTheDocument();
  });

  it("🔴 sin caseId NO se dispara la petición a Asignaciones, y se dice por qué", async () => {
    render(<ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />);

    expect(await screen.findByText(COPY.sinCaseId)).toBeInTheDocument();
    expect(mocks.historialCaso).not.toHaveBeenCalled();

    // La traza interna se enseña entera: el aviso acompaña a la lista, no la sustituye.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Asignaciones")).not.toBeInTheDocument();
  });

  it("si Asignaciones falla, la traza interna se sigue viendo con su aviso", async () => {
    mocks.historialCaso.mockRejectedValue(new Error("502 Bad Gateway"));

    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    expect(await screen.findByText(COPY.fallaAsignaciones)).toBeInTheDocument();
    // 🔴 Fallo parcial ⇒ NUNCA modal en blanco.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("EPAS verificado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("si la traza interna falla, lo que sí llegó de Asignaciones se enseña igualmente", async () => {
    mocks.bitacora.mockRejectedValue(new Error("500"));

    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    expect(await screen.findByText(COPY.fallaInterna)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Asignado al decisor")).toBeInTheDocument();
  });

  it("un asiento sin actor pinta «Sistema», y un hito sin diff no pinta caja de cambios", async () => {
    render(<ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");

    // Actor ausente ⇒ «Sistema». Nunca vacío, nunca el literal de un valor no definido.
    expect(screen.getByText("Actor: Sistema")).toBeInTheDocument();
    expect(screen.getByText("Actor: Andrés Decisor")).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();

    // 🔴 El hito sin diff SE PINTA, y la caja de cambios solo aparece una vez: la del asiento que sí
    // cambió algo. Hoy se montaba siempre, dejando una caja vacía por evento.
    expect(
      screen.getByText("Se constató el incumplimiento del correctivo"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Cambios realizados")).toHaveLength(1);
  });

  it("quick 261106-ft7: la aprobación del director se lista y su fecha se lee legible, no en ISO", async () => {
    mocks.bitacora.mockResolvedValue([
      {
        logId: 130,
        logCreatedAt: "2026-11-06T14:30:00.000Z",
        logUserId: 254,
        usuFullName: "Directora de Ejecución",
        logTableName: "t_expediente_ejecucion",
        logRecordId: 105,
        logEvent: "Aprobado por el director y remitido al secretario",
        logEventCodigo: "APROBADO_POR_DIRECTOR",
        cambios: [
          {
            campo: "Remitido por el director el",
            antes: "",
            despues: "2026-11-06T14:30:00.000Z",
          },
        ],
      },
    ]);

    render(<ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />);

    expect(
      await screen.findByText(
        "Aprobado por el director y remitido al secretario",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("2026-11-06T14:30:00.000Z")).toBeNull();
    expect(
      screen.getByText(
        DatetimeUtil.formatFechaHoraCorta("2026-11-06T14:30:00.000Z"),
      ),
    ).toBeInTheDocument();
  });

  it("cuando ninguna de las dos trae eventos, el vacío lo dice con su copy", async () => {
    mocks.bitacora.mockResolvedValue([]);
    mocks.historialCaso.mockResolvedValue([]);

    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    expect(await screen.findByText(COPY.sinEventos)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryAllByRole("listitem")).toHaveLength(0),
    );
  });

  it("la cabecera dice DE QUÉ expediente habla", async () => {
    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    // Hoy el kicker es el literal «Expediente» y no dice de cuál: con el número, el modal se puede
    // citar. Sin él, una captura de pantalla de la traza no prueba nada.
    expect(
      await screen.findByText("Expediente EPAS-2026-00105"),
    ).toBeInTheDocument();
  });
});

/**
 * EL HISTORIAL DE ÓRDENES DE PAGO (Fase 03.22, D-07). Una sola orden que se registró y LUEGO SE
 * ANULÓ: es el caso que la fila de la bandeja no puede enseñar —allí solo se ve la vigente— y el
 * único que explica por qué un expediente tuvo dos números. Datos inventados (T-03.19-01).
 */
const ORDENES: OrdenPago[] = [
  {
    ordpId: 4101,
    eejeId: 105,
    tipo: "MULTA",
    numero: "SAO-2026-0041",
    estado: "REGISTRADA",
    registradaAt: "2026-09-18T19:00:00.000Z",
    registradaBy: 4,
    registradaPor: "Andrés Decisor",
    anuladaAt: "2026-09-19T11:00:00.000Z",
    anuladaBy: 4,
    anuladaMotivo:
      "Se emitió con el valor del remanente en lugar del de la multa",
  },
];

describe("ModalTimeline — el TERCER origen: las órdenes de pago (Fase 03.22, D-07)", () => {
  beforeEach(() => {
    mocks.bitacora.mockReset().mockResolvedValue(TRAZA_INTERNA);
    mocks.historialCaso.mockReset().mockResolvedValue(HISTORIAL);
    mocks.historialOrdenes.mockReset().mockResolvedValue([]);
  });

  it("🔴 el historial de órdenes se pide SIEMPRE, aunque el expediente no tenga orden vigente", async () => {
    // El historial devuelve vacío: este expediente no tiene ninguna orden, ni viva ni anulada. Aun
    // así la petición se hace. Condicionarla a «la fila tiene orden vigente» escondería justo el
    // caso que D-07 quiere iluminar, porque las ANULADAS no aparecen en la fila.
    render(<ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");
    expect(mocks.historialOrdenes).toHaveBeenCalledWith(105);
    expect(mocks.historialOrdenes).toHaveBeenCalledTimes(1);
  });

  it("un expediente SIN ninguna orden no pinta nada relativo a órdenes", async () => {
    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");

    // Ni evento, ni aviso, ni un «sin órdenes»: es el estado de 156 de 157 expedientes, y un aviso
    // por expediente sería ruido que no informa.
    expect(screen.queryByText("Órdenes de pago")).not.toBeInTheDocument();
    expect(screen.queryByText(COPY.fallaOrdenes)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("🔴 una orden anulada cuenta sus DOS hechos, con el motivo y con su etiqueta de origen", async () => {
    mocks.historialOrdenes.mockResolvedValue(ORDENES);

    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    await screen.findByText(
      "Orden de pago (multa) registrada — N.º SAO-2026-0041",
    );
    expect(
      screen.getByText("Orden de pago (multa) anulada — N.º SAO-2026-0041"),
    ).toBeInTheDocument();

    // El motivo va LITERAL, sin prefijo ni comillas añadidas: la traza lo cita, no lo glosa.
    expect(
      screen.getByText(
        "Se emitió con el valor del remanente en lugar del de la multa",
      ),
    ).toBeInTheDocument();

    // 🔴 El origen se anuncia con ETIQUETA DE TEXTO, no solo con icono y color — una por evento.
    expect(screen.getAllByText("Órdenes de pago")).toHaveLength(2);

    // 🔴 Y quedan INTERCALADOS por fecha, no agrupados al final: el registro (18-09 19:00) cae
    // ANTES de la liberación de Asignaciones (19-09 10:00) y la anulación (19-09 11:00) DESPUÉS de
    // ella. Son los 4 eventos de siempre más los 2 de la orden, con lo más nuevo arriba.
    const eventos = screen.getAllByRole("listitem");
    expect(eventos).toHaveLength(6);
    expect(eventos[3]).toHaveTextContent(
      "Orden de pago (multa) registrada — N.º SAO-2026-0041",
    );
    expect(eventos[2]).toHaveTextContent("Liberado del decisor");
    expect(eventos[1]).toHaveTextContent(
      "Orden de pago (multa) anulada — N.º SAO-2026-0041",
    );

    // La anulación se firma «Sistema»: el historial no trae el nombre de quien anula.
    expect(eventos[1]).toHaveTextContent("Actor: Sistema");
    expect(eventos[3]).toHaveTextContent("Actor: Andrés Decisor");
  });

  it("🔴 si el historial de órdenes falla, las otras dos trazas se siguen viendo", async () => {
    mocks.historialOrdenes.mockRejectedValue(
      new Error("503 Service Unavailable"),
    );

    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    expect(await screen.findByText(COPY.fallaOrdenes)).toBeInTheDocument();

    // 🔴 NUNCA modal en blanco, y NUNCA se deja caer la traza normativa interna del art. 82 CRE
    // por un fallo del tercer origen: la lista se enseña igual con lo que sí llegó.
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("EPAS verificado")).toBeInTheDocument();
    expect(screen.getByText("Asignado al decisor")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();

    // Y el vacío honesto no se afirma: con una fuente caída, «no hay movimientos» sería mentira.
    expect(screen.queryByText(COPY.sinEventos)).not.toBeInTheDocument();
  });

  it("🔴 C4 — el marcador de origen es legible: tamaño pequeño y sin modificador de color", async () => {
    render(<ModalTimeline caseData={CON_CASE_ID} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");

    // El `span` es ÚNICO en el JSX y su texto lo resuelve el mapa de etiquetas: esta aserción
    // vale para los TRES orígenes a la vez. Con el modificador informativo medía ~2,3:1 en tema
    // claro —falla AA con cualquier espacio de color— y a 10px estaba fuera de la escala declarada.
    const marcador = screen.getAllByText("Módulo de Ejecución")[0];
    expect(marcador.className).toBe("badge badge-soft badge-sm");
    expect(marcador.className).not.toContain("badge-xs");
    expect(marcador.className).not.toContain("badge-info");
  });
});

/**
 * ANTES DEL SORTEO (Fase 03.24, Plan 20 — G-04). Desde la Bandeja de Entrada no viaja `caseId`, y
 * con el expediente todavía sin sortear eso NO es una carencia: no hay identificador de asignación
 * que resolver. El aviso azul de «sin identificador» sería falso aquí; se enseña una nota neutra.
 */
describe("ModalTimeline — antes del sorteo (Fase 03.24, Plan 20, G-04)", () => {
  const ANTES_DEL_SORTEO = {
    eejeId: 5,
    expNumber: "STUB-5-2026",
    momento: "antesDelSorteo" as const,
  };

  beforeEach(() => {
    mocks.bitacora.mockReset().mockResolvedValue(TRAZA_INTERNA);
    mocks.historialCaso.mockReset().mockResolvedValue(HISTORIAL);
    mocks.historialOrdenes.mockReset().mockResolvedValue([]);
  });

  it("🔴 con momento «antesDelSorteo» NO enseña el aviso de «sin identificador»", async () => {
    render(<ModalTimeline caseData={ANTES_DEL_SORTEO} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");
    expect(screen.queryByText(COPY.sinCaseId)).not.toBeInTheDocument();
  });

  it("antes del sorteo no pinta ninguna nota ni aviso: solo los movimientos (pedido del usuario, 2026-10-21)", async () => {
    render(<ModalTimeline caseData={ANTES_DEL_SORTEO} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");
    expect(
      screen.queryByText(/todavía no ha pasado por el sorteo/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Sin «Reintentar»: no es una avería.
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("la bitácora se pide igual, y Asignaciones no", async () => {
    render(<ModalTimeline caseData={ANTES_DEL_SORTEO} onClose={vi.fn()} />);

    await screen.findByText("EPAS verificado");
    expect(mocks.bitacora).toHaveBeenCalledWith(5);
    expect(mocks.historialCaso).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("sin momento y sin caseId sigue el aviso de siempre (como en «Mis expedientes»)", async () => {
    render(<ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />);

    expect(await screen.findByText(COPY.sinCaseId)).toBeInTheDocument();
  });
});

/**
 * A12 del 03.19 — al cerrar la línea de tiempo, el foco vuelve a quien la abrió (el `⑂` de la
 * fila). Sin esto, cerrar con el teclado deja el foco en el `<body>`.
 */
describe("ModalTimeline — devolución del foco (A12)", () => {
  beforeEach(() => {
    mocks.bitacora.mockReset().mockResolvedValue(TRAZA_INTERNA);
    mocks.historialCaso.mockReset().mockResolvedValue(HISTORIAL);
    mocks.historialOrdenes.mockReset().mockResolvedValue([]);
  });

  it("al desmontar, el foco vuelve al elemento activo al montar", async () => {
    const disparador = document.createElement("button");
    disparador.textContent = "Línea de tiempo de EPAS-2026-00105";
    document.body.appendChild(disparador);
    disparador.focus();
    expect(document.activeElement).toBe(disparador);

    const { unmount } = render(
      <ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />,
    );
    await screen.findByText("EPAS verificado");
    screen
      .getByRole("button", { name: "Cerrar modal de línea de tiempo" })
      .focus();
    expect(document.activeElement).not.toBe(disparador);

    unmount();
    expect(document.activeElement).toBe(disparador);
    disparador.remove();
  });

  it("si el disparador ya no está en el documento, no se le intenta devolver el foco", async () => {
    const disparador = document.createElement("button");
    document.body.appendChild(disparador);
    disparador.focus();
    const enfocar = vi.spyOn(disparador, "focus");

    const { unmount } = render(
      <ModalTimeline caseData={SIN_CASE_ID} onClose={vi.fn()} />,
    );
    await screen.findByText("EPAS verificado");
    disparador.remove();

    unmount();
    expect(enfocar).not.toHaveBeenCalled();
  });
});
