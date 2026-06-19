import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 显式 IPv4，避免 Windows 把 localhost 解析成 ::1（IPv6）导致 ECONNREFUSED
        target: 'http://127.0.0.1:3100',
        changeOrigin: true
      }
    }
  }
})
