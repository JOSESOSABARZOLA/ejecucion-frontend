/**
 * Microservicio: ejecucion
 * Módulo: Firma digital (frontend) — Fase 03.21
 * Feature: El campo de clave único de las superficies de firma — pruebas
 * Archivo: CampoClaveCertificado.test.tsx
 * Responsabilidad: Fijar los cinco estados del campo (UI-SPEC 03.21 §2.2) y sus precauciones:
 *   · A — firmador apagado: el aviso que pasa la superficie y NINGÚN campo de contraseña.
 *   · C — firmador encendido sin sesión central: el aviso de §10.5 en `warning` y ningún campo.
 *   · B/D — el campo, con su rótulo único, sin `name` ni `placeholder`, con pista y mostrar/ocultar.
 *   · E — el rechazo de la clave: `aria-invalid`, `input-error` y la línea de error asociada, con el
 *     texto en `text-base-content` (el rojo en oscuro no da contraste) y el icono decorativo.
 *   · 🔴 El fuente del campo y el del hook no nombran ninguna salida por la que un secreto se escapa.
 *   Los textos esperados se escriben a mano: importarlos del catálogo haría tautológica la aserción.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: los estados «comprobando» y «no se
 *   pudo comprobar» del modo de firma.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-05: `autocomplete="new-password"` y
 *   los atributos de descarte de los gestores de contraseñas.)
 */
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CampoClaveCertificado from "./CampoClaveCertificado";
// Los FUENTES como texto, con `?raw` (el proyecto no le abre `fs` al código de la app).
import fuenteDelCampo from "./CampoClaveCertificado.tsx?raw";
import fuenteDelHook from "../../hooks/useClaveDeFirma.ts?raw";

const AVISO_ACTA =
  "La firma digital está desactivada en este despliegue: su firma quedará registrada, pero el acta quedará SIN firma criptográfica.";
const AVISO_SIN_SESION =
  "Para firmar hay que entrar al sistema con el Auth central, y su sesión actual no lo está. Cierre sesión y vuelva a entrar por el Auth central. Mientras tanto no se puede emitir nada que lleve firma.";
const PISTA =
  "Se usa únicamente para firmar y no se guarda en ningún momento. Si la firma no se aplica, no se guarda nada.";

function montar(props: Partial<Parameters<typeof CampoClaveCertificado>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <CampoClaveCertificado
      requerida
      value=""
      onChange={onChange}
      avisoSinFirmador={AVISO_ACTA}
      {...props}
    />,
  );
  return { ...utils, onChange };
}

function campoDePassword(container: HTMLElement) {
  return container.querySelector('input[type="password"]');
}

describe("CampoClaveCertificado — estado A: firmador apagado", () => {
  it("pinta el aviso de la superficie en `info` y NINGÚN campo de contraseña", () => {
    const { container } = montar({ requerida: false });

    const aviso = screen.getByText(AVISO_ACTA);
    expect(aviso.closest(".alert")?.className).toContain("alert-info");
    expect(campoDePassword(container)).toBeNull();
    expect(screen.queryByLabelText("Clave de firma")).toBeNull();
  });

  it("con el firmador apagado no importa la sesión: sigue siendo el aviso del firmador", () => {
    montar({ requerida: false, sesionCentral: false });

    expect(screen.getByText(AVISO_ACTA)).toBeInTheDocument();
    expect(screen.queryByText(AVISO_SIN_SESION)).toBeNull();
  });
});

describe("CampoClaveCertificado — modo de firma desconocido (revisión 03.21, WR-01)", () => {
  const COMPROBANDO = "Comprobando si la firma digital está activa en este despliegue…";
  const NO_SE_PUDO_COMPROBAR =
    "No se pudo comprobar si la firma digital está activa en este despliegue, así que todavía no se puede firmar. Vuelva a intentarlo; si el aviso persiste, recargue la página.";

  it("leyendo el modo: un estado neutro, ni el aviso del firmador apagado ni el campo", () => {
    const { container } = montar({ requerida: false, cargando: true });

    expect(screen.getByRole("status")).toHaveTextContent(COMPROBANDO);
    expect(screen.queryByText(AVISO_ACTA)).toBeNull();
    expect(campoDePassword(container)).toBeNull();
  });

  it("no se pudo leer el modo: lo dice, sin afirmar que la firma está desactivada, y ofrece reintentar", () => {
    const onReintentarModo = vi.fn();
    const { container } = montar({
      requerida: false,
      errorModo: true,
      onReintentarModo,
    });

    const aviso = screen.getByText(NO_SE_PUDO_COMPROBAR);
    expect(aviso.closest(".alert")?.className).toContain("alert-warning");
    expect(screen.queryByText(AVISO_ACTA)).toBeNull();
    expect(campoDePassword(container)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onReintentarModo).toHaveBeenCalledTimes(1);
  });
});

describe("CampoClaveCertificado — estado C: sin sesión central", () => {
  it("pinta el aviso de §10.5 en `warning` (no `error`) y ningún campo", () => {
    const { container } = montar({ sesionCentral: false });

    const aviso = screen.getByText(AVISO_SIN_SESION);
    const caja = aviso.closest(".alert");
    expect(caja?.className).toContain("alert-warning");
    expect(caja?.className).not.toContain("alert-error");
    expect(campoDePassword(container)).toBeNull();
  });

  it("si el servidor no informa la sesión, la UI degrada: se pinta el campo", () => {
    const { container } = montar({ sesionCentral: undefined });

    expect(screen.queryByText(AVISO_SIN_SESION)).toBeNull();
    expect(campoDePassword(container)).not.toBeNull();
  });
});

