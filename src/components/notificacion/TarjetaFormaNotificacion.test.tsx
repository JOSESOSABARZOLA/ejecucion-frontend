/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La tarjeta de forma de notificación del Gestor (Fase 03.20, Plan 06)
 * Archivo: TarjetaFormaNotificacion.test.tsx
 * Responsabilidad: Fijar los CUATRO estados de la tarjeta, sus motivos y sus rótulos, con las tres
 *   aserciones NEGATIVAS que impiden que vuelvan el literal de intentos, el tamaño ilegal y la fecha
 *   inventada.
 *
 *   ── 🔴 LO QUE ESTE ARCHIVO PROTEGE, EN ORDEN DE LO QUE COSTARÍA PERDERLO ────────────────────
 *   1. 🔴 **Que la tarjeta sin despacho explique el hueco Y ofrezca dónde arreglarlo (D-21).** Es
 *      el caso de **156 de 157** filas: medido el 2026-09-25, un solo administrado de la base tiene
 *      una forma aceptada. Si esto se rompe, la pantalla parece vacía —o rota— y el secretario no
 *      se entera de que hay algo que él puede hacer.
 *   2. 🔴 **Que el interruptor del envío venga del SERVIDOR (D-20 / CH-5).** Un botón encendido en
 *      un entorno donde el envío está apagado ofrece mandar una notificación jurídica que no va a
 *      salir. Por eso las dos variantes se montan las dos, y ninguna prueba deja que el componente
 *      «deduzca» el valor.
 *   3. 🔴 **Que el rótulo de la fecha no mienta.** «Entrega:» sobre la fecha de resolución —que es
 *      cuándo alguien REGISTRÓ el resultado— y «Envío:» sólo sobre la fecha de envío. Sin fecha de
 *      envío, la tarjeta de correo no pinta NINGUNA fecha: reutilizar la de resolución metería una
 *      fecha falsa en un procedimiento sancionador cuyos términos corren desde la notificación.
 *   4. **Que el motivo de un botón apagado sea alcanzable.** Un `<button disabled>` no recibe
 *      eventos de puntero, así que la burbuja tiene que colgar del DIV ENVOLTORIO: por eso el
 *      motivo se busca con el ancestro más cercano que tenga el atributo —`closest('[data-tip]')`—
 *      y no en el botón.
 *
 *   ── 🔴 LO QUE ESTE ARCHIVO NO PUEDE AFIRMAR, Y NO LO INTENTA ────────────────────────────────
 *   **jsdom no calcula CSS.** Nada de color resuelto, contraste, ancho, pliegue ni opacidad
 *   compuesta: aquí se afirman CLASES y ESTRUCTURA, que es lo que una prueba puede demostrar. Las
 *   comprobaciones H1-H8 del contrato de UI —la rejilla de tres, el chip pálido sobre la tarjeta
 *   blanca, el 4,8:1 de la línea meta, que la burbuja no cae sobre la tarjeta siguiente— van al UAT
 *   de la fase, con un par de ojos y en los DOS temas. Fingirlas con una aserción sobre un estilo
 *   calculado sería PEOR que no tenerlas: daría verde sin haber mirado nada.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-28
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, D-09/D-21, UI-SPEC §9: el QUINTO
 *   motivo —el documento requería firma y no la tiene—, que llega del SERVIDOR por fila y gana a
 *   los otros cuatro; con `false` los cuatro de siempre siguen en su orden, y «Registrar» no cambia).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TarjetaFormaNotificacion from "./TarjetaFormaNotificacion";
import type { DespachoGestor } from "../../services/NotificacionEjecucionService";

/** Datos INVENTADOS. Ninguna fila real de la base entra en un fixture. */
const despacho = (parcial: Partial<DespachoGestor> = {}): DespachoGestor => ({
  despId: 501,
  forma: "CASILLERO",
  estado: "pendiente",
  intentos: 0,
  ...parcial,
});

const EXP = "053-2026";

/** Los cuatro motivos, VERBATIM del contrato de UI §2.6 / §5.8. */
const MOTIVO_PAPEL =
  "Registrar la notificación en papel llega en una fase posterior. Hoy el Gestor solo muestra.";
