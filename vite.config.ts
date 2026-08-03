
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Copia `index.html` como `404.html` al compilar.
 *
 * GitHub Pages es un servidor de archivos estaticos: no sabe nada de las rutas de la
 * aplicacion, asi que responde 404 a direcciones como `/inmunizaciones/catalogo`. Al
 * dejar una copia en `404.html`, ese 404 sirve igualmente la aplicacion, que lee la
 * direccion y abre el modulo correcto. Es la solucion habitual para publicar una SPA
 * en un hosting estatico.
 */
const spaFallback = (outDir: string): Plugin => ({
  name: 'spa-fallback-404',
  apply: 'build',
  closeBundle() {
    const index = resolve(outDir, 'index.html');
    if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'));
  }
});

export default defineConfig({
  plugins: [react(), spaFallback('dist')],
  // IMPORTANTE: Esto debe coincidir con el nombre de tu repositorio en GitHub
  base: '/ToolkitSISMED/', 
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Eliminamos 'minify: terser' para usar el predeterminado (esbuild) y evitar errores si no tienes terser instalado
  },
  server: {
    port: 3000,
  }
});
