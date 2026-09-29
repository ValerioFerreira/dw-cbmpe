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
};

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

// { metricas: { [sigla]: { efetivo?, viaturas?, financas? } },
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

  // Frescor por domínio (D8): quando o DW recebeu a última carga boa.
  try {
    const { rows } = await getPoolDw().query(
      "select dominio, ultima_carga from marts.carga_status"
    );
    for (const { dominio, ultima_carga } of rows) {
      if (dominios[dominio]) dominios[dominio].carregado_em = ultima_carga;
    }
  } catch (err) {
    console.error("dados/metricas: carga_status indisponível —", err.message);
  }

  return { metricas, dominios };
}
