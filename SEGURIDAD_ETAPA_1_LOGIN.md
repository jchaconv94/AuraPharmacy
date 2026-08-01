# Seguridad, etapa 1 - El hash de contraseña deja de salir de la base

Fecha: 2026-07-31.

## Hallazgo

La clave `anon` de Supabase viaja dentro del bundle publicado: el workflow de GitHub Pages la inyecta en el build, así que cualquiera que abra la aplicación desplegada puede extraerla del JavaScript.

Con esa clave se podía leer `public.users` completa, **incluida la columna `password_hash`** de los 64 usuarios. Verificado consultando la API REST con la misma clave del `.env`.

Columnas que devolvía la tabla: `created_at`, `is_active`, `password_hash`, `personnel_id`, `role`, `username`.

### Por qué ocurría

El login comparaba la contraseña **en el navegador**, en `services/api.ts` con `bcrypt.compareSync`. Para eso necesitaba descargarse el hash, así que la columna tenía que ser legible por el rol anónimo.

### Qué lo agravaba

- Los hashes son bcrypt `$2b$` con sal y coste 10, no texto plano. Pero estaban públicos, y eso permite ataques de diccionario sin límite de intentos y sin tocar el servidor.
- `services/api.ts` usa una **contraseña por defecto fija** al crear usuarios y al resetear. Con los hashes a la vista, comprobar cuáles siguen con esa contraseña es cuestión de segundos.
- Una cuenta `ADMIN` comprometida da control total del módulo.

### Lo que no se comprobó

Si el rol anónimo también puede **escribir** en `users`. No se probó porque habría significado modificar datos reales. El bloque 0 del script lista los permisos y políticas vigentes para medirlo.

Es importante: mientras la escritura siga abierta, alguien podría cambiar un `password_hash` o un `role` sin necesidad de conocer ninguna contraseña. **Ocultar el hash es necesario, pero no suficiente.**

## Solución aplicada

### En la base de datos

`SUPABASE_SECURITY_STAGE1_LOGIN.sql` crea `public.app_verify_password(username, password)`, una función `SECURITY DEFINER` que compara la contraseña con `crypt()` de pgcrypto y devuelve solo `true` o `false`. Después revoca `SELECT (password_hash)` para `anon` y `authenticated`.

### En la aplicación

- `login()` ya no compara el hash: llama a la función y solo consulta el perfil.
- Se creó la constante `USER_SELECT` con la lista explícita de columnas. Las tres consultas que usaban `select("*")` sobre `users` la usan ahora, porque con `*` PostgREST pediría también `password_hash` y fallaría al revocarlo.
- `AdminMigrationModule` contaba usuarios con `select('*')`; ahora usa una columna concreta.
- `verifyPasswordOnServer` devuelve `null` si la función todavía no existe, y en ese caso el login recurre a la verificación anterior. Así el frontend se puede desplegar antes o después del SQL sin dejar a nadie fuera. Ese respaldo deja de funcionar solo en cuanto se revoca la columna.

## Orden de aplicación

El orden importa: revocar la columna antes de desplegar el frontend nuevo deja a **todos** sin poder iniciar sesión.

1. Ejecutar el **bloque 0** del SQL y revisar qué permisos tiene hoy `anon`.
2. Ejecutar el **bloque 1**. Comprueba que `pgcrypto` entiende los hashes `$2b$` generados por bcryptjs. **Si devuelve false o da error, detenerse**: la alternativa sería implementar el login como Edge Function con bcryptjs.
3. Ejecutar el **bloque 2**, que crea la función.
4. Desplegar la aplicación con estos cambios.
5. Probar el login con un usuario real.
6. Ejecutar el **bloque 3**, que revoca la lectura del hash.
7. Ejecutar el **bloque 4** para verificar.

El script incluye las sentencias de reversión.

## Verificación hecha

- `npm run lint`, `npm test` (38 pruebas) y `npm run build`: correctos.
- La consulta de perfil con `USER_SELECT` se probó contra la API real: es válida, devuelve las relaciones embebidas (`personnel`, `roles_config`, `labor_regimes`, `professions`) y **no** incluye `password_hash`.
- La aplicación carga sin errores de consola ni del servidor.

No se pudo probar un login completo porque requiere credenciales reales. Ese es el paso 5 del procedimiento y lo debe hacer el usuario.

## Etapa 2, pendiente

Lo que sigue abierto, por orden de riesgo:

1. **Escritura anónima sobre `users`**: si el bloque 0 confirma que existe, es más grave que la lectura del hash. Cerrarla exige que el servidor sepa quién llama, es decir, identidad real.
2. **Resto de tablas**: las políticas RLS del módulo de inmunizaciones son permisivas por diseño provisional. Cualquiera con la clave puede leer y probablemente escribir stock, movimientos y cierres.
3. **Contraseña por defecto fija** en `services/api.ts`: conviene generar una aleatoria por usuario y obligar a cambiarla en el primer ingreso.
4. **Migración a Supabase Auth o Edge Functions**, que es lo que `INMUNIZACIONES_DISENO_FUNCIONAL.md` §25 ya anticipaba como camino definitivo.
