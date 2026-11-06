/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: La campana lleva al expediente (quick 261030-m29, D-CANAL)
 * Archivo: AlertList.test.tsx
 * Responsabilidad: Fijar el clic en una alerta del panel: sale del panel (contexto real), se marca
 *   leída en el servidor y lleva a su ruta solo si es interna; una marca fallida no bloquea el
 *   camino; «Ver más» lleva a Avisos; y el vacío se pinta sin enrutador.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 */
import { useEffect } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { IAlert } from "../../interfaces/IAlert";

const mocks = vi.hoisted(() => ({
  markAsRead: vi.fn(),
  getUnreadAlerts: vi.fn(),
}));

vi.mock("../../services/AlertService", () => ({
  AlertService: {
    markAsRead: mocks.markAsRead,
    getUnreadAlerts: mocks.getUnreadAlerts,
  },
}));

import { AlertProvider } from "../../context/AlertContext";
import { useAlerts } from "../../hooks/useAlerts";
import AlertList from "./AlertList";

const alerta = (sobrescribir: Partial<IAlert> = {}): IAlert => ({
  ualeId: 11,
  ualeRead: false,
  ualeReadAt: null,
  aresCreatedAt: new Date("2026-10-30T10:00:00Z"),
  aresTitle: "La orden de pago vence hoy",
  aresMessage: "Expediente 0001-2026: registre la orden de pago.",
  aresPriority: "alta",
  elapsedTime: "hace 5 minutos",
  eejeId: 5,
  aresTipo: "orden_pago.plazo_vence_hoy",
  aresRuta: "/home/mis-asignados?eeje=5&exp=0001-2026",
  ...sobrescribir,
});

/** Siembra el contexto real y pinta la campana con lo que hay en él, como hace el Navbar. */
function Campana({
  iniciales,
  total,
}: {
  iniciales: IAlert[];
  total?: number;
}) {
  const { alerts, totalAlerts, setAlerts, setTotalAlerts } = useAlerts();

  useEffect(() => {
    setAlerts(iniciales);
    setTotalAlerts(total ?? iniciales.length);
  }, [iniciales, total, setAlerts, setTotalAlerts]);

  return (
    <>
      <p>Pendientes: {totalAlerts}</p>
      <ul>
        <AlertList items={alerts} />
      </ul>
    </>
  );
}

/** Enseña la ruta actual para aseverar la navegación. */
function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="ubicacion">{`${pathname}${search}`}</p>;
}

const montar = (iniciales: IAlert[], total?: number) =>
  render(
    <MemoryRouter initialEntries={["/home/dashboard"]}>
      <AlertProvider>
        <Campana
          iniciales={iniciales}
          total={total}
        />
        <Routes>
          <Route
            path="*"
            element={<Ubicacion />}
          />
        </Routes>
      </AlertProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markAsRead.mockResolvedValue(undefined);
});

describe("AlertList — pulsar una alerta", () => {
  it("la quita del panel, la marca leída y navega a su expediente", async () => {
    const otra = alerta({ ualeId: 12, aresTitle: "Otra alerta" });
    montar([alerta(), otra]);

    fireEvent.click(
      await screen.findByRole("button", { name: /La orden de pago vence hoy/ }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("ubicacion")).toHaveTextContent(
        "/home/mis-asignados?eeje=5&exp=0001-2026",
      ),
    );
    expect(mocks.markAsRead).toHaveBeenCalledWith(11);
    expect(
      screen.queryByRole("button", { name: /La orden de pago vence hoy/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Otra alerta/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pendientes: 1")).toBeInTheDocument();
  });

  it("con una ruta que no es interna la marca leída y NO navega", async () => {
    montar([alerta({ aresRuta: "https://evil.example/x" })]);

    fireEvent.click(
      await screen.findByRole("button", { name: /La orden de pago vence hoy/ }),
    );

    await waitFor(() => expect(mocks.markAsRead).toHaveBeenCalledWith(11));
    expect(screen.getByTestId("ubicacion")).toHaveTextContent(
      "/home/dashboard",
    );
    expect(screen.getByText("Pendientes: 0")).toBeInTheDocument();
  });

  it("si la marca falla, avisa solo en consola y navega igual", async () => {
    mocks.markAsRead.mockRejectedValue(new Error("500"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    montar([alerta()]);

    fireEvent.click(
      await screen.findByRole("button", { name: /La orden de pago vence hoy/ }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("ubicacion")).toHaveTextContent(
        "/home/mis-asignados?eeje=5&exp=0001-2026",
      ),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("«Ver más» lleva a Avisos", async () => {
    montar([alerta()]);

    fireEvent.click(await screen.findByRole("link", { name: "Ver más" }));

    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/home/alerts");
  });
});

describe("AlertList — no leídas fuera del panel (WR-05)", () => {
  it("si quedaban no leídas fuera del panel, tras marcarla recarga la página: no queda vacío con la insignia en positivo", async () => {
    // El panel enseña 1 de 2 no leídas; la otra llega al recargar.
    const siguiente = alerta({ ualeId: 13, aresTitle: "La siguiente" });
    mocks.getUnreadAlerts.mockResolvedValue({
      alerts: [siguiente],
      totalAlerts: 1,
    });
    montar([alerta({ aresRuta: null })], 2);

    fireEvent.click(
      await screen.findByRole("button", { name: /La orden de pago vence hoy/ }),
    );

    expect(
      await screen.findByRole("button", { name: /La siguiente/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sin notificaciones nuevas")).toBeNull();
    expect(screen.getByText("Pendientes: 1")).toBeInTheDocument();
    expect(mocks.getUnreadAlerts).toHaveBeenCalledTimes(1);
    // Primero la marca y después la recarga: si no, la recién leída volvería.
    expect(mocks.markAsRead.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getUnreadAlerts.mock.invocationCallOrder[0],
    );
  });

  it("si todas las no leídas estaban en el panel, no recarga", async () => {
    montar([alerta({ aresRuta: null })]);

    fireEvent.click(
      await screen.findByRole("button", { name: /La orden de pago vence hoy/ }),
    );

    await waitFor(() => expect(mocks.markAsRead).toHaveBeenCalledWith(11));
    expect(mocks.getUnreadAlerts).not.toHaveBeenCalled();
  });

  it("si la marca falla no recarga (la alerta volvería) y si la recarga falla solo avisa en consola", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.markAsRead.mockRejectedValueOnce(new Error("500"));
    montar([alerta({ aresRuta: null })], 3);

    fireEvent.click(
      await screen.findByRole("button", { name: /La orden de pago vence hoy/ }),
    );
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(mocks.getUnreadAlerts).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("AlertList — accesibilidad (IN-09)", () => {
  it("sin div dentro del botón, sin la papelera que no hacía nada y con lo que hace el clic en texto", async () => {
    montar([alerta(), alerta({ ualeId: 12, aresTitle: "Sin ruta", aresRuta: null })]);

    const conRuta = await screen.findByRole("button", {
      name: /La orden de pago vence hoy/,
    });
    expect(conRuta.querySelector("div")).toBeNull();
    expect(conRuta).toHaveTextContent("Abre el expediente y la marca como leída.");
    expect(
      screen.getByRole("button", { name: /Sin ruta/ }),
    ).toHaveTextContent("La marca como leída.");
    // Solo quedan los botones de las alertas: la papelera sin función ya no está.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("AlertList — vacío", () => {
  it("sin alertas dice que no hay nuevas, incluso fuera de un enrutador", () => {
    render(<AlertList items={[]} />);

    expect(screen.getByText("Sin notificaciones nuevas")).toBeInTheDocument();
  });
});