const MOTIVO_ENVIO_APAGADO =
  "El envío de correo está desactivado en este entorno.";
const MOTIVO_VIA_AGOTADA =
  "Vía agotada: ya consta la razón de imposibilidad.";
/** El motivo del despacho bloqueado por firma, VERBATIM de UI-SPEC 03.21 §10.11. */
const MOTIVO_SIN_FIRMA =
  "No se despacha: el documento notificado requería firma y no la tiene. Avise a soporte.";
/** El copy del hueco, VERBATIM de §5.6. */
const FRASE_HUECO = "El administrado no ha declarado esta forma de notificación.";

const montar = (props: Partial<
  React.ComponentProps<typeof TarjetaFormaNotificacion>
> = {}) =>
  render(
    <TarjetaFormaNotificacion
      forma="CASILLERO"
      despachos={[]}
      expNumber={EXP}
      correoEnvioHabilitado={false}
      despachoBloqueadoPorFirma={false}
      onEnviarCorreo={vi.fn()}
      onVerFormas={vi.fn()}
      {...props}
    />,
  );

describe("TarjetaFormaNotificacion — estado D: la forma no declarada, que es el caso NORMAL", () => {
  it("🔴 explica el hueco, no pinta chip y ofrece el salto a la pantalla de formas (D-21)", () => {
    const verFormas = vi.fn();
    montar({ despachos: [], onVerFormas: verFormas });

    // El título de la tarjeta se pinta igual: las TRES tarjetas van siempre.
    expect(screen.getByText("Casillero Judicial")).toBeInTheDocument();
    expect(screen.getByText(FRASE_HUECO)).toBeInTheDocument();

    // Ningún chip: no hay despacho del que decir un estado.
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();

    // Y UN solo control: el del salto. Ni «Registrar», ni «Enviar correo».
    const botones = screen.getAllByRole("button");
    expect(botones).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Registrar/ })).not.toBeInTheDocument();

    fireEvent.click(botones[0]);
    expect(verFormas).toHaveBeenCalledTimes(1);
  });

  it("el salto nombra la forma y el expediente: con tres tarjetas por fila, «Ver formas» a secas no distingue nada", () => {
    montar({ forma: "FISICO", despachos: [] });

    const salto = screen.getByRole("button", {
      name: /Dirección Física.*053-2026/,
    });
    expect(salto).toBeInTheDocument();
    expect(salto.className).toContain("btn-link");
  });

  it("🔴 la frase del hueco es HERMANA del título, nunca hija de una etiqueta de control (A5)", () => {
    const { container } = montar({ despachos: [] });

    const frase = screen.getByText(FRASE_HUECO);
    expect(frase.closest("label")).toBeNull();
    expect(frase.tagName).toBe("P");
    // Título y frase comparten padre: el cuerpo de la tarjeta.
    expect(container.querySelector("h5")?.parentElement?.parentElement).toBe(
      frase.parentElement,
    );
  });
});

