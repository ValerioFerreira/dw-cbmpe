// Gera o SNAPSHOT que abastece o app publicado na Vercel enquanto o deploy interno
// (CapRover/VM da ATI) não existe. Lê do DW com os MESMOS serviços do backend
// (services/dadosService.js) e grava, como arquivos estáticos, o que o backend
// entregaria a um perfil de acesso total — MENOS o que o Comando mandou não publicar
// (2026-10-06): nome completo, CPF, telefone, licenças nominais (LE, LTIP e afastamento
// acima de 90 dias) e ofício/SEI de Finanças. O CPF nem existe no DW; o nome de quem
// aplicou vacina vira "Nome S." (primeiro nome + inicial do último).
//
// Uso (da pasta backend/, com a rede do DW e backend/.env):
//   node scripts/gerar_snapshot.js [pasta-de-saida]      # padrão: ../public/snapshot
//   node scripts/gerar_snapshot.js --completo            # SÓ para uso local (2026-10-08)
//
// --completo: sem nenhuma omissão — nome completo, telefones, LE/LTIP/afastamento, ofício de
// Finanças e nome inteiro de quem aplicou vacina, como o backend entrega a um perfil de acesso
// total. Para rodar o app na própria máquina (public/snapshot/ é git-ignorado). NUNCA publicar
// esta saída: publicar_snapshot.py chama o script SEM a flag, que continua omitindo.
//
// Quem publica: etl/snapshot/publicar_snapshot.py (gera, junta ao código e envia para a
// branch que a Vercel serve). Não commitar public/snapshot/ na main.
import "dotenv/config";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as dados from "../services/dadosService.js";
import { getPoolDw } from "../config/db.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const argumentos = process.argv.slice(2);
const COMPLETO = argumentos.includes("--completo");
const pastaArg = argumentos.find((a) => !a.startsWith("--"));
const saida = path.resolve(pastaArg || path.join(AQUI, "..", "..", "public", "snapshot"));
const geradoEm = new Date().toISOString();

// "JOÃO PEDRO DA SILVA" -> "João S."
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
function abreviarNome(bruto) {
  const partes = String(bruto || "").trim().split(/\s+/).filter((p) => !PARTICULAS.has(p.toLowerCase()));
  if (partes.length === 0) return null;
  const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  if (partes.length === 1) return cap(partes[0]);
  return `${cap(partes[0])} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

// Efetivo sem nome completo, telefone e licenças nominais. Consequência conhecida: no app
// publicado as telas que contam licença (Situações Funcionais) e a regra de indisponível
// (que usa LE, LTIP e afastamento) enxergam esses campos vazios.
function semDadoReservado(efetivo) {
  const por_unidade = {};
  for (const [sigla, lista] of Object.entries(efetivo.por_unidade)) {
    por_unidade[sigla] = lista.map((r) => {
      const { nome, completo, ...resto } = r; // eslint-disable-line no-unused-vars
      const {
        telefone1, telefone2, le, ltip, afastamentoSup90Dias, ...demais // eslint-disable-line no-unused-vars
      } = completo || {};
      return { ...resto, completo: demais };
    });
  }
  return { ...efetivo, por_unidade };
}

// Finanças sem ofício (e o SEI, que o painel já não traz).
function financasSemOficio(df) {
  return { ...df, lancamentos: df.lancamentos.map(({ oficio, ...resto }) => resto) }; // eslint-disable-line no-unused-vars
}

async function gravar(nome, payload) {
  const corpo = JSON.stringify({ ...payload, snapshot_gerado_em: geradoEm });
  await writeFile(path.join(saida, `${nome}.json`), corpo, "utf-8");
  console.log(`  ${nome}.json  ${(corpo.length / 1024).toFixed(0)} KB`);
  return nome;
}

async function main() {
  await rm(saida, { recursive: true, force: true });
  await mkdir(saida, { recursive: true });
  console.log(`Snapshot em ${saida}${COMPLETO ? "  (COMPLETO — uso local, não publicar)" : ""}`);

  const arquivos = [];
  arquivos.push(await gravar("metricas", await dados.metricasPorSigla()));
  const efetivo = await dados.efetivoNominal(null);
  arquivos.push(await gravar("efetivo", COMPLETO ? efetivo : semDadoReservado(efetivo)));
  arquivos.push(await gravar("lotacao", await dados.lotacaoNominal(null)));
  arquivos.push(await gravar("viaturas", await dados.viaturasNominal(null)));
  const painelDf = await dados.painelDf(null);
  arquivos.push(await gravar("painel-df", COMPLETO ? painelDf : financasSemOficio(painelDf)));
  arquivos.push(await gravar("painel-efetivo", await dados.painelEfetivo()));
  arquivos.push(await gravar("painel-movimentacao", await dados.painelMovimentacao()));
  arquivos.push(await gravar("painel-ocorrencias", await dados.painelOcorrencias(null)));

  const vacinacao = await dados.painelVacinacao();
  if (!COMPLETO) vacinacao.eventos = vacinacao.eventos.map((e) => ({ ...e, aplicador: abreviarNome(e.aplicador) }));
  arquivos.push(await gravar("painel-vacinacao", vacinacao));

  const indice = await dados.mapaForcaIndice();
  arquivos.push(await gravar("mapa-forca-indice", indice));
  for (const data of indice.datas) {
    arquivos.push(await gravar(`mapa-forca-dia-${data}`, await dados.mapaForcaDia(data, null)));
  }

  await writeFile(
    path.join(saida, "manifesto.json"),
    JSON.stringify({ gerado_em: geradoEm, arquivos: arquivos.map((a) => `${a}.json`) }),
    "utf-8"
  );
  console.log(`\n${arquivos.length} arquivos.`);
  await getPoolDw().end();
}

main().catch((erro) => {
  console.error("Falha ao gerar o snapshot:", erro);
  process.exit(1);
});
