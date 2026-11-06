/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: Adónde lleva una alerta de la campana (quick 261030-m29, D-CANAL)
 * Archivo: destinoAlerta.test.ts
 * Responsabilidad: Fijar que la campana solo navega a rutas internas `/home/…` (segunda llave de
 *   T-m29-02) y el orden del flujo «reflejar → marcar → navegar», incluido que una marca fallida
 *   no bloquea el camino.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 */
import { describe, it, expect, vi } from "vitest";
import {
  abrirAlerta,
  destinoDeAlerta,
  MAX_RUTA_ALERTA,
} from "./destinoAlerta";

describe("destinoDeAlerta", () => {
  it("devuelve la ruta interna de Mis Expedientes tal cual", () => {
    const ruta = "/home/mis-asignados?eeje=5&exp=0001-2026";
    expect(destinoDeAlerta({ aresRuta: ruta })).toBe(ruta);
  });

  it("admite la pestaña de documentos y un número codificado", () => {
    const ruta =
      "/home/mis-asignados?eeje=5&exp=EPAS%2F2026%280001%29&pestana=documentos";
    expect(destinoDeAlerta({ aresRuta: ruta })).toBe(ruta);
  });

  it("admite el panel del director sin query", () => {
    expect(destinoDeAlerta({ aresRuta: "/home/dashboard" })).toBe(
      "/home/dashboard",
    );
  });

  it.each([
    ["una URL absoluta", "https://x.y"],
    ["un host relativo al protocolo", "//evil.com"],
    ["una subida de directorio", "/home/../x"],
    ["un esquema javascript", "javascript:alert(1)"],
    ["la cadena vacía", ""],
    ["null", null],
    ["undefined", undefined],
    ["una ruta fuera de /home", "/admin/usuarios"],
    ["/home a secas", "/home/"],
    ["una query con dos puntos", "/home/mis-asignados?x=javascript:1"],
    ["una query con barra", "/home/mis-asignados?x=//evil.com"],
  ])("con %s devuelve null", (_caso, ruta) => {
    expect(destinoDeAlerta({ aresRuta: ruta })).toBeNull();
  });

  it("con una ruta más larga que el tope de la columna devuelve null", () => {
    const larga = `/home/mis-asignados?x=${"a".repeat(MAX_RUTA_ALERTA)}`;
    expect(destinoDeAlerta({ aresRuta: larga })).toBeNull();
  });
});

describe("abrirAlerta", () => {
  const acciones = () => ({
    marcarLeidaEnVista: vi.fn(),
    marcarLeidaEnServidor: vi.fn().mockResolvedValue(undefined),
    navegar: vi.fn(),
  });

  it("refleja la lectura, la registra y navega, en ese orden", async () => {
    const orden: string[] = [];
    const a = {
      marcarLeidaEnVista: vi.fn(() => orden.push("vista")),
      marcarLeidaEnServidor: vi.fn(async () => {
        orden.push("servidor");
      }),
      navegar: vi.fn(() => orden.push("navegar")),
    };

    await abrirAlerta(
      { ualeId: 9, ualeRead: false, aresRuta: "/home/mis-asignados?eeje=5" },
      a,
    );

    expect(a.marcarLeidaEnVista).toHaveBeenCalledWith(9);
    expect(a.marcarLeidaEnServidor).toHaveBeenCalledWith(9);
    expect(a.navegar).toHaveBeenCalledWith("/home/mis-asignados?eeje=5");
    expect(orden).toEqual(["vista", "servidor", "navegar"]);
  });

  it("con una ruta inválida marca leída y NO navega", async () => {
    const a = acciones();

    await abrirAlerta(
      { ualeId: 9, ualeRead: false, aresRuta: "https://x.y" },
      a,
    );

    expect(a.marcarLeidaEnServidor).toHaveBeenCalledWith(9);
    expect(a.navegar).not.toHaveBeenCalled();
  });

  it("si la marca del servidor falla, avisa en consola y navega igual", async () => {
    const a = acciones();
    a.marcarLeidaEnServidor.mockRejectedValue(new Error("500"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await abrirAlerta(
      { ualeId: 9, ualeRead: false, aresRuta: "/home/dashboard" },
      a,
    );

    expect(warn).toHaveBeenCalled();
    expect(a.marcarLeidaEnVista).toHaveBeenCalledWith(9);
    expect(a.navegar).toHaveBeenCalledWith("/home/dashboard");
    warn.mockRestore();
  });

  it("una alerta ya leída no vuelve a pedir la marca, pero sí navega", async () => {
    const a = acciones();

    await abrirAlerta(
      { ualeId: 9, ualeRead: true, aresRuta: "/home/dashboard" },
      a,
    );

    expect(a.marcarLeidaEnVista).not.toHaveBeenCalled();
    expect(a.marcarLeidaEnServidor).not.toHaveBeenCalled();
    expect(a.navegar).toHaveBeenCalledWith("/home/dashboard");
  });
});
