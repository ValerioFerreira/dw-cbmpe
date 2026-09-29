import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Build do app INTERNO (CapRover, dentro da rede do CBMPE): VITE_APP_INTERNO=1,
// ligado no Dockerfile. Lá o dado vem do DW pelo backend (/dados/*, com
// login SGU e recorte por perfil no servidor), então os JSON com dado
// pessoal que o DW já serve NÃO entram no bundle — entram vazios, e o front
// preenche com o DW (src/data/efetivoLista.js, src/lib/lotacaoFuncao.js,
// src/lib/usePainelDw.js). Na Vercel (sem a variável), nada muda: o app não
// alcança o backend e segue com os JSON embutidos.
//
// O conteúdo vazio preserva as chaves de cada arquivo, para as telas não
// quebrarem antes de a resposta do DW chegar.
const JSON_SERVIDOS_PELO_DW = {
  'src/data/real/efetivo_lista.json': (d) => ({ fonte: d.fonte, gerado_em: d.gerado_em, por_unidade: {} }),
  // por_unidade_divisao continua: é o casamento seção do QOD -> divisão do
  // organograma, que o DW ainda não reproduz (só matrículas, sem nome).
  'src/data/real/lotacao_funcao.json': (d) => ({ ...d, por_matricula: {} }),
  'src/data/real/vacinacao_dashboard.json': () => ({ eventos: [], participacao: [] }),
  'src/data/real/ocorrencias_dashboard.json': (d) => ({
    ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? [] : v])),
  }),
  'src/data/real/financas_dashboard.json': (d) => ({
    ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? [] : v])),
  }),
}

function semDadoPessoalNoBundle() {
  const alvos = Object.fromEntries(
    Object.entries(JSON_SERVIDOS_PELO_DW).map(([rel, reduzir]) => [path.resolve(__dirname, rel), reduzir])
  )
  return {
    name: 'cbmpe-sem-dado-pessoal-no-bundle',
    enforce: 'pre',
    async load(id) {
      const reduzir = alvos[path.resolve(id.split('?')[0])]
      if (!reduzir) return null
      const { readFile } = await import('fs/promises')
      const original = JSON.parse(await readFile(id.split('?')[0], 'utf-8'))
      return JSON.stringify(reduzir(original))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const interno = (process.env.VITE_APP_INTERNO ?? env.VITE_APP_INTERNO) === '1'
  return {
    plugins: [react(), ...(interno ? [semDadoPessoalNoBundle()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
