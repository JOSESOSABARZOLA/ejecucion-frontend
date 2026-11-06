/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Infraestructura de tests (Wave 0, D-05)
 * Archivo: setup.ts
 * Responsabilidad: setupFile de vitest. Importa los matchers DOM de @testing-library/jest-dom para
 *   que estén disponibles globalmente en todos los *.test.ts (toBeInTheDocument, etc.). Punto único de
 *   configuración compartida para las suites de 3.5/3.8/3.9.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-23
 */

import "@testing-library/jest-dom";
