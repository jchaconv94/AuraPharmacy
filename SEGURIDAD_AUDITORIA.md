# Auditoría de acceso a datos - ToolKit SISMED Web

Fecha: 2026-07-31. Realizada contra el proyecto Supabase `ujknopysvgqqvkmgrfhp` usando **únicamente la clave `anon` del `.env`**, que es la misma que viaja en el bundle publicado.

## Resumen

La clave `anon` da acceso de **lectura y escritura sin restricción** a todas las tablas del esquema `public`, incluida `users`.

Consecuencia principal: cualquiera que abra la aplicación desplegada, extraiga la clave del JavaScript y haga una petición HTTP puede **crear una cuenta con rol `ADMIN`** y entrar al sistema. No necesita descifrar ninguna contraseña.

No es una hipótesis: los permisos se verificaron directamente contra la API.

## Cómo se comprobó

Sondas no destructivas: `UPDATE` y `DELETE` con un filtro que no coincide con ninguna fila (`username=eq.__sonda__`). Si el permiso está cerrado, la API responde error; si está abierto, responde `204` con cero filas afectadas. **Ninguna sonda modificó un solo registro.**

También se consultó `information_schema.column_privileges` desde el panel de Supabase.

## Resultados

### Tabla `users`

Permisos concedidos al rol `anon`, según `information_schema`:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`
- `INSERT` alcanza a las columnas `password_hash`, `role`, `username`, `personnel_id`, `is_active` y `created_at`

Sondas: `SELECT` → `200`. `UPDATE` → `204`. `DELETE` → `204`.

Vías de ataque que esto habilita:

1. **Crear un usuario `ADMIN`** con una contraseña conocida por el atacante e iniciar sesión con normalidad.
2. **Cambiar el `role`** de una cuenta existente.
3. **Sobrescribir el `password_hash`** de cualquier usuario y tomar su cuenta.
4. **Borrar usuarios**, dejando a personal sin acceso.

La vía 1 es la más grave porque no deja rastro sobre ninguna cuenta legítima.

### Datos personales en `personnel`

Legible completa por `anon`: **70 personas**, con `dni`, `first_name`, `last_name`, `phone` y `email`.

Es una exposición de datos personales que en Perú cae bajo la Ley 29733 de Protección de Datos Personales. Conviene evaluarla con quien corresponda en la institución, con independencia de la corrección técnica.

### Resto de tablas

Todas las probadas resultaron abiertas a lectura y borrado para `anon`:

`facilities`, `roles_config`, `ungets`, `diresas`, `ogess`, `microredes`, `immunization_products`, `immunization_stock_layers`, `immunization_stock_movements`, `immunization_monthly_closures`, `immunization_distribution_batches`, `immunization_return_batches`, `immunization_adjustments`, `immunization_initial_inventories`.

Es decir, todo el stock biológico, los movimientos y los cierres mensuales pueden ser leídos, alterados o borrados desde fuera.

## Por qué ocurre

No es un descuido puntual, es consecuencia del modelo de autenticación.

La aplicación no usa Supabase Auth: valida usuarios contra su propia tabla `users` con `bcryptjs`. Para que eso funcione, **la base de datos no sabe quién está haciendo cada petición**: todas llegan como `anon`.

Sin identidad en el servidor no se pueden escribir políticas RLS del tipo "solo un ADMIN puede modificar usuarios", porque la base no distingue un ADMIN de un anónimo. La única forma de que la aplicación funcione con este diseño es conceder todo a `anon`, que es exactamente lo que está configurado.

Esto ya estaba anticipado como deuda en `INMUNIZACIONES_DISENO_FUNCIONAL.md` §25, que señalaba que las políticas eran provisionales y que la solución definitiva exigía Supabase Auth o Edge Functions. La auditoría confirma que esa deuda tiene consecuencias reales y explotables hoy.

## Qué se corrigió ya

`SEGURIDAD_ETAPA_1_LOGIN.md` documenta la etapa 1: el hash de contraseña deja de salir de la base, con verificación en el servidor mediante `app_verify_password`. Sigue pendiente de aplicar el SQL.

**Esa corrección sigue siendo válida pero ya no es la prioridad.** Ocultar el hash no sirve de mucho si cualquiera puede fabricarse un ADMIN sin necesidad de contraseñas.

## Prioridades recomendadas

### 1. Cortar la escalada de privilegios (inmediato)

```sql
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.roles_config FROM anon;
```

Cierra las cuatro vías de ataque de la sección anterior. Es una sola sentencia y es reversible.

**Rompe temporalmente**: crear y editar usuarios, activar/desactivar, eliminar, cambio de contraseña y edición de permisos por rol. Todo eso escribe desde el navegador con la clave `anon`.

Se acepta esa rotura a propósito: la administración de usuarios se usa ocasionalmente, mientras que la puerta abierta lo está de forma continua y la clave lleva meses publicada.

### 2. Restaurar la administración de forma segura

Reconstruir esas operaciones como funciones `SECURITY DEFINER` que exijan las credenciales del administrador que las ejecuta, y verificarlas en el servidor antes de actuar. Es el mismo patrón de `app_verify_password`.

### 3. Migrar a identidad real

Supabase Auth, o mover todas las escrituras a Edge Functions. Es la única forma de proteger las tablas restantes sin romper la aplicación, porque permite políticas RLS que distingan quién llama.

Mientras esto no exista, cualquier cierre adicional será a costa de funcionalidad.

### 4. Revisar la exposición de datos personales

Decidir con la institución qué corresponde hacer respecto de los datos de las 70 personas en `personnel`.

## Nota sobre rotación de la clave

Rotar la clave `anon` **no resuelve nada por sí solo**: la nueva clave volvería a publicarse en el siguiente despliegue. El problema no es que la clave se haya filtrado, sino que una clave pública tiene permisos de administración.
