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
import { readFile } from "node:fs/promises";
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
    from marts.previsto_quadro
    union all
    select sigla, previsto, null::date
    from marts.previsto_organograma
    where not exists (select 1 from marts.previsto_quadro)`,
};

// Titular de cada unidade, do Pecúlio (marts.chefe_organograma). Dado nominal
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
         pcnh, agregado, to_char(data_referencia, 'YYYY-MM-DD')   as data_referencia
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
      // Marca "Ag" da coluna OBS do Pecúlio — entra na regra de indisponível.
      agregado: !!r.agregado,
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

// ---------------------------------------------------------------------------
// Painéis corporativos (etl/dw/ddl/13_paineis.sql) — mesmo JSON que
// src/data/real/{financas,vacinacao,ocorrencias}_dashboard.json.
// ---------------------------------------------------------------------------
const num = (v) => (v == null ? null : Number(v));
const texto = (v) => (v == null ? null : String(v).trim() || null);
// Espelho de stg.normalizar_sigla(): maiúsculas, sem acento, só letras e
// números ("GBMar" e "GBMAR" viram "GBMAR").
function normalizarSigla(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
const CONECTORES_NOME = new Set(["de", "da", "do", "das", "dos", "e"]);
// capitalizar_nome() de extract_dashboard_vacinacoes.py
function capitalizarNome(bruto) {
  if (!bruto) return null;
  return bruto.trim().split(/\s+/).map((p, i) => {
    const pl = p.toLowerCase();
    return i > 0 && CONECTORES_NOME.has(pl) ? pl : pl.charAt(0).toUpperCase() + pl.slice(1);
  }).join(" ");
}

// DF: linhas por unidade recortadas pelo indicador Finanças. As diárias (módulo
// "Diárias") e os lançamentos sem unidade (folha, contratos, "Aos mesmos"...)
// só vão para quem vê Finanças de todas as unidades (acesso total ou perfil DF)
// — o painel só os mostra na visão do Comando Geral. `lancamentos` alimenta a aba
// "Despesas Gerais": uma linha por lançamento, sem texto livre; quem não vê tudo
// só recebe as linhas das unidades liberadas.
export async function painelDf(siglas) {
  const pool = getPoolDw();
  const parametros = [];
  const where = siglas === null ? "" : (parametros.push([...siglas]), "where unidade = any($1)");
  const [ord, extra, si, diarias, lanc] = await Promise.all([
    pool.query(`select unidade, natureza, mes, valor from marts.painel_df_sfi_ordinario ${where}`, parametros),
    pool.query(`select unidade, valor from marts.painel_df_sfi_extra ${where}`, parametros),
    pool.query(`select unidade, valor from marts.painel_df_suprimento_individual ${where}`, parametros),
    siglas === null ? pool.query("select operacao, valor from marts.painel_df_diarias order by valor desc") : { rows: [] },
    pool.query(
      `select bloco, unidade, destino, enquadramento, situacao, tipo, natureza, mes, mes_ordem, oficio, item, empenho,
              valor, valor_liquidado, valor_pago, pago_maior_liquidado, liquidado_maior_empenhado, pago_maior_empenhado
       from marts.painel_df_lancamento ${where} order by mes_ordem nulls last, bloco, oficio, item`,
      parametros
    ),
  ]);
  const comValor = (r) => ({ ...r, valor: num(r.valor) });
  const lancamento = (r) => ({
    ...r,
    valor: r.valor === null ? null : num(r.valor),
    valor_liquidado: r.valor_liquidado === null ? null : num(r.valor_liquidado),
    valor_pago: r.valor_pago === null ? null : num(r.valor_pago),
  });
  return {
    fonte: "dw (marts.painel_df_*)",
    criterio: "situacao=EMPENHADO. SFI = SFI Ordinário (valor liquidado) + Autorização enquadramento=SFI (SFI Extra). Suprimento Individual = Autorização enquadramento=SI. Diárias = Autorização enquadramento=DIÁRIAS. Despesas Gerais = todos os lançamentos da planilha, como estão (só a grafia do tipo de gasto e do mês é tratada).",
    sfi_ordinario: ord.rows.map(comValor),
    sfi_extra: extra.rows.map(comValor),
    suprimento_individual: si.rows.map(comValor),
    diarias: diarias.rows.map(comValor),
    lancamentos: lanc.rows.map(lancamento),
  };
}

export async function painelVacinacao() {
  const pool = getPoolDw();
  const [eventos, participacao] = await Promise.all([
    pool.query("select data, posto, campanha, vacina, marca, ome, aplicador from marts.painel_vacinacao_evento order by data"),
    pool.query("select vacina, ome, militares from marts.painel_vacinacao_participacao"),
  ]);
  return {
    eventos: eventos.rows.map((r) => ({ ...r, aplicador: capitalizarNome(r.aplicador) })),
    participacao: participacao.rows.map((r) => ({ ...r, militares: Number(r.militares) })),
  };
}

// Dashboard Pessoal de Efetivo (etl/dw/ddl/19_painel_efetivo.sql): só agregados —
// previsto por unidade e posto (o front soma as unidades do escopo), saída de
// militares por ano e previsão de saída. Os registros por militar vêm da relação
// nominal (efetivoNominal), já recortada por perfil.
export async function painelEfetivo() {
  const pool = getPoolDw();
  const [prev, saida, previsao] = await Promise.all([
    pool.query("select sigla, posto, previsto from marts.previsto_quadro_posto"),
    pool.query("select ano, total from marts.painel_saida_ano order by ano"),
    pool.query("select ano, categoria, total from marts.painel_saida_previsao order by ano, categoria"),
  ]);
  return {
    fonte: "dw (marts.previsto_quadro_posto, painel_saida_*)",
    previsto: prev.rows.map((r) => ({ sigla: r.sigla, posto: r.posto, previsto: Number(r.previsto) })),
    saida_por_ano: Object.fromEntries(saida.rows.map((r) => [String(r.ano), Number(r.total)])),
    previsao_saida: previsao.rows.map((r) => ({ ano: Number(r.ano), categoria: r.categoria, total: Number(r.total) })),
  };
}

// Painel 09 (Intenção de Movimentação, etl/dw/ddl/17_cim.sql): uma linha por
// solicitação/transferência, SEM matrícula nem nome. As agregações e os filtros
// de categoria e motivo são feitos na tela. Visão corporativa — só quem vê o
// Efetivo de todas as unidades recebe (ver o controller).
export async function painelMovimentacao() {
  const pool = getPoolDw();
  const [pedidos, atendidos] = await Promise.all([
    pool.query("select posto_grad, categoria, ome, ome_atual, opcao_1, opcao_2, opcao_3, motivo from marts.painel_cim_pedido"),
    pool.query("select posto_grad, categoria, ome, ome_atual, motivo from marts.painel_cim_atendido"),
  ]);
  return { fonte: "dw (marts.painel_cim_*)", pedidos: pedidos.rows, atendidos: atendidos.rows };
}

// Ocorrências: recortadas pelas unidades liberadas (ome OU diretoria da
// ocorrência dentro do conjunto). `siglas` null = todas.
export async function painelOcorrencias(siglas) {
  const pool = getPoolDw();
  const parametros = [];
  // Compara normalizado: a ROE grava as OMEs em maiúsculas ("GBMAR") e o
  // organograma não ("GBMar").
  const where = siglas === null ? "" : (parametros.push([...siglas].map(normalizarSigla)),
    "where ome_norm = any($1) or diretoria_norm = any($1)");
  const consulta = (sql) => pool.query(`${sql} ${where}`, parametros);
  const [oc, aph, inc, salv, prev, pp, diag] = await Promise.all([
    consulta("select * from marts.painel_roe_ocorrencia"),
    consulta("select * from marts.painel_roe_aph"),
    consulta("select * from marts.painel_roe_incendio"),
    consulta("select * from marts.painel_roe_salvamento"),
    consulta("select * from marts.painel_roe_prevencao"),
    consulta("select * from marts.painel_roe_produtos_perigosos"),
    pool.query("select * from marts.painel_roe_diagnostico_pp"),
  ]);
  const d = diag.rows[0] || {};
  return {
    ocorrencias: oc.rows.map((r) => ({
      data: r.data, natureza: r.natureza, diretoria: r.diretoria, ome: r.ome, cidade: r.cidade,
      grupo: r.grupo, subgrupo: r.subgrupo, motivoNaoAtendimento: r.motivo_nao_atendimento,
      statusRelatorio: r.status_relatorio, finalizado: r.status_relatorio === "Finalizado",
      ocorrenciaAtendida: r.ocorrencia_atendida, protocoloPresente: !!r.protocolo_presente,
      vitimasFeridas: Number(r.vitimas_feridas), vitimasFatais: Number(r.vitimas_fatais),
      vitimasIlesas: Number(r.vitimas_ilesas), vitimasDesaparecidas: Number(r.vitimas_desaparecidas),
    })),
    aphEstatistica: aph.rows.map((r) => ({
      ome: r.ome, diretoria: r.diretoria, genero: texto(r.genero), idade: num(r.idade),
      idadeEmMeses: !!r.idade_em_meses, cvi: r.cvi == null ? null : !!r.cvi,
      entregueVivo: r.entregue_vivo == null ? null : !!r.entregue_vivo, deficiencia: texto(r.deficiencia),
    })),
    incendio: inc.rows.map((r) => ({
      data: r.data, ome: r.ome, diretoria: r.diretoria, cidade: r.cidade,
      duracaoCombateHoras: num(r.duracao_combate_horas), duracaoRescaldoHoras: num(r.duracao_rescaldo_horas),
      duracaoTotalHoras: num(r.duracao_total_horas),
    })),
    salvamento: salv.rows.map((r) => ({
      data: r.data, ome: r.ome, diretoria: r.diretoria, cidade: r.cidade, tipoPredominante: r.tipo_predominante,
    })),
    prevencao: prev.rows.map((r) => ({
      data: r.data, ome: r.ome, diretoria: r.diretoria, cidade: r.cidade,
      duracaoEventoHoras: num(r.duracao_evento_horas), publicoEstimado: num(r.publico_estimado),
      publicoPresente: num(r.publico_presente), situacaoAvcb: r.situacao_avcb, areaEstimada: num(r.area_estimada),
      eventoRegularizado: r.evento_regularizado,
    })),
    produtosPerigosos: pp.rows.map((r) => ({
      data: r.data, ome: r.ome, diretoria: r.diretoria, cidade: r.cidade, nomeProduto: r.nome_produto,
      classeRisco: r.classe_risco, perfilBotijaoGlp: r.perfil_botijao_glp,
    })),
    produtosPerigososDiagnostico: {
      semMatchNaBasico: num(d.sem_match_na_basico), matchMasDataNula: num(d.match_mas_data_nula), comData: num(d.com_data),
    },
    // Ressalva de qualidade de dado que continua valendo (ver o extrator).
    pendenciasSemSql: {
      produtos_perigosos_total_por_produto: "Igor sinalizou suspeita de erro de qualidade na fonte: 656 dos 672 produtos apareciam com contagem exatamente 20, a maioria com rótulo no formato \"X (ver Y)\" — indício de lista de referência carregada junto com o dado de incidente. Card retido até confirmação com quem administra a base.",
    },
  };
}

// ---------------------------------------------------------------------------
// Mapa de Força (etl/dw/ddl/16_mapa_forca.sql) — dado NOMINAL (guarnição de cada
// viatura/posto, por dia), sempre recortado pelas unidades que o perfil libera.
// O app só apresenta os últimos 30 dias (a janela está nas views).
//
// O catálogo de postos (nome, município, AIS e coordenada conferida) não é
// pessoal e vem de backend/data/mapa_forca_postos.json, gerado por
// etl/mapa_forca/extract_mapa_forca.py — até a tabela de coordenadas dos
// postos existir no DW.
// ---------------------------------------------------------------------------
const ARQUIVO_POSTOS = new URL("../data/mapa_forca_postos.json", import.meta.url);
let catalogoPostos = null;

async function lerCatalogoPostos() {
  if (!catalogoPostos) {
    try {
      catalogoPostos = JSON.parse(await readFile(ARQUIVO_POSTOS, "utf-8"));
    } catch (err) {
      console.error("dados/mapa-forca: catálogo de postos indisponível —", err.message);
      return { gerado_em: null, postos: {}, omes: {} };
    }
  }
  return catalogoPostos;
}

const ISO = "to_char(data, 'YYYY-MM-DD')";

// Dias com lançamento dentro da janela + catálogo dos postos. Não é nominal:
// vale para qualquer usuário logado (o recorte vem na hora de pedir o dia).
export async function mapaForcaIndice() {
  const [{ rows: dias }, catalogo] = await Promise.all([
    getPoolDw().query(`select distinct ${ISO} as data from marts.mapa_forca_lancamento order by 1`),
    lerCatalogoPostos(),
  ]);
  return {
    gerado_em: catalogo.gerado_em,
    fonte: "dw (marts.mapa_forca_*), janela de 30 dias",
    datas: dias.map((r) => r.data),
    postos: catalogo.postos,
    omes: catalogo.omes,
  };
}

// Um dia inteiro: lançamento → viaturas + guarnição (mesmo formato dos
// arquivos que o painel lia). `siglas` null = todas; Set vazio = nenhuma.
export async function mapaForcaDia(data, siglas) {
  const vazio = { data, fonte: "dw (marts.mapa_forca_*)", lancamentos: [] };
  if (siglas && siglas.size === 0) return vazio;
  const parametros = [data];
  let recorte = "";
  if (siglas) {
    parametros.push([...siglas]);
    recorte = "and l.sigla = any($2)";
  }
  const pool = getPoolDw();
  const [lanc, vtr, gua] = await Promise.all([
    pool.query(
      `select l.id_lancamento, coalesce(l.sigla, l.ome_dw) as ome, l.id_posto, l.tipo_servico, l.turno
       from marts.mapa_forca_lancamento l
       where l.data = $1 ${recorte}
       order by l.id_lancamento desc`,
      parametros
    ),
    pool.query(
      `select v.id_lancamento, v.placa, v.tipo, v.acronimo, v.numero
       from marts.mapa_forca_viatura v
       join marts.mapa_forca_lancamento l using (id_lancamento)
       where l.data = $1 ${recorte}`,
      parametros
    ),
    pool.query(
      `select g.id_lancamento, g.matricula, g.posto_grad, g.nome_guerra, g.funcao
       from marts.mapa_forca_guarnicao g
       join marts.mapa_forca_lancamento l using (id_lancamento)
       where l.data = $1 ${recorte}`,
      parametros
    ),
  ]);

  const porId = new Map();
  for (const r of lanc.rows) {
    porId.set(String(r.id_lancamento), {
      id: Number(r.id_lancamento),
      ome: r.ome,
      posto: r.id_posto == null ? null : String(r.id_posto),
      tipoServico: r.tipo_servico,
      turno: r.turno,
      viaturas: [],
      guarnicao: [],
    });
  }
  for (const r of vtr.rows) {
    porId.get(String(r.id_lancamento))?.viaturas.push({
      placa: r.placa, tipo: r.tipo, acronimo: r.acronimo, numero: r.numero,
    });
  }
  for (const r of gua.rows) {
    porId.get(String(r.id_lancamento))?.guarnicao.push({
      matricula: r.matricula, postoGrad: r.posto_grad, nomeGuerra: r.nome_guerra, funcao: r.funcao,
    });
  }
  return { ...vazio, lancamentos: [...porId.values()] };
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
