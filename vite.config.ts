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
      // Cuando hagas fetch a '/api-zip', Vite lo redirigirá
      '/api-zip': {
        target: 'https://services.celcom.cl/rest/protected/flex_email/addFileZip',
        changeOrigin: true,
        secure: false, // Útil si el certificado SSL da problemas en local
        rewrite: (path) => path.replace(/^\/api-zip/, '')
      }
    }
  }
})
