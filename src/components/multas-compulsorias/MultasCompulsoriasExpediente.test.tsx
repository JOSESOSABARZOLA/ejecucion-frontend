/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/multas-compulsorias (frontend)
 * Feature: El gate de registro, decidido FUERA (Fase 03.18, Plan 08)
 * Archivo: MultasCompulsoriasExpediente.test.tsx
 * Responsabilidad: Afirmar la sexta conducta del Plan 08: **este componente no decide por su
 *   cuenta** — recibe el permiso y el motivo desde fuera, y cuando el permiso es falso el botón se
 *   ve APAGADO CON SU MOTIVO en vez de desaparecer.
 *
 *   🔴 POR QUÉ IMPORTA QUE NO DESAPAREZCA. Es el criterio de toda la fase (D-7): esconder un botón
 *   deja al funcionario buscando una opción que ayer estaba y sin saber qué haría falta para
 *   recuperarla. Apagado con su motivo, el procedimiento entero sigue a la vista.
 *
 *   🔴 Y POR QUÉ NO DECIDE AQUÍ. Quien decide es el motor de acciones, con la regla del Plan 04 y el
 *   hecho que el backend deriva. Si este componente dedujera el permiso por su cuenta, habría dos
 *   versiones de la misma regla y un día dirían cosas distintas.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo de carga en su hueco con
 *   «Reintentar» y la validación bajo cada campo, sin aviso flotante)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq: la serie se lee «USD 1.250,50» y la
 *   casilla «Valor (USD)» acepta el formato ecuatoriano y rechaza el punto decimal bajo el campo)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { errorDelServidor } from "../../test/errores";

