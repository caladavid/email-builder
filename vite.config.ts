import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss(), ui(), vueJsx()],
  server: {
    proxy: {
      '/api-zip': {
        target: 'https://services.celcom.cl/rest/protected/flex_email/addFileZip',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-zip/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue';
            if (id.includes('@nuxt/ui') || id.includes('@headlessui') || id.includes('reka-ui')) return 'vendor-ui';
            if (id.includes('dompurify')) return 'vendor-security';
            return 'vendor';
          }
          if (id.includes('HTMLToBlockParser') || id.includes('matchers') || id.includes('CSSParser')) return 'parser';
        }
      }
    }
  }
})
