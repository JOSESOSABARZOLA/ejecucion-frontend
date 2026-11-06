/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: El catálogo de las 12 entradas del `⋮` del EPAS (Fase 03.19, Plan 11 — D-05, D-11, D-12)
 * Archivo: accionesDelEpas.test.ts
 * Responsabilidad: Demostrar las tres cosas que el catálogo protege, y demostrarlas SIN MONTAR LA
 *   PÁGINA: que el resolver no razona, que una acción que no procede sale APAGADA CON SU MOTIVO y
 *   nunca ausente, y que el catálogo no puede crecer un agujero —una entrada nueva sin icono, sin
 *   grupo o sin declarar en el union no compila, y un icono que no existe en el mapa falla aquí—.
 *
 *   🔴 POR QUÉ ESTA PRUEBA EXISTE APARTE DE LA DE LA PÁGINA. La bandeja del decisor pasa de las mil
 *   líneas; una prueba que tuviera que montarla para comprobar que «Coactiva» sale apagada con su
 *   motivo sería una prueba que nadie ejecuta al cambiar una regla. El catálogo es un dato, y un
 *   dato se prueba como dato.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: «Recursos» alcanzable desde la rama
 *   pecuniaria y desde la de obligación de hacer, también suspendido; en EN_IMPUGNACION los actos del
 *   ⋮ salen apagados con el motivo de la suspensión)
 */

import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Iconos from "../components/common/Iconos";
import {
  ACCIONES_DEL_EPAS,
  GRUPOS_DEL_EPAS,
  accionesDeLaFila,
  type DisparadoresDelEpas,
} from "./accionesDelEpas";
import { MOTIVOS_ACCION } from "./accionesHechos";
import { RUTA_GENERAR_DOCUMENTO } from "./rutasGeneracionDocumento";
import { RUTA_OBLIGACION_HACER } from "./rutasObligacionHacer";
import { crearMiEpasAsignado } from "../test/fixtures/miEpasAsignado";
import type { MiEpasAsignado } from "../services/SorteoService";

const DECISOR = "funcionario decisor";

/** Un disparador de mentira por cada entrada que ACTÚA. El `Record` es total: no cabe olvidar uno. */
const disparadores = (): DisparadoresDelEpas => ({
  aceptarCaso: vi.fn(),
  excusarme: vi.fn(),
  adjuntarDocumento: vi.fn(),
  pago: vi.fn(),
  acogimiento: vi.fn(),
  trabajoComunitario: vi.fn(),
  prorroga: vi.fn(),
  impugnacion: vi.fn(),
  descargarExpediente: vi.fn(),
  coactiva: vi.fn(),
});

/** Resuelve el menú de una fila con el rol del decisor. */
const menu = (row: MiEpasAsignado, rol: string = DECISOR) =>
  accionesDeLaFila(row, rol, disparadores());

/** Una fila ACEPTADA y sin excusa pendiente: la que enciende lo que depende de hacerse cargo. */
const filaAceptada = (over: Partial<MiEpasAsignado> = {}): MiEpasAsignado =>
  crearMiEpasAsignado({
    aceptado: true,
    excusaPendiente: false,
    eejeStatus: "ASIGNADO_DECISOR",
    ...over,
  });

