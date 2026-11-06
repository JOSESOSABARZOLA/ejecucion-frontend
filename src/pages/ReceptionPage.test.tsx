/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/recepción (frontend)
 * Feature: El SECRETARIO conserva «Formas de notificación» en su Bandeja de Recepción (D-05)
 * Archivo: ReceptionPage.test.tsx
 * Responsabilidad: Fijar UNA conducta, y es la que puede apagar el módulo entero sin hacer ruido:
 *   montada como `secretario abogado` sobre un EPAS en `RECIBIDO`, esta bandeja ofrece la entrada
 *   «Formas de notificación».
 *
 *   🔴 QUÉ SE VA A ROMPER Y QUÉ LO IMPIDE. La Fase 03.19 retira «Formas de notificación» del `⋮`
 *   DEL DECISOR (D-05), y el modal tiene DOS puntos de montaje: `MisAsignadosPage` —el del decisor,
 *   el que hay que tocar— y ESTA página, la del secretario, que no se toca. Son dos sitios y una
 *   sola decisión, así que es fácil retirarla de los dos «por coherencia».
 *
 *   Hacerlo dejaría al módulo sin el ÚNICO sitio donde se declaran las formas de notificación. Y las
 *   formas nacen todas en «no»: mientras nadie las declare, cada providencia que se emita crea su
 *   notificación SIN despachos — el acto existe, nadie queda notificado y NINGÚN PLAZO ARRANCA en
 *   NINGÚN expediente (D-12; medido el 2026-08-20: 0 de 17 administrados las tenían). No hay error,
 *   no hay pantalla roja: solo un backend repitiendo «no tiene ninguna forma de notificación
 *   aceptada» en su log mientras los plazos se quedan quietos.
 *
 *   Por eso el archivo trae también un CONTROL con el DIRECTOR: si la entrada apareciera para
 *   cualquier rol, afirmar que aparece para el secretario no probaría nada. La regla que las separa
 *   está escrita en `inboxActionStatusRules.formasNotificacion` (`roles: ["secretario abogado"]`), y
 *   estas dos pruebas son sus dos caras.
 *
 *   La entrada se localiza por su TEXTO VISIBLE, igual que `MenuAccionesCaso.test.tsx` y
 *   `MisAsignadosPage.test.tsx` (Pitfall 8): si alguien renombra la etiqueta, este test cae y se
 *   entera en el mismo commit.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: un fallo al cargar la lista se afirma
 *   en línea y sin aviso flotante)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { errorDelServidor } from "../test/errores";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type {
  EpasListItem,
  ExpedienteGrupo,
  ExpedienteGrupoListResponse,
} from "../services/EpasService";

const mocks = vi.hoisted(() => ({
  getEpasAgrupados: vi.fn(),
  getInboxCases: vi.fn(),
  rolName: { actual: "secretario abogado" },
  addToast: vi.fn(),
  openModal: vi.fn(),
}));

vi.mock("../services/EpasService", () => ({
  EpasService: {
    getEpasAgrupados: mocks.getEpasAgrupados,
    // Los toca `useEpasInboxActions` al EJECUTAR una acción; aquí nadie hace clic, pero el módulo
    // se importa entero y sus referencias tienen que existir.
    approveDirector: vi.fn(),
    approveExpediente: vi.fn(),
    getEpasDocumentos: vi.fn().mockResolvedValue([]),
  },
  default: {},
}));

vi.mock("../services/InboxCasesService", () => ({
  InboxCasesService: {
    getInboxCases: mocks.getInboxCases,
    enviarASorteo: vi.fn(),
    isSeedEnabled: vi.fn().mockResolvedValue(false),
  },
}));

// El modal de formas NO se abre en esta prueba (eso es un acto, y lo que se prueba es que la ENTRADA
// esté ofrecida). Se dobla porque importarlo arrastra su árbol entero, que no tiene nada que ver con
// lo que aquí se afirma.
vi.mock("../components/notificacion/FormasNotificacionModal", () => ({
  default: () => null,
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({
    user: { usuId: 7, rolName: mocks.rolName.actual, actividades: [] },
    sessionState: "authenticated",
  }),
}));
vi.mock("../hooks/useModal", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

import ReceptionPage from "./ReceptionPage";

/** El caso mínimo: un administrado de un expediente, RECIBIDO, que es el estado que la regla exige. */
const caso: EpasListItem = {
  eejeId: 101,
  eejeStatus: "RECIBIDO",
  expId: 55,
  expNumber: "EXP-2026-0001",
  expZone: "Eugenio Espejo",
  admiName: "Marco",
  admiLastname: "Tulio",
  admiIdentification: "1717171717",
  eejeIsLocked: false,
  eejeDirectorApprovedAt: null,
};

const grupo: ExpedienteGrupo = {
  expId: 55,
  expNumber: "EXP-2026-0001",
  expZone: "Eugenio Espejo",
  casos: [caso],
  totalCasos: 1,
};

const respuesta: ExpedienteGrupoListResponse = {
  data: [grupo],
  total: 1,
  limit: 10,
  offset: 0,
  page: 1,
  pages: 1,
};

function montar() {
  return render(
    <MemoryRouter>
      <ReceptionPage />
    </MemoryRouter>,
  );
}

describe("ReceptionPage — el secretario conserva «Formas de notificación» (D-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName.actual = "secretario abogado";
    mocks.getEpasAgrupados.mockResolvedValue(respuesta);
    mocks.getInboxCases.mockResolvedValue([]);
  });

  it("el SECRETARIO ve la entrada sobre un EPAS RECIBIDO", async () => {
    montar();

    // Primero la fila: si el expediente no llegó a pintarse, la ausencia de la entrada no diría nada
    // sobre el gating, solo sobre la carga.
    expect(
      await screen.findByText(/EXP-2026-0001/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Formas de notificación")).toBeInTheDocument();
  });

  it("CONTROL: el DIRECTOR no la ve — la regla es por rol, no por pantalla", async () => {
    mocks.rolName.actual = "director";
    montar();

    expect(
      await screen.findByText(/EXP-2026-0001/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Formas de notificación")).toBeNull();
    });
  });
});

describe("ReceptionPage — un fallo al cargar la lista se dice una vez, en su hueco (quick 261028-kmg)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolName.actual = "secretario abogado";
    mocks.getEpasAgrupados.mockRejectedValue(
      errorDelServidor("La bandeja de recepción no responde."),
    );
    mocks.getInboxCases.mockResolvedValue([]);
  });

  it("el aviso en línea de siempre, sin aviso flotante que lo repita", async () => {
    montar();

    expect(
      await screen.findByText("La bandeja de recepción no responde.", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(mocks.addToast).not.toHaveBeenCalled();
  });
});
