// Dados estruturais do CBMPE — organograma, indicadores, dashboards e alertas.
//
// Portados do organograma de referência (arquivo estático "Power BI CBMPE -
// Organograma Interativo") fornecido para orientar nomes, siglas, cargos e
// divisões hierárquicas. Os números de efetivo/viaturas/materiais/finanças/
// atividades são fictícios, porém coerentes — mesmo caráter de dado de
// demonstração do arquivo de referência original.
//
// Este módulo substitui as entidades que antes vinham do backend do Base44
// (UnidadeOrganizacional, Indicador, Dashboard, Alerta). Quando houver uma
// API/planilha real para plugar, troque os `fetch*` de `src/lib/cbmpe.js`
// por chamadas HTTP — o formato dos registros abaixo já segue o mesmo
// contrato usado pelo resto do app.

import efetivoReal from "./real/efetivo.json";
import efetivoPrevistoReal from "./real/efetivo_previsto.json";
import efetivoPrevistoDivisoesReal from "./real/efetivo_previsto_divisoes.json";
import lotacaoFuncaoReal from "./real/lotacao_funcao.json";

const DIACRITICOS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(s) {
  return s
    .normalize("NFD").replace(DIACRITICOS_REGEX, "")
    .replace(/[ºª]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ----- Cargo/oficial por sigla -----
// Mantido à mão até 2026-09-29. Quando o backend alcança o DW, cada entrada
// é sobreposta pelo titular do QOD (aplicarMetricasDw, mais abaixo); esta
// tabela fica só como fallback do app fora da rede (Vercel).
const OFICIAIS = {
  'COMANDO GERAL': { oficial: 'Cel Araripe', cargo: 'Comandante Geral' },
  'SUBCOMANDO GERAL': { oficial: 'Cel Curvêlo', cargo: 'Subcomandante Geral' },
  // Estado-Maior Geral (e 1º/2º/3º EMG) NÃO entram aqui — ver
  // RAIZES_EM_CONSTRUCAO abaixo.
  'GCG': { oficial: 'Maj Rafael', cargo: 'Chefe' },
  'AECI': { oficial: 'Cel Jailton', cargo: 'Assessor Especial' },
  'CPO': { oficial: 'Maj França', cargo: 'Chefe' },
  'CPP': { oficial: 'Maj França', cargo: 'Chefe' },
  'CCS': { oficial: 'Maj Getúlio', cargo: 'Chefe' },
  'CI': { oficial: 'TC Samuel', cargo: 'Chefe' },
  'GSG': { oficial: 'Maj Allisson Carneiro', cargo: 'Chefe' },
  'DIESP': { oficial: 'Cel Lucena', cargo: 'Diretor' },
  'AJG': { oficial: 'Maj Calado', cargo: 'Chefe' },
  'DGO': { oficial: 'Cel Leonardo', cargo: 'Diretor' },
  'DIM': { oficial: 'TC Brainer', cargo: 'Diretor' },
  'DINTER I': { oficial: 'TC Ivânio', cargo: 'Diretor' },
  'DINTER II': { oficial: 'TC Clérisson', cargo: 'Diretor' },
  'GBAPH': { oficial: 'TC Cleiton', cargo: 'Comandante' },
  'GBI': { oficial: 'TC Damasceno', cargo: 'Comandante' },
  'GBS': { oficial: 'TC Barbalho', cargo: 'Comandante' },
  'GBMar': { oficial: 'Maj Otávio', cargo: 'Comandante' },
  'CAT/RMR': { oficial: 'TC Flávio Cysneiros', cargo: 'Chefe' },
  '1º GB': { oficial: 'TC Carneiro', cargo: 'Comandante' },
  '2º GB': { oficial: 'TC Dantas', cargo: 'Comandante' },
  '6º GB': { oficial: 'TC Vieira de Melo', cargo: 'Comandante' },
  '7º GB': { oficial: 'TC Melo Júnior', cargo: 'Comandante' },
  'CAT/ZM': { oficial: 'Maj Cibely', cargo: 'Chefe' },
  'CAT/AG': { oficial: 'Maj Cledjones', cargo: 'Chefe' },
  '3º GB': { oficial: 'Maj Isaac', cargo: 'Comandante' },
  '4º GB': { oficial: 'TC Alisson', cargo: 'Comandante' },
  '5º GB': { oficial: 'Maj Castro', cargo: 'Comandante' },
  '9º GB': { oficial: 'Maj Lamartine', cargo: 'Comandante' },
  'CAT/SE': { oficial: 'TC Oliveira', cargo: 'Chefe' },
  // DGA: posição confirmada no organograma, unidade ainda não criada — sem
  // titular, o card mostra "Em construção" (como o Estado-Maior).
  'DGA': { oficial: 'Em construção', cargo: '' },
  'DPLAG': { oficial: 'TC Barros Leite', cargo: 'Diretor' },
  'DGP': { oficial: 'TC Wagner', cargo: 'Diretor' },
  'DVP': { oficial: 'TC Pablo', cargo: 'Diretor' },
  'DJD': { oficial: 'TC Berenguer', cargo: 'Diretor' },
  'DF': { oficial: 'TC Anderson Carvalho', cargo: 'Diretor' },
  'DAS': { oficial: 'TC Bartolomeu', cargo: 'Diretor' },
  'DTIC': { oficial: 'TC Dallas', cargo: 'Diretor' },
  'DLOG': { oficial: 'Cel Vitoriano', cargo: 'Diretor' },
  'CMAN': { oficial: 'TC Helder', cargo: 'Chefe' },
  'CINT': { oficial: 'Maj Zovka', cargo: 'Chefe' },
  'CEAO': { oficial: 'TC Josinaldo', cargo: 'Chefe' },
  'DEIP': { oficial: 'Cel Aprígio', cargo: 'Diretor' },
  'ABMG': { oficial: 'Maj João Paulo', cargo: 'Comandante' },
  'CEFD': { oficial: 'Maj Silva', cargo: 'Chefe' },
};

// ----- Hierarquia (estrutura editável em /adm > Organograma) -----
//
// Até 2026-09-23 isto era um objeto ARVORE fixo (sigla -> array de siglas
// subordinadas) hardcoded aqui. Agora a árvore fica no backend
// (backend/data/organograma.json, servido por GET /organograma —
// ver src/lib/organogramaClient.js) e o admin edita via /adm. O que fica
// abaixo é só o ESTADO INICIAL/FALLBACK: a mesma estrutura migrada 1:1 do
// ARVORE antigo (mesma contagem de unidades, mesmos pais — conferido na
// migração), usada quando o backend está fora do ar ou não configurado
// (VITE_AUTH_API_URL vazio), pra o app nunca ficar sem organograma nenhum.
//
// Cada nó carrega o `nivel` hierárquico (1 Comando Geral, 2 Subcomando
// Geral, 3 Estado Maior, 4 Diretoria Executiva, 5 Diretoria Setorial, 6 OME
// Subordinada) explicitamente, porque a partir da migração de 2026-09-23 o
// nível deixou de ser "1 + profundidade na árvore a partir do Comando
// Geral": unidades de nível 6 como GCG/CI/CPO/AECI/CCS/GSG/AJG/CPP são
// filhas DIRETAS do Comando/Subcomando Geral (profundidade 2), mas
// continuam nível 6 (gabinetes/comissões, não diretorias de verdade —
// confirmado pelo usuário) e aparecem no organograma AO LADO do balão do
// pai, não abaixo dele (ver Organograma.jsx). `id` é estável (não
// recalculado a partir da sigla) — sobrevive a uma renomeação, pra não
// quebrar referências existentes (localStorage de "recentes", unidade_id
// de indicador/dashboard/alerta).
//
// 2026-09-25: o Estado Maior (nível 3) deixou de ser "reservado, sem
// unidade" — agora é uma unidade real, filha do Subcomando Geral, renomeada
// para "Estado-Maior Geral", exibida no mesmo formato visual de uma
// Diretoria Executiva (balão dourado + body cinza com as 3 subordinadas —
// ver Organograma.jsx), posicionada à esquerda do balão do Subcomando
// Geral, na mesma altura. Nível 4 (Diretoria Executiva) CONTINUA filho
// direto do Subcomando Geral (não do Estado-Maior — testado e revertido no
// mesmo dia após confusão inicial). Nível 5 foi renomeado, de "Diretoria
// Especialista" para "Diretoria Setorial".
//
// `ordem` (2026-09-23) é a posição de exibição entre irmãos (mesmo
// parentId) — sem ela, Organograma.jsx caía pra ordem alfabética da sigla,
// o que embaralhava agrupamentos com ordem própria (ex.: DGO antes de DGA,
// DIM/DINTER I/DINTER II/DIESP nessa ordem). É por onde o arrastar-e-soltar
// do organograma (admin, ver Organograma.jsx > useArrastarOrganograma)
// grava reposicionamento/mudança de pai — valores espaçados de 10 em 10 de
// propósito, pra inserir entre dois existentes sem ter que renumerar os
// outros (novo valor = média dos vizinhos).
const NODES_PADRAO = [
  { id: 'comando-geral', sigla: 'COMANDO GERAL', nivel: 1, parentId: null, fixo: true, ordem: 10 },
  { id: 'subcomando-geral', sigla: 'SUBCOMANDO GERAL', nivel: 2, parentId: 'comando-geral', fixo: true, ordem: 20 },
  { id: 'gcg', sigla: 'GCG', nivel: 6, parentId: 'comando-geral', ordem: 30 },
  { id: 'ci', sigla: 'CI', nivel: 6, parentId: 'comando-geral', ordem: 40 },
  { id: 'cpo', sigla: 'CPO', nivel: 6, parentId: 'comando-geral', ordem: 50 },
  { id: 'aeci', sigla: 'AECI', nivel: 6, parentId: 'comando-geral', ordem: 60 },
  { id: 'ccs', sigla: 'CCS', nivel: 6, parentId: 'comando-geral', ordem: 70 },
  { id: 'gsg', sigla: 'GSG', nivel: 6, parentId: 'subcomando-geral', ordem: 80 },
  { id: 'ajg', sigla: 'AJG', nivel: 6, parentId: 'subcomando-geral', ordem: 90 },
  { id: 'cpp', sigla: 'CPP', nivel: 6, parentId: 'subcomando-geral', ordem: 100 },
  { id: 'estado-maior', sigla: 'ESTADO-MAIOR GERAL', nivel: 3, parentId: 'subcomando-geral', fixo: true, ordem: 105 },
  { id: '1-emg', sigla: '1º EMG', nivel: 6, parentId: 'estado-maior', ordem: 10 },
  { id: '2-emg', sigla: '2º EMG', nivel: 6, parentId: 'estado-maior', ordem: 20 },
  { id: '3-emg', sigla: '3º EMG', nivel: 6, parentId: 'estado-maior', ordem: 30 },
  { id: 'dgo', sigla: 'DGO', nivel: 4, parentId: 'subcomando-geral', ordem: 110 },
  { id: 'dga', sigla: 'DGA', nivel: 4, parentId: 'subcomando-geral', ordem: 120 },
  { id: 'dim', sigla: 'DIM', nivel: 5, parentId: 'dgo', ordem: 130 },
  { id: 'dinter-i', sigla: 'DINTER I', nivel: 5, parentId: 'dgo', ordem: 140 },
  { id: 'dinter-ii', sigla: 'DINTER II', nivel: 5, parentId: 'dgo', ordem: 150 },
  { id: 'diesp', sigla: 'DIESP', nivel: 5, parentId: 'dgo', ordem: 160 },
  { id: 'gbi', sigla: 'GBI', nivel: 6, parentId: 'dim', ordem: 170 },
  { id: 'gbaph', sigla: 'GBAPH', nivel: 6, parentId: 'dim', ordem: 180 },
  { id: 'gbs', sigla: 'GBS', nivel: 6, parentId: 'dim', ordem: 190 },
  { id: 'gbmar', sigla: 'GBMar', nivel: 6, parentId: 'dim', ordem: 200 },
  { id: 'cat-rmr', sigla: 'CAT/RMR', nivel: 6, parentId: 'dim', ordem: 210 },
  { id: '1-gb', sigla: '1º GB', nivel: 6, parentId: 'dinter-i', ordem: 220 },
  { id: '2-gb', sigla: '2º GB', nivel: 6, parentId: 'dinter-i', ordem: 230 },
  { id: '6-gb', sigla: '6º GB', nivel: 6, parentId: 'dinter-i', ordem: 240 },
  { id: '7-gb', sigla: '7º GB', nivel: 6, parentId: 'dinter-i', ordem: 250 },
  { id: 'cat-zm', sigla: 'CAT/ZM', nivel: 6, parentId: 'dinter-i', ordem: 260 },
  { id: 'cat-ag', sigla: 'CAT/AG', nivel: 6, parentId: 'dinter-i', ordem: 270 },
  { id: '3-gb', sigla: '3º GB', nivel: 6, parentId: 'dinter-ii', ordem: 280 },
  { id: '4-gb', sigla: '4º GB', nivel: 6, parentId: 'dinter-ii', ordem: 290 },
  { id: '5-gb', sigla: '5º GB', nivel: 6, parentId: 'dinter-ii', ordem: 300 },
  { id: '9-gb', sigla: '9º GB', nivel: 6, parentId: 'dinter-ii', ordem: 310 },
  { id: 'cat-se', sigla: 'CAT/SE', nivel: 6, parentId: 'dinter-ii', ordem: 320 },
  { id: 'dgp', sigla: 'DGP', nivel: 5, parentId: 'dga', ordem: 330 },
  { id: 'dvp', sigla: 'DVP', nivel: 5, parentId: 'dga', ordem: 340 },
  { id: 'djd', sigla: 'DJD', nivel: 5, parentId: 'dga', ordem: 350 },
  { id: 'df', sigla: 'DF', nivel: 5, parentId: 'dga', ordem: 360 },
  { id: 'das', sigla: 'DAS', nivel: 5, parentId: 'dga', ordem: 370 },
  { id: 'dtic', sigla: 'DTIC', nivel: 5, parentId: 'dga', ordem: 380 },
  { id: 'dlog', sigla: 'DLOG', nivel: 5, parentId: 'dga', ordem: 390 },
  { id: 'deip', sigla: 'DEIP', nivel: 5, parentId: 'dga', ordem: 400 },
  { id: 'dplag', sigla: 'DPLAG', nivel: 5, parentId: 'dga', ordem: 410 },
  { id: 'cman', sigla: 'CMAN', nivel: 6, parentId: 'dlog', ordem: 420 },
  { id: 'cint', sigla: 'CINT', nivel: 6, parentId: 'dlog', ordem: 430 },
  { id: 'ceao', sigla: 'CEAO', nivel: 6, parentId: 'dlog', ordem: 440 },
  { id: 'abmg', sigla: 'ABMG', nivel: 6, parentId: 'deip', ordem: 450 },
  { id: 'cefd', sigla: 'CEFD', nivel: 6, parentId: 'deip', ordem: 460 },
];

// ----- LOB Nova (2026-10-01) -----
// Segunda hierarquia, só para visualização enquanto a nova LOB não é efetivada:
// o seletor "LOB Atual/Nova" do organograma (só Administrador, Comandante e
// Subcomandante Geral) troca TODA a árvore do app — organograma, contagens,
// tabelas — por esta. Fica no código (não é editável em /adm, que edita só a
// LOB atual). Quando a nova LOB valer de verdade, isto vira a árvore oficial.
//
// Regras definidas pelo usuário:
// - Unidade com função de Coronel ganha o card dourado (`funcaoCoronel`).
// - Renomeadas (DEIP→DECI, DLOG→DAL, CINT→CSM/INT, CMAN→CSM/MOTO) levam os dados
//   da unidade de origem (ALIAS_NOVA).
// - Unidades novas (ARI, AJ, DINTER III, GI, CEI, CFO, CAEBM, CCBM, CRESEP) ainda
//   não têm OME no SGP: `emConstrucao`, sem dados.
// - A DPlaG é extinta e absorvida pela DGA: fica na árvore como nó `oculto`
//   (não aparece no organograma nem nas listas, mas soma nas contagens da DGA) e o
//   diretor dela NÃO vira diretor da DGA (que segue "Em construção").
// - Estado-Maior Geral, e os subordinados de DIM, DINTER I e DINTER II, não mudam.
const ALIAS_NOVA = { 'DECI': 'DEIP', 'DAL': 'DLOG', 'CSM/INT': 'CINT', 'CSM/MOTO': 'CMAN' };

const NODES_NOVA = (() => {
  // Sai do fallback tudo que é reposicionado/renomeado abaixo.
  const REFEITOS = new Set(['gcg', 'ci', 'cpo', 'aeci', 'ccs', 'gsg', 'ajg', 'cpp', 'diesp', 'dgp', 'dvp', 'djd', 'df',
    'das', 'dtic', 'dlog', 'deip', 'dplag', 'cman', 'cint', 'ceao', 'abmg', 'cefd']);
  const base = NODES_PADRAO.filter((n) => !REFEITOS.has(n.id));
  const no = (id, sigla, nivel, parentId, ordem, extra = {}) => ({ id, sigla, nivel, parentId, ordem, ...extra });
  return [
    ...base,
    // Subordinados diretos do Comando Geral*
    no('gcg', 'GCG', 6, 'comando-geral', 30),
    no('aeci', 'AECI', 6, 'comando-geral', 40, { funcaoCoronel: true }),
    no('ari', 'ARI', 6, 'comando-geral', 50, { emConstrucao: true }),
    no('ci', 'CI', 6, 'comando-geral', 60),
    no('ccs', 'CCS', 6, 'comando-geral', 70),
    no('cpo', 'CPO', 6, 'comando-geral', 80),
    no('aj', 'AJ', 6, 'comando-geral', 90, { emConstrucao: true }),
    // Subordinados diretos do Subcomando Geral* (Estado-Maior, DGO e DGA não mudam de pai)
    no('gsg', 'GSG', 6, 'subcomando-geral', 80),
    no('djd', 'DJD', 6, 'subcomando-geral', 90, { funcaoCoronel: true }),
    no('cpp', 'CPP', 6, 'subcomando-geral', 100),
    // DGO*: DINTER III fica sem subordinados e acima da DIESP (ver Organograma.jsx: 4 colunas)
    no('dinter-iii', 'DINTER III', 5, 'dgo', 155, { emConstrucao: true }),
    no('diesp', 'DIESP', 5, 'dgo', 160),
    // DGA*
    no('deci', 'DECI', 5, 'dga', 330),
    no('abmg', 'ABMG', 6, 'deci', 450, { funcaoCoronel: true }),
    no('cei', 'CEI', 7, 'abmg', 451, { emConstrucao: true }),
    no('cfo', 'CFO', 7, 'abmg', 452, { emConstrucao: true }),
    no('caebm', 'CAEBM', 7, 'abmg', 453, { emConstrucao: true }),
    no('ccbm', 'CCBM', 6, 'deci', 455, { emConstrucao: true }),
    no('cefd', 'CEFD', 6, 'deci', 460),
    no('dal', 'DAL', 5, 'dga', 340),
    no('csm-int', 'CSM/INT', 6, 'dal', 420),
    no('csm-moto', 'CSM/MOTO', 6, 'dal', 430),
    no('ceao', 'CEAO', 6, 'dal', 440),
    // DGP: grupo posto embaixo do grupo da DAL, na mesma coluna (ver Organograma.jsx).
    no('dgp', 'DGP', 5, 'dga', 350, { abaixoDe: 'dal' }),
    no('cresep', 'CRESEP', 6, 'dgp', 351, { emConstrucao: true }),
    no('df', 'DF', 5, 'dga', 360),
    no('dtic', 'DTIC', 5, 'dga', 370),
    no('dvp', 'DVP', 5, 'dga', 380),
    no('das', 'DAS', 5, 'dga', 390),
    no('ajg', 'AJG', 6, 'dga', 395),
    no('gi', 'GI', 6, 'dgp', 352, { emConstrucao: true }),
    no('dplag', 'DPLAG', 5, 'dga', 410, { oculto: true }),
  ];
})();

// Dados (métricas, chefes, divisões) vivem sob a sigla da LOB atual. Na LOB Nova,
// uma unidade renomeada lê os dados da sigla antiga. Guardado em módulo porque
// metricasProprias()/metricasDivisoesProprias() são chamadas na hora de
// renderizar, depois de montarOrganograma().
let ALIAS_ATIVO = {};
export function siglaDeDados(sigla) {
  return ALIAS_ATIVO[sigla] || sigla;
}

// Siglas subordinadas diretas de `sigla`, segundo a lista de nós `nodes`
// (que pode ser o fallback estático acima ou a árvore vinda do backend).
function filhosSiglas(nodes, sigla) {
  const no = nodes.find((n) => n.sigla === sigla);
  if (!no) return [];
  return nodes.filter((n) => n.parentId === no.id).map((n) => n.sigla);
}

// ----- Métricas próprias (não agregadas) por unidade -----
const METRICAS = {
  'COMANDO GERAL': { efetivo: 22, viaturas: 4, financas: 180000, financaPct: 93 },
  'SUBCOMANDO GERAL': { efetivo: 14, viaturas: 3, financas: 95000, financaPct: 90 },
  'GCG': { efetivo: 18, viaturas: 2, financas: 45000, financaPct: 88 },
  'AECI': { efetivo: 12, viaturas: 1, financas: 35000, financaPct: 91 },
  'CPO': { efetivo: 10, viaturas: 1, financas: 25000, financaPct: 86 },
  'CCS': { efetivo: 16, viaturas: 2, financas: 40000, financaPct: 89 },
  'CI': { efetivo: 20, viaturas: 3, financas: 55000, financaPct: 90 },
  'GSG': { efetivo: 15, viaturas: 2, financas: 38000, financaPct: 88 },
  'DIESP': { efetivo: 30, viaturas: 3, financas: 75000, financaPct: 87 },
  'AJG': { efetivo: 14, viaturas: 1, financas: 32000, financaPct: 89 },
  'CPP': { efetivo: 9, viaturas: 1, financas: 20000, financaPct: 90 },
  'DGO': { efetivo: 24, viaturas: 3, financas: 60000, financaPct: 88 },
  'DIM': { efetivo: 20, viaturas: 3, financas: 55000, financaPct: 88 },
  'GBI': { efetivo: 95, viaturas: 12, financas: 210000, financaPct: 91 },
  'GBAPH': { efetivo: 80, viaturas: 10, financas: 185000, financaPct: 90 },
  'GBS': { efetivo: 70, viaturas: 9, financas: 160000, financaPct: 89 },
  'GBMar': { efetivo: 45, viaturas: 6, financas: 110000, financaPct: 88 },
  'CAT/RMR': { efetivo: 38, viaturas: 5, financas: 95000, financaPct: 87 },
  'DINTER I': { efetivo: 18, viaturas: 2, financas: 50000, financaPct: 86 },
  '1º GB': { efetivo: 60, viaturas: 7, financas: 140000, financaPct: 88 },
  '2º GB': { efetivo: 75, viaturas: 9, financas: 170000, financaPct: 89 },
  '6º GB': { efetivo: 50, viaturas: 6, financas: 115000, financaPct: 87 },
  '7º GB': { efetivo: 55, viaturas: 6, financas: 125000, financaPct: 87 },
  'CAT/ZM': { efetivo: 32, viaturas: 4, financas: 80000, financaPct: 86 },
  'CAT/AG': { efetivo: 30, viaturas: 4, financas: 78000, financaPct: 86 },
  'DINTER II': { efetivo: 16, viaturas: 2, financas: 48000, financaPct: 85 },
  '3º GB': { efetivo: 48, viaturas: 6, financas: 112000, financaPct: 86 },
  '4º GB': { efetivo: 52, viaturas: 6, financas: 118000, financaPct: 87 },
  '5º GB': { efetivo: 46, viaturas: 5, financas: 105000, financaPct: 85 },
  '9º GB': { efetivo: 40, viaturas: 5, financas: 95000, financaPct: 84 },
  'CAT/SE': { efetivo: 35, viaturas: 5, financas: 88000, financaPct: 84 },
  'DGA': { efetivo: 22, viaturas: 3, financas: 65000, financaPct: 90 },
  'DPLAG': { efetivo: 18, viaturas: 2, financas: 48000, financaPct: 88 },
  'DGP': { efetivo: 28, viaturas: 2, financas: 70000, financaPct: 89 },
  'DVP': { efetivo: 20, viaturas: 2, financas: 52000, financaPct: 88 },
  'DJD': { efetivo: 16, viaturas: 1, financas: 38000, financaPct: 90 },
  'DF': { efetivo: 24, viaturas: 2, financas: 95000, financaPct: 92 },
  'DAS': { efetivo: 18, viaturas: 2, financas: 42000, financaPct: 87 },
  'DTIC': { efetivo: 20, viaturas: 1, financas: 60000, financaPct: 91 },
  'DLOG': { efetivo: 26, viaturas: 4, financas: 80000, financaPct: 88 },
  'CMAN': { efetivo: 34, viaturas: 8, financas: 98000, financaPct: 89 },
  'CINT': { efetivo: 22, viaturas: 3, financas: 60000, financaPct: 86 },
  'CEAO': { efetivo: 19, viaturas: 2, financas: 55000, financaPct: 87 },
  'DEIP': { efetivo: 20, viaturas: 2, financas: 58000, financaPct: 89 },
  'ABMG': { efetivo: 65, viaturas: 5, financas: 150000, financaPct: 90 },
  'CEFD': { efetivo: 14, viaturas: 1, financas: 30000, financaPct: 87 },
};

// ----- Overlay de Efetivo real (fonte: Neon, ver etl/efetivo/) -----
// Substitui o efetivo fictício de TODAS as unidades pelo valor real (0
// incluído, ex. DGA — unidade "planejada" — e CPP, que não tem lotação
// direta nessa fonte) para nunca misturar número real com mock na mesma
// tela. Militares sem unidade mapeada na fonte (hoje só "ADIDO") entram
// só no total do Comando Geral, nunca atribuídos a uma unidade específica
// — decisão registrada em DW_PLANEJAMENTO.md.
Object.keys(METRICAS).forEach((sigla) => {
  METRICAS[sigla] = { ...METRICAS[sigla], efetivo: efetivoReal.por_unidade[sigla] ?? 0 };
});
const efetivoNaoLotado = Object.values(efetivoReal.nao_lotados || {}).reduce((a, b) => a + b, 0);
if (efetivoNaoLotado > 0 && METRICAS['COMANDO GERAL']) {
  METRICAS['COMANDO GERAL'] = {
    ...METRICAS['COMANDO GERAL'],
    efetivo: METRICAS['COMANDO GERAL'].efetivo + efetivoNaoLotado,
  };
}

// ----- Overlay de Efetivo Previsto real (fonte: QOD, ver etl/efetivo/) -----
// Mesmo princípio dos demais overlays: substitui o previsto fictício
// (antes um multiplicador aleatório do atual) pelo previsto oficial da
// planilha QOD, por unidade (0 incluído — ex. DGA, unidade "planejada" que
// não aparece no QOD). CPPA soma dentro de DGP, mesma regra do Efetivo
// atual — decisão registrada em DW_PLANEJAMENTO.md.
Object.keys(METRICAS).forEach((sigla) => {
  METRICAS[sigla] = { ...METRICAS[sigla], efetivoPrevisto: efetivoPrevistoReal.por_unidade[sigla] ?? 0 };
});

// ----- Viaturas: sem número fictício (2026-10-06) -----
// O valor real vem do DW (aplicarMetricasDw, domínio "viaturas": veículos da
// unidade, sem os descarregados e sem os de unidade fora do organograma, como a
// GTA). Antes do DW responder, o card mostra 0, nunca o mock — mesmo princípio
// de Finanças logo abaixo. O JSON viaturas_lista.json que alimentava este
// overlay foi removido.
Object.keys(METRICAS).forEach((sigla) => {
  METRICAS[sigla] = { ...METRICAS[sigla], viaturas: 0 };
});

// ----- Finanças: sem número fictício (2026-10-01) -----
// O valor real vem do DW (aplicarMetricasDw, domínio "financas": soma do valor
// PAGO das linhas EMPENHADO — Autorização/Carnaval só enquadramento SI; SFI
// Ordinário completo). Antes do DW responder, o card mostra 0, nunca o mock.
// O percentual de execução (financaPct) não é sobreposto — o usuário pediu para
// não mostrar percentual por enquanto (ver executadoPct).
Object.keys(METRICAS).forEach((sigla) => {
  METRICAS[sigla] = { ...METRICAS[sigla], financas: 0 };
});

// ----- Overlay do DW (GET /dados/metricas, ver backend/services/dadosService.js) -----
// Quando o backend responde (app no CapRover, dentro da rede), os números
// dos domínios que vieram passam a ser os do DW, atualizados todo dia pelo
// flow do Windmill. Mesmo princípio dos overlays acima: o domínio que veio
// substitui o valor de TODAS as unidades (0 para quem o DW não conta), e o
// domínio que não veio fica como estava (JSON embutido) — o app nunca mistura
// as duas fontes dentro de um mesmo domínio. Valores são os PRÓPRIOS da
// unidade; o rollup continua em totaisDaSigla. No DW os adidos já contam no
// próprio do Comando Geral (a OME ADIDOS pende dele), então não há o ajuste
// de efetivoNaoLotado que o JSON precisa.
const CAMPO_POR_DOMINIO = { efetivo: "efetivo", viaturas: "viaturas", financas: "financas", previsto: "efetivoPrevisto" };

// "VIEIRA DE MELO" -> "Vieira de Melo", como o organograma sempre exibiu.
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
function nomeExibicao(nome) {
  return (nome || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// Unidades que o organograma mostra "Em construção" no lugar do titular, e que
// o DW não deve preencher nem marcar como "Vago".
const SEM_TITULAR_EM_CONSTRUCAO = new Set(['DGA']);

export function aplicarMetricasDw({ metricas = {}, chefes = null, dominios = {} } = {}) {
  const aplicados = Object.keys(dominios).filter((d) => CAMPO_POR_DOMINIO[d]);
  aplicados.forEach((dominio) => {
    const campo = CAMPO_POR_DOMINIO[dominio];
    Object.keys(METRICAS).forEach((sigla) => {
      METRICAS[sigla] = { ...METRICAS[sigla], [campo]: metricas[sigla]?.[dominio] ?? 0 };
    });
  });
  // Titulares do QOD (marts.chefe_organograma). Unidade que o QOD não
  // resolve mantém o que já tinha; função sem ocupante vira "Vago" — nunca
  // um nome que não está no QOD.
  if (chefes) {
    Object.entries(chefes).forEach(([sigla, c]) => {
      if (SEM_TITULAR_EM_CONSTRUCAO.has(sigla)) return;
      const oficial = c.vago ? "Vago" : [c.posto, nomeExibicao(c.nome)].filter(Boolean).join(" ") || "—";
      OFICIAIS[sigla] = { oficial, cargo: c.cargo || OFICIAIS[sigla]?.cargo || "Titular" };
    });
    aplicados.push("chefes");
  }
  return aplicados;
}

// ----- Divisões/seções internas por unidade (inclui itens que também são
// nós próprios da árvore — filtrados na leitura abaixo) -----
const SUBSETORES = {
  'COMANDO GERAL': ['SUBCOMANDO GERAL', 'GCG', 'CI', 'CPO', 'AECI', 'CCS'],
  'SUBCOMANDO GERAL': ['ESTADO-MAIOR GERAL', 'DGO', 'DGA', 'GSG', 'AJG', 'CPP'],
  'ESTADO-MAIOR GERAL': ['1º EMG', '2º EMG', '3º EMG'],
  'GCG': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Assessoria Jurídica - AJ', '↳ Assessoria de Relações Institucionais'],
  'AECI': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento de Controle Interno - DPCI'],
  'CPO': ['↳ Presidência', '↳ Secretaria da Comissão de Promoção de Oficiais - SCPO', '↳ Membros'],
  'CCS': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Seção de Ações Preventivas - SAP', '↳ Seção de Impressa e Jornalismo - SIJ', '↳ Seção de Marketing e Relações Públicas - SMRP', '↳ Seção de Cerimonial e Eventos - SCE'],
  'CI': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Inteligência - DI', '↳ Divisão de Planejamento e Análise de Risco - DPAR'],
  'GSG': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Assessoria de Atividades Técnicas - AAT', '↳ Assessoria de Gestão e Governança de Dados - AGGD'],
  'DIESP': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Secretaria da Comissão Interna de Atividades Técnicas - SCIATec', '↳ Divisão de Planejamento de Operações - DPO', '↳ Divisão de Normatização e Doutrina - DND', '↳ Divisão de Atendimento ao Público - DAP', '↳ Seção de Isenção e Restituição - SIR', '↳ Divisão de Projetos Contra Incêndio e Pânico - DPCIP'],
  'AJG': ['↳ Chefia', '↳ Secretaria', '↳ Divisão de Protocolo, Publicação e Arquivo', '↳ Divisão Administrativa - DA'],
  'CPP': ['↳ Presidência', '↳ Secretaria da Comissão de Promoção de Praças - SCPP', '↳ Membros'],
  'DGO': ['DIM', 'DINTER I', 'DINTER II', 'DIESP', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento de Operações - DPO', '↳ Divisão de Apoio Operacional - DAO', '↳ Divisão de Coordenação Operacional - DCO'],
  'DIM': ['GBI', 'GBAPH', 'GBS', 'GBMar', 'CAT/RMR', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento de Operações - DPO', '↳ Divisão de Resposta a Desastres - DRD'],
  'GBI': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - Div. Op.', '↳ 1ª SBI/GBI (Jaboatão dos Guararapes)', '↳ 2ª SBI/GBI (Complexo QCG)', '↳ 3ª SBI/GBI (SUAPE)', '↳ 4ª SBI/GBI (AENA)', '↳ SBFN/GBI (Fernando de Noronha)', '↳ Divisão Administrativa - DA'],
  'GBAPH': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - Div. Op.', '↳ 1ª SBAPH/GBAPH (Olinda)', '↳ 2ª SBAPH/GBAPH (Igarassu)', '↳ 3ª SBAPH/GBAPH (São Lourenço da Mata)', '↳ 4ª SBAPH/GBAPH (Motorresgate - Sede)', '↳ Divisão Administrativa - DA'],
  'GBS': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - Div. Op.', '↳ 1ª SBS/GBS (Abreu e Lima)', '↳ 2ª SBS/GBS (Canil)', '↳ 3ª SBS/GBS (Mergulho)', '↳ 4ª SBS/GBS (Produtos Perigosos e Incêndio Florestais)', '↳ 5ª SBS/GBS (Respostas a Desastres)', '↳ Divisão Administrativa - DA'],
  'GBMar': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - Div. Op.', '↳ 1ª SBSA/GBMar (Jaboatão dos Guararapes)', '↳ 2ª SBSA/GBMar (Jaboatão dos Guararapes)', '↳ Divisão Administrativa - DA'],
  'CAT/RMR': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', '↳ Divisão de Serviços Técnicos - DSTec', '↳ 1ª SATec', '↳ 2ª SATec', '↳ 3ª SATec', '↳ 4ª SATec', '↳ Divisão Administrativa - DA'],
  'DINTER I': ['1º GB', '2º GB', '6º GB', '7º GB', 'CAT/ZM', 'CAT/AG', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento de Operações - DPO', '↳ Divisão de Resposta Operacional - DRD'],
  '1º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/1º GB (Vitória de Santo Antão)', '↳ 2ª SB/1º GB (Palmares)', '↳ 3ª SB/1º GB (Gravatá)', '↳ Divisão Administrativa - DA'],
  '2º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DivOP', '↳ 1ª SB/2º GB (Caruaru)', '↳ 2ª SB/2º GB (Bezerros)', '↳ 3ª SB/2º GB (Belo Jardim)', '↳ 4ª SB/2º GB (Bonito)', '↳ 5ª SB/2º GB (Toritama)', '↳ 6ª SB/2º GB (Santa Cruz do Capibaribe)', '↳ 7ª SB/2º GB (Mergulho ZM e AG)', '↳ Divisão Administrativa - DA'],
  '6º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/6º GB (Garanhuns)', '↳ 2ª SB/6º GB (Bom Conselho)', '↳ Divisão Administrativa - DA'],
  '7º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/7º GB (Carpina)', '↳ 2ª SB/7º GB (Goiana)', '↳ 3ª SB/7º GB (Macaparana)', '↳ 4ª SB/7º GB (Surubim)', '↳ Divisão Administrativa - DA'],
  'CAT/ZM': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', '↳ Divisão de Serviços Técnicos - DSTec', '↳ 1ª SATec (Carpina)', '↳ 2ª SATec (Goiana)', '↳ 3ª SATec (Vitória de Santo Antão)', '↳ Divisão Administrativa - DA'],
  'CAT/AG': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', '↳ Divisão de Serviços Técnicos - DSTec', '↳ 1ª SATec (Caruaru)', '↳ 2ª SATec (Garanhuns)', '↳ 3ª SATec (Belo Jardim)', '↳ 4ª SATec (Toritama)', '↳ Divisão Administrativa - DA'],
  'DINTER II': ['3º GB', '4º GB', '5º GB', '9º GB', 'CAT/SE', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento de Operações - DPO', '↳ Divisão de Resposta Operacional - DRD'],
  '3º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/3º GB (Serra Talhada)', '↳ 2ª SB/3º GB (Afogados da Ingazeira)', '↳ 3ª SB/3º GB (São José do Egito)', '↳ 4ª SB/3º GB (Petrolândia)', '↳ Divisão Administrativa - DA'],
  '4º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/4º GB (Petrolina)', '↳ 2ª SB/4º GB (Santa Maria da Boa Vista)', '↳ 3ª SB/4º GB (Mergulho SE)', '↳ Divisão Administrativa - DA'],
  '5º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/5º GB (Salgueiro)', '↳ 2ª SB/5º GB (São José Belmonte)', '↳ 3ª SB/5º GB (Araripina)', '↳ 4ª SB/5º GB (Ouricuri)', '↳ Divisão Administrativa - DA'],
  '9º GB': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', 'Divisão de Operações - DO', '↳ 1ª SB/9º GB (Arcoverde)', '↳ 2ª SB/9º GB (Pesqueira)', '↳ 3ª SB/9º GB (Custódia)', '↳ Divisão Administrativa - DA'],
  'CAT/SE': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', '↳ Divisão de Planejamento e Serviços Técnicos', '↳ 1ª SATec (Salgueiro)', '↳ 2ª SATec (Petrolina)', '↳ 3ª SATec (Serra Talhada)', '↳ 4ª SATec (Arcoverde)', '↳ 5ª SATec (Araripina)', '↳ Divisão Administrativa - DA'],
  'DGA': ['DGP', 'DVP', 'DJD', 'DF', 'DAS', 'DTIC', 'DLOG', 'DEIP', 'DPLAG', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm'],
  'DPLAG': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento e Gestão Estratégica - DPGE', '↳ Divisão Projetos e Captação de Recursos - DPCR', '↳ Divisão de Convênios e Acordo de Cooperação - DCAC', '↳ Divisão de Tributação e Orçamento - DTO'],
  // CPPA (Centro de Pagamento de Pessoal Ativo) tem aba própria no QOD mas
  // soma dentro de DGP no organograma (não é unidade própria — decisão já
  // registrada em DW_PLANEJAMENTO.md) — listada aqui como mais uma divisão
  // de DGP para exibir seu efetivo previsto na tabela de setores vinculados.
  'DGP': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Ativos - DA', '↳ Divisão de Direitos - DDIr', '↳ Divisão de Movimentação e Controle de Pessoal - DMCP', '↳ Divisão de Normatização e Programas - DNP', '↳ CPPA'],
  'DAS': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Programas Sociais - DPS', '↳ Divisão Administrativa'],
  'DJD': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento de Justiça e Disciplina - DPJD', '↳ Divisão de Justiça e Disciplina - Div. JD'],
  'DVP': ['↳ Diretoria', '↳ Divisão de Transferência para Reserva e Reformas - DTRR', '↳ Divisão de Inativos - DI', '↳ Divisão de Direitos'],
  'DTIC': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Projetos - DP', '↳ Divisão de Coordenação Técnica - DCT'],
  'DLOG': ['CMAN', 'CINT', 'CEAO', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento Logístico - DPL', '↳ Divisão de Gestão de Contratos - DGC', '↳ Divisão de Gestão de Patrimônio - DGPat', '↳ Divisão de Gestão de Transporte e Combustível - DGTC', '↳ Divisão de Controle de Inquéritos Administrativos e Logísticos - DCIAL', '↳ Divisão de Compras e Serviços - DCS'],
  'DF': ['↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Planejamento e Administração Financeira e Orçamentária', '↳ Divisão de Prestação de Contas', '↳ Divisão de Tesouraria Geral', '↳ Divisão de Controle Orçamentário e Financeiro'],
  'DEIP': ['ABMG', 'CEFD', '↳ Diretoria', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Ensino e Pesquisa - DEP', '↳ Divisão de Admissão, Credenciamento e Fiscalização - DACF'],
  'CMAN': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Gestão de Manutenção - DGM', '↳ Divisão Administrativa - DA'],
  'CINT': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Gestão de Suprimentos - DGS'],
  'CEAO': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Divisão de Projetos - DP', '↳ Divisão Administrativa - DA'],
  'ABMG': ['↳ Comando', '↳ Subcomando', '↳ Secretaria e Apoio do Comando - SAC', '↳ Divisão de Ensino - DE', '↳ Corpo de Alunos Oficiais', '↳ Corpo de Alunos Praças', '↳ Divisão Administrativa'],
  'CEFD': ['↳ Chefia', '↳ Secretaria e Apoio Administrativo - SAAdm', '↳ Seção de Treinamento Físico'],
};

// ----- Tipo de unidade (para legenda/cores do organograma) -----
const TIPO_POR_SIGLA = {
  'COMANDO GERAL': 'comando',
  'SUBCOMANDO GERAL': 'comando',
  'DGO': 'diretoria', 'DGA': 'diretoria', 'DIM': 'diretoria', 'DINTER I': 'diretoria', 'DINTER II': 'diretoria',
  'DIESP': 'diretoria', 'DGP': 'diretoria', 'DVP': 'diretoria', 'DJD': 'diretoria', 'DF': 'diretoria',
  'DAS': 'diretoria', 'DTIC': 'diretoria', 'DLOG': 'diretoria', 'DEIP': 'diretoria', 'DPLAG': 'diretoria',
  'GCG': 'departamento', 'AECI': 'departamento', 'CPO': 'departamento', 'CCS': 'departamento', 'CI': 'departamento',
  'GSG': 'departamento', 'AJG': 'departamento', 'CPP': 'departamento',
  'CMAN': 'departamento', 'CINT': 'departamento', 'CEAO': 'departamento', 'CEFD': 'departamento',
  'ABMG': 'escola',
};
// `nivel` (1-6, ver NODES_PADRAO) só entra como fallback quando a sigla não
// está no mapa fixo acima — cobre unidades novas criadas pelo admin, que
// nunca vão ter uma entrada aqui (TIPO_POR_SIGLA é decoração visual estática,
// fora do escopo do organograma editável).
function tipoDaSigla(sigla, nivel) {
  if (TIPO_POR_SIGLA[siglaDeDados(sigla)]) return TIPO_POR_SIGLA[siglaDeDados(sigla)];
  if (nivel != null) {
    if (nivel <= 3) return 'comando';
    if (nivel === 4 || nivel === 5) return 'diretoria';
  }
  return 'grupamento';
}

// Categoria temática (para Indicador/Dashboard) por sigla — quando não
// listada, cai no padrão do tipo (ver CATEGORIA_POR_TIPO).
const CATEGORIA_POR_SIGLA = {
  'DF': 'financeiro', 'DPLAG': 'financeiro',
  'DLOG': 'logistico', 'CMAN': 'logistico', 'CINT': 'logistico', 'CEAO': 'logistico',
  'DEIP': 'ensino', 'ABMG': 'ensino', 'CEFD': 'ensino',
  'DGP': 'recursos_humanos', 'DVP': 'recursos_humanos', 'DJD': 'recursos_humanos', 'DAS': 'recursos_humanos',
  'DTIC': 'gestao', 'GSG': 'gestao', 'AJG': 'gestao',
};
const CATEGORIA_POR_TIPO = {
  comando: 'gestao', diretoria: 'gestao', departamento: 'gestao', escola: 'ensino', grupamento: 'operacional',
};
function categoriaDaSigla(sigla, tipo) {
  return CATEGORIA_POR_SIGLA[siglaDeDados(sigla)] || CATEGORIA_POR_TIPO[tipo] || 'gestao';
}

// ----- PRNG determinístico (mesmo seed => mesmos números a cada carregamento) -----
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function criarRng(seedStr) {
  let a = hashSeed(seedStr);
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerarSerie(valorFinal, seedStr, { pontos = 12, volatilidade = 0.08, max = null } = {}) {
  const rng = criarRng(seedStr);
  const inicio = valorFinal * (0.75 + rng() * 0.15);
  const serie = [];
  for (let i = 0; i < pontos; i++) {
    const progresso = i / (pontos - 1);
    const base = inicio + (valorFinal - inicio) * progresso;
    const ruido = base * volatilidade * (rng() * 2 - 1);
    let v = Math.round(base + ruido);
    if (max != null) v = Math.min(max, v);
    serie.push(Math.max(0, v));
  }
  serie[pontos - 1] = max != null ? Math.min(max, Math.round(valorFinal)) : Math.round(valorFinal);
  return serie;
}

function calcularVariacaoTendencia(serie) {
  if (serie.length < 2) return { variacao: 0, tendencia: 'estavel' };
  const anterior = serie[serie.length - 2];
  const atual = serie[serie.length - 1];
  const variacao = anterior ? Number((((atual - anterior) / anterior) * 100).toFixed(1)) : 0;
  const tendencia = variacao > 1 ? 'alta' : variacao < -1 ? 'baixa' : 'estavel';
  return { variacao, tendencia };
}

function statusPorAtingimento(valor, meta) {
  if (!meta) return 'dentro_meta';
  const ating = (valor / meta) * 100;
  if (ating >= 100) return 'dentro_meta';
  if (ating >= 90) return 'atencao';
  return 'fora_meta';
}

// ----- Construção da árvore de unidades -----

// Unidades "em construção" (pedido de 2026-09-25: "remova os dados
// fictícios do ESTADO-MAIOR GERAL, deixe tudo 'Em construção'"). Vale pra
// raiz E toda a descendência dela na árvore ativa (inclusive uma OME que o
// admin venha a criar debaixo do Estado-Maior em /adm): sem chefe, sem
// indicador, sem painel, e métricas ZERADAS — não METRICAS_PADRAO, que é
// fictício e, antes disto, somava no total do Subcomando Geral. Por `id`
// (estável), não por sigla, pra sobreviver a uma renomeação.
const RAIZES_EM_CONSTRUCAO = new Set(['estado-maior']);
const METRICAS_ZERO = { efetivo: 0, efetivoPrevisto: 0, viaturas: 0, financas: 0, financaPct: 0 };

function idsEmConstrucao(nodes) {
  const ids = new Set();
  const visitar = (id) => {
    if (ids.has(id)) return;
    ids.add(id);
    nodes.filter((n) => n.parentId === id).forEach((n) => visitar(n.id));
  };
  nodes.filter((n) => RAIZES_EM_CONSTRUCAO.has(n.id) || n.emConstrucao).forEach((n) => visitar(n.id));
  return ids;
}

const METRICAS_PADRAO = { efetivo: 20, efetivoPrevisto: 22, viaturas: 2, financas: 40000, financaPct: 88 };

// Totais agregados (própria unidade + toda a descendência), replicando a
// lógica do organograma de referência — segue os filhos da árvore ATIVA
// (`nodes`: o fallback estático ou a árvore vinda do backend), então uma
// unidade movida pelo admin recalcula corretamente quem soma no total de
// quem. `cache` é por chamada de montarOrganograma() (nunca module-level),
// pra não vazar total calculado com uma árvore antiga para a próxima.
function totaisDaSigla(sigla, nodes, cache, siglasEmConstrucao = new Set()) {
  if (cache[sigla]) return cache[sigla];
  if (siglasEmConstrucao.has(sigla)) {
    cache[sigla] = { ...METRICAS_ZERO };
    return cache[sigla];
  }
  const proprio = METRICAS[siglaDeDados(sigla)] || METRICAS_PADRAO;
  const filhos = filhosSiglas(nodes, sigla);
  let total = { efetivo: proprio.efetivo, efetivoPrevisto: proprio.efetivoPrevisto, viaturas: proprio.viaturas, financas: proprio.financas };
  let pesoFin = proprio.financaPct * proprio.efetivo;
  let pesoBase = proprio.efetivo;
  filhos.forEach((filho) => {
    const ct = totaisDaSigla(filho, nodes, cache, siglasEmConstrucao);
    total.efetivo += ct.efetivo;
    total.efetivoPrevisto += ct.efetivoPrevisto;
    total.viaturas += ct.viaturas;
    total.financas += ct.financas;
    pesoFin += ct.financaPct * ct.efetivo;
    pesoBase += ct.efetivo;
  });
  total.financaPct = pesoBase > 0 ? Math.round(pesoFin / pesoBase) : proprio.financaPct;
  cache[sigla] = total;
  return total;
}

// Métricas próprias (não agregadas com subordinadas) de uma unidade, por sigla.
export function metricasProprias(sigla) {
  const m = METRICAS[siglaDeDados(sigla)] || METRICAS_PADRAO;
  return {
    efetivo: m.efetivo,
    efetivoPrevisto: m.efetivoPrevisto,
    viaturas: m.viaturas,
    financas: m.financas,
    financaPct: m.financaPct,
  };
}

// Seções operacionais (SB/SBI/SBAPH/SBS/SBSA/SBFN/SATec de uma unidade,
// numeradas ou não — ex. "1ª SB/3º GB", "SBFN/GBI") ficam por último na
// lista de setores vinculados — a parte administrativa (comando,
// subcomando, secretaria, divisões) vem primeiro, na ordem em que já está
// declarada em SUBSETORES — decisão registrada em DW_PLANEJAMENTO.md.
const PADRAO_SECAO_OPERACIONAL = /\bSB(APH|SA|FN|I|S)?\b|\bSATec\b/i;

// Usa sempre a árvore ESTÁTICA (NODES_PADRAO), não a árvore ao vivo vinda do
// backend: SUBSETORES é dado cosmético fora do escopo do organograma
// editável (não tem entrada pra unidade nova nenhuma, e só filtra
// duplicidade de filhos das ~46 unidades originais) — ver cabeçalho de
// NODES_PADRAO.
const SIGLAS_DE_NO = new Set([...NODES_PADRAO, ...NODES_NOVA].map((n) => n.sigla));
function divisoesDaSigla(sigla) {
  const filhos = filhosSiglas(NODES_PADRAO, sigla);
  // Item que é sigla de unidade de QUALQUER das duas LOBs nunca é "divisão".
  const divisoes = (SUBSETORES[siglaDeDados(sigla)] || [])
    .filter((item) => !filhos.includes(item) && !SIGLAS_DE_NO.has(item))
    .map((item) => item.replace(/^↳\s*/, ''));
  const administrativas = divisoes.filter((d) => !PADRAO_SECAO_OPERACIONAL.test(d));
  const operacionais = divisoes.filter((d) => PADRAO_SECAO_OPERACIONAL.test(d));
  return [...administrativas, ...operacionais];
}

// Efetivo previsto por divisão/seção interna de uma unidade — fonte real
// (QOD, ver etl/efetivo/extract_previsto_divisoes.py).
//
// Efetivo ATUAL por divisão vem do QOD publicado pela DPlaG (ver
// etl/efetivo/extract_lotacao_funcao.py), que cobre 88,6% do efetivo.
// "efetivoAtual" fica null (não 0) pra divisão cuja função ainda não foi
// lançada — evita mostrar "0" como se a seção estivesse vazia quando na
// verdade é só falta de lançamento. A UI decide como exibir esse "sem
// dado ainda" (ver Diretoria.jsx).
//
// Atenção: o QOD é um nível MAIS FINO que este organograma (ele lista
// seções dentro das divisões), e só 980 das 1.823 funções do catálogo
// casam com uma divisão daqui. As outras contam no total da unidade mas
// não em divisão nenhuma — daí divisão com efetivoAtual abaixo do real.
export function metricasDivisoesProprias(sigla) {
  const divisoes = divisoesDaSigla(sigla);
  if (!divisoes.length) return [];
  const previstoPorNome = new Map(
    (efetivoPrevistoDivisoesReal.por_unidade[siglaDeDados(sigla)] || []).map((d) => [d.nome, d.previsto])
  );
  const atualPorNome = new Map(
    Object.entries(lotacaoFuncaoReal.por_unidade_divisao[siglaDeDados(sigla)] || {}).map(([nome, matriculas]) => [nome, matriculas.length])
  );
  // Setor vinculado que é OME própria na fonte (ex. CPPA dentro da DGP):
  // o efetivo atual vem da contagem direta por OME, não da Repercussão
  // Financeira — é dado completo, não amostra parcial. Ver
  // etl/efetivo/extract_efetivo.py (OME_SETOR_VINCULADO).
  const vinculadoPorNome = efetivoReal.por_setor_vinculado?.[siglaDeDados(sigla)] || {};
  return divisoes.map((nome) => ({
    nome,
    efetivoPrevisto: previstoPorNome.get(nome) ?? 0,
    efetivoAtual: nome in vinculadoPorNome
      ? vinculadoPorNome[nome]
      : (atualPorNome.has(nome) ? atualPorNome.get(nome) : null),
  }));
}

// Monta o array de unidades (mesmo formato consumido pelo app inteiro via
// src/lib/cbmpe.js) a partir de uma árvore de nós {id, sigla, nivel,
// parentId, fixo?} — a estática (NODES_PADRAO) ou a vinda do backend
// (ver src/lib/organogramaClient.js). `oficial`/`cargo`/divisões/efetivo
// continuam vindo dos mocks estáticos (OFICIAIS/METRICAS/SUBSETORES, fora
// do escopo do organograma editável) — com fallback pra unidade nova que o
// admin cria, que não existe em nenhum desses mapas.
function construirUnidades(nodes, totaisPorSigla, emConstrucao = new Set()) {
  return nodes.map((no) => {
    const sigla = no.sigla;
    if (emConstrucao.has(no.id)) {
      return {
        id: no.id,
        nome: sigla,
        sigla,
        tipo: tipoDaSigla(sigla, no.nivel),
        parent_id: no.parentId,
        nivel: no.nivel,
        ordem: no.ordem ?? 0,
        fixo: !!no.fixo,
        funcaoCoronel: !!no.funcaoCoronel,
        oculto: !!no.oculto,
        emConstrucao: true,
        descricao: 'Em construção.',
        responsavel: 'Em construção',
        cargo: '',
        divisoes: [],
        efetivo: 0,
        ativo: true,
      };
    }
    const { oficial, cargo } = OFICIAIS[siglaDeDados(sigla)] || { oficial: '—', cargo: 'Titular' };
    const tipo = tipoDaSigla(sigla, no.nivel);
    const totais = totaisPorSigla.get(sigla) || METRICAS_PADRAO;
    const divisoes = divisoesDaSigla(sigla);
    return {
      id: no.id,
      nome: sigla,
      sigla,
      tipo,
      parent_id: no.parentId,
      nivel: no.nivel,
      ordem: no.ordem ?? 0,
      fixo: !!no.fixo,
      // "Função de Coronel" (2026-09-25): unidade marcada assim pelo admin
      // sempre renderiza no card dourado com fade de diretoria (CardDiretoria
      // em Organograma.jsx), mesmo quando seu nível normalmente usaria o
      // card branco de OME "folha" — independe de onde ela está na árvore.
      funcaoCoronel: !!no.funcaoCoronel,
      oculto: !!no.oculto,
      abaixoDe: no.abaixoDe || null,
      descricao: `${cargo}: ${oficial}.${divisoes.length ? ` Divisões internas: ${divisoes.join('; ')}.` : ''}`,
      responsavel: oficial,
      cargo,
      divisoes,
      efetivo: totais.efetivo,
      ativo: true,
    };
  });
}

const KPI_UNIDADE_MEDIDA = {
  Efetivo: 'militares',
  Viaturas: 'viaturas',
  Materiais: '%',
  Finanças: 'R$',
  'Atividades Específicas': 'atividades',
};

// Indicadores sem meta estabelecida (não há valor de referência oficial).
const KPI_SEM_META = new Set(['Materiais', 'Atividades Específicas']);

function construirIndicadores(unidades, totaisPorSigla) {
  const indicadores = [];
  unidades.forEach((u) => {
    if (u.emConstrucao) return; // ver RAIZES_EM_CONSTRUCAO
    const totais = totaisPorSigla.get(u.sigla) || METRICAS_PADRAO;
    const specs = [
      { base: 'Efetivo', valor: totais.efetivo, max: null, metaReal: totais.efetivoPrevisto },
      { base: 'Viaturas', valor: totais.viaturas, max: null },
      { base: 'Materiais', valor: null, max: null },
      { base: 'Finanças', valor: totais.financas, max: null },
      { base: 'Atividades Específicas', valor: null, max: null },
    ];
    specs.forEach(({ base, valor, max, metaReal }) => {
      const seed = `${u.id}:${base}`;
      const semMeta = KPI_SEM_META.has(base);
      let meta = null;
      if (!semMeta) {
        if (metaReal != null) {
          meta = metaReal;
        } else {
          const rng = criarRng(`${seed}:meta`);
          const fatorMeta = 0.9 + rng() * 0.25;
          meta = Math.round(valor * fatorMeta);
        }
      }
      // Sem fonte real (Materiais: sistema novo em desenvolvimento; Atividades
      // Específicas: o número vem do SGAT, ainda não levantado): sem valor,
      // sem série e sem tendência. A tela mostra "Em construção".
      const semDado = valor == null;
      const serie = semDado ? [] : gerarSerie(valor, seed, { max });
      const { variacao, tendencia } = semDado ? { variacao: 0, tendencia: 'estavel' } : calcularVariacaoTendencia(serie);
      indicadores.push({
        id: `${u.id}--${slugify(base)}`,
        nome: base,
        sigla: u.sigla,
        descricao: `${base} consolidado de ${u.sigla} (unidade + vinculadas).`,
        categoria: categoriaDaSigla(u.sigla, u.tipo),
        unidade_id: u.id,
        valor,
        meta,
        unidade_medida: KPI_UNIDADE_MEDIDA[base],
        variacao_percentual: variacao,
        tendencao: tendencia,
        serie: JSON.stringify(serie),
        status: semMeta || semDado ? null : statusPorAtingimento(valor, meta),
        // financaPct não é sobreposto com dado real (ver overlay de
        // Finanças acima) — nunca expor o percentual fictício do mock ao
        // lado do valor real de financas.
        executadoPct: undefined,
      });
    });
  });
  return indicadores;
}

function construirDashboards(unidades) {
  const agora = Date.now();
  return unidades.filter((u) => !u.emConstrucao).map((u) => {
    const rng = criarRng(`${u.id}:dashboard`);
    const diasAtras = Math.round(rng() * 45);
    return {
      id: `dash-${u.id}`,
      nome: `Painel ${u.sigla}`,
      descricao: `Indicadores consolidados de ${u.sigla} (${u.cargo.toLowerCase()}: ${u.responsavel}).`,
      unidade_id: u.id,
      categoria: categoriaDaSigla(u.sigla, u.tipo),
      icone: 'bar-chart',
      atualizado_em: new Date(agora - diasAtras * 86400000).toISOString(),
    };
  });
}

// ----- Alertas ilustrativos (fictícios, curadoria manual para variedade) -----
const ALERTAS_BASE = [
  { sigla: 'DLOG', titulo: 'Estoque de EPI abaixo do mínimo', descricao: 'Nível de estoque de equipamentos de proteção individual abaixo do limite recomendado para o trimestre.', severidade: 'alta', status: 'aberto', diasAtras: 2 },
  { sigla: 'CMAN', titulo: 'Manutenção corretiva pendente', descricao: 'Viaturas aguardando manutenção corretiva há mais de 15 dias.', severidade: 'critica', status: 'em_andamento', diasAtras: 5 },
  { sigla: 'DF', titulo: 'Execução orçamentária abaixo do previsto', descricao: 'Percentual de execução orçamentária do trimestre abaixo da meta estabelecida.', severidade: 'media', status: 'aberto', diasAtras: 8 },
  { sigla: 'GBI', titulo: 'Meta de vistorias abaixo do esperado', descricao: 'Número de vistorias técnicas realizadas no mês ficou abaixo da meta.', severidade: 'media', status: 'aberto', diasAtras: 3 },
  { sigla: 'DEIP', titulo: 'Turma de formação com vagas ociosas', descricao: 'Turma de formação técnica com ocupação abaixo de 70% das vagas ofertadas.', severidade: 'baixa', status: 'resolvido', diasAtras: 20 },
  { sigla: 'DIESP', titulo: 'Atraso na análise de projetos', descricao: 'Fila de projetos contra incêndio e pânico aguardando análise técnica acima do prazo padrão.', severidade: 'alta', status: 'em_andamento', diasAtras: 6 },
  { sigla: 'DGP', titulo: 'Pendência em movimentação de pessoal', descricao: 'Processos de movimentação de efetivo aguardando validação há mais de 30 dias.', severidade: 'media', status: 'aberto', diasAtras: 12 },
  { sigla: 'DTIC', titulo: 'Indisponibilidade de sistema corporativo', descricao: 'Sistema corporativo apresentou instabilidade pontual, já contornada.', severidade: 'baixa', status: 'resolvido', diasAtras: 15 },
  { sigla: 'CAT/RMR', titulo: 'Viaturas com disponibilidade reduzida', descricao: 'Disponibilidade operacional de viaturas abaixo de 85% no período.', severidade: 'alta', status: 'aberto', diasAtras: 1 },
  { sigla: 'DPLAG', titulo: 'Convênio pendente de assinatura', descricao: 'Convênio de captação de recursos aguardando assinatura das partes.', severidade: 'baixa', status: 'em_andamento', diasAtras: 10 },
  { sigla: '2º GB', titulo: 'Efetivo abaixo do quadro ideal', descricao: 'Unidade operando com efetivo abaixo do quadro ideal em parte das subseções.', severidade: 'media', status: 'aberto', diasAtras: 4 },
  { sigla: 'CEAO', titulo: 'Atraso em processo de compras', descricao: 'Processo de aquisição de materiais de engenharia com atraso em relação ao cronograma.', severidade: 'media', status: 'em_andamento', diasAtras: 9 },
  { sigla: 'ABMG', titulo: 'Infraestrutura de ensino em manutenção', descricao: 'Bloco de instrução em reforma, com impacto parcial na grade de treinamento.', severidade: 'baixa', status: 'aberto', diasAtras: 7 },
  { sigla: 'CCS', titulo: 'Campanha institucional em atraso', descricao: 'Campanha de comunicação institucional com cronograma atrasado.', severidade: 'baixa', status: 'resolvido', diasAtras: 25 },
  { sigla: 'DAS', titulo: 'Demanda de assistência social crescente', descricao: 'Volume de atendimentos de assistência social acima do previsto para o período.', severidade: 'media', status: 'aberto', diasAtras: 3 },
  { sigla: 'CI', titulo: 'Atualização de análise de risco pendente', descricao: 'Relatório de análise de risco regional pendente de atualização trimestral.', severidade: 'media', status: 'em_andamento', diasAtras: 11 },
];

function construirAlertas(unidades) {
  const agora = Date.now();
  return ALERTAS_BASE.map((a, i) => {
    const unidade = unidades.find((u) => u.sigla === a.sigla);
    return {
      id: `alerta-${i + 1}`,
      titulo: a.titulo,
      descricao: a.descricao,
      severidade: a.severidade,
      unidade_id: unidade?.id || null,
      data: new Date(agora - a.diasAtras * 86400000).toISOString().slice(0, 10),
      status: a.status,
    };
  });
}

// ----- Ponto de entrada usado por src/lib/cbmpe.js -----
//
// Recebe uma árvore de nós {id, sigla, nivel, parentId, fixo?} (o fallback
// NODES_PADRAO, exportado abaixo, ou a árvore vinda do backend via
// src/lib/organogramaClient.js) e monta, num único passo consistente,
// tudo que antes eram 4 constantes estáticas independentes (UNIDADES/
// INDICADORES/DASHBOARDS/ALERTAS). Isso garante que um admin movendo/
// renomeando/criando/excluindo uma OME em /adm se reflete em TODO o app —
// organograma, controle de acesso (accessControl.js), Atividades
// Específicas (atividadesEspecificas.js) — sem duplicar a lógica de
// derivação em outro lugar.
export function montarOrganograma(nodes, { lob = 'atual' } = {}) {
  ALIAS_ATIVO = lob === 'nova' ? ALIAS_NOVA : {};
  const cache = {};
  const totaisPorSigla = new Map();
  const emConstrucao = idsEmConstrucao(nodes);
  const siglasEmConstrucao = new Set(nodes.filter((n) => emConstrucao.has(n.id)).map((n) => n.sigla));
  nodes.forEach((no) => totaisPorSigla.set(no.sigla, totaisDaSigla(no.sigla, nodes, cache, siglasEmConstrucao)));

  const unidades = construirUnidades(nodes, totaisPorSigla, emConstrucao);
  const indicadores = construirIndicadores(unidades, totaisPorSigla);
  const dashboards = construirDashboards(unidades);
  const alertas = construirAlertas(unidades);
  return { unidades, indicadores, dashboards, alertas };
}

export { NODES_PADRAO, NODES_NOVA };
