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
import { contatosPorMatricula } from "./omeResolver.js";

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
  // Indicadores próprios desde 2026-10-29 (etl/dw/ddl/24): ocorrências recebidas
  // nos últimos 30 dias e militares empregados no dia que o Mapa de Força abre.
  ocorrencias: `
    select sigla, ocorrencias_30d as valor, null::date as data_referencia
    from marts.ocorrencias_organograma`,
  mapaForca: `
    select sigla, militares as valor, data as data_referencia
    from marts.mapa_forca_organograma`,
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
// lotacao_funcao.json, removido em 2026-10-06), para a troca de fonte não mexer nas telas.
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
  if (siglas && siglas.size === 0) return { por_matricula: {}, funcoes: {}, por_unidade_divisao: {} };
  const parametros = [];
  const onde = filtroSiglas(siglas, parametros);
  const { rows } = await getPoolDw().query(
    `select matricula, id_funcao, antiguidade, bge, cursos, portaria, posto_funcao,
            tipo, funcao, secao, ome, ome_completa, localidade, divisao
     from marts.lotacao_militar ${onde}`,
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
        localidade: r.localidade, tipo: r.tipo, divisao: r.divisao,
      };
    }
  }
  // Quem está lotado em cada divisão do organograma (por unidade do militar), para
  // filtrar a tabela de Efetivo pelo setor — recortado pelo perfil como o resto.
  const divisoes = await getPoolDw().query(
    `select sigla, divisao, matricula from marts.lotacao_divisao ${onde}`,
    parametros
  );
  const porUnidadeDivisao = {};
  for (const r of divisoes.rows) ((porUnidadeDivisao[r.sigla] ||= {})[r.divisao] ||= []).push(r.matricula);
  return {
    fonte: "dw (marts.lotacao_militar, lotacao_divisao)",
    por_matricula: porMatricula,
    funcoes,
    por_unidade_divisao: porUnidadeDivisao,
  };
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

