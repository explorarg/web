# Diseño y funcionamiento de `/admin/login`

Esta guía describe cómo está construida la pantalla de acceso del panel administrador de BAFT para poder replicar su diseño y su comportamiento en otro sistema.

## Archivos involucrados

- `app/admin/login/page.tsx`: página cliente, estado de los formularios y operaciones de autenticación.
- `components/auth/AuthPortalShell.tsx`: carcasa visual compartida por el login y la recuperación de contraseña.
- `app/admin/layout.tsx`: aplica la fuente Poppins y el scope `admin-scope`.
- `lib/auth/authConfig.ts`: persistencia, dominios permitidos y límites de seguridad.
- `lib/auth/sessionManager.ts`: sesión local, actividad y bloqueo por intentos fallidos.
- `lib/auth/password-recovery.ts`: normalización del DNI y reglas de contraseña.
- `components/ui/input.tsx`, `button.tsx`, `checkbox.tsx` y `label.tsx`: primitivas UI utilizadas por los formularios.

## Composición visual

La pantalla ocupa todo el viewport con `min-h-screen` y un fondo radial muy claro:

- exterior: degradado radial desde blanco hacia gris azulado (`#EFF3FA` y `#E4EAF3`);
- separación horizontal: `px-4` en móvil y `sm:px-6` en pantallas mayores;
- separación vertical: `py-8` en móvil y `sm:py-10` en pantallas mayores;
- contenedor centrado: `max-w-md`, con altura mínima equivalente al viewport menos el padding vertical;
- tarjeta: fondo blanco translúcido (`bg-white/88`), borde blanco semitransparente, blur y sombra amplia;
- radio de la tarjeta: `30px`;
- padding interno: `px-7 pb-7 pt-6`, aumentando a `sm:px-8 sm:pb-8 sm:pt-7`.

La tarjeta tiene dos capas decorativas absolutas en la parte superior, de `144px` de alto. Son degradados gris azulados muy suaves que aportan profundidad sin introducir una imagen de fondo.

Dentro de la tarjeta el orden es:

1. enlace opcional para volver;
2. icono circular;
3. título;
4. subtítulo;
5. formulario o mensaje de estado;
6. divisor y pie de autoría.

El icono mide `80px` por `80px`, usa radio completo y fondo `#EEF3FF` con icono `#0F1F52`. En el estado exitoso cambia a fondo `#D1FAE5` e icono verde `#059669`.

El título usa aproximadamente `32px`, peso `600`, color `#0B163B` y tracking `-0.03em`. El subtítulo tiene `14px`, interlineado `24px`, color `#66728F` y ancho máximo de `260px`, centrado.

El pie tiene margen superior de `40px`, borde superior `#E6EBF3`, padding superior de `20px`, tamaño `12px` y color `#7B859D`. El enlace de “Tucs Digital” usa peso semibold y color `#0F1F52`.

## Formulario de login

El formulario usa separación vertical de `20px`. Cada campo sigue el mismo patrón:

- etiqueta semibold de `14px`, color `#24335B`;
- contenedor `position: relative`;
- input de `48px` de alto, radio `16px`, borde `#D6DEEC`, fondo blanco y sin sombra;
- texto de entrada de `15px`;
- icono Lucide en color `#7F8AA5`;
- el icono se coloca a la derecha en Email y a la izquierda en Contraseña;
- la contraseña agrega un botón de mostrar/ocultar en la derecha.

Campos y controles:

- **Email**: `type="email"`, `autoComplete="email"`, placeholder con el email administrador configurado.
- **Contraseña**: `type="password"` o `text`, `autoComplete="current-password"`, placeholder “Ingresá tu contraseña”.
- **Recordarme**: checkbox marcado inicialmente, controla la persistencia de Firebase.
- **¿Olvidaste tu contraseña?**: cambia el estado de la vista a `recover-dni` sin navegar a otra URL.
- **Iniciar sesión**: botón de ancho completo, alto `48px`, radio `16px`, texto semibold y degradado lineal de `#0F1F52` a `#0B2F7D`.

El botón usa la misma sombra en todos los formularios: `0 14px 30px rgba(15,31,82,0.26)`. Cuando está cargando muestra `Loader2` animado antes del texto.

También se muestra el aviso “Bloq Mayús activado.” debajo del campo de contraseña cuando el navegador informa que Caps Lock está activo.

## Estados de la pantalla

La ruta es una sola página cliente y cambia el contenido de la carcasa mediante `view`:

```ts
type ViewState = 'login' | 'recover-dni' | 'recover-reset' | 'recover-success';
```

### 1. Login

- icono: `ShieldCheck`;
- título: “Panel Admin”;
- subtítulo: “Accedé a tu cuenta para continuar con la gestión interna de BAFT.”;
- sin enlace de regreso.

### 2. Validación de identidad

