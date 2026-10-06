import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dado pessoal NÃO vai no pacote JS (que o navegador baixa antes do login): o efetivo, o
// Mapa de Força, as viaturas, a lotação e os painéis vêm do backend (DW, com login SGU e
// recorte por perfil) ou, no app publicado na Vercel, do SNAPSHOT em /snapshot/*.json
// (etl/snapshot/publicar_snapshot.py; sem nome completo, CPF, telefone, licenças nominais
// nem ofício/SEI). Os JSON que existiam em src/data/real/ com esse conteúdo foram removidos
// em 2026-10-06 — não há mais plugin que "esvazie" arquivo no build.
// VITE_APP_INTERNO=1 (Dockerfile do CapRover) só desliga o login local e o snapshot.

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
