<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg" alt="React Logo" width="100"/>
</p>

Proyecto de automatización de la Dirección Metropolitana de Resolución de la AMC, esta es una propuesta de estructuración del frontend. Se uso React + Vite y Typescript.

Librerias importantes para considerar son Tanstack, Formik, DaysiUI + Tailwind.

## Versiones de las herramientas utilizadas

- nodejs version: 24.13.0
- react version: 19.2.0
- vite version: 7.3.1
- react-router-dom: 7.13.1
- daisyui: 5.5.19
- tailwindcss: 4.2.1
- @tanstack/react-table: 8.21.3
- react-pdf: 10.4.1 (usa pdfj-dist 5.4.296)

## Arbol: Estructura del proyecto

```
automatizacion_amc_frontend/
|-- public/
|-- src/
|   |-- assets/
|   |-- components/
|   |   |-- common/
|   |   |   |-- Boton.tsx
|   |   |   |-- Iconos.tsx
|   |   |   |-- Loading.tsx
|   |   |   |-- SubMenuDropdown.tsx
|   |   |   +-- UserProfileButton.tsx
|   |   |-- modals/
|   |   |   |-- ModalCase.tsx
|   |   |   +-- ModalContainer.tsx
|   |   |-- navbar/
|   |   |   |-- Navbar.tsx
|   |   |   |-- AlertList.tsx
|   |   |   |-- MenuDropdown.tsx
|   |   |   +-- MenuDropdownParts.tsx
|   |   +-- tabla/
|   |       |-- Table.tsx
|   |       |-- ActionButton.tsx
|   |       |-- RowActionMenu.tsx
|   |       +-- RowActions.tsx
|   |-- config/
|   |   +-- routes.tsx
|   |-- context/
|   |   +-- UserContext.tsx
|   |-- hooks/
|   |-- interfaces/
|   |   |-- Alert.ts
|   |   +-- User.ts
|   |-- layouts/
|   |   |-- LoginLayout.tsx
|   |   +-- MainLayout.tsx
|   |-- pages/
|   |   |-- LoginPage.tsx
|   |   +-- ReceptionPage.tsx
|   |-- services/
|   |   |-- AlertService.ts
|   |   |-- Api.ts
|   |   +-- UserService.ts
|   |-- utils/
|   |   +-- makeData.ts
|   |-- App.tsx
|   |-- App.css
|   |-- main.tsx
|   |-- index.css
|-- .gitignore
|-- eslint.config.js
|-- index.html
|-- package.json
|-- package-lock.json
|-- README.md
|-- tsconfig.json
|-- tsconfig.app.json
|-- tsconfig.node.json
+-- vite.config.ts
```

## Detalles principales del arbol

- index.html: define la estructura principal html, y contiene el div root en el cual se renderizar� toda nuestra aplicaci�n.
- src/: código fuente
- src/main.tsx: renderiza el componente App.tsx referenciando al div root.
- src/App.tsx: componente raíz de la aplicación
- src/index.css: para definir estilos globales, que deben aplicarse a toda la aplicaci�n (fuentes, colores base, etc..)
- src/App.css: para estilos particulares de App o de componentes principales.
- src/assets: archivos estáticos que presentará la aplicación (imágenes, fuentes, iconos, etc..)
- src/components: directorio que maneja todos los componentes que implementemos, organizados en carpetas por funcionalidades
- src/components/common: componentes reutilizables a lo largo de nuestra aplicaci�n (botones, menus desplegables, loading, etc)
- src/components/[carpeta]: cada subcarpeta de componentes representará una funcionalidad, por ejemplo navbar tiene todos los componentes correspondientes a la barra de navegación
- src/config: archivos de configuración de la aplicación (rutas)
- src/config/routes.tsx: definición centralizada de todas las rutas de la aplicación
- src/context: archivos que definan contextos para la aplicaci�n
- src/hooks: archivos de hooks personalizados
- src/interfaces: archivos de interfaces/tipos para el tipado de nuestros objetos
- src/layouts: contiene componentes que definen la estructura general visual (disposici�n de navbar, sidebar, etc)
- src/pages: contiene componentes que representan páginas completas que son envueltas por los layouts y representan una ruta o url
- src/services: archivos que permiten la comunicación con un backend
- src/utils: archivos con funciones utilitarias que pueden ser reutilizadas en varias partes de nuestro código

## Configuración del proyecto

```
Creación del proyecto
  > npm create vite@latest nombre-del-proyecto
    > Select a framework: React
    > Select a variant: Typescript
```

```
Datatable Tanstack
  > npm install @tanstack/react-table
```

```
Tailwind
  > npm install tailwindcss @tailwindcss/vite
  > Añadir al archivo vite.config.ts:
     - import tailwindcss from '@tailwindcss/vite'
     - tailwindcss() en el método defineConfig
  > Añadir en el archivo index.css:
     - @import "tailwindcss";
```

```
DaisyUI
  > npm i -D daisyui@latest
  > Añadir al archivo index.css:
     - @plugin "daisyui";

```

```
React Router
  > npm install react-router-dom
```

```
Formik y Yup
  > npm install formik yup
```

## Compilar y correr proyecto

```
Para clonar este proyecto
  > Clonar desde el repositorio al local
  > npm install
  > npm run dev (modo desarrollo)
```

```
Para generar el build de producción
  > npm run build
```
