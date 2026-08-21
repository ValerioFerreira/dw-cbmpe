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
import viaturasListaReal from "./real/viaturas_lista.json";
import financasReal from "./real/financas.json";

const DIACRITICOS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(s) {
  return s
    .normalize("NFD").replace(DIACRITICOS_REGEX, "")
    .replace(/[ºª]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ----- Cargo/oficial por sigla (fictício, porém coerente) -----
const OFICIAIS = {
  'COMANDO GERAL': { oficial: 'Cel BM Araripe', cargo: 'Comandante Geral' },
  'SUBCOMANDO GERAL': { oficial: 'Cel BM Curvêlo', cargo: 'Subcomandante Geral' },
  'GCG': { oficial: 'Maj BM Rafael', cargo: 'Chefe' },
  'AECI': { oficial: 'Cel BM Jailton', cargo: 'Assessor Especial' },
  'CPO': { oficial: 'Maj BM França', cargo: 'Chefe' },
  'CPP': { oficial: 'Maj BM França', cargo: 'Chefe' },
  'CCS': { oficial: 'Maj BM Getúlio', cargo: 'Chefe' },
  'CI': { oficial: 'TC BM Samuel', cargo: 'Chefe' },
  'GSG': { oficial: 'Maj BM Allisson Carneiro', cargo: 'Chefe' },
  'DIESP': { oficial: 'Cel BM Lucena', cargo: 'Diretor' },
  'AJG': { oficial: 'Maj BM Calado', cargo: 'Chefe' },
  'DGO': { oficial: 'Cel BM Leonardo', cargo: 'Diretor' },
  'DIM': { oficial: 'TC BM Brainer', cargo: 'Diretor' },
  'DINTER I': { oficial: 'TC BM Ivânio', cargo: 'Diretor' },
  'DINTER II': { oficial: 'TC BM Clérisson', cargo: 'Diretor' },
  'GBAPH': { oficial: 'TC BM Cleiton', cargo: 'Comandante' },
  'GBI': { oficial: 'TC BM Damasceno', cargo: 'Comandante' },
  'GBS': { oficial: 'TC BM Barbalho', cargo: 'Comandante' },
  'GBMar': { oficial: 'Maj BM Otávio', cargo: 'Comandante' },
  'CAT/RMR': { oficial: 'TC BM Flávio Cysneiros', cargo: 'Chefe' },
  '1º GB': { oficial: 'TC BM Carneiro', cargo: 'Comandante' },
  '2º GB': { oficial: 'TC BM Dantas', cargo: 'Comandante' },
  '6º GB': { oficial: 'TC BM Vieira de Melo', cargo: 'Comandante' },
  '7º GB': { oficial: 'TC BM Melo Júnior', cargo: 'Comandante' },
  'CAT/ZM': { oficial: 'Maj BM Cibely', cargo: 'Chefe' },
  'CAT/AG': { oficial: 'Maj BM Cledjones', cargo: 'Chefe' },
  '3º GB': { oficial: 'Maj BM Isaac', cargo: 'Comandante' },
  '4º GB': { oficial: 'TC BM Alisson', cargo: 'Comandante' },
  '5º GB': { oficial: 'Maj BM Castro', cargo: 'Comandante' },
  '9º GB': { oficial: 'Maj BM Lamartine', cargo: 'Comandante' },
  'CAT/SE': { oficial: 'TC BM Oliveira', cargo: 'Chefe' },
  'DGA': { oficial: 'Cel BM XXXX', cargo: 'Diretor' },
  'DPLAG': { oficial: 'TC BM Barros Leite', cargo: 'Diretor' },
  'DGP': { oficial: 'TC BM Wagner', cargo: 'Diretor' },
  'DVP': { oficial: 'TC BM Pablo', cargo: 'Diretor' },
  'DJD': { oficial: 'TC BM Berenguer', cargo: 'Diretor' },
  'DF': { oficial: 'TC BM Anderson Carvalho', cargo: 'Diretor' },
  'DAS': { oficial: 'TC BM Bartolomeu', cargo: 'Diretor' },
  'DTIC': { oficial: 'TC BM Dallas', cargo: 'Diretor' },
  'DLOG': { oficial: 'Cel BM Vitoriano', cargo: 'Diretor' },
  'CMAN': { oficial: 'TC BM Helder', cargo: 'Chefe' },
  'CINT': { oficial: 'Maj BM Zovka', cargo: 'Chefe' },
  'CEAO': { oficial: 'TC BM Josinaldo', cargo: 'Chefe' },
  'DEIP': { oficial: 'Cel BM Aprígio', cargo: 'Diretor' },
  'ABMG': { oficial: 'Maj BM João Paulo', cargo: 'Comandante' },
  'CEFD': { oficial: 'Maj BM Silva', cargo: 'Chefe' },
};

// ----- Hierarquia (quem é subordinado direto de quem) -----
const ARVORE = {
  'COMANDO GERAL': ['SUBCOMANDO GERAL', 'GCG', 'CI', 'CPO', 'AECI', 'CCS'],
  'SUBCOMANDO GERAL': ['DGO', 'DGA', 'GSG', 'AJG', 'CPP'],
  'DGO': ['DIM', 'DINTER I', 'DINTER II', 'DIESP'],
  'DIM': ['GBI', 'GBAPH', 'GBS', 'GBMar', 'CAT/RMR'],
  'DINTER I': ['1º GB', '2º GB', '6º GB', '7º GB', 'CAT/ZM', 'CAT/AG'],
  'DINTER II': ['3º GB', '4º GB', '5º GB', '9º GB', 'CAT/SE'],
  'DGA': ['DGP', 'DVP', 'DJD', 'DF', 'DAS', 'DTIC', 'DLOG', 'DEIP', 'DPLAG'],
  'DLOG': ['CMAN', 'CINT', 'CEAO'],
  'DEIP': ['ABMG', 'CEFD'],
};

// ----- Métricas próprias (não agregadas) por unidade -----
const METRICAS = {
  'COMANDO GERAL': { efetivo: 22, viaturas: 4, materiaisPct: 95, financas: 180000, financaPct: 93, acoes: 120 },
  'SUBCOMANDO GERAL': { efetivo: 14, viaturas: 3, materiaisPct: 92, financas: 95000, financaPct: 90, acoes: 70 },
  'GCG': { efetivo: 18, viaturas: 2, materiaisPct: 88, financas: 45000, financaPct: 88, acoes: 40 },
  'AECI': { efetivo: 12, viaturas: 1, materiaisPct: 90, financas: 35000, financaPct: 91, acoes: 30 },
  'CPO': { efetivo: 10, viaturas: 1, materiaisPct: 85, financas: 25000, financaPct: 86, acoes: 25 },
  'CCS': { efetivo: 16, viaturas: 2, materiaisPct: 87, financas: 40000, financaPct: 89, acoes: 45 },
  'CI': { efetivo: 20, viaturas: 3, materiaisPct: 91, financas: 55000, financaPct: 90, acoes: 50 },
  'GSG': { efetivo: 15, viaturas: 2, materiaisPct: 89, financas: 38000, financaPct: 88, acoes: 35 },
  'DIESP': { efetivo: 30, viaturas: 3, materiaisPct: 86, financas: 75000, financaPct: 87, acoes: 90 },
  'AJG': { efetivo: 14, viaturas: 1, materiaisPct: 90, financas: 32000, financaPct: 89, acoes: 28 },
  'CPP': { efetivo: 9, viaturas: 1, materiaisPct: 92, financas: 20000, financaPct: 90, acoes: 18 },
  'DGO': { efetivo: 24, viaturas: 3, materiaisPct: 90, financas: 60000, financaPct: 88, acoes: 55 },
  'DIM': { efetivo: 20, viaturas: 3, materiaisPct: 90, financas: 55000, financaPct: 88, acoes: 50 },
  'GBI': { efetivo: 95, viaturas: 12, materiaisPct: 93, financas: 210000, financaPct: 91, acoes: 340 },
  'GBAPH': { efetivo: 80, viaturas: 10, materiaisPct: 92, financas: 185000, financaPct: 90, acoes: 290 },
  'GBS': { efetivo: 70, viaturas: 9, materiaisPct: 91, financas: 160000, financaPct: 89, acoes: 260 },
  'GBMar': { efetivo: 45, viaturas: 6, materiaisPct: 90, financas: 110000, financaPct: 88, acoes: 150 },
  'CAT/RMR': { efetivo: 38, viaturas: 5, materiaisPct: 89, financas: 95000, financaPct: 87, acoes: 130 },
  'DINTER I': { efetivo: 18, viaturas: 2, materiaisPct: 88, financas: 50000, financaPct: 86, acoes: 45 },
  '1º GB': { efetivo: 60, viaturas: 7, materiaisPct: 90, financas: 140000, financaPct: 88, acoes: 210 },
  '2º GB': { efetivo: 75, viaturas: 9, materiaisPct: 91, financas: 170000, financaPct: 89, acoes: 250 },
  '6º GB': { efetivo: 50, viaturas: 6, materiaisPct: 88, financas: 115000, financaPct: 87, acoes: 175 },
  '7º GB': { efetivo: 55, viaturas: 6, materiaisPct: 89, financas: 125000, financaPct: 87, acoes: 190 },
  'CAT/ZM': { efetivo: 32, viaturas: 4, materiaisPct: 87, financas: 80000, financaPct: 86, acoes: 110 },
  'CAT/AG': { efetivo: 30, viaturas: 4, materiaisPct: 87, financas: 78000, financaPct: 86, acoes: 105 },
  'DINTER II': { efetivo: 16, viaturas: 2, materiaisPct: 87, financas: 48000, financaPct: 85, acoes: 40 },
  '3º GB': { efetivo: 48, viaturas: 6, materiaisPct: 88, financas: 112000, financaPct: 86, acoes: 170 },
  '4º GB': { efetivo: 52, viaturas: 6, materiaisPct: 89, financas: 118000, financaPct: 87, acoes: 180 },
  '5º GB': { efetivo: 46, viaturas: 5, materiaisPct: 87, financas: 105000, financaPct: 85, acoes: 160 },
  '9º GB': { efetivo: 40, viaturas: 5, materiaisPct: 86, financas: 95000, financaPct: 84, acoes: 145 },
  'CAT/SE': { efetivo: 35, viaturas: 5, materiaisPct: 86, financas: 88000, financaPct: 84, acoes: 120 },
  'DGA': { efetivo: 22, viaturas: 3, materiaisPct: 90, financas: 65000, financaPct: 90, acoes: 60 },
  'DPLAG': { efetivo: 18, viaturas: 2, materiaisPct: 88, financas: 48000, financaPct: 88, acoes: 50 },
  'DGP': { efetivo: 28, viaturas: 2, materiaisPct: 88, financas: 70000, financaPct: 89, acoes: 75 },
  'DVP': { efetivo: 20, viaturas: 2, materiaisPct: 87, financas: 52000, financaPct: 88, acoes: 55 },
  'DJD': { efetivo: 16, viaturas: 1, materiaisPct: 89, financas: 38000, financaPct: 90, acoes: 40 },
  'DF': { efetivo: 24, viaturas: 2, materiaisPct: 91, financas: 95000, financaPct: 92, acoes: 65 },
  'DAS': { efetivo: 18, viaturas: 2, materiaisPct: 86, financas: 42000, financaPct: 87, acoes: 48 },
  'DTIC': { efetivo: 20, viaturas: 1, materiaisPct: 93, financas: 60000, financaPct: 91, acoes: 52 },
  'DLOG': { efetivo: 26, viaturas: 4, materiaisPct: 89, financas: 80000, financaPct: 88, acoes: 70 },
  'CMAN': { efetivo: 34, viaturas: 8, materiaisPct: 90, financas: 98000, financaPct: 89, acoes: 95 },
  'CINT': { efetivo: 22, viaturas: 3, materiaisPct: 87, financas: 60000, financaPct: 86, acoes: 60 },
  'CEAO': { efetivo: 19, viaturas: 2, materiaisPct: 88, financas: 55000, financaPct: 87, acoes: 52 },
  'DEIP': { efetivo: 20, viaturas: 2, materiaisPct: 90, financas: 58000, financaPct: 89, acoes: 58 },
  'ABMG': { efetivo: 65, viaturas: 5, materiaisPct: 91, financas: 150000, financaPct: 90, acoes: 220 },
  'CEFD': { efetivo: 14, viaturas: 1, materiaisPct: 88, financas: 30000, financaPct: 87, acoes: 35 },
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

// ----- Overlay de Viaturas real (fonte: sistema de frotas → Neon, ver
// etl/viaturas/) -----
// Mesmo princípio do overlay de Efetivo: substitui o valor fictício de
// TODAS as unidades pelo valor real (0 incluído) para nunca misturar
// número real com mock na mesma tela. Viaturas sem transferência
// registrada (sem OME conhecida) e a viatura da GTA (unidade fora do
// organograma, confirmado com o usuário) ficam de fora de qualquer
// unidade específica — decisão registrada em DW_PLANEJAMENTO.md.
// A contagem é derivada de viaturas_lista.json (por veículo) em vez do
// agregado bruto de viaturas.json (COUNT(*) sem filtro de situação no SQL
// do extrator) — sem isso o card mostrava um total maior do que a tabela
// de detalhe, que já exclui viaturas em situação "Descarregada" (mesma
// regra de ViaturaDetalhe.jsx). Bug reportado pelo usuário, 2026-08-19.
Object.keys(METRICAS).forEach((sigla) => {
  const veiculos = viaturasListaReal.por_unidade[sigla] || [];
  METRICAS[sigla] = { ...METRICAS[sigla], viaturas: veiculos.filter((v) => v.situacao !== "Descarregada").length };
});

// ----- Overlay de Finanças real (fonte: planilha de Finanças → Postgres
// interno → Neon, ver etl/financas/) -----
// Mesmo princípio dos overlays acima: substitui o valor fictício de TODAS
// as unidades pelo valor real (0 incluído) para nunca misturar número real
// com mock na mesma tela. Valor = soma de "valor pago" das linhas EMPENHADO
// (Autorização/Carnaval só enquadramento "Suprimento Individual"; SFI
// Ordinário completo) — rubricas institucionais centrais (folha de
// pagamento, aquisição de viaturas) e auxílio funeral a pessoa física ficam
// de fora por não representarem gasto de uma unidade específica — decisão
// registrada em DW_PLANEJAMENTO.md. O percentual de execução (financaPct)
// não é sobreposto — o usuário pediu para não mostrar percentual por
// enquanto, então ele é suprimido mais abaixo (ver executadoPct).
Object.keys(METRICAS).forEach((sigla) => {
  METRICAS[sigla] = { ...METRICAS[sigla], financas: financasReal.por_unidade[sigla] ?? 0 };
});

// ----- Divisões/seções internas por unidade (inclui itens que também são
// nós próprios da árvore — filtrados na leitura abaixo) -----
const SUBSETORES = {
  'COMANDO GERAL': ['SUBCOMANDO GERAL', 'GCG', 'CI', 'CPO', 'AECI', 'CCS'],
  'SUBCOMANDO GERAL': ['DGO', 'DGA', 'GSG', 'AJG', 'CPP'],
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
function tipoDaSigla(sigla) {
  return TIPO_POR_SIGLA[sigla] || 'grupamento';
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
  return CATEGORIA_POR_SIGLA[sigla] || CATEGORIA_POR_TIPO[tipo] || 'gestao';
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
const SIGLAS = Object.keys(OFICIAIS);

function calcularNivel(sigla, cache = {}) {
  if (cache[sigla] != null) return cache[sigla];
  const pai = Object.entries(ARVORE).find(([, filhos]) => filhos.includes(sigla))?.[0];
  const nivel = pai ? calcularNivel(pai, cache) + 1 : 1;
  cache[sigla] = nivel;
  return nivel;
}

// Totais agregados (própria unidade + toda a descendência), replicando a
// lógica do organograma de referência.
const totaisCache = {};
function totaisDaSigla(sigla) {
  if (totaisCache[sigla]) return totaisCache[sigla];
  const proprio = METRICAS[sigla] || { efetivo: 20, efetivoPrevisto: 22, viaturas: 2, materiaisPct: 88, financas: 40000, financaPct: 88, acoes: 40 };
  const filhos = ARVORE[sigla] || [];
  let total = { efetivo: proprio.efetivo, efetivoPrevisto: proprio.efetivoPrevisto, viaturas: proprio.viaturas, financas: proprio.financas, acoes: proprio.acoes };
  let pesoMat = proprio.materiaisPct * proprio.efetivo;
  let pesoFin = proprio.financaPct * proprio.efetivo;
  let pesoBase = proprio.efetivo;
  filhos.forEach((filho) => {
    const ct = totaisDaSigla(filho);
    total.efetivo += ct.efetivo;
    total.efetivoPrevisto += ct.efetivoPrevisto;
    total.viaturas += ct.viaturas;
    total.financas += ct.financas;
    total.acoes += ct.acoes;
    pesoMat += ct.materiaisPct * ct.efetivo;
    pesoFin += ct.financaPct * ct.efetivo;
    pesoBase += ct.efetivo;
  });
  total.materiaisPct = pesoBase > 0 ? Math.round(pesoMat / pesoBase) : proprio.materiaisPct;
  total.financaPct = pesoBase > 0 ? Math.round(pesoFin / pesoBase) : proprio.financaPct;
  totaisCache[sigla] = total;
  return total;
}

const METRICAS_PADRAO = { efetivo: 20, efetivoPrevisto: 22, viaturas: 2, materiaisPct: 88, financas: 40000, financaPct: 88, acoes: 40 };

// Métricas próprias (não agregadas com subordinadas) de uma unidade, por sigla.
export function metricasProprias(sigla) {
  const m = METRICAS[sigla] || METRICAS_PADRAO;
  return {
    efetivo: m.efetivo,
    efetivoPrevisto: m.efetivoPrevisto,
    viaturas: m.viaturas,
    materiaisPct: m.materiaisPct,
    financas: m.financas,
    financaPct: m.financaPct,
    acoes: m.acoes,
  };
}

// Seções operacionais (SB/SBI/SBAPH/SBS/SBSA/SBFN/SATec de uma unidade,
// numeradas ou não — ex. "1ª SB/3º GB", "SBFN/GBI") ficam por último na
// lista de setores vinculados — a parte administrativa (comando,
// subcomando, secretaria, divisões) vem primeiro, na ordem em que já está
// declarada em SUBSETORES — decisão registrada em DW_PLANEJAMENTO.md.
const PADRAO_SECAO_OPERACIONAL = /\bSB(APH|SA|FN|I|S)?\b|\bSATec\b/i;

function divisoesDaSigla(sigla) {
  const filhos = ARVORE[sigla] || [];
  const divisoes = (SUBSETORES[sigla] || [])
    .filter((item) => !filhos.includes(item))
    .map((item) => item.replace(/^↳\s*/, ''));
  const administrativas = divisoes.filter((d) => !PADRAO_SECAO_OPERACIONAL.test(d));
  const operacionais = divisoes.filter((d) => PADRAO_SECAO_OPERACIONAL.test(d));
  return [...administrativas, ...operacionais];
}

// Efetivo previsto por divisão/seção interna de uma unidade — fonte real
// (QOD, ver etl/efetivo/extract_previsto_divisoes.py).
//
// Efetivo ATUAL por divisão vem da Repercussão Financeira (CPPA, aba
// DIST_FUNCOES — ver etl/efetivo/extract_lotacao_funcao.py), que ainda
// está sendo preenchida pela CPPA: hoje cobre só uma parte do efetivo
// (ver lotacaoFuncaoReal.cobertura.percentual). "efetivoAtual" fica null
// (não 0) pra divisão de unidade cuja função ainda não foi lançada em
// nenhuma linha — evita mostrar "0" como se a seção estivesse vazia
// quando na verdade é só falta de lançamento na planilha. A UI decide
// como exibir esse "sem dado ainda" (ver Diretoria.jsx).
export function metricasDivisoesProprias(sigla) {
  const divisoes = divisoesDaSigla(sigla);
  if (!divisoes.length) return [];
  const previstoPorNome = new Map(
    (efetivoPrevistoDivisoesReal.por_unidade[sigla] || []).map((d) => [d.nome, d.previsto])
  );
  const atualPorNome = new Map(
    Object.entries(lotacaoFuncaoReal.por_unidade_divisao[sigla] || {}).map(([nome, matriculas]) => [nome, matriculas.length])
  );
  // Setor vinculado que é OME própria na fonte (ex. CPPA dentro da DGP):
  // o efetivo atual vem da contagem direta por OME, não da Repercussão
  // Financeira — é dado completo, não amostra parcial. Ver
  // etl/efetivo/extract_efetivo.py (OME_SETOR_VINCULADO).
  const vinculadoPorNome = efetivoReal.por_setor_vinculado?.[sigla] || {};
  return divisoes.map((nome) => ({
    nome,
    efetivoPrevisto: previstoPorNome.get(nome) ?? 0,
    efetivoAtual: nome in vinculadoPorNome
      ? vinculadoPorNome[nome]
      : (atualPorNome.has(nome) ? atualPorNome.get(nome) : null),
  }));
}

function construirUnidades() {
  const nivelCache = {};
  return SIGLAS.map((sigla) => {
    const { oficial, cargo } = OFICIAIS[sigla];
    const tipo = tipoDaSigla(sigla);
    const pai = Object.entries(ARVORE).find(([, filhos]) => filhos.includes(sigla))?.[0];
    const totais = totaisDaSigla(sigla);
    const divisoes = divisoesDaSigla(sigla);
    return {
      id: slugify(sigla),
      nome: sigla,
      sigla,
      tipo,
      parent_id: pai ? slugify(pai) : null,
      nivel: calcularNivel(sigla, nivelCache),
      descricao: `${cargo}: ${oficial}.${divisoes.length ? ` Divisões internas: ${divisoes.join('; ')}.` : ''}`,
      responsavel: oficial,
      cargo,
      divisoes,
      efetivo: totais.efetivo,
      ativo: true,
    };
  });
}

export const UNIDADES = construirUnidades();

const KPI_UNIDADE_MEDIDA = {
  Efetivo: 'militares',
  Viaturas: 'viaturas',
  Materiais: '%',
  Finanças: 'R$',
  'Atividades Específicas': 'atividades',
};

// Indicadores sem meta estabelecida (não há valor de referência oficial).
const KPI_SEM_META = new Set(['Materiais', 'Atividades Específicas']);

function construirIndicadores() {
  const indicadores = [];
  UNIDADES.forEach((u) => {
    const totais = totaisDaSigla(u.sigla);
    const specs = [
      { base: 'Efetivo', valor: totais.efetivo, max: null, metaReal: totais.efetivoPrevisto },
      { base: 'Viaturas', valor: totais.viaturas, max: null },
      { base: 'Materiais', valor: totais.materiaisPct, max: 100 },
      { base: 'Finanças', valor: totais.financas, max: null },
      { base: 'Atividades Específicas', valor: totais.acoes, max: null },
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
      const serie = gerarSerie(valor, seed, { max });
      const { variacao, tendencia } = calcularVariacaoTendencia(serie);
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
        status: semMeta ? null : statusPorAtingimento(valor, meta),
        // financaPct não é sobreposto com dado real (ver overlay de
        // Finanças acima) — nunca expor o percentual fictício do mock ao
        // lado do valor real de financas.
        executadoPct: undefined,
      });
    });
  });
  return indicadores;
}

export const INDICADORES = construirIndicadores();

function construirDashboards() {
  const agora = Date.now();
  return UNIDADES.map((u) => {
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

export const DASHBOARDS = construirDashboards();

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

function construirAlertas() {
  const agora = Date.now();
  return ALERTAS_BASE.map((a, i) => {
    const unidade = UNIDADES.find((u) => u.sigla === a.sigla);
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

export const ALERTAS = construirAlertas();
