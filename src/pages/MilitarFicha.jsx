import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, UserRound, CalendarClock, ShieldCheck, Lock } from "lucide-react";
import SectionCard from "@/components/ui/section-card";
import EmptyState from "@/components/ui/empty-state";
import efetivoLista from "@/data/efetivoLista"; // JSON embutido ou DW (ver o módulo)
import { funcaoDoMilitar, secaoDoMilitar } from "@/lib/lotacaoFuncao";

// Ficha do militar — CAMINHO A (público). Só campos NÃO sensíveis, servidos
// pelo build estático na Vercel. Todo o dado sensível do SGP (CPF/RG/
// endereço/filiação/saúde/biometria/religião/raça/dependentes) é CAMINHO B:
// fica reservado pro backend interno com autenticação real e NUNCA entra num
// arquivo público. Decisão de 2026-08-19 — ver DW_GOVERNANCA.md e
// DW_PLANEJAMENTO.md.
//
// A chave de junção é a matrícula (confirmado pelo usuário: a matrícula da
// base atual = a do SGP). Esta ficha lê o que já temos em efetivo_lista.json;
// os blocos "de carreira" mais ricos do SGP (promoções, movimentações,
// afastamentos, cursos) entram quando a sincronização SGP → Neon for
// publicada (ver DW_ETL.md / windmill-sgp.py, engatilhado).

// Índice matrícula → registro (achatando por_unidade). A OME exibida
// respeita omeExibicao (ex. "ADIDO"); ver extract_efetivo.py. Refeito quando
// a lista troca de fonte (JSON embutido -> DW, ver src/data/efetivoLista.js).
let indice = { base: null, idx: {} };
function porMatricula() {
  if (indice.base === efetivoLista.por_unidade) return indice.idx;
  const idx = {};
  const porUnidade = efetivoLista.por_unidade || {};
  for (const [sigla, arr] of Object.entries(porUnidade)) {
    for (const r of arr) {
      if (r.matricula && !idx[r.matricula]) {
        idx[r.matricula] = { ...r, ome: r.omeExibicao || sigla };
      }
    }
  }
  indice = { base: efetivoLista.por_unidade, idx };
  return idx;
}

// Data ISO "aaaa-mm-dd" → dd/mm/aaaa (lê por regex pra não sofrer com fuso).
function fmtData(valor) {
  if (!valor) return "—";
  const iso = typeof valor === "string" ? valor.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return String(valor);
}

function fmtCampo(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

function fmtNumero(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n) ? "—" : n.toLocaleString("pt-BR");
}

function Campo({ rotulo, valor }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-foreground">{valor ?? "—"}</p>
    </div>
  );
}

function Widget({ icone: Icone, rotulo, valor, sub }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3.5 w-3.5" /> {rotulo}
      </p>
      <p className="mt-1 font-display text-[20px] font-semibold tracking-tight text-foreground">{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function MilitarFicha() {
  const { matricula } = useParams();
  const navigate = useNavigate();
  const militar = porMatricula()[matricula];
  const completo = militar?.completo || {};
  const funcao = militar ? funcaoDoMilitar(militar.matricula) : null;
  const secao = militar ? secaoDoMilitar(militar.matricula) : null;

  const nomeExibido = militar
    ? [militar.postoGrad, militar.nomeGuerra || militar.nome].filter(Boolean).join(" ")
    : matricula;

  return (
    <div className="space-y-3 animate-fade-in">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      {!militar ? (
        <EmptyState
          icon={UserRound}
          titulo="Militar não encontrado"
          descricao={`Nenhum militar ativo com a matrícula ${matricula} na base atual.`}
          acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{nomeExibido}</h1>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{militar.nome}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Widget
              icone={UserRound}
              rotulo="Idade / Sexo"
              valor={militar.idade != null ? `${militar.idade} anos` : "—"}
              sub={militar.sexo || undefined}
            />
            <Widget
              icone={CalendarClock}
              rotulo="Tempo de Serviço"
              valor={completo.tempoServicoAnos != null ? `${fmtNumero(completo.tempoServicoAnos)} anos` : "—"}
              sub={completo.tempoObmAtualDias != null ? `${fmtNumero(completo.tempoObmAtualDias)} dias na unidade` : undefined}
            />
            <Widget icone={ShieldCheck} rotulo="OME" valor={militar.ome || "—"} sub={funcao || undefined} />
          </div>

          <SectionCard titulo="Dados Funcionais">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Campo rotulo="Posto/Graduação" valor={fmtCampo(militar.postoGrad)} />
              <Campo rotulo="Matrícula" valor={fmtCampo(militar.matricula)} />
              <Campo rotulo="OME" valor={fmtCampo(militar.ome)} />
              <Campo rotulo="Função" valor={fmtCampo(funcao)} />
              <Campo rotulo="Seção" valor={fmtCampo(secao)} />
              <Campo rotulo="Data de Ingresso" valor={fmtData(completo.dataIngresso)} />
              <Campo rotulo="Última Promoção" valor={fmtData(completo.dataUltimaPromocao)} />
              <Campo rotulo="Última Movimentação" valor={fmtData(completo.dataMovimentacaoSp)} />
              <Campo rotulo="Unidade Anterior" valor={fmtCampo(completo.omeAnteriorSp)} />
              <Campo rotulo="Órgão" valor={fmtCampo(completo.orgao)} />
            </div>
          </SectionCard>

          <SectionCard titulo="Situação Administrativa">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Campo rotulo="Horário Especial" valor={fmtCampo(completo.horarioEspecial)} />
              <Campo rotulo="Readaptado" valor={fmtCampo(completo.readaptado)} />
              <Campo rotulo="Acúmulo de Cargos" valor={fmtCampo(completo.acumuloCargos)} />
              <Campo rotulo="LE" valor={fmtCampo(completo.le)} />
              <Campo rotulo="LTIP" valor={fmtCampo(completo.ltip)} />
              <Campo rotulo="Afastamento > 90 dias" valor={fmtCampo(completo.afastamentoSup90Dias)} />
              <Campo rotulo="Suplemento Pessoal (Nº/Ano)" valor={fmtCampo(completo.suplementoPessoalNumeroAno)} />
              <Campo rotulo="Data do Suplemento Pessoal" valor={fmtData(completo.dataSuplementoPessoal)} />
              <Campo rotulo="Promoção PCNH" valor={fmtCampo(completo.pcnh)} />
            </div>
          </SectionCard>

          {/* Caminho B — reservado ao backend interno autenticado. */}
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Dados pessoais, físicos, de saúde, documentos, dependentes e histórico completo
              (promoções, movimentações, afastamentos, cursos) do SGP são sensíveis (LGPD) e ficam
              reservados ao acesso autenticado no servidor interno — não são publicados aqui.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
