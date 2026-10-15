import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_BASE = env.VITE_API_BASE ?? 'https://services.celcom.cl';

  // "npm run preview:local" only (mode localtest): the ZIP/image services
  // reject the localhost origin (CORS 403), so the preview server forwards
  // /rest/* server-side and drops the Origin header. Production (nginx) and
  // "npm run dev" never use this.
  const localTestProxy = mode === 'localtest'
    ? {
        '/rest': {
          target: env.PROXY_TARGET || 'https://services.celcom.cl',
          changeOrigin: true,
          secure: true,
          configure: (proxy: any) => {
            proxy.on('proxyReq', (proxyReq: any) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
          },
        },
      }
    : undefined;

  return {
    plugins: [vue(), tailwindcss(), ui(), vueJsx()],
    preview: localTestProxy ? { proxy: localTestProxy } : undefined,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) return 'vue';
            if (id.includes('node_modules/pinia')) return 'vue';
            if (id.includes('node_modules/@nuxt') || id.includes('node_modules/reka-ui')) return 'nuxt-ui';
            if (id.includes('node_modules/highlight.js')) return 'highlight';
            if (id.includes('HTMLToBlockParser') || id.includes('matchers') || id.includes('CSSParser')) return 'parser';
          }
        }
      }
    }
  };
})
