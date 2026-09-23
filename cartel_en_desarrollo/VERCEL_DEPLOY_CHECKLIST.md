# Checklist de Deploy en Vercel

## ✅ Cambios Realizados

### 1. Versiones y Compatibilidad
- ✅ Next.js actualizado a 14.2.18 (versión estable y segura)
- ✅ React 18.3.1 (no experimental)
- ✅ Todas las dependencias compatibles con React 18

### 2. Node y Package Manager
- ✅ `engines` agregado en package.json: `"node": ">=18.0.0 <21.0.0"`
- ✅ package-lock.json existe (usando npm)
- ✅ Vercel detectará automáticamente npm

### 3. App Router y "use client"
- ✅ `ComingSoon.tsx`: Agregado `'use client'` y `Date()` movido a `useEffect` para evitar hydration mismatch
- ✅ `SocialLinks.tsx`: Agregado `'use client'` (componente interactivo)
- ✅ `app/page.tsx`: Server Component (correcto)
- ✅ `app/layout.tsx`: Server Component (correcto)

### 4. Hydration Mismatch
- ✅ `Date().getFullYear()` movido a `useEffect` en ComingSoon.tsx
- ✅ No hay uso de `window`, `localStorage`, `navigator` en render
- ✅ No hay `Math.random()` en render

### 5. Runtime
- ✅ No se requiere `export const runtime = "nodejs"` (comportamiento por defecto)
- ✅ No hay dependencias que requieran edge runtime específico

### 6. Assets e Imágenes
- ✅ Logo en `/public/logo-lado-v.png` (verificado)
- ✅ Uso correcto: `<Image src="/logo-lado-v.png" />`
- ✅ Fuentes en `/app/fonts/` (correcto para next/font/local)

### 7. Tailwind
- ✅ No hay clases dinámicas problemáticas (todas explícitas)
- ✅ Colores hardcodeados: `text-[#FFD21E]`, `bg-[#1E5EFF]`
- ✅ Configuración correcta en tailwind.config.ts

## 📋 Verificación Pre-Deploy

### Instalación Local
```bash
npm install
npm run build
```

### Si hay errores en el build:
1. Verificar logs en terminal
2. Verificar que todas las fuentes estén en `app/fonts/`
3. Verificar que el logo esté en `public/logo-lado-v.png`

## 🚀 Deploy en Vercel

### Configuración Recomendada en Vercel:
- **Framework Preset**: Next.js (detectado automáticamente)
- **Build Command**: `npm run build` (por defecto)
- **Output Directory**: `.next` (por defecto)
- **Install Command**: `npm install` (por defecto)
- **Node.js Version**: 18.x o 20.x (Vercel usará la especificada en engines)

### Logs a Revisar en Vercel:
1. **Build Logs**: Buscar errores de compilación
2. **Runtime Logs**: Buscar errores de runtime/hydration
3. **Function Logs**: Si hay errores en funciones serverless

### Posibles Issues a Verificar:
- Si hay errores de fuentes: Verificar rutas en `app/fonts/`
- Si hay errores de imágenes: Verificar que `logo-lado-v.png` exista en `public/`
- Si hay errores de TypeScript: Ejecutar `npm run build` localmente primero

## 🔍 Archivos Modificados

1. `package.json`:
   - Agregado `engines`
   - Versiones actualizadas y fijadas

2. `app/components/ComingSoon.tsx`:
   - Agregado `'use client'`
   - `Date()` movido a `useEffect` para evitar hydration mismatch

3. `app/components/SocialLinks.tsx`:
   - Agregado `'use client'`

## ⚠️ Notas Importantes

- El proyecto está listo para deploy
- Todas las dependencias son compatibles
- No hay problemas conocidos de SSR/hydration
- El proyecto usa Next.js 14 App Router correctamente