describe("CampoClaveCertificado — estados B/D: el campo", () => {
  it("un único rótulo «Clave de firma» en 14 px / 700, asociado al campo", () => {
    const { container } = montar({ sesionCentral: true });

    const etiquetas = container.querySelectorAll("label");
    expect(etiquetas).toHaveLength(1);
    expect(etiquetas[0]).toHaveTextContent("Clave de firma");
    expect(etiquetas[0].className).toContain("text-sm");
    expect(etiquetas[0].className).toContain("font-bold");
    expect(etiquetas[0].className).not.toContain("font-medium");

    const campo = screen.getByLabelText("Clave de firma");
    expect(etiquetas[0].getAttribute("for")).toBe(campo.id);
  });

  it("type=password, autoComplete=new-password, spellCheck=false, sin name ni placeholder", () => {
    montar();
    const campo = screen.getByLabelText("Clave de firma");

    expect(campo).toHaveAttribute("type", "password");
    // `off` lo ignoran los navegadores en un campo de contraseña (revisión 03.21, WR-05).
    expect(campo).toHaveAttribute("autocomplete", "new-password");
    expect(campo).toHaveAttribute("spellcheck", "false");
    expect(campo).not.toHaveAttribute("name");
    expect(campo).not.toHaveAttribute("placeholder");
  });

  it("los gestores de contraseñas la descartan: ni la rellenan ni se ofrecen a guardarla (WR-05)", () => {
    const { container } = montar();
    const campo = screen.getByLabelText("Clave de firma");

    expect(campo).toHaveAttribute("data-1p-ignore");
    expect(campo).toHaveAttribute("data-lpignore", "true");
    expect(campo).toHaveAttribute("data-bwignore");
    expect(campo).toHaveAttribute("data-form-type", "other");
    // Fuera de todo formulario: nada lo serializa en un envío.
    expect(campo.closest("form")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });

  it("la pista dice el texto de §10.3 y el campo la referencia por aria-describedby", () => {
    montar();
    const campo = screen.getByLabelText("Clave de firma");
    const pista = screen.getByText(PISTA);

    expect(pista.id).not.toBe("");
    expect(campo.getAttribute("aria-describedby")).toBe(pista.id);
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(campo.className).not.toContain("input-error");
  });

  it("dos instancias en el mismo DOM tienen id distintos", () => {
    const { container } = render(
      <>
        <CampoClaveCertificado
          requerida
          value=""
          onChange={() => {}}
          avisoSinFirmador={AVISO_ACTA}
        />
        <CampoClaveCertificado
          requerida
          value=""
          onChange={() => {}}
          avisoSinFirmador={AVISO_ACTA}
        />
      </>,
    );

    const campos = container.querySelectorAll("input");
    expect(campos).toHaveLength(2);
    expect(campos[0].id).not.toBe(campos[1].id);
    const pistas = screen.getAllByText(PISTA);
    expect(pistas[0].id).not.toBe(pistas[1].id);
  });

  it("mostrar/ocultar alterna el tipo y aria-pressed, y apunta al campo", () => {
    montar();
    const campo = screen.getByLabelText("Clave de firma");

    const mostrar = screen.getByRole("button", { name: "Mostrar la clave" });
    expect(mostrar).toHaveAttribute("aria-pressed", "false");
    expect(mostrar).toHaveAttribute("aria-controls", campo.id);
    expect(mostrar).toHaveAttribute("type", "button");

    fireEvent.click(mostrar);
    expect(campo).toHaveAttribute("type", "text");
    const ocultar = screen.getByRole("button", { name: "Ocultar la clave" });
    expect(ocultar).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(ocultar);
    expect(campo).toHaveAttribute("type", "password");
  });

  it("lo tecleado sube por onChange", () => {
    const { onChange } = montar();

    fireEvent.change(screen.getByLabelText("Clave de firma"), {
      target: { value: "abc" },
    });

    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("disabled apaga el campo y el botón de mostrar", () => {
    montar({ disabled: true });

    expect(screen.getByLabelText("Clave de firma")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mostrar la clave" })).toBeDisabled();
  });

  it("inputRef recibe el elemento input (para devolverle el foco tras un rechazo)", () => {
    const ref = createRef<HTMLInputElement>();
    montar({ inputRef: ref });

    expect(ref.current).toBe(screen.getByLabelText("Clave de firma"));
  });
});

describe("CampoClaveCertificado — estado E: clave rechazada", () => {
  const ERROR = "La clave de firma no es correcta.";

  it("marca el campo, asocia la línea de error y la pinta sin depender del rojo", () => {
    montar({ error: ERROR });
    const campo = screen.getByLabelText("Clave de firma");

    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo.className).toContain("input-error");

    const linea = screen.getByText(ERROR).closest("[id]") as HTMLElement;
    const pista = screen.getByText(PISTA);
    const descritoPor = (campo.getAttribute("aria-describedby") ?? "").split(" ");
    expect(descritoPor).toContain(pista.id);
    expect(descritoPor).toContain(linea.id);

    // El texto en base-content: el rojo sobre el fondo oscuro no llega a 4,5:1.
    expect(linea.className).toContain("text-base-content");
    expect(linea.className).not.toContain("text-error");

    // El icono es decorativo: el significado lo llevan la palabra, el borde y aria-invalid.
    const icono = linea.querySelector('[aria-hidden="true"]');
    expect(icono).not.toBeNull();
    expect(icono?.querySelector(".text-error")).not.toBeNull();
  });
});

describe("🔴 el fuente no nombra ninguna vía de escape del secreto", () => {
  const VIAS = [
    "console.",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "window.location",
  ];

  it("CampoClaveCertificado.tsx", () => {
    for (const via of VIAS) expect(fuenteDelCampo).not.toContain(via);
  });

  it("useClaveDeFirma.ts", () => {
    for (const via of VIAS) expect(fuenteDelHook).not.toContain(via);
  });
});
