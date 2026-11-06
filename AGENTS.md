<!-- Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: viñeta «Mensajes» en Patrones, la regla de dónde se dice cada mensaje) -->
# Agent Guidelines — resolucion-frontend

Frontend AMC (Dirección Metropolitana de Resolución de Casos).

## Rol

- Staff Frontend Engineer: React 19, TypeScript estricto (sin `any`), HTML semántico.
- Reutilizar patrones existentes; código production-ready; evitar re-renders innecesarios.
- CSS con prefijos `app-`, `app-modules-`, `app-shell-` y tokens en `src/styles/foundation/`.
- Frontend-only: APIs externas; nunca llamar axios directo — siempre `httpClient`.

## Commands

```bash
npm install | npm run dev | npm run build | npm run lint
```

## Cabecera de archivo

Obligatoria en archivos nuevos o modificados de forma sustancial:

```typescript
/**
 * Microservicio: resolucion
 * Módulo: [feature]
 * Feature: [descripción]
 * Archivo: [filename]
 * Responsabilidad: [qué hace el archivo]
 * Desarrollador: Johan Freire
 * Fecha: YYYY-MM-DD
 */
```

## Stack

React 19 | Vite 7 | TS 5.9 | Tailwind 4 | DaisyUI 5 | Router 7 | Formik/Yup | TanStack Table 8 | Axios | React PDF | socket.io-client

## Estructura (`src/`)

- `api/` — `httpClient`, `correlationId`
- `components/` — `common`, `modals`, `forms`, `tabla`, `navbar`, `collapse`, `dashboard`, `toasts`, `pdf`, `documentation`
- `config/` — `routes`, `validationSchemas`, `env`, `navigation`, `socketConfig`, `inboxActionStatusRules`
- `context/` — `UserContext`, `ModalContext`, `ThemeContext`, `ToastContext` (`AlertContext` deshabilitado)
- `hooks/` — `useModal`, `useTheme`, `useToast`, `useAlerts`
- `interfaces/` — tipos con prefijo `I*` (`IModal`, `IDocument`, `ICase`, etc.)
- `layouts/` — `MainLayout`, `LoginLayout`
- `pages/` — Login (`/`), Dashboard (`/home/dashboard`), Reception (`/home/expediente`), InboxCases (`/home/inbox`), Avisos (`/home/alerts`), Documentation (`/home/documentacion`)
- `providers/` — `AppProviders`: Theme → User → Toast → Modal
- `services/` — `Case`, `User`, `Auth`, `Alert`, `Assignment`, `InboxCases`, `Document`, `AlertWebSocket` (object-literal, sin clases)
- `styles/` — `foundation/`, `layout/`, `administration/`, `auth/`, `ui/`, `pdf/`
- `utils/` — `datetime.util`, `statusMemorandum.util`, `makeData`, `dashboardDemoData`

## Patrones

- **Estado:** Context API (no Redux). Hooks: `useModal()`, `useTheme()`, `useToast()`, `useAlerts()`.
- **API:** `httpClient` → errores `HttpClientError` (`status`, `code`, `correlationId`); env en `config/env.ts`.
- **Modales:** tipo en `interfaces/IModal.ts` → `ModalXxx.tsx` → `modalRegistry` → `openModal(type, data, callbacks)`.
- **Formularios:** Formik + Yup en `validationSchemas.ts`; `InferType<>`; campos en `FormikField`.
- **Tablas:** TanStack v8, paginación/filtros server-side en `components/tabla/`.
- **CSS:** Tailwind → DaisyUI → custom; modales con `app-modules-*`; tema `[data-theme]`; transiciones 180ms.
- **Mensajes:** (quick 261028-kmg; detalle en la cabecera de `components/common/Alert.tsx`)
  - Error de un campo (validación, obligatorio, clave de firma rechazada) → solo bajo el campo, con `aria-invalid` y el foco; se retira al editar.
  - Resultado de una acción (éxito, error del servidor o de negocio) → solo `useToast().addToast`. Error y advertencia se quedan hasta cerrarlos; éxito e información se van solos.
  - `Alert` solo para estado del caso/vista y para el fallo de CARGA en el hueco del contenido (con «Reintentar» si existe), nunca repetido en un aviso flotante.
  - Nada se dice dos veces. En `ConfirmationDetail`, el padre pone `message` (va al flotante y bloquea el reintento) y no emite además su propio aviso.

## Inbox

- `InboxCasesPage` carga documentos vía `InboxCasesService`.
- `CollapseInboxDocument` renderiza documentos y acciones.
- Visibilidad por rol/estado: `inboxActionStatusRules.ts` + `statusMemorandum.util.ts`.

## Convenciones

- Componentes: PascalCase. Servicios/utils: camelCase. Interfaces: prefijo `I` en `src/interfaces/`.
- Respuestas paginadas: `{ data: T[], total, limit, offset, page, pages }`.
- CSS: kebab-case con prefijos `app-`.

## Checklist

- **Modal:** tipo `IModal.ts` → componente → `modalRegistry` → Yup si aplica.
- **Servicio:** método en `services/` con `httpClient` + tipos en `interfaces/`.
- **Página:** `pages/` → ruta lazy en `routes.tsx` → nav en `navigation.ts`.
- **Formulario:** schema Yup → `InferType<>` → `FormikField`.

## Referencias

- [GUIA_DESARROLLO_MODALES.md](docs/styles/GUIA_DESARROLLO_MODALES.md) — CSS modales
- [README.md](README.md) — dependencias y estructura extendida
