// Camada de dados do app sobre o DW (diretriz D6 de DW_INGESTAO.md): o
// backend só lê `marts`, nunca raw/stg/core nem a fonte original.
//
// Cada domínio vem de uma view própria, na SIGLA DO ORGANOGRAMA do app
// (marts.*_organograma), com o valor PRÓPRIO da unidade — o rollup para a
// unidade-mãe continua sendo feito no front (src/data/organograma.js,
// totaisDaSigla), exatamente como era com os JSON. Assim o front troca a
// fonte sem mudar nenhuma conta.
//
// Um domínio que falhar (view ainda não criada, erro pontual) não derruba os
// outros: ele simplesmente não vem na resposta, e o front mantém para ele o
// valor que já tinha (JSON embutido). O erro vai para o log do servidor.
import { getPoolDw } from "../config/db.js";

const CONSULTAS = {
  efetivo: `
    select sigla, efetivo_proprio as valor, data_referencia
    from marts.efetivo_organograma`,
  viaturas: `
    select sigla, viaturas as valor, null::date as data_referencia
    from marts.frota_organograma`,
  financas: `
    select sigla, valor_pago as valor, null::date as data_referencia
    from marts.financas_organograma`,
  // Vagas FUNCIONAL do QOD publicado (decisão do usuário, 2026-09-29).
  previsto: `
    select sigla, previsto as valor, null::date as data_referencia
    from marts.previsto_organograma`,
};

// Titular de cada unidade, do QOD (marts.chefe_organograma). Dado nominal
// institucional — o mesmo que o organograma já exibe para todo usuário logado.
async function chefesPorSigla() {
  const { rows } = await getPoolDw().query(
    "select sigla, posto, nome_guerra, cargo, vago from marts.chefe_organograma"
  );
  const chefes = {};
  for (const r of rows) {
    chefes[r.sigla] = { posto: r.posto, nome: r.nome_guerra, cargo: r.cargo, vago: r.vago };
  }
  return chefes;
}

async function consultar(nome, sql) {
  const { rows } = await getPoolDw().query(sql);
  const porSigla = {};
  let referencia = null;
  for (const r of rows) {
    porSigla[r.sigla] = Number(r.valor) || 0;
    if (r.data_referencia && (!referencia || r.data_referencia > referencia)) referencia = r.data_referencia;
  }
  return { porSigla, referencia };
}

// ---------------------------------------------------------------------------
// Dado NOMINAL — sempre recortado pelas unidades que o perfil libera
// (services/acessoService.js). `siglas` null = todas; Set vazio = nenhuma.
// O formato é o dos JSON que o front já consome (efetivo_lista.json e
// lotacao_funcao.json), para a troca de fonte não mexer nas telas.
// ---------------------------------------------------------------------------
function filtroSiglas(siglas, parametros) {
  if (siglas === null) return "";
  parametros.push([...siglas]);
  return `where sigla = any($${parametros.length})`;
}

const SQL_EFETIVO_NOMINAL = (where) => `
  select sigla, ome_exibicao, posto_grad, matricula, nome, nome_guerra, sexo, idade, ordem,
         raca_cor, pcd, telefone_1, telefone_2, tempo_servico_anos, tempo_obm_atual_dias,
         ome_anterior, orgao, horario_especial, readaptado, acumulo_cargos, le, ltip,
         afastamento_sup_90_dias, suplemento_pessoal,
         to_char(data_suplemento_pessoal, 'YYYY-MM-DD') as data_suplemento_pessoal,
         aniversario,
         to_char(data_movimentacao_sp, 'YYYY-MM-DD')    as data_movimentacao_sp,
         to_char(data_ingresso, 'YYYY-MM-DD')           as data_ingresso,
         to_char(data_ultima_promocao, 'YYYY-MM-DD')    as data_ultima_promocao,
         pcnh, to_char(data_referencia, 'YYYY-MM-DD')   as data_referencia
  from marts.efetivo_nominal
  ${where}
  order by ordem nulls last, nome_guerra nulls last`;

