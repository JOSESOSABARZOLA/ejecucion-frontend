/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: Contrato de la rama del correctivo
 * Archivo: ObligacionHacerService.test.ts
 * Responsabilidad: Fijar el contrato HTTP de los trece endpoints. Lo que se prueba aquí no es «que
 *   llame»: es que la RUTA sea la literal del controlador —una letra de más y el usuario ve un 404
 *   que nadie sabe explicar—, que los cuatro multipart manden SOLO `file` y ningún nombre de
 *   fichero, que las advertencias lleguen como dato de éxito y no como error, y que ningún importe
 *   ni identificador de actor salga del navegador.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api/httpClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import httpClient from "../api/httpClient";
import {
  ObligacionHacerService,
  SUBIDA_TIMEOUT_MS,
} from "./ObligacionHacerService";

const mockGet = httpClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = httpClient.post as unknown as ReturnType<typeof vi.fn>;

const EEJE = 1361;

const pdf = () =>
  new File(["x"], "escaneo del funcionario.pdf", { type: "application/pdf" });

/** Las claves con que alguien podría colar el nombre del fichero en el cuerpo. */
const CLAVES_DE_NOMBRE = /nombre|filename|originalname|archivo|ruta|path/i;

describe("ObligacionHacerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
    mockPost.mockResolvedValue({ data: {} });
  });

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // LECTURAS — los tres roles operativos
  // ═════════════════════════════════════════════════════════════════════════════════════════

  describe("lecturas", () => {
    it("detalle() → GET /obligacion-hacer/:eejeId", async () => {
      await ObligacionHacerService.detalle(EEJE);

      expect(mockGet).toHaveBeenCalledWith("/obligacion-hacer/1361");
    });

    it("diligencias() → GET /obligacion-hacer/:eejeId/diligencias", async () => {
      await ObligacionHacerService.diligencias(EEJE);

      expect(mockGet).toHaveBeenCalledWith("/obligacion-hacer/1361/diligencias");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // ACTOS CON CUERPO JSON
  // ═════════════════════════════════════════════════════════════════════════════════════════

  describe("actos con cuerpo JSON", () => {
    it("declarar() → POST /obligacion-hacer/:eejeId/declarar", async () => {
      await ObligacionHacerService.declarar(EEJE, {
        observaciones: "La resolución impuso el retiro de la valla.",
      });

      expect(mockPost).toHaveBeenCalledWith("/obligacion-hacer/1361/declarar", {
        observaciones: "La resolución impuso el retiro de la valla.",
      });
    });

    it("deshacer() → POST /obligacion-hacer/:eejeId/deshacer, con el motivo tal cual", async () => {
      // El backend exige longitud mínima. El servicio NO lo recorta ni lo suple: si es corto, que
      // lo rechace el servidor, porque el mínimo es lo que separa un motivo de un tecleo.
      await ObligacionHacerService.deshacer(EEJE, {
        motivo: "Se declaró sobre el expediente equivocado.",
      });

      expect(mockPost).toHaveBeenCalledWith("/obligacion-hacer/1361/deshacer", {
        motivo: "Se declaró sobre el expediente equivocado.",
      });
    });

    it("acreditar() → POST /obligacion-hacer/:eejeId/acreditar", async () => {
      await ObligacionHacerService.acreditar(EEJE, { docId: 501 });

      expect(mockPost).toHaveBeenCalledWith("/obligacion-hacer/1361/acreditar", {
        docId: 501,
      });
    });

    it("constatarIncumplimiento() → POST /obligacion-hacer/:eejeId/incumplimiento", async () => {
      await ObligacionHacerService.constatarIncumplimiento(EEJE, {
        docId: 502,
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/obligacion-hacer/1361/incumplimiento",
        { docId: 502 },
      );
    });

    it("ordenarSustitutoria() → POST /obligacion-hacer/:eejeId/sustitutoria", async () => {
      await ObligacionHacerService.ordenarSustitutoria(EEJE, {
        docId: 504,
        motivo: "Riesgo inminente para la vía pública.",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/obligacion-hacer/1361/sustitutoria",
        { docId: 504, motivo: "Riesgo inminente para la vía pública." },
      );
    });

    it("registrarGastosSustitutoria() → POST /obligacion-hacer/:eejeId/gastos-sustitutoria con los cuatro campos", async () => {
      await ObligacionHacerService.registrarGastosSustitutoria(EEJE, {
        valor: 1840.5,
        numeroOrden: "SAO-2026/00412",
        docId: 505,
        respaldoDocId: 506,
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/obligacion-hacer/1361/gastos-sustitutoria",
        {
          valor: 1840.5,
          numeroOrden: "SAO-2026/00412",
          docId: 505,
          respaldoDocId: 506,
        },
      );
    });

    it("🔴 los gastos mandan la BASE y nada más: ni recargo, ni total", async () => {
      // El 20 % del art. 239 es una cifra de LEY y lo aplica el servidor. Si el cliente pudiera
      // mandar el total, quien llama a la API decidiría cuánto se le cobra a un ciudadano por vía
      // coactiva. Además el ValidationPipe del backend rechaza el campo de más con un 400.
      await ObligacionHacerService.registrarGastosSustitutoria(EEJE, {
        valor: 1840.5,
        numeroOrden: "SAO-2026/00412",
        docId: 505,
        respaldoDocId: 506,
      });

      const [, cuerpo] = mockPost.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(Object.keys(cuerpo).sort()).toEqual([
        "docId",
        "numeroOrden",
        "respaldoDocId",
        "valor",
      ]);
    });

    it("🔴 sin respaldoDocId la llamada NO COMPILA: el tipo lo impide", async () => {
      // Es un cambio de contrato NO aditivo del backend: sin él llega un 400. La barrera está en el
      // tipo para que el fallo salga al escribir el código y no delante del decisor.
      // @ts-expect-error falta respaldoDocId, que el backend exige desde la Fase 03.17
      await ObligacionHacerService.registrarGastosSustitutoria(EEJE, {
        valor: 1840.5,
        numeroOrden: "SAO-2026/00412",
        docId: 505,
      });

      expect(mockPost).toHaveBeenCalled();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // ACTOS MULTIPART — el PDF viaja bajo `file`, y el nombre lo pone el servidor
  // ═════════════════════════════════════════════════════════════════════════════════════════

  describe("actos multipart", () => {
    it("adjuntarInforme() → POST /obligacion-hacer/:eejeId/informe con FormData y su timeout propio", async () => {
      await ObligacionHacerService.adjuntarInforme(EEJE, pdf());

      const [url, cuerpo, opciones] = mockPost.mock.calls[0] as [
        string,
        FormData,
        { timeout: number },
      ];
      expect(url).toBe("/obligacion-hacer/1361/informe");
      expect(cuerpo).toBeInstanceOf(FormData);
      expect(cuerpo.get("file")).toBeInstanceOf(File);
      expect(opciones.timeout).toBe(SUBIDA_TIMEOUT_MS);
    });

    it("registrarDiligencia() → POST /obligacion-hacer/:eejeId/diligencia con el acta y sus dos campos", async () => {
      await ObligacionHacerService.registrarDiligencia(
        EEJE,
        {
          resultado: "FALLIDA",
          motivo: "Acceso negado por el propietario del predio.",
        },
        pdf(),
      );

      const [url, cuerpo] = mockPost.mock.calls[0] as [string, FormData];
      expect(url).toBe("/obligacion-hacer/1361/diligencia");
      expect(cuerpo).toBeInstanceOf(FormData);
      expect(cuerpo.get("file")).toBeInstanceOf(File);
      expect(cuerpo.get("resultado")).toBe("FALLIDA");
      expect(cuerpo.get("motivo")).toBe(
        "Acceso negado por el propietario del predio.",
      );
    });

    it("registrarAlegacion() → POST /obligacion-hacer/:eejeId/alegacion con el escrito", async () => {
      await ObligacionHacerService.registrarAlegacion(
        EEJE,
        { observaciones: "Ingresó por ventanilla, trámite 2026-8841." },
        pdf(),
      );

      const [url, cuerpo] = mockPost.mock.calls[0] as [string, FormData];
      expect(url).toBe("/obligacion-hacer/1361/alegacion");
      expect(cuerpo).toBeInstanceOf(FormData);
      expect(cuerpo.get("file")).toBeInstanceOf(File);
      expect(cuerpo.get("observaciones")).toBe(
        "Ingresó por ventanilla, trámite 2026-8841.",
      );
    });

    it("🔴 la alegación NO manda la FECHA de ingreso: la pone el servidor", async () => {
      // De esa fecha depende que el término conste usado. Mandarla desde aquí sería dejar que quien
      // sube el escrito decida si alegó a tiempo.
      await ObligacionHacerService.registrarAlegacion(EEJE, {}, pdf());

      const [, cuerpo] = mockPost.mock.calls[0] as [string, FormData];
      expect([...cuerpo.keys()]).toEqual(["file"]);
    });

    it("respaldoCostos() → POST /obligacion-hacer/:eejeId/respaldo-costos", async () => {
      await ObligacionHacerService.respaldoCostos(EEJE, pdf());

      const [url, cuerpo, opciones] = mockPost.mock.calls[0] as [
        string,
        FormData,
        { timeout: number },
      ];
      expect(url).toBe("/obligacion-hacer/1361/respaldo-costos");
      expect(cuerpo).toBeInstanceOf(FormData);
      expect(cuerpo.get("file")).toBeInstanceOf(File);
      expect(opciones.timeout).toBe(SUBIDA_TIMEOUT_MS);
    });

    it("🔴 ninguno de los cuatro multipart manda el NOMBRE del fichero", async () => {
      // El nombre del archivo servido lo genera el servidor. Dejar que lo eligiera el cliente sería
      // dejarle elegir la ruta del fichero que después se sirve como estático (T-0318-05).
      await ObligacionHacerService.adjuntarInforme(EEJE, pdf());
      await ObligacionHacerService.registrarDiligencia(
        EEJE,
        { resultado: "EJECUTADA", motivo: "Se retiró la valla publicitaria." },
        pdf(),
      );
      await ObligacionHacerService.registrarAlegacion(
        EEJE,
        { observaciones: "Con anexos." },
        pdf(),
      );
      await ObligacionHacerService.respaldoCostos(EEJE, pdf());

      expect(mockPost).toHaveBeenCalledTimes(4);
      for (const [, cuerpo] of mockPost.mock.calls as [string, FormData][]) {
        const claves = [...cuerpo.keys()];
        expect(claves).toContain("file");
        expect(claves.filter((k) => CLAVES_DE_NOMBRE.test(k))).toEqual([]);
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════════════════
  // ADVERTENCIAS, ENCADENADO Y ACTOR
  // ═════════════════════════════════════════════════════════════════════════════════════════

  describe("advertencias, encadenado y actor", () => {
    it("🔴 una respuesta 2xx CON advertencias RESUELVE y se las entrega al llamador", async () => {
      // Avisar no es bloquear: el acto ya se registró. Si el servicio lanzara, la pantalla diría que
      // no pasó nada cuando sí pasó.
      mockPost.mockResolvedValueOnce({
        data: {
          multasCompulsoriasRegistradas: 1,
          advertencias: [
            {
              codigo: "SUSTITUTORIA_SIN_LAS_TRES_MULTAS",
              mensaje: "Constan 1 de 3 multas compulsorias.",
            },
          ],
        },
      });

      const resultado = await ObligacionHacerService.ordenarSustitutoria(EEJE, {
        docId: 504,
      });

      expect(resultado.multasCompulsoriasRegistradas).toBe(1);
      expect(resultado.advertencias?.[0].codigo).toBe(
        "SUSTITUTORIA_SIN_LAS_TRES_MULTAS",
      );
    });

    it("sin advertencias, el campo AUSENTE significa «sin avisos»", async () => {
      mockPost.mockResolvedValueOnce({
        data: { ordpId: 90, epasReabierto: true, base: 100, recargoPct: 20 },
      });

      const resultado =
        await ObligacionHacerService.registrarGastosSustitutoria(EEJE, {
          valor: 100,
          numeroOrden: "SAO-2026/00412",
          docId: 505,
          respaldoDocId: 506,
        });

      expect(resultado.advertencias).toBeUndefined();
    });

    it("🔴 el docId de respaldoCostos es el respaldoDocId de los gastos: dos pasos de un trámite", async () => {
      mockPost.mockResolvedValueOnce({ data: { docId: 7788 } });

      const { docId } = await ObligacionHacerService.respaldoCostos(
        EEJE,
        pdf(),
      );
      await ObligacionHacerService.registrarGastosSustitutoria(EEJE, {
        valor: 1840.5,
        numeroOrden: "SAO-2026/00412",
        docId: 505,
        respaldoDocId: docId,
      });

      const [, cuerpo] = mockPost.mock.calls[1] as [
        string,
        { respaldoDocId: number },
      ];
      expect(docId).toBe(7788);
      expect(cuerpo.respaldoDocId).toBe(7788);
    });

    it("🔴 ningún cuerpo lleva el identificador del actor: sale del JWT", async () => {
      // Si viniera del cuerpo, cualquiera podría firmar un acto con el id de otro decisor y la
      // bitácora del art. 82 CRE dejaría de ser atribuible (T-0318-06).
      await ObligacionHacerService.declarar(EEJE, { observaciones: "x" });
      await ObligacionHacerService.acreditar(EEJE, { docId: 501 });
      await ObligacionHacerService.registrarDiligencia(
        EEJE,
        { resultado: "EJECUTADA", motivo: "Se retiró la valla publicitaria." },
        pdf(),
      );

      const sospechoso = /usuario|userid|actor|decisor/i;
      for (const [, cuerpo] of mockPost.mock.calls as [
        string,
        FormData | Record<string, unknown>,
      ][]) {
        const claves =
          cuerpo instanceof FormData
            ? [...cuerpo.keys()]
            : Object.keys(cuerpo ?? {});
        expect(claves.filter((k) => sospechoso.test(k))).toEqual([]);
      }
    });
  });
});