const mocks = vi.hoisted(() => ({
  serie: vi.fn(),
  registrar: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock("../../services/MultaCompulsoriaService", () => ({
  MultaCompulsoriaService: {
    serie: mocks.serie,
    registrar: mocks.registrar,
  },
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

import MultasCompulsoriasExpediente from "./MultasCompulsoriasExpediente";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.serie.mockResolvedValue([]);
});

describe("MultasCompulsoriasExpediente — el permiso viene de fuera", () => {
  it("🔴 con el permiso en FALSO el botón sigue ahí, apagado y con el motivo en el tooltip", async () => {
    render(
      <MultasCompulsoriasExpediente
        eejeId={183}
        permiteRegistrar={false}
        motivoNoRegistrar="Esta acción solo procede si el término de alegación ya venció."
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Multas compulsorias/i)).toBeInTheDocument(),
    );

    const boton = screen.getByRole("button", { name: /Registrar multa/i });
    // PRESENTE: no desaparece. Ése es el criterio de toda la fase.
    expect(boton).toBeInTheDocument();
    expect(boton).toBeDisabled();
    // Y con su porqué, tomado TAL CUAL de quien lo apagó: aquí no se redacta ningún motivo.
    // El título cuelga del envoltorio y no del botón, y no es un descuido: un botón deshabilitado
    // no recibe eventos de puntero, así que su propio tooltip nunca llegaría a mostrarse.
    expect(boton.closest("[title]")?.getAttribute("title") ?? "").toMatch(
      /solo procede si el término de alegación ya venció/i,
    );
  });

  it("con el permiso en VERDADERO el botón se ofrece habilitado y sin motivo que dar", async () => {
    render(<MultasCompulsoriasExpediente eejeId={183} permiteRegistrar />);
    await waitFor(() =>
      expect(screen.getByText(/Multas compulsorias/i)).toBeInTheDocument(),
    );

    const boton = screen.getByRole("button", { name: /Registrar multa/i });
    expect(boton).toBeEnabled();
    // 🔴 HABILITA; NO DISPARA. Un botón encendido no es una orden: la multa la impone una resolución
    // de la DME fuera de esta pantalla, y aquí sólo se REGISTRA lo que esa resolución dice.
    expect(boton.closest("[title]")).toBeNull();
  });
});

describe("MultasCompulsoriasExpediente — dónde se dice cada cosa (quick 261028-kmg)", () => {
  it("🔴 un fallo al cargar se dice en el hueco de la serie, con «Reintentar», sin aviso flotante y sin afirmar que no hay multas", async () => {
    mocks.serie.mockRejectedValueOnce(errorDelServidor("Servicio de multas caído."));
    render(<MultasCompulsoriasExpediente eejeId={183} permiteRegistrar />);

    expect(await screen.findByText("Servicio de multas caído.")).toBeInTheDocument();
    expect(
      screen.queryByText("Este expediente no tiene multas compulsorias registradas."),
    ).toBeNull();
    expect(mocks.addToast).not.toHaveBeenCalled();

    // «Reintentar» vuelve a pedir la serie; con éxito, el hueco enseña lo que hay.
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByText("Este expediente no tiene multas compulsorias registradas."),
    ).toBeInTheDocument();
    expect(mocks.serie).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Servicio de multas caído.")).toBeNull();
  });

  it("🔴 lo que falta del formulario se dice bajo cada campo, con aria-invalid y el foco en el primero, sin aviso flotante; editar lo retira", async () => {
    render(<MultasCompulsoriasExpediente eejeId={183} permiteRegistrar />);
    fireEvent.click(await screen.findByRole("button", { name: /Registrar multa/i }));

    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    const numero = screen.getByPlaceholderText("GADDMQ-AMC-DME-2026-000");
    expect(screen.getByText("Escriba el número de la resolución.")).toBeInTheDocument();
    expect(screen.getByText("Indique la fecha de la resolución.")).toBeInTheDocument();
    expect(screen.getByText("El valor de la multa debe ser mayor que cero.")).toBeInTheDocument();
    expect(screen.getByText("Adjunte el PDF de la resolución.")).toBeInTheDocument();
    expect(numero).toHaveAttribute("aria-invalid", "true");
    expect(numero).toHaveFocus();
    expect(mocks.addToast).not.toHaveBeenCalled();

    fireEvent.change(numero, { target: { value: "GADDMQ-AMC-DME-2026-001" } });
    expect(screen.queryByText("Escriba el número de la resolución.")).toBeNull();
    expect(numero).not.toHaveAttribute("aria-invalid");
  });
});

describe("MultasCompulsoriasExpediente — el valor en formato ecuatoriano (quick 261105-cvq)", () => {
  const FORMATO =
    "Escriba el valor en dólares con coma para los centavos, por ejemplo 1.250,50 (el punto separa los miles).";

  /** Abre el formulario y rellena todo menos el valor. */
  const abrirYRellenar = async () => {
    render(<MultasCompulsoriasExpediente eejeId={183} permiteRegistrar />);
    fireEvent.click(await screen.findByRole("button", { name: /Registrar multa/i }));
    fireEvent.change(screen.getByPlaceholderText("GADDMQ-AMC-DME-2026-000"), {
      target: { value: "GADDMQ-AMC-DME-2026-001" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de la resolución"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Resolución escaneada (PDF)"), {
      target: {
        files: [new File(["%PDF"], "resolucion.pdf", { type: "application/pdf" })],
      },
    });
    return screen.getByLabelText("Valor (USD)");
  };

  it("la serie pinta el valor como «USD 1.250,50»", async () => {
    mocks.serie.mockResolvedValue([
      {
        mcomId: 1,
        eejeId: 183,
        ordinal: 1,
        resolucionNumero: "GADDMQ-AMC-DME-2026-001",
        resolucionFecha: "2026-10-01",
        valor: 1250.5,
        docId: 9,
        registradaAt: "2026-10-02T10:00:00.000Z",
      },
    ]);
    render(<MultasCompulsoriasExpediente eejeId={183} permiteRegistrar />);
    expect(await screen.findByText("USD 1.250,50")).toBeInTheDocument();
  });

  it("🔴 «1250.50» se rechaza bajo el campo con aria-invalid y NO llama al servicio", async () => {
    const valor = await abrirYRellenar();
    // Casilla de texto con teclado decimal: el tipo numérico del navegador no lee bien «1.234,56».
    expect(valor).toHaveAttribute("type", "text");
    expect(valor).toHaveAttribute("inputMode", "decimal");

    fireEvent.change(valor, { target: { value: "1250.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(screen.getByText(FORMATO)).toBeInTheDocument();
    expect(valor).toHaveAttribute("aria-invalid", "true");
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("vacío sigue diciendo que el valor debe ser mayor que cero", async () => {
    await abrirYRellenar();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(
      screen.getByText("El valor de la multa debe ser mayor que cero."),
    ).toBeInTheDocument();
    expect(screen.queryByText(FORMATO)).toBeNull();
  });

  it("con «1.250,50» no hay error en el campo y el servicio recibe 1250.5", async () => {
    mocks.registrar.mockResolvedValue({ mcomId: 5 });
    const valor = await abrirYRellenar();

    fireEvent.change(valor, { target: { value: "1.250,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(mocks.registrar).toHaveBeenCalledTimes(1));
    expect(mocks.registrar).toHaveBeenCalledWith(
      183,
      expect.objectContaining({ valor: 1250.5 }),
      expect.any(File),
    );
    expect(screen.queryByText(FORMATO)).toBeNull();
  });
});
