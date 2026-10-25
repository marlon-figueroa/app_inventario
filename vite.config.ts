import { defineConfig } from 'vite';

/**
 * @ionic/pwa-elements (Stencil) usa import() dinámicos que Vite no puede analizar
 * al preempaquetar dependencias. Excluirlo evita el aviso en `ng serve` al arrancar.
 */
export default defineConfig({
  optimizeDeps: {
    exclude: ['@ionic/pwa-elements'],
  },
});