export async function efetivoNominal(siglas) {
  if (siglas && siglas.size === 0) return { fonte: "dw", por_unidade: {} };
  const parametros = [];
  const { rows } = await getPoolDw().query(SQL_EFETIVO_NOMINAL(filtroSiglas(siglas, parametros)), parametros);
  const porUnidade = {};
  let referencia = null;
  for (const r of rows) {
    referencia = r.data_referencia;
    (porUnidade[r.sigla] ||= []).push({
      postoGrad: r.posto_grad,
      matricula: r.matricula,
      nome: r.nome,
      nomeGuerra: r.nome_guerra,
      sexo: r.sexo,
      idade: r.idade,
      ordem: r.ordem,
      omeExibicao: r.ome_exibicao,
      completo: {
        racaCor: r.raca_cor,
        pcd: r.pcd,
        telefone1: r.telefone_1,
        telefone2: r.telefone_2,
        tempoServicoAnos: r.tempo_servico_anos,
        tempoObmAtualDias: r.tempo_obm_atual_dias,
        omeAnteriorSp: r.ome_anterior,
        orgao: r.orgao,
        horarioEspecial: r.horario_especial,
        readaptado: r.readaptado,
        acumuloCargos: r.acumulo_cargos,
        le: r.le,
        ltip: r.ltip,
        afastamentoSup90Dias: r.afastamento_sup_90_dias,
        suplementoPessoalNumeroAno: r.suplemento_pessoal,
        dataSuplementoPessoal: r.data_suplemento_pessoal,
        aniversario: r.aniversario,
        dataMovimentacaoSp: r.data_movimentacao_sp,
        dataIngresso: r.data_ingresso,
        dataUltimaPromocao: r.data_ultima_promocao,
        pcnh: r.pcnh,
      },
    });
  }
  return { fonte: "dw (marts.efetivo_nominal)", data_referencia: referencia, por_unidade: porUnidade };
}

export async function lotacaoNominal(siglas) {
  if (siglas && siglas.size === 0) return { por_matricula: {}, funcoes: {} };
  const parametros = [];
  const { rows } = await getPoolDw().query(
    `select matricula, id_funcao, antiguidade, bge, cursos, portaria, posto_funcao,
            tipo, funcao, secao, ome, ome_completa, localidade
     from marts.lotacao_militar ${filtroSiglas(siglas, parametros)}`,
    parametros
  );
  const porMatricula = {};
  const funcoes = {};
  for (const r of rows) {
    (porMatricula[r.matricula] ||= []).push({
      antiguidade: r.antiguidade == null ? null : Number(r.antiguidade),
      bge: r.bge,
      cursos: r.cursos,
      idFuncao: r.id_funcao,
      portaria: r.portaria,
      postoFuncao: r.posto_funcao,
    });
    if (r.id_funcao && !funcoes[r.id_funcao]) {
      funcoes[r.id_funcao] = {
        funcao: r.funcao, secao: r.secao, ome: r.ome, omeCompleta: r.ome_completa,
        localidade: r.localidade, tipo: r.tipo,
      };
    }
  }
  return { fonte: "dw (marts.lotacao_militar)", por_matricula: porMatricula, funcoes };
}

// { metricas: { [sigla]: { efetivo?, viaturas?, financas?, previsto? } },
//   chefes:   { [sigla]: { posto, nome, cargo, vago } } | null,
//   dominios: { efetivo: { data_referencia, carregado_em }, ... } }
export async function metricasPorSigla() {
  const metricas = {};
  const dominios = {};

  const resultados = await Promise.allSettled(
    Object.entries(CONSULTAS).map(async ([nome, sql]) => [nome, await consultar(nome, sql)])
  );

  for (const r of resultados) {
    if (r.status !== "fulfilled") {
      console.error("dados/metricas: domínio indisponível —", r.reason?.message);
      continue;
    }
    const [nome, { porSigla, referencia }] = r.value;
    for (const [sigla, valor] of Object.entries(porSigla)) {
      (metricas[sigla] ||= {})[nome] = valor;
    }
    dominios[nome] = { data_referencia: referencia };
  }

  let chefes = null;
  try {
    chefes = await chefesPorSigla();
    dominios.chefes = {};
  } catch (err) {
    console.error("dados/metricas: chefes indisponíveis —", err.message);
  }

  // Frescor por domínio (D8): quando o DW recebeu a última carga boa.
  // previsto e chefes vêm do QOD.
  if (dominios.previsto) dominios.previsto.fonte = "qod";
  if (dominios.chefes) dominios.chefes.fonte = "qod";
  try {
    const { rows } = await getPoolDw().query(
      "select dominio, ultima_carga from marts.carga_status"
    );
    for (const { dominio, ultima_carga } of rows) {
      if (dominios[dominio]) dominios[dominio].carregado_em = ultima_carga;
      if (dominio === "qod") {
        for (const d of ["previsto", "chefes"]) if (dominios[d]) dominios[d].carregado_em = ultima_carga;
      }
    }
  } catch (err) {
    console.error("dados/metricas: carga_status indisponível —", err.message);
  }

  return { metricas, chefes, dominios };
}