- icono: `ShieldCheck`;
- título: “Recuperar contraseña”;
- subtítulo: “Ingresá tu DNI para validar tu identidad y continuar con el cambio de contraseña.”;
- enlace superior “Volver al login” con icono `ArrowLeft`;
- campo DNI con icono `IdCard`;
- botón “Validar identidad”.

El DNI se normaliza eliminando todo carácter que no sea numérico. Se exige una longitud mínima de 7 dígitos antes de enviar la solicitud.

### 3. Nueva contraseña

- icono: `KeyRound`;
- título: “Nueva contraseña”;
- subtítulo: “Definí una nueva clave segura. El acceso de recuperación es temporal y de un solo uso.”;
- dos campos de contraseña con controles de visibilidad;
- bloque informativo con fondo `#F8FAFD`, borde `#E1E7F2` y radio `16px`;
- botón “Guardar nueva contraseña”.

Las reglas visibles y validaciones son: mínimo 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.

### 4. Recuperación completada

- icono: `Check` en tono verde;
- título: “Contraseña actualizada”;
- mensaje en bloque verde claro (`#ECFDF5`), con borde verde;
- botón “Volver al inicio de sesión”.

## Flujo de autenticación

1. Al montar la página se valida el dominio actual mediante `validateAdminDomain()`.
2. Si ya existe un usuario Firebase cuyo email coincide con el administrador, se redirige a `/admin`.
3. Al enviar el login se bloquea el formulario, se configura la persistencia y se llama a `signInWithEmailAndPassword`.
4. Si el acceso es correcto, se registra el intento exitoso, se limpian los intentos previos, se crea la sesión local y se redirige a `/admin`.
5. Si falla, se muestra un toast contextual según el código de Firebase.
6. Cinco fallos dentro de una ventana de 15 minutos bloquean temporalmente el email durante 15 minutos. El contador se actualiza cada segundo en la interfaz.
7. Entre intentos se exige una espera mínima de 3 segundos.

La opción “Recordarme” selecciona `browserLocalPersistence`; si se desmarca, se usa `browserSessionPersistence`. Además se guarda una sesión propia con email, UID, dispositivo, fecha de login, última actividad y preferencia de persistencia.

## Recuperación de contraseña

La recuperación ocurre en dos requests internos:

```text
POST /api/auth/password-recovery/start
{ role: 'admin', dni: normalizedDni }
```

Si la identidad es válida, el servidor devuelve un `challengeToken` temporal y la interfaz pasa a `recover-reset`.

```text
POST /api/auth/password-recovery/complete
{ challengeToken, newPassword }
```

El token es de un solo uso y tiene una vigencia de 10 minutos. El cliente también valida que ambas contraseñas coincidan y que cumplan las reglas de seguridad antes de enviar el segundo request.

## Paleta para replicar

| Uso | Valor |
| --- | --- |
| Título principal | `#0B163B` |
| Azul de acción oscuro | `#0F1F52` |
| Azul de acción profundo | `#0B2F7D` |
| Texto de etiquetas | `#24335B` |
| Texto secundario | `#66728F` |
| Texto auxiliar | `#7B859D` |
| Iconos secundarios | `#7F8AA5` |
| Borde de inputs | `#D6DEEC` |
| Borde de divisor | `#E6EBF3` |
| Fondo del icono | `#EEF3FF` |
| Fondo informativo | `#F8FAFD` |
| Fondo de éxito | `#ECFDF5` |

## Receta de implementación en otro sistema

Separar la pantalla en dos piezas:

1. **Shell de autenticación**: recibe `title`, `subtitle`, `icon`, `children`, un callback opcional de regreso y un estado visual (`default` o `success`). Esta pieza concentra el layout, los degradados, la tarjeta y el footer.
2. **Controlador de autenticación**: mantiene el estado de la vista y las variables de formulario. Debe ser independiente de la presentación para reutilizar el mismo shell en login, recuperación y confirmación.

Para conservar la experiencia visual, mantener un ancho máximo aproximado de `448px`, radios de `16px` en inputs y botones, radio de `30px` en la tarjeta, separación de `20px` entre controles y el botón con degradado azul y sombra amplia.

Para conservar la experiencia de uso, incluir estados de carga, deshabilitar controles durante requests, mostrar errores mediante notificaciones, permitir ver/ocultar contraseñas, detectar Caps Lock y ofrecer un mensaje de bloqueo temporal después de varios intentos fallidos.

## Referencias de código

- Shell visual: `components/auth/AuthPortalShell.tsx`.
- Página y estados: `app/admin/login/page.tsx`.
- Configuración de Firebase: `lib/auth/authConfig.ts`.
- Sesiones y bloqueo: `lib/auth/sessionManager.ts`.
- Reglas de contraseña: `lib/auth/password-recovery.ts`.
