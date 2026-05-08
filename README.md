# MOD Tracker — Sistema Operativo de Gestión de Tiempo

Plataforma multi-usuario de seguimiento de tiempo con estética Tech-Noir. Diseñada para equipos: cada operador tiene su propio panel de cronómetros con un único cronómetro activo a la vez, y los administradores ven la actividad agregada de todo el sistema.

---

## Tabla de contenidos

- [Stack tecnológico](#stack-tecnológico)
- [Instalación y arranque](#instalación-y-arranque)
- [Roles y permisos](#roles-y-permisos)
- [Guía del usuario (rol USER)](#guía-del-usuario-rol-user)
- [Guía del administrador (rol ADMIN)](#guía-del-administrador-rol-admin)
- [Tema claro / oscuro](#tema-claro--oscuro)
- [Sincronización y guardado](#sincronización-y-guardado)
- [Modelo de datos](#modelo-de-datos)
- [API REST](#api-rest)
- [Despliegue en Plesk](#despliegue-en-plesk)
- [Notas de seguridad](#notas-de-seguridad)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Estilos | Tailwind CSS 3.4 (CDN, configurado inline en `index.html`) con tokens semánticos vía CSS variables |
| Backend | PHP 7.4+ (un único `api.php` con PDO) |
| Base de datos | MySQL 5.7+ / 8.0 (motor InnoDB) |
| IA opcional | Google Gemini API (insights en Reportes) |
| Iconografía | Material Symbols Outlined |
| Tipografía | Inter + JetBrains Mono |

---

## Instalación y arranque

### Requisitos

- Node.js 18+ y npm para desarrollo
- PHP 7.4+ con extensión PDO MySQL
- MySQL 5.7+ accesible con credenciales

### Configuración de base de datos

`api.php` lee credenciales desde variables de entorno con fallback a valores por defecto:

```php
$host = getenv('DB_HOST') ?: '...';
$db   = getenv('DB_NAME') ?: 'mod_tracker_db';
$user = getenv('DB_USER') ?: '...';
$pass = getenv('DB_PASS') ?: '...';
```

En **producción (Plesk)**: define las variables en el panel del dominio → PHP Settings → Custom variables.

En la **primera petición a `api.php`** se crean automáticamente todas las tablas y un usuario `Admin` (clave `123456789`). Las migraciones son idempotentes y aditivas (solo `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE … ADD COLUMN` en try/catch), por lo que actualizar la app no destruye datos existentes.

### Desarrollo local

```bash
# Instalar dependencias
npm install

# Frontend (Vite, http://localhost:5173)
npm run dev

# Backend PHP (http://localhost:8080)
npm run dev:api

# Ambos a la vez
npm run dev:full

# Build de producción → dist/
npm run build
```

Vite proxea `/api.php` a `http://localhost:8080`, por lo que el frontend en dev usa el PHP local de forma transparente.

---

## Roles y permisos

| Acción | USER | ADMIN |
|---|:---:|:---:|
| Iniciar sesión | ✅ | ✅ |
| Ver / iniciar / parar cronómetros propios | ✅ | — |
| Crear proyectos privados | ✅ | ✅ |
| Crear proyectos globales | — | ✅ |
| Editar / eliminar sus propios logs | ⚙️ configurable | ✅ |
| Editar / eliminar logs de otros usuarios | — | ✅ |
| Ver historial de modificaciones de logs | — | ✅ |
| Ver Panel Global, Operadores, Estadísticas | — | ✅ |
| Buscar usuarios y proyectos globales | — | ✅ |
| Activar / desactivar proyectos globales | — | ✅ |
| Activar / desactivar el permiso de modificar logs de otros usuarios | — | ✅ |

> El permiso de un USER para modificar sus propios logs lo controla el admin por usuario (ver [Permiso de edición de logs por operador](#permiso-de-edición-de-logs-por-operador)). Por defecto está activado para mantener compatibilidad con el comportamiento previo.

---

## Guía del usuario (rol USER)

### 1. Inicio de sesión

- Pantalla `LoginView` con dos inputs: usuario y contraseña.
- La sesión queda guardada en `localStorage` bajo `mod_tracker_session` para no tener que volver a entrar mientras no se cierre sesión expresamente.

### 2. Terminal (Dashboard)

Vista principal: una **rejilla de tarjetas**, una por proyecto visible. Cada tarjeta es un cronómetro independiente.

**Estado de las tarjetas:**
- **Inactiva** → solo muestra acumulado del día.
- **Activa** → un proyecto está corriendo. Borde resaltado y sombreado luminoso (`active-project-card`).

**Acciones por tarjeta:**

| Acción | Cómo |
|---|---|
| **Iniciar / parar cronómetro** | Clic en el botón principal. Solo un cronómetro puede estar activo a la vez en el sistema → al iniciar uno nuevo se detiene automáticamente el anterior. |
| **Ajuste manual ±** | Botones `+` / `−` para sumar o restar tiempo con incrementos rápidos (útil para pausas reales o correcciones de minutos). |
| **Iniciar con tiempo preestablecido** | Permite arrancar el cronómetro con un valor inicial ya cargado (registro `PRESET`). |
| **Comentario de sesión** | Campo de texto que viaja junto al log diario al guardar. Se almacena en `user_projects.session_comment` mientras el cronómetro corre y se persiste en `logs.comment` al cerrar el día. |
| **Reset diario** | Reinicia a 0 el contador diario de ese proyecto sin afectar al histórico. |
| **Ocultar proyecto** | Marca el proyecto como oculto solo para tu vista (`user_projects.hidden_by_user`). El proyecto sigue existiendo y otros usuarios lo ven. |
| **Reordenar** | Drag & drop. El orden se persiste en `users.project_order`. |

**Cronómetro y Wake Lock:** mientras un cronómetro corre, la pantalla del navegador no se apaga (Wake Lock API). Útil para terminales fijos en taller.

### 3. Crear un proyecto

Botón **Nuevo Proyecto** en la sidebar inferior. Abre un modal con:

- **Nombre** (obligatorio)
- **Categoría** (texto libre, sirve de agrupador)
- **Color** — paleta de 15 colores vibrantes (red, blue, green, orange, purple, pink, cyan, yellow, indigo, emerald, crimson, teal, amber, violet, lime)
- **Visibilidad**:
  - Como USER → se crea como **proyecto privado** (`is_global = 0`), solo tú lo ves
  - Como ADMIN → puedes elegir entre privado o global

Los proyectos privados solo aparecen en el dashboard de su creador.

### 4. Inyectar tiempo manualmente

Botón **Inyectar** en el Header (icono `history_edu`).

Se usa para registrar tiempo de forma retroactiva o cuando se olvidó arrancar el cronómetro:

- Selección del proyecto
- Fecha (cualquier fecha pasada)
- Duración (horas / minutos)
- Comentario opcional

El registro se crea con `status = MANUAL` para diferenciarlo de los registros automáticos.

### 5. Movimientos

`Movimientos` (sidebar) → lista cronológica de tus logs históricos con filtros y acciones:

- **Editar** un log → abre modal con duración, fecha y comentario. Cada edición se guarda en `log_modification_history` (visible solo para admins).
- **Eliminar** un log con confirmación.
- **Estados**: `NORMAL` (cronómetro), `MANUAL` (inyección manual), `PRESET` (iniciado con tiempo prefijado).

### 6. Mis Reportes

Vista `Reports` con:

- **Métricas agregadas** del usuario (total horas, días activos, etc.)
- **Desglose de utilización** por proyecto en porcentaje (gráfico de barras)
- **Inteligencia Central** — si está configurada la API Key de Gemini, se generan insights de productividad en lenguaje natural a partir de tus logs.
- **Historial Operativo** — tabla de últimos registros.
- **Exportación CSV** del histórico completo.
- **Sincronización Manual** — fuerza el cierre del día actual y persiste todos los segundos acumulados.

### 7. Historial

`Historial` (sidebar) → vista semanal de los últimos 7 días con totales por día y proyecto.

### 8. Perfil

Visualiza y edita tus datos: avatar (semilla DiceBear), nombre de usuario, contraseña.

---

## Guía del administrador (rol ADMIN)

Los administradores tienen los mismos cronómetros que un usuario normal, pero la sidebar les muestra apartados adicionales. La vista `Terminal` (cronómetros) queda **oculta** por defecto en el menú admin (se prioriza la gestión global) — está disponible si se navega manualmente.

### Búsqueda global

En el Header aparece un input de búsqueda que indexa **usuarios** y **proyectos** simultáneamente. Permite saltar rápidamente al detalle de cualquier entidad.

### Panel Global (`AdminDashboardView`)

Resumen ejecutivo de todo el sistema:

- Total de horas registradas, número de operadores activos
- Distribución de proyectos globales vs privados
- Listado clicable de operadores con horas trabajadas

### Operadores (`AdminView` filtrado a usuarios)

Lista completa de usuarios con una columna **Editar Logs** que muestra un toggle por operador (los ADMIN aparecen como "— Admin —", el permiso no aplica). Clic en el toggle → activa o desactiva el permiso del operador para editar/borrar sus propios registros (ver siguiente sección).

Clic en el nombre del operador → `AdminUserDetailView`:

- Estadísticas individuales (horas totales, proyectos activos, último login)
- Listado de proyectos en los que el operador ha trabajado, con su porcentaje
- Acceso al historial completo de logs del operador, con capacidad de **editar o eliminar logs ajenos**
- Cualquier modificación queda registrada en `log_modification_history` con marca temporal y `modified_by_user_id`
- Tarjeta **Permisos del Operador** con el toggle de edición de logs propios

### Permiso de edición de logs por operador

El admin controla por usuario si éste puede modificar sus propios registros. Hay dos puntos de acceso al toggle:

- **Listado de Operadores** — columna "Editar Logs" con un switch compacto, ideal para ajustes rápidos sobre varios usuarios.
- **Detalle del Operador** — tarjeta "Permisos del Operador" con el mismo switch en formato grande.

**Comportamiento:**
- Activado (por defecto) → el operador ve los botones editar/borrar en su vista Movimientos sobre sus propios logs.
- Desactivado → los botones desaparecen. Si el operador intentara forzar la petición vía API, el backend responde `403 FORBIDDEN`.
- Los administradores **siempre** mantienen edición y borrado, sin importar este flag.
- Persistido en la columna `users.can_modify_logs`. Los usuarios existentes y nuevos arrancan con `1` (activado) para no romper compatibilidad.
- La sesión del operador afectado se refresca automáticamente cada 15 segundos contra el servidor, así que el cambio se propaga sin necesidad de cerrar sesión.

### Proyectos Global (`AdminView` filtrado a proyectos)

Lista de todos los proyectos del sistema, globales y privados de cualquier usuario. Clic → `AdminProjectDetailView`:

- Métricas del proyecto: horas acumuladas, número de operadores que lo usan, días activos
- Listado de operadores con horas individuales en ese proyecto
- **Activar / desactivar** el proyecto (`is_active`) — desactivados quedan ocultos para todos pero conservan histórico

### Estadísticas (`AdminStatsView`)

- Distribución temporal global (últimos 7 días)
- Gráfico de dona con tiempo por proyecto
- Top de operadores y proyectos
- Filtros por rango de fechas

### Historial de modificaciones de logs

Cada vez que alguien (admin o usuario) edita un log, se guarda en `log_modification_history`:

- `old_duration_seconds` / `new_duration_seconds`
- `old_date_str` / `new_date_str`
- `old_comment` / `new_comment`
- `modified_by_user_id` y `modified_at`

Visible desde el detalle de log en cualquier vista de movimientos para usuarios admin.

### Crear usuario nuevo

Desde **Operadores** → botón crear. Campos: usuario, contraseña, rol (USER / ADMIN), avatar.

---

## Tema claro / oscuro

Botón cuadrado con icono en la parte superior derecha del Header (junto a Inyectar / Sincronizar):

- **Claro** (`light_mode` ☀️) — paleta blanco / gris azulado
- **Oscuro** (`dark_mode` 🌙) — paleta Tech-Noir original
- **Sistema** (`desktop_windows` 🖥️) — sigue el `prefers-color-scheme` del SO y se actualiza en tiempo real si lo cambias

La preferencia se persiste en `localStorage` con la clave `mod_tracker_theme`. Un script inline en `<head>` aplica el tema antes de que cargue React para evitar el "flash" de tema incorrecto.

Internamente todos los tokens (`mod-dark`, `mod-card`, `mod-border`, `mod-fg`, `background-dark`) son CSS variables en formato RGB triple, lo que permite usar opacidad de Tailwind (`bg-mod-fg/20`, `border-mod-fg/[0.02]`, etc.) en cualquier modo. El acento `mod-blue` (`#00a3e0`) es invariante.

---

## Sincronización y guardado

| Evento | Frecuencia |
|---|---|
| Refresco visual del cronómetro | 1 s |
| Sincronización con servidor (proyectos, logs y datos del usuario actual) | 15 s |
| Cierre automático del día | Al detectar cambio de fecha (medianoche) |
| Cierre manual del día | Botón "Sincronizar" en Reportes / Header |

Al cerrar un día:
1. Para todos los cronómetros corriendo del usuario.
2. Crea un registro en `logs` por cada proyecto con `current_day_seconds > 0`.
3. Resetea `user_projects.current_day_seconds` y `running_since` a 0/NULL.
4. La operación es idempotente: aunque haya múltiples disparos simultáneos (timer + cambio de fecha + manual), no se duplican logs.

Si el dispositivo está offline, los segundos siguen contando localmente; en cuanto vuelve la conexión, la siguiente sincronización los persiste.

---

## Modelo de datos

Esquema InnoDB. Todas las tablas se autocrean y autoextienden en la primera petición a `api.php`.

### `users`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | VARCHAR(50) PK | UUID generado en cliente |
| `username` | VARCHAR(100) UNIQUE | Login |
| `password` | VARCHAR(255) | Texto plano (ver [Seguridad](#notas-de-seguridad)) |
| `role` | VARCHAR(20) | `USER` o `ADMIN` |
| `avatar_seed` | VARCHAR(100) | Semilla DiceBear |
| `last_login` | DATETIME | |
| `project_order` | TEXT | JSON array con orden de proyectos |
| `can_modify_logs` | TINYINT(1) DEFAULT 1 | Si 0, el USER no puede editar/borrar sus propios logs. Los ADMIN siempre pueden. |

### `projects`
| Columna | Tipo |
|---|---|
| `id`, `creator_id`, `name`, `category`, `color` | strings |
| `is_global` | TINYINT(1) — 1 = visible para todos |
| `is_active` | TINYINT(1) — 0 = desactivado, oculto |

### `user_projects` (estado por usuario)
| Columna | Tipo |
|---|---|
| `user_id` + `project_id` | PK compuesta |
| `running_since` | VARCHAR(50) NULL — timestamp ISO si está corriendo |
| `current_day_seconds` | INT — acumulado del día sin persistir aún |
| `session_comment` | VARCHAR(500) NULL |
| `hidden_by_user` | TINYINT(1) |

### `logs` (registros históricos)
| Columna | Tipo |
|---|---|
| `id` (UUID), `user_id`, `project_id`, `project_name` | strings |
| `date_str` | VARCHAR(50) — ISO `YYYY-MM-DD` |
| `duration_seconds` | INT |
| `status` | `NORMAL` / `MANUAL` / `PRESET` |
| `comment` | TEXT NULL |
| `created_at` | TIMESTAMP |

### `log_modification_history` (auditoría)
Cada edición de log guarda valores antiguos y nuevos, autor de la edición y timestamp.

---

## API REST

Todos los endpoints son `GET` o `POST` a `api.php?action=<nombre>`.

| Acción | Descripción |
|---|---|
| `status` | Health check, retorna `{status, db, server_time}` |
| `get_users` | Lista de usuarios |
| `save_user` | Crea o actualiza un usuario (upsert por id) |
| `get_projects?userId=X` | Lista de proyectos visibles para un usuario |
| `save_project` | Crea o actualiza un proyecto |
| `delete_project` | Elimina un proyecto |
| `get_logs?userId=X` | Logs históricos de un usuario (admin: todos) |
| `save_log` | Crea un log nuevo |
| `update_log` | Edita un log existente, registra historial. Requiere `modifiedByUserId` y valida permisos (admin o dueño con `can_modify_logs=1`); si no, responde `403 FORBIDDEN`. |
| `delete_log` | Elimina un log. Requiere `modifiedByUserId` por query string. Misma validación de permisos que `update_log`. |
| `get_log_modification_history?logId=X` | Historial de ediciones de un log |

CORS abierto a `*` (apropiado solo si el dominio se sirve detrás del mismo origen en producción).

---

## Despliegue en Plesk

1. **Backup BD**: `mysqldump --single-transaction --routines --triggers …`
2. **Backup archivos**: `tar czf backup.tgz httpdocs/`
3. **Build local**: `npm ci && npm run build`
4. **Subir vía SFTP/rsync** a `httpdocs/`:
   - Contenido de `dist/` (`index.html` + `assets/`)
   - `api.php`
5. **Verificar**: `curl https://tu-dominio/api.php?action=status` debe responder `{"status":"online","db":"ok"}`.

Las migraciones (`ALTER TABLE ADD COLUMN`) se aplican automáticamente en la primera petición. No hay paso de migración manual.

---

## Notas de seguridad

- ⚠️ **Contraseñas en texto plano**: el sistema actual guarda las contraseñas sin hashear. Recomendado migrar a `password_hash` / `password_verify` (bcrypt) en producción.
- ⚠️ **CORS abierto** (`Access-Control-Allow-Origin: *`): adecuado para desarrollo, restringir en producción al dominio real.
- ⚠️ **API Key de Gemini**: no comprometas la clave en el bundle. En producción, configúrala como variable de entorno `API_KEY` y proxéala desde el backend si se quiere ocultar al cliente.
- ✅ Validación de roles tanto en frontend como en backend.
- ✅ Uso exclusivo de PDO con prepared statements (sin concatenación SQL).

---

## Estructura del proyecto

```
Mod-Time-Tracker/
├── api.php                       Backend PHP/MySQL (único archivo)
├── App.tsx                       Componente raíz, sesión y routing
├── index.html                    HTML + Tailwind config + tema CSS variables
├── index.tsx                     Punto de entrada React
├── types.ts                      Tipos TypeScript compartidos
├── constants.tsx                 Datos mock para modo offline
├── components/
│   ├── Header.tsx               Top bar (búsqueda, acciones, ThemeToggle)
│   ├── Sidebar.tsx              Menú lateral
│   └── ThemeToggle.tsx          Botón cíclico claro/oscuro/sistema
├── hooks/
│   └── useTheme.ts              Hook de tema con persistencia y matchMedia
├── views/
│   ├── DashboardGrid.tsx        Rejilla de cronómetros
│   ├── MovementsView.tsx        Lista editable de logs
│   ├── Reports.tsx              Reportes individuales + Gemini
│   ├── WeeklyHistoryView.tsx    Vista de 7 días
│   ├── ProfileView.tsx          Perfil del usuario
│   ├── ProjectList.tsx          Selector de proyectos
│   ├── LoginView.tsx            Pantalla de login
│   ├── AdminDashboardView.tsx   Panel global admin
│   ├── AdminView.tsx            Lista de usuarios o proyectos
│   ├── AdminUserDetailView.tsx  Detalle por usuario
│   ├── AdminProjectDetailView.tsx Detalle por proyecto
│   └── AdminStatsView.tsx       Estadísticas agregadas
├── services/
│   ├── db.ts                    Cliente del API (con fallback mock)
│   └── geminiService.ts         Cliente Gemini para insights
├── firefox-extension/           Extensión Firefox complementaria
└── mockData/                    Datos de prueba para dev offline
```

---

**MOD Tracker** v1.0.0 — Uso interno.
