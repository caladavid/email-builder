import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_BASE = env.VITE_API_BASE ?? 'https://services.celcom.cl';

  return {
    plugins: [vue(), tailwindcss(), ui(), vueJsx()],
    server: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('HTMLToBlockParser') || id.includes('matchers') || id.includes('CSSParser')) return 'parser';
          }
        }
      }
    }
  }};
})
