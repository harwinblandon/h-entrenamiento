import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base relativa: la app funciona en la raíz (local) y en una subcarpeta (GitHub Pages).
// Las rutas internas usan HashRouter, así que no necesitan configuración del servidor.
export default defineConfig({
  base: './',
  plugins: [react()],
})