// Frota por viatura (etl/dw/ddl/20_viatura_nominal.sql) — a tabela e o dashboard de
// Viaturas, a ficha de cada uma. Recortada pelas unidades que o perfil libera no
// indicador Viaturas. `siglas` null = todas; Set vazio = nenhuma.
export async function viaturasNominal(siglas) {
  if (siglas && siglas.size === 0) return { fonte: "dw (marts.viatura_nominal)", viaturas: [] };
  const parametros = [];
  const { rows } = await getPoolDw().query(
    `select sigla, id, placa, tipo, tipo_acronym, numero_ordem, marca, modelo, ano, patrimonio, renavam,
            chassis, rastreado, caracterizado, posse, destinacao, combustivel, categoria_habilitacao,
            situacao, odometro, ultimo_abastecimento_valor, ultimo_abastecimento_data, condutores
     from marts.viatura_nominal ${filtroSiglas(siglas, parametros)}
     order by sigla, tipo_acronym, numero_ordem`,
    parametros
  );
  return {
    fonte: "dw (marts.viatura_nominal)",
    viaturas: rows.map((r) => ({
      sigla: r.sigla,
      id: r.id,
      placa: r.placa,
      tipo: r.tipo,
      tipoAcronym: r.tipo_acronym,
      numeroOrdem: r.numero_ordem,
      marca: r.marca,
      modelo: r.modelo,
      ano: r.ano,
      patrimonio: r.patrimonio,
      renavam: r.renavam,
      chassis: r.chassis,
      rastreado: r.rastreado,
      caracterizado: r.caracterizado,
      posse: r.posse,
      destinacao: r.destinacao,
      combustivel: r.combustivel,
      categoriaHabilitacao: r.categoria_habilitacao,
      situacao: r.situacao,
      odometro: num(r.odometro),
      ultimoAbastecimentoValor: num(r.ultimo_abastecimento_valor),
      ultimoAbastecimentoData: r.ultimo_abastecimento_data ? new Date(r.ultimo_abastecimento_data).toISOString() : null,
      condutores: r.condutores,
    })),
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
  const [oc, aph, inc, salv, prev, pp, diag, cvi, pop] = await Promise.all([
    consulta("select * from marts.painel_roe_ocorrencia"),
    consulta("select * from marts.painel_roe_aph"),
    consulta("select * from marts.painel_roe_incendio"),
    consulta("select * from marts.painel_roe_salvamento"),
    consulta("select * from marts.painel_roe_prevencao"),
    consulta("select * from marts.painel_roe_produtos_perigosos"),
    pool.query("select * from marts.painel_roe_diagnostico_pp"),
    consulta("select * from marts.painel_roe_cvi"),
    pool.query("select municipio, municipio_chave, ano, populacao from marts.populacao_municipio"),
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
      // Mapa da aba Geolocalização e tabela de detalhamento (etl/dw/ddl/13, 2026-10-29).
      roeId: r.roe_id == null ? null : String(r.roe_id), bairro: r.bairro ?? null, lat: num(r.lat), lng: num(r.lng),
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
    // Aba CVI (etl/dw/ddl/24): uma linha por vítima de ocorrência CVI (ou uma linha
    // sem vítima, quando a ocorrência não tem ficha de APH). `roeId` agrupa as
    // vítimas da mesma ocorrência.
    cvi: cvi.rows.map((r) => ({
      roeId: String(r.roe_id), data: r.data, ome: r.ome, diretoria: r.diretoria, cidade: r.cidade,
      bairro: r.bairro, lat: num(r.lat), lng: num(r.lng), grupo: r.grupo, subgrupo: r.subgrupo,
      origemCvi: r.origem_cvi, finalizado: !!r.finalizado, atendida: r.atendida == null ? null : !!r.atendida,
      vitimasFataisOcorrencia: Number(r.vitimas_fatais_ocorrencia) || 0, tempoRespostaMin: num(r.tempo_resposta_min),
      vitima: !!r.vitima, vitimaMarcadaCvi: !!r.vitima_marcada_cvi, tipoAgressao: r.tipo_agressao,
      genero: texto(r.genero), idade: num(r.idade),
      entregueVivo: r.entregue_vivo == null ? null : !!r.entregue_vivo,
      destino: texto(r.destino), tipoHospital: texto(r.tipo_hospital), consciencia: texto(r.consciencia),
    })),
    // População dos municípios de PE (IBGE, etl/dw/ddl/25) para as taxas por habitante.
    // `chave`: nome sem acento e em maiúsculas, como o front casa a cidade.
    populacao: pop.rows.map((r) => ({ municipio: r.municipio, chave: r.municipio_chave, ano: r.ano, populacao: Number(r.populacao) })),
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
// O catálogo de postos (nome, município, AIS e coordenada) não é pessoal e vem do DW:
// marts.mapa_forca_posto / mapa_forca_ome (etl/dw/ddl/23_coordenadas_mapa_forca.sql),
// gravadas por etl/mapa_forca/extract_mapa_forca.py --gravar-dw. A coordenada de cada seção
// é a que o usuário informou (etl/mapa_forca/coordenadas_secoes.csv); o resto segue as regras
// de conferir_coordenadas.py.
// ---------------------------------------------------------------------------
async function lerCatalogoPostos() {
  const pool = getPoolDw();
  const [postos, omes] = await Promise.all([
    pool.query("select id_posto, nome, ome, municipio, bairro, ais, lat, lon, origem_coord, sede, gerado_em from marts.mapa_forca_posto"),
    pool.query("select sigla, nome, municipio, lat, lon from marts.mapa_forca_ome"),
  ]);
  return {
    gerado_em: postos.rows.reduce((m, r) => (!m || r.gerado_em > m ? r.gerado_em : m), null),
    postos: Object.fromEntries(postos.rows.map((r) => [String(r.id_posto), {
      nome: r.nome, ome: r.ome, municipio: r.municipio, bairro: r.bairro, ais: r.ais,
      lat: r.lat, lon: r.lon, origemCoord: r.origem_coord, sede: r.sede,
    }])),
    omes: Object.fromEntries(omes.rows.map((r) => [r.sigla, { nome: r.nome, municipio: r.municipio, lat: r.lat, lon: r.lon }])),
  };
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
      `select g.id_lancamento, g.matricula, g.posto_grad, g.nome_guerra, g.funcao, g.ativado
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
      ativado: r.ativado !== false,
    });
  }
  return { ...vazio, lancamentos: [...porId.values()] };
}

// Telefones da guarnição de UM posto num dia (detalhe do posto no Mapa de Força). Usa o mesmo recorte do
// dia (`siglas` null = todas; Set vazio = nenhuma), então só devolve telefone de quem o usuário já pode
// ver na guarnição. O telefone vem do SGP ao vivo (ovrsgp.tb_pess.nr_cntt_proprio), nunca do DW.
export async function mapaForcaContatos(data, posto, siglas) {
  if (siglas && siglas.size === 0) return { data, posto, telefones: {} };
  const parametros = [data, Number(posto)];
  let recorte = "";
  if (siglas) {
    parametros.push([...siglas]);
    recorte = "and l.sigla = any($3)";
  }
  const { rows } = await getPoolDw().query(
    `select distinct g.matricula
     from marts.mapa_forca_guarnicao g
     join marts.mapa_forca_lancamento l using (id_lancamento)
     where l.data = $1 and l.id_posto = $2 ${recorte}`,
    parametros
  );
  const telefones = await contatosPorMatricula(rows.map((r) => r.matricula));
  return { data, posto, telefones };
}

// { metricas: { [sigla]: { efetivo?, viaturas?, financas?, previsto? } },
//   chefes:   { [sigla]: { posto, nome, cargo, vago } } | null,
//   divisoes: { previsto: { [sigla]: [{ nome, previsto, extra }] }, atual: { [sigla]: { [divisao]: n } } } | null,
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

  // Divisões do organograma (ddl/21): previsto dos quadros e quantos militares estão
  // lotados em cada uma — agregados, como as demais métricas.
  let divisoes = null;
  try {
    const [prev, atual] = await Promise.all([
      getPoolDw().query("select sigla, nome, previsto, extra from marts.previsto_divisao order by sigla, ordem"),
      getPoolDw().query("select sigla, divisao, count(*)::int as n from marts.lotacao_divisao group by 1, 2"),
    ]);
    divisoes = { previsto: {}, atual: {} };
    for (const r of prev.rows) (divisoes.previsto[r.sigla] ||= []).push({ nome: r.nome, previsto: Number(r.previsto), extra: r.extra });
    for (const r of atual.rows) (divisoes.atual[r.sigla] ||= {})[r.divisao] = r.n;
    dominios.divisoes = { fonte: "qod" };
  } catch (err) {
    console.error("dados/metricas: divisões indisponíveis —", err.message);
  }

  return { metricas, chefes, divisoes, dominios };
}
