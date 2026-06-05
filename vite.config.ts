
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: Esto debe coincidir con el nombre de tu repositorio en GitHub
  base: '/AuraPharmacy/', 
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Eliminamos 'minify: terser' para usar el predeterminado (esbuild) y evitar errores si no tienes terser instalado
  },
  server: {
    port: 3000,
  }
});
