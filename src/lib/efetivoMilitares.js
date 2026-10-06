import efetivoLista from "@/data/efetivoLista";
import { CIDADE_POR_OME } from "@/lib/omeGeografia";
import { OFICIAIS_POSTOS, omeSiglaCurta } from "@/lib/efetivoDashboard";

// Registros do Dashboard Pessoal de Efetivo, montados a partir da MESMA
// relação nominal que a tabela de Efetivo usa (src/data/efetivoLista.js:
// DW pelo backend, já recortada pelo perfil no servidor).
//
// Desde 2026-10-06 isto substitui os JSON militares.json, carreira_extra.json
// e adidos_extra.json (gerados à mão em 19/08, sem agenda, dentro do bundle e
// sem login). Só há uma fonte para o mesmo militar: o número do dashboard e o
// da tabela deixam de poder divergir.
//
// O campo `ome` segue na grafia curta do Pecúlio ("CG", "1ºGB", "DInter/1"),
// que é a que as telas, o mapa (CIDADE_POR_OME) e os filtros já usam;
// omeSiglaReal() de efetivoDashboard.js faz o caminho de volta.

const OFICIAIS = new Set(OFICIAIS_POSTOS);

// Região de cada OME (spec do dashboard, dePara.regiaoPorOme). OME fora da
// lista cai em QCG: são setores da administração central.
const REGIAO_POR_OME = {};
[
  ["QCG", ["ABMG", "ADIDO", "AECI", "AjG", "CAT/RMR", "CCS", "CEAO", "CEFD", "CG", "CI", "CInt", "CMan", "CPO", "CPPA",
    "DAS", "DEIP", "DF", "DGO", "DGP", "DIEsp", "DJD", "DLog", "DPlaG", "DTIC", "DVP", "GCG", "GSG", "SG"]],
  ["DIM", ["GBI", "GBAPH", "GBMar", "GBS", "DIM"]],
  ["DINTER 1", ["1ºGB", "2ºGB", "6ºGB", "7ºGB", "CAT Agreste", "CAT Zona da Mata", "DInter/1"]],
  ["DINTER 2", ["3ºGB", "4ºGB", "5ºGB", "9ºGB", "CAT Sertão", "DInter/2"]],
].forEach(([regiao, omes]) => omes.forEach((o) => { REGIAO_POR_OME[o] = regiao; }));

const FAIXAS = [[18, 22], [23, 27], [28, 32], [33, 37], [38, 42], [43, 47], [48, 52], [53, 57], [58, 59]];
function faixaEtaria(idade) {
  if (idade == null) return null;
  if (idade >= 60) return "60+";
  const f = FAIXAS.find(([min, max]) => idade >= min && idade <= max);
  return f ? `${f[0]}-${f[1]}` : null;
}

const ano = (iso) => (iso ? Number(String(iso).slice(0, 4)) : null);

// Só LTS e LM contam como afastamento (a coluna do Pecúlio traz também lixo
// digitado — sigla de OME no lugar do tipo — que não é afastamento).
const AFASTAMENTOS = new Set(["LTS", "LM"]);

function montar(porUnidade) {
  const militares = [];
  const carreira = [];
  const adidosExtra = [];

  for (const [sigla, arr] of Object.entries(porUnidade || {})) {
    for (const r of arr) {
      const c = r.completo || {};
      const ome = omeSiglaCurta(r.omeExibicao || sigla);
      const categoria = OFICIAIS.has(r.postoGrad) ? "Oficiais" : "Praças";
      const dias = c.tempoObmAtualDias;
      const tempoOmeAnos = dias != null ? dias / 365 : null;

      militares.push({
        sigla, // unidade do organograma em que o militar conta (escopo por perfil)
        posto: r.postoGrad,
        ome,
        regiao: REGIAO_POR_OME[ome] || "QCG",
        categoria,
        sexo: r.sexo,
        faixa: faixaEtaria(r.idade),
        cidade: CIDADE_POR_OME[ome] || null,
        // Anos inteiros na OME atual (dias/365, truncado): é o que reproduz o
        // print do Igor no painel de Adidos (117/36/23/11).
        tempoObmAnos: dias != null ? Math.floor(dias / 365) : null,
        le: !!c.le,
        ltip: !!c.ltip,
        horarioEspecial: !!c.horarioEspecial,
        readaptado: !!c.readaptado,
        pcd: !!c.pcd,
        agregado: !!r.agregado,
        afastamento: AFASTAMENTOS.has(c.afastamentoSup90Dias) ? c.afastamentoSup90Dias : null,
        acumuloCargos: c.acumuloCargos || null,
      });

      carreira.push({
        sigla,
        posto: r.postoGrad,
        categoria,
        ome,
        anoMovimentacao: ano(c.dataMovimentacaoSp),
        anoPromocao: ano(c.dataUltimaPromocao),
        anoIngresso: ano(c.dataIngresso),
        tempoServicoAnos: c.tempoServicoAnos ?? null,
        tempoOmeAnos,
      });

      if (ome === "ADIDO") {
        adidosExtra.push({ sigla, orgao: c.orgao || "Não informado", omeAnterior: c.omeAnteriorSp || "Não informado" });
      }
    }
  }
  return { militares, carreira, adidosExtra };
}

// Refeito só quando a lista troca de fonte (JSON embutido -> DW).
let cache = { base: null, dados: { militares: [], carreira: [], adidosExtra: [] } };
export function registrosEfetivo() {
  if (cache.base !== efetivoLista.por_unidade) {
    cache = { base: efetivoLista.por_unidade, dados: montar(efetivoLista.por_unidade) };
  }
  return cache.dados;
}

// Restringe pelas unidades do escopo (chave de `por_unidade`, que já é a
// sigla do organograma — adido conta no COMANDO GERAL; CPPA, na DGP).
export function doEscopo(registros, permitidas) {
  return registros.filter((r) => permitidas.has(r.sigla));
}
