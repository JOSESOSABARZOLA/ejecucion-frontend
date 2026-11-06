# Docker Setup para Presentaciones

Guía rápida para levantar **resolucion-frontend** en Docker con el backend dockerizado en la misma red.

---

## 📋 Requisitos

- **Docker** (v20+): [Instalar](https://docs.docker.com/get-docker/)
- **Docker Compose** (v2+): Incluido en Docker Desktop
- **Red Docker**: `resolucion-network` debe existir

**Crear la red** (si no existe):

```bash
docker network create resolucion-network
```

---

## 🚀 Quick Start (30 segundos)

### 1. Levantar el frontend

```bash
docker-compose up -d
```

**Output esperado:**

```
✓ resolucion-frontend  Running (port 5173)
```

### 2. Abrir en navegador

```
http://localhost:5173
```

### 3. Parar el frontend

```bash
docker-compose down
```

---

## 🔧 Customización: Cambiar URL del Backend

El archivo `docker-compose.yaml` tiene la URL del backend configurada:

```yaml
args:
  VITE_API_BASE_URL: http://app:3000
```

### Escenarios comunes:

**Scenario 1: Backend en docker (mismo host, red `resolucion-network`)**

```yaml
VITE_API_BASE_URL: http://app:3000
```

✅ Recomendado. `app` es el nombre del servicio del backend.

**Scenario 2: Backend en diferente máquina (misma red local)**

```yaml
VITE_API_BASE_URL: http://192.168.1.100:3000
```

**Scenario 3: Backend en URL remota**

```yaml
VITE_API_BASE_URL: https://api.example.com
```

### Cambiar la URL:

**Opción A: Editar docker-compose.yaml directamente**

```bash
# Editar la línea VITE_API_BASE_URL, luego:
docker-compose up --build -d
```

**Opción B: Override por línea de comando (sin editar archivo)**

```bash
docker-compose build --build-arg VITE_API_BASE_URL=http://192.168.1.100:3000
docker-compose up -d
```

**Nota:** Cambiar la URL requiere **rebuild** de la imagen (`npm run build` internamente). No es dinámico en runtime.

---

## 🔑 Token de GitHub Packages

La instalación (`npm ci`) baja `@amc-automatizacion/ui` (el buscador flotante de infracciones) del registro privado de GitHub Packages. El `.npmrc` del repo fija ese scope al registro y solo lleva el marcador `${NODE_AUTH_TOKEN}`, nunca el token.

Hace falta un Personal Access Token de GitHub con permiso `read:packages` (autorizado para `AMC-Automatizacion` si la organización usa inicio de sesión único) en la variable `NODE_AUTH_TOKEN` de la terminal. Nunca en el repositorio ni en un `.env`.

El token entra en la imagen como **secreto de BuildKit**, no como build-arg: vive solo durante el `npm ci` y no queda en capas, caché ni historial de builds. Requiere BuildKit (el constructor por omisión desde Docker 23).

Con compose (PowerShell):

```powershell
$env:NODE_AUTH_TOKEN = "github_pat_..."
docker compose build
docker compose up -d
```

Versión para el servidor, construida desde un commit (Git Bash, con `NODE_AUTH_TOKEN` definida en la misma terminal):

```bash
git archive <commit> | docker build -q --secret id=npmtoken,env=NODE_AUTH_TOKEN -t ejecucion-frontend:<ver> -
```

Sin el token la construcción se para en la instalación con «Falta el secreto npmtoken…».

---

## 📊 Verificación

### 1. Contenedor activo

```bash
docker ps | grep resolucion-frontend
```

**Output esperado:**

```
CONTAINER ID  IMAGE                    PORTS
abc123...     resolucion-frontend      0.0.0.0:5173->5173/tcp
```

### 2. Healthcheck status

```bash
docker inspect resolucion-frontend --format='{{.State.Health.Status}}'
```

**Output esperado:**

```
healthy
```

(Esperar ~30 segundos para que pase el primer healthcheck)

### 3. Verificar conectividad al backend

En el navegador (http://localhost:5173):

- Abrir **DevTools** (F12)
- Tab **Network**
- Hacer una acción que llamé al backend (ej: login, listar casos)
- Verificar que las requests lleguen al backend sin errores de CORS

---

## 🐛 Troubleshooting

### Puerto 5173 ocupado

```bash
# Cambiar puerto en docker-compose.yaml:
ports:
  - '5174:5173'  # Usar 5174 en lugar de 5173
```

Luego:

```bash
docker-compose down
docker-compose up -d
# Acceder a: http://localhost:5174
```

### Backend no responde (error de conexión)

**Verificar:**

1. ¿Backend está corriendo en docker?

   ```bash
   docker ps | grep backend
   ```

2. ¿Frontend y backend en la misma red?

   ```bash
   docker network inspect resolucion-network
   ```

3. ¿URL del backend es correcta en docker-compose.yaml?

   ```yaml
   VITE_API_BASE_URL: http://app:3000 # 'app' debe ser el nombre del servicio
   ```

4. ¿Firewall bloquea el puerto?
   ```bash
   docker exec resolucion-frontend wget -O- http://app:3000/health
   ```

### Imagen muy pesada / compilación lenta

Esto es normal con Node + Vite. Primera compilación toma ~2-3 minutos.

**Optimizaciones futuras:**

- Usar caché de Docker
- Pre-compilar en CI/CD
- Usar image layer caching

### Limpiar completamente

```bash
# Parar contenedor
docker-compose down

# Eliminar imagen
docker rmi resolucion-frontend

# Eliminar volúmenes (si los hay)
docker-compose down -v

# Reconstruir desde cero
docker-compose build --no-cache
docker-compose up -d
```

---

## 📐 Arquitectura

```
┌─────────────────────────────────────────┐
│  Tu computadora                         │
├─────────────────────────────────────────┤
│  Docker Network: resolucion-network     │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  Frontend    │    │   Backend    │  │
│  │  (Nginx)     ├───→│   (Node)     │  │
│  │  :5173       │    │   :3000      │  │
│  └──────────────┘    └──────────────┘  │
│       ↓                                 │
│   http://localhost:5173 (tu navegador) │
└─────────────────────────────────────────┘
```

---

## 🧑‍💻 Desarrollo Local (sin Docker)

Para desarrollo local, **NO necesitas Docker**:

```bash
# Terminal 1: Backend (asumir que está en otro proyecto)
cd ../backend
npm run dev  # Corre en http://localhost:3000

# Terminal 2: Frontend (este proyecto)
npm install
npm run dev  # Corre en http://localhost:5173 (Vite dev server)
```

El frontend se conectará a `http://localhost:3000` (ver [src/config/env.ts](src/config/env.ts)).

---

## 📝 Archivos relevantes

- `docker-compose.yaml` — Configuración de servicios
- `Dockerfile` — Build image del frontend (multi-stage: Node → Nginx)
- `nginx.conf` — Configuración de Nginx (SPA routing, gzip, headers de seguridad)
- `src/config/env.ts` — Donde se lee `VITE_API_BASE_URL` en build time
- `.dockerignore` — (si existe) Archivos que se excluyen del build

---

## ✅ Checklist para presentación

Antes de presentar en otro computador:

- [ ] Red `resolucion-network` existe en el computador destino
- [ ] Backend está levantado y funcionando
- [ ] `VITE_API_BASE_URL` es correcta para el ambiente
- [ ] Puerto 5173 está disponible (o configurado en docker-compose)
- [ ] Hacer `docker-compose build` antes de viajar (asegurar imagen en caché local)
- [ ] Probar en tu computadora: `docker-compose up -d` + navegar a http://localhost:5173
- [ ] Verificar que el frontend se conecta al backend correctamente

---

## 📞 Support

Si algo no funciona:

1. Revisar logs: `docker logs resolucion-frontend`
2. Revisar healthcheck: `docker ps | grep resolucion-frontend`
3. Verificar conectividad al backend: `docker exec resolucion-frontend wget -O- http://app:3000`
4. Limpiar y reconstruir: `docker-compose down && docker-compose up --build -d`

---

**Last updated:** May 5, 2026
