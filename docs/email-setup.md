# Configuracion de emails

## 1. Variables requeridas en el deploy

Configuralas en Vercel o en el entorno donde corre la app:

- `RESEND_API_KEY`
  - API key real de Resend.
- `RESEND_FROM_EMAIL`
  - Remitente valido, idealmente con dominio verificado.
  - Ejemplo: `Explorarg <ventas@explorar.ar>`
- `CRON_SECRET`
  - Token secreto para proteger `/api/cron/email`.
- `BRAND_NAME`
  - Opcional. Se usa para el nombre visible del remitente.

## 2. Requisito en Resend

- Verificar el dominio desde donde se envian los correos.
- Confirmar que el remitente de `RESEND_FROM_EMAIL` pertenezca a ese dominio.

## 3. GitHub Actions

Se agrego el workflow:

- `.github/workflows/email-queue-cron.yml`

Secrets necesarios en GitHub:

- `EMAIL_CRON_BASE_URL`
  - URL publica base de la app.
  - Ejemplo: `https://explorar.ar`
- `EMAIL_CRON_SECRET`
  - Debe ser exactamente el mismo valor que `CRON_SECRET` en el deploy.

El workflow:

- procesa la cola cada 5 minutos;
- permite ejecucion manual desde GitHub Actions;
- falla si la API responde fuera de `2xx`.

## 4. Endpoints utiles para probar

### Procesar cola manualmente

`POST /api/cron/email`

Header:

`Authorization: Bearer TU_CRON_SECRET`

### Enviar un correo de prueba directo

`GET /api/debug/email-test?to=tu@email.com`

Header:

`Authorization: Bearer TU_CRON_SECRET`

## 5. Checklist rapido

- `RESEND_API_KEY` cargada
- `RESEND_FROM_EMAIL` valido
- dominio verificado en Resend
- `CRON_SECRET` cargado en deploy
- `EMAIL_CRON_BASE_URL` cargado en GitHub
- `EMAIL_CRON_SECRET` cargado en GitHub
- workflow habilitado en GitHub Actions