/** Una fila SIN aceptar: la que apaga casi todo, y con la que se comprueba que no desaparece nada. */
const filaSinAceptar = (over: Partial<MiEpasAsignado> = {}): MiEpasAsignado =>
  crearMiEpasAsignado({
    aceptado: false,
    excusaPendiente: false,
    eejeStatus: "ASIGNADO_DECISOR",
    ...over,
  });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// (1) LA FORMA DEL CATÁLOGO, Y SU TOTALIDAD
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("ACCIONES_DEL_EPAS: las doce entradas del submenú", () => {
  it("son doce y ninguna repite identificador", () => {
    expect(ACCIONES_DEL_EPAS).toHaveLength(12);
    const ids = ACCIONES_DEL_EPAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("🔴 TODAS declaran icono y grupo: el catálogo no puede crecer un agujero", () => {
    // La totalidad de verdad la impone el COMPILADOR —`icono` y `grupo` son obligatorios en el tipo
    // de la entrada, y `CATALOGO_COMPLETO` no compila si el union de identificadores y el array se
    // separan—. Esto es la red de abajo: comprueba que ninguno de los dos llegó vacío, que el
    // compilador no puede ver.
    for (const accion of ACCIONES_DEL_EPAS) {
      expect(accion.icono.trim().length, `icono vacío: ${accion.id}`)
        .toBeGreaterThan(0);
      expect(GRUPOS_DEL_EPAS, `grupo desconocido: ${accion.id}`).toContain(
        accion.grupo,
      );
    }
  });

  it("🔴 los doce iconos EXISTEN en el mapa: un nombre mal escrito no cae en el comodín", () => {
    // `Iconos` resuelve un nombre desconocido al glifo de interrogación y no rompe nada — que es
    // correcto para un componente compartido y es exactamente el agujero que este catálogo no puede
    // tener: un icono mal tecleado saldría en producción como un signo de interrogación y ninguna
    // prueba lo diría. Aquí se pinta cada uno y se comprueba que NO es el comodín.
    const comodin = render(createElement(Iconos, { nombre: "no-existe-este-icono" }));
    const glifoComodin = comodin.container
      .querySelector("svg")
      ?.getAttribute("data-icon");
    expect(glifoComodin).toBeTruthy();

    for (const accion of ACCIONES_DEL_EPAS) {
      const { container } = render(
        createElement(Iconos, { nombre: accion.icono }),
      );
      const glifo = container.querySelector("svg")?.getAttribute("data-icon");
      expect(glifo, `${accion.id} no pinta icono`).toBeTruthy();
      expect(glifo, `icono desconocido en ${accion.id}: ${accion.icono}`).not.toBe(
        glifoComodin,
      );
    }
  });

  it("toda entrada que NAVEGA declara su motivo de falta de expediente", () => {
    // Sin expediente no hay ruta que construir. Una entrada-enlace que no dijera por qué se apaga
    // dejaría al decisor delante de una opción gris sin explicación.
    for (const accion of ACCIONES_DEL_EPAS) {
      if (!("navega" in accion)) continue;
      expect(
        "exigeExpediente" in accion && accion.exigeExpediente.length > 0,
        `${accion.id} navega sin declarar su motivo`,
      ).toBe(true);
    }
  });

  it("los cuatro grupos van en el orden del contrato y sus entradas son CONSECUTIVAS", () => {
    // Si un grupo se partiera en dos tramos, el menú repetiría su rótulo — que es la señal visible
    // de que el orden está mal, según el contrato de `AccionCaso.grupo`.
    const tramos = ACCIONES_DEL_EPAS.map((a) => a.grupo).filter(
      (grupo, i, todos) => grupo !== todos[i - 1],
    );
    expect(tramos).toEqual([...GRUPOS_DEL_EPAS]);
  });

  it("🔴 D-05: «Formas de notificación» NO está en el catálogo del decisor", () => {
    // Su sitio es el paso 3 de la página de generación. La regla del motor ya decía que es acto del
    // secretario y en recepción: retirarla de aquí alinea la pantalla con la regla.
    expect(ACCIONES_DEL_EPAS.map((a) => a.id)).not.toContain(
      "formasNotificacion",
    );
  });

  it("🔴 D-12: «Emitir providencia» se llama ahora «Generar documento»", () => {
    const etiquetas = ACCIONES_DEL_EPAS.map((a) => a.label);
    expect(etiquetas).toContain("Generar documento");
    expect(etiquetas).not.toContain("Emitir providencia");
  });

  it("⚠️ «Constancia de pago» conserva su etiqueta: la actividad normativa se llama de otra forma", () => {
    // El pedido del área usuaria (2026-08-28) cambió la ETIQUETA, no el paso. Renombrarla más
    // rompería la trazabilidad contra el procedimiento aprobado.
    const pago = ACCIONES_DEL_EPAS.find((a) => a.id === "pago");
    expect(pago?.label).toBe("Constancia de pago");
  });

  it("el catálogo no importa ningún modal: los disparadores llegan de fuera", () => {
    // Lo comprueba el `grep` del criterio de aceptación; aquí se comprueba su consecuencia
    // observable, que es lo que de verdad importa: se puede resolver el menú entero sin montar una
    // sola pantalla ni abrir un solo modal.
    expect(() => menu(filaAceptada())).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// (2) EL RESOLVER NO RAZONA: DEVUELVE LO QUE EL MOTOR DIGA
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("accionesDeLaFila: apagada con su motivo, nunca ausente", () => {
  it("🔴 D-11: sobre un expediente SIN aceptar, las doce siguen presentes", () => {
    const acciones = menu(filaSinAceptar());
    expect(acciones).toHaveLength(12);
    expect(acciones.map((a) => a.id)).toEqual(
      ACCIONES_DEL_EPAS.map((a) => a.id),
    );
  });

  it("🔴 y las que no proceden salen APAGADAS CON MOTIVO, no ausentes", () => {
    const acciones = menu(filaSinAceptar());
    const apagadas = acciones.filter((a) => a.deshabilitado);

    // Sin aceptar, lo que depende de hacerse cargo está apagado: generar, descargar e impugnar.
    for (const id of ["generarDocumento", "descargarExpediente", "impugnacion"]) {
      const accion = acciones.find((a) => a.id === id);
      expect(accion, id).toBeDefined();
      expect(accion?.deshabilitado, id).toBe(true);
      expect((accion?.motivo ?? "").trim().length, id).toBeGreaterThan(0);
    }

    expect(apagadas.length).toBeGreaterThanOrEqual(3);
    // Y NINGÚN apagado es mudo.
    for (const accion of apagadas) {
      expect((accion.motivo ?? "").trim().length, accion.id).toBeGreaterThan(0);
    }
  });

  it("con otro rol, las doce siguen presentes y el motivo nombra el ROL", () => {
    const acciones = menu(filaAceptada(), "secretario abogado");
    expect(acciones).toHaveLength(12);

    const generar = acciones.find((a) => a.id === "generarDocumento");
    expect(generar?.deshabilitado).toBe(true);
    expect(generar?.motivo).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);

    // Menos la puerta del correctivo, que los tres roles pueden abrir para LEER.
    const correctivo = acciones.find((a) => a.id === "obligacionHacer");
    expect(correctivo?.deshabilitado).toBe(false);
  });

  it("el catálogo NO rehabilita ni razona: acepta el veredicto del motor tal cual", () => {
    // Un caso aceptado y en verificación de pago: «Constancia de pago» procede y «Registrar
    // cumplimiento» no, porque su estado es otro. El catálogo no opina sobre ninguna de las dos.
    const acciones = menu(
      filaAceptada({ eejeStatus: "EN_VERIFICACION_PAGO" }),
    );
    expect(acciones.find((a) => a.id === "pago")?.deshabilitado).toBe(false);

    const cumplimiento = acciones.find((a) => a.id === "trabajoComunitario");
    expect(cumplimiento?.deshabilitado).toBe(true);
    expect(cumplimiento?.motivo).toBe(MOTIVOS_ACCION.FUERA_DE_ESTADO);
  });

  it("las entradas que actúan traen su disparador, y solo se dispara el que se pulsa", () => {
    const stubs = disparadores();
    const fila = filaAceptada();
    const acciones = accionesDeLaFila(fila, DECISOR, stubs);

    acciones.find((a) => a.id === "descargarExpediente")?.onSelect?.();

    expect(stubs.descargarExpediente).toHaveBeenCalledWith(fila);
    expect(stubs.coactiva).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// (3) LAS DOS ENTRADAS QUE NAVEGAN
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("las dos entradas que navegan en vez de actuar", () => {
  it("🔴 D-12: «Generar documento» lleva RUTA y no manejador cuando hay expediente", () => {
    const generar = menu(filaAceptada({ eejeId: 4821 })).find(
      (a) => a.id === "generarDocumento",
    );

    expect(generar?.to).toBe(RUTA_GENERAR_DOCUMENTO(4821));
    expect(generar?.onSelect).toBeUndefined();
    expect(generar?.deshabilitado).toBe(false);
  });

  it("sin expediente resuelto, «Generar documento» se apaga y no construye ruta", () => {
    const generar = menu(filaAceptada({ eejeId: undefined })).find(
      (a) => a.id === "generarDocumento",
    );

    expect(generar).toBeDefined();
    expect(generar?.to).toBeUndefined();
    expect(generar?.deshabilitado).toBe(true);
    expect(generar?.motivo).toMatch(/expediente/i);
  });

  it("🔴 la entrada del correctivo se traslada TAL CUAL, con sus DOS motivos", () => {
    // Motivo 1 — sin expediente al que navegar: el suyo propio, escrito en el catálogo.
    const sinExpediente = menu(filaAceptada({ eejeId: undefined })).find(
      (a) => a.id === "obligacionHacer",
    );
    expect(sinExpediente?.to).toBeUndefined();
    expect(sinExpediente?.deshabilitado).toBe(true);
    expect(sinExpediente?.motivo).toBe(
      "Este caso todavía no tiene un expediente resuelto: no hay correctivo que abrir.",
    );

    // Motivo 2 — el del MOTOR, cuando el rol no interviene en la rama.
    const ajeno = menu(filaAceptada({ eejeId: 4821 }), "auditor").find(
      (a) => a.id === "obligacionHacer",
    );
    expect(ajeno?.deshabilitado).toBe(true);
    expect(ajeno?.motivo).toBe(MOTIVOS_ACCION.FUERA_DE_ROL);
  });

  it("🔴 y LLEVE O NO CORRECTIVO el expediente, la puerta sigue abierta (CR-01)", () => {
    // Es el callejón sin salida que la corrección de CR-01 deshizo: el expediente SIN correctivo es
    // exactamente aquel en el que hay que entrar, porque dentro está la única acción que lo declara.
    for (const tiene of [true, false]) {
      const fila = filaAceptada({
        eejeId: 4821,
        obligacionHacer: { tiene } as MiEpasAsignado["obligacionHacer"],
      });
      const correctivo = menu(fila).find((a) => a.id === "obligacionHacer");
      expect(correctivo?.deshabilitado, `tiene=${tiene}`).toBe(false);
      expect(correctivo?.to, `tiene=${tiene}`).toBe(RUTA_OBLIGACION_HACER(4821));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// (4) quick 261028-mtg (2026-10-29): LA IMPUGNACIÓN EN CUALQUIER MOMENTO
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("la impugnación en cualquier momento (quick 261028-mtg)", () => {
  const conHacer = { tiene: true } as MiEpasAsignado["obligacionHacer"];

  it.each(["EN_TRABAJO_COMUNITARIO", "EN_VERIFICACION_PAGO", "EN_IMPUGNACION"])(
    "D-5: una fila %s con obligación de hacer, aceptada, ofrece «Recursos» habilitada",
    (eejeStatus) => {
      const recursos = menu(
        filaAceptada({ eejeStatus, obligacionHacer: conHacer }),
      ).find((a) => a.id === "impugnacion");
      expect(recursos?.deshabilitado).toBe(false);
      expect(recursos?.onSelect).toBeDefined();
    },
  );

  it("en EN_IMPUGNACION los cinco actos pecuniarios del ⋮ salen apagados con el motivo de la suspensión", () => {
    const acciones = menu(
      filaAceptada({ eejeStatus: "EN_IMPUGNACION", obligacionHacer: conHacer }),
    );
    for (const id of [
      "pago",
      "acogimiento",
      "trabajoComunitario",
      "prorroga",
      "coactiva",
    ]) {
      const accion = acciones.find((a) => a.id === id);
      expect(accion?.deshabilitado, id).toBe(true);
      expect(accion?.motivo, id).toBe(
        MOTIVOS_ACCION.SUSPENDIDA_POR_IMPUGNACION,
      );
    }
    // Y lo que P-8 deja disponible sigue encendido.
    for (const id of [
      "impugnacion",
      "generarDocumento",
      "adjuntarDocumento",
      "descargarExpediente",
      "obligacionHacer",
    ]) {
      expect(acciones.find((a) => a.id === id)?.deshabilitado, id).toBe(false);
    }
    // Apagar no es esconder: las doce siguen.
    expect(acciones).toHaveLength(12);
  });
});