describe("TarjetaFormaNotificacion — estado A: pendiente", () => {
  it("casillero pendiente: chip «Pendiente», botón «Registrar» APAGADO y su motivo en el envoltorio", () => {
    montar({ forma: "CASILLERO", despachos: [despacho()] });

    const chip = screen.getByText("Pendiente");
    expect(chip.className).toContain("badge-ghost");
    expect(chip.className).toContain("badge-sm");

    const boton = screen.getByRole("button", { name: /Registrar/ });
    expect(boton).toBeDisabled();

    // 🔴 El motivo va en el ancestro con el atributo, no en el botón: un botón deshabilitado no
    // recibe eventos de puntero y su propia burbuja no se dispararía nunca.
    expect(boton.closest('[data-tip]')?.getAttribute("data-tip")).toBe(
      MOTIVO_PAPEL,
    );
    expect(boton.getAttribute("data-tip")).toBeNull();
  });

  it("el botón de registrar está apagado también en la dirección física (D-18: el Gestor solo muestra)", () => {
    montar({ forma: "FISICO", despachos: [despacho({ forma: "FISICO" })] });

    const boton = screen.getByRole("button", { name: /Registrar/ });
    expect(boton).toBeDisabled();
    expect(boton.closest('[data-tip]')?.getAttribute("data-tip")).toBe(
      MOTIVO_PAPEL,
    );
  });

  it("🔴 correo pendiente con el envío HABILITADO: el botón está encendido y el clic entrega el despacho", () => {
    const enviar = vi.fn();
    const desp = despacho({
      despId: 777,
      forma: "CORREO",
      correo: "gabriela@example.com",
    });
    montar({
      forma: "CORREO",
      despachos: [desp],
      correoEnvioHabilitado: true,
      onEnviarCorreo: enviar,
    });

    const boton = screen.getByRole("button", { name: /Enviar correo/ });
    expect(boton).not.toBeDisabled();

    fireEvent.click(boton);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(desp);
  });

  it("🔴 correo pendiente con el envío DESHABILITADO: el botón se apaga y el motivo lo dice", () => {
    const enviar = vi.fn();
    montar({
      forma: "CORREO",
      despachos: [despacho({ forma: "CORREO", correo: "g@example.com" })],
      correoEnvioHabilitado: false,
      onEnviarCorreo: enviar,
    });

    const boton = screen.getByRole("button", { name: /Enviar correo/ });
    expect(boton).toBeDisabled();
    expect(boton.closest('[data-tip]')?.getAttribute("data-tip")).toBe(
      MOTIVO_ENVIO_APAGADO,
    );

    fireEvent.click(boton);
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe("TarjetaFormaNotificacion — estados B y C: resueltos", () => {
  it("correo notificado: chip «Notificado», rótulo de ENVÍO con la fecha corta y motivo que la nombra", () => {
    montar({
      forma: "CORREO",
      despachos: [
        despacho({
          forma: "CORREO",
          estado: "notificado",
          correo: "g@example.com",
          intentos: 1,
          enviadoAt: "2026-09-17T15:00:00.000Z",
          resueltoAt: "2026-09-10T15:00:00.000Z",
        }),
      ],
      correoEnvioHabilitado: true,
    });

    const chip = screen.getByText("Notificado");
    expect(chip.className).toContain("badge-secondary");
    expect(chip.className).toContain("badge-sm");

    expect(screen.getByText("Envío: 17 sept 2026")).toBeInTheDocument();

    const boton = screen.getByRole("button", { name: /Enviar correo/ });
    expect(boton).toBeDisabled();
    expect(boton.closest('[data-tip]')?.getAttribute("data-tip")).toBe(
      "Ya notificado por correo el 17 sept 2026.",
    );
  });

  it("casillero notificado: rótulo de ENTREGA —no de envío— con la fecha de resolución", () => {
    montar({
      forma: "CASILLERO",
      despachos: [
        despacho({
          estado: "notificado",
          resueltoAt: "2026-09-10T15:00:00.000Z",
        }),
      ],
    });

    expect(screen.getByText("Entrega: 10 sept 2026")).toBeInTheDocument();
    expect(screen.queryByText(/^Envío:/)).not.toBeInTheDocument();
  });

  it("🔴 correo rechazado: chip «Rechazado» y motivo de vía agotada (el estado que la captura no tiene)", () => {
    montar({
      forma: "CORREO",
      despachos: [
        despacho({
          forma: "CORREO",
          estado: "rechazado",
          correo: "g@example.com",
          intentos: 2,
          razonDocId: 901,
        }),
      ],
      correoEnvioHabilitado: true,
    });

    const chip = screen.getByText("Rechazado");
    expect(chip.className).toContain("badge-error");
    expect(chip.className).toContain("badge-sm");

    const boton = screen.getByRole("button", { name: /Enviar correo/ });
    expect(boton).toBeDisabled();
    expect(boton.closest('[data-tip]')?.getAttribute("data-tip")).toBe(
      MOTIVO_VIA_AGOTADA,
    );
  });
});

describe("TarjetaFormaNotificacion — las tres aserciones NEGATIVAS", () => {
  it("🔴 con el contador en CERO no aparece la palabra «Intentos»: un cero es ruido, y un literal es la señal de alarma", () => {
    montar({ forma: "CASILLERO", despachos: [despacho({ intentos: 0 })] });

    expect(screen.queryByText(/Intentos/)).not.toBeInTheDocument();
  });

  it("con el contador en DOS aparece la meta, compuesta del dato", () => {
    montar({ forma: "CASILLERO", despachos: [despacho({ intentos: 2 })] });

    expect(screen.getByText("Intentos: 2")).toBeInTheDocument();
  });

  it("🔴 correo notificado SIN fecha de envío: no se pinta NINGUNA fecha, y en particular no la de resolución", () => {
    montar({
      forma: "CORREO",
      despachos: [
        despacho({
          forma: "CORREO",
          estado: "notificado",
          correo: "g@example.com",
          // Resuelto sí, enviado no: es el estado de los despachos anteriores a la Fase 03.20.
          resueltoAt: "2026-09-10T15:00:00.000Z",
        }),
      ],
      correoEnvioHabilitado: true,
    });

    expect(screen.queryByText(/Envío:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Entrega:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/10 sept 2026/)).not.toBeInTheDocument();
  });

  it("🔴 el botón NO lleva el tamaño extra pequeño del analog y la meta NO lleva su tamaño de 11px (C2 y C3)", () => {
    montar({
      forma: "CASILLERO",
      despachos: [
        despacho({ estado: "notificado", resueltoAt: "2026-09-10T15:00:00.000Z" }),
      ],
    });

    const boton = screen.getByRole("button", { name: /Registrar/ });
    expect(boton.className).toContain("btn-sm");
    expect(boton.className).not.toContain("btn-xs");

    const textoMeta = screen.getByText("Entrega: 10 sept 2026");
    const meta = textoMeta.parentElement as HTMLElement;
    expect(meta.className).toContain("text-xs");
    expect(meta.className).toContain("text-base-content/70");
    expect(meta.className).not.toContain("text-[0.6875rem]");
    expect(textoMeta.className).not.toContain("text-base-content/55");
  });
});

describe("TarjetaFormaNotificacion — estructura y accesibilidad", () => {
  it("los nombres accesibles de los botones nombran la ACCIÓN, la FORMA y el EXPEDIENTE", () => {
    montar({
      forma: "CORREO",
      despachos: [despacho({ forma: "CORREO", correo: "g@example.com" })],
      correoEnvioHabilitado: true,
    });

    expect(
      screen.getByRole("button", {
        name: "Enviar correo — Correo Electrónico, expediente 053-2026",
      }),
    ).toBeInTheDocument();
  });

  it("sin número de expediente el nombre accesible sigue siendo válido, sin dejar el hueco a la vista", () => {
    montar({
      forma: "CASILLERO",
      despachos: [despacho()],
      expNumber: undefined,
    });

    expect(
      screen.getByRole("button", { name: "Registrar — Casillero Judicial" }),
    ).toBeInTheDocument();
  });

  it("dos despachos de la MISMA forma pintan DOS filas, cada una con su estado", () => {
    const { container } = montar({
      forma: "FISICO",
      despachos: [
        despacho({ despId: 601, forma: "FISICO", direccion: "Av. Amazonas" }),
        despacho({
          despId: 602,
          forma: "FISICO",
          direccion: "Av. Naciones Unidas",
          estado: "notificado",
          resueltoAt: "2026-09-10T15:00:00.000Z",
        }),
      ],
    });

    expect(
      container.querySelectorAll(".app-table-expanded-despacho-row"),
    ).toHaveLength(2);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Notificado")).toBeInTheDocument();
  });

  it("🔴 la cabecera de la tarjeta NO pinta ningún control de añadir (D-23)", () => {
    montar({ forma: "CASILLERO", despachos: [despacho()] });

    // Un único botón: el de registrar. Ni un `+`, ni un «Agregar despacho» apagado.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("+")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar/i })).not.toBeInTheDocument();
  });

  it("la tarjeta es un <article> y su rejilla no es la de dos columnas del analog", () => {
    const { container } = montar({ forma: "CORREO", despachos: [] });

    const tarjeta = screen.getByRole("article");
    expect(tarjeta.className).toContain("app-table-expanded-type-card");
    expect(container.innerHTML).not.toContain("grid-cols-2");
  });
});

describe("TarjetaFormaNotificacion — el despacho bloqueado por firma (Fase 03.21, D-09/D-21, UI-SPEC §9)", () => {
  it("🔴 correo PENDIENTE con el envío ENCENDIDO y el bloqueo: el botón se apaga con el motivo de §10.11", () => {
    const enviar = vi.fn();
    montar({
      forma: "CORREO",
      despachos: [despacho({ forma: "CORREO", correo: "g@example.com" })],
      correoEnvioHabilitado: true,
      despachoBloqueadoPorFirma: true,
      onEnviarCorreo: enviar,
    });

    const boton = screen.getByRole("button", { name: /Enviar correo/ });
    expect(boton).toBeDisabled();
    expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      MOTIVO_SIN_FIRMA,
    );
    expect(boton.getAttribute("data-tip")).toBeNull();

    fireEvent.click(boton);
    expect(enviar).not.toHaveBeenCalled();
  });

  it.each([
    ["con el envío APAGADO", { estado: "pendiente" }, false],
    ["ya NOTIFICADO", { estado: "notificado", enviadoAt: "2026-09-10T15:30:00" }, true],
    ["RECHAZADO", { estado: "rechazado" }, true],
  ] as const)(
    "🔴 la regla va PRIMERO: %s, el motivo sigue siendo el de la firma",
    (_caso, parcial, correoEnvioHabilitado) => {
      montar({
        forma: "CORREO",
        despachos: [despacho({ forma: "CORREO", ...parcial })],
        correoEnvioHabilitado,
        despachoBloqueadoPorFirma: true,
      });

      const boton = screen.getByRole("button", { name: /Enviar correo/ });
      expect(boton).toBeDisabled();
      expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
        MOTIVO_SIN_FIRMA,
      );
    },
  );

  it("sin el bloqueo, los cuatro motivos de siempre en su orden: el envío apagado sigue diciendo lo suyo", () => {
    montar({
      forma: "CORREO",
      despachos: [despacho({ forma: "CORREO" })],
      correoEnvioHabilitado: false,
      despachoBloqueadoPorFirma: false,
    });

    const boton = screen.getByRole("button", { name: /Enviar correo/ });
    expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      MOTIVO_ENVIO_APAGADO,
    );
  });

  it("sin el bloqueo, un rechazado sigue con su vía agotada y un pendiente encendido sigue encendido", () => {
    const { unmount } = montar({
      forma: "CORREO",
      despachos: [despacho({ forma: "CORREO", estado: "rechazado" })],
      correoEnvioHabilitado: true,
      despachoBloqueadoPorFirma: false,
    });
    expect(
      screen
        .getByRole("button", { name: /Enviar correo/ })
        .closest("[data-tip]")
        ?.getAttribute("data-tip"),
    ).toBe(MOTIVO_VIA_AGOTADA);
    unmount();

    montar({
      forma: "CORREO",
      despachos: [despacho({ forma: "CORREO" })],
      correoEnvioHabilitado: true,
      despachoBloqueadoPorFirma: false,
    });
    expect(screen.getByRole("button", { name: /Enviar correo/ })).not.toBeDisabled();
  });

  it("«Registrar» (papel) no cambia con el bloqueo: sigue apagado con SU motivo (D-18 de la 03.20)", () => {
    montar({
      forma: "CASILLERO",
      despachos: [despacho()],
      despachoBloqueadoPorFirma: true,
    });

    const boton = screen.getByRole("button", { name: /Registrar/ });
    expect(boton).toBeDisabled();
    expect(boton.closest("[data-tip]")?.getAttribute("data-tip")).toBe(
      MOTIVO_PAPEL,
    );
  });
});
