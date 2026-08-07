---
name: integrar-fonte-dw
description: Use this skill whenever the user shares, pastes, describes, or references a new data source (spreadsheet, system export, API, database table, screenshot of a system) to be integrated into the CBMPE data warehouse (dw-cbmpe project). Ensures every doubt about the source is resolved before any table/schema integration is designed. Trigger on phrases like "aqui está uma fonte de dados", "essa é a planilha de...", "esse é o sistema que...", or any file/data the user wants incorporated into the DW.
---

# Integrar nova fonte de dados ao DW do CBMPE

Este projeto tem uma regra permanente de trabalho, registrada em
`DW_PLANEJAMENTO.md` e detalhada em `DW_PROCESSO_INTEGRACAO.md`: nunca
desenhar a integração de uma fonte de dados nova antes de entendê-la por
completo.

## O que fazer, nesta ordem

1. **Leia `DW_PROCESSO_INTEGRACAO.md` na raiz do projeto** (se ainda não
   estiver em contexto) para o processo completo e os documentos
   relacionados (`DW_MODELO_DADOS.md`, `DW_CATALOGO_FONTES.md`,
   `DW_GOVERNANCA.md`, `DW_PLANEJAMENTO.md`).
2. **Receba a fonte** que o usuário compartilhou — não presuma nada sobre
   o conteúdo antes de examiná-la.
3. **Esclareça todas as dúvidas antes de propor qualquer integração.**
   Use `AskUserQuestion` quando fizer sentido. Cubra pelo menos:
   - Significado real de cada campo/coluna (não só o nome).
   - Grão: o que cada linha representa (evento, snapshot, pessoa, unidade,
     período?).
   - Relação com o que já existe no DW — sobretudo com `dim_unidade`
     (organograma já modelado, incluindo unidades `planejada` como a DGA).
   - Qualidade conhecida (campos vazios, duplicidade, nomes de unidade
     divergentes do organograma oficial).
   - Frequência real de atualização da fonte.
   - Responsável/dono da fonte.
   - Sensibilidade: PII, agregado, ou misto (ver `DW_GOVERNANCA.md`).
   - Casos especiais (unidades planejadas/extintas, dado histórico vs.
     corrente).
4. **Só depois de entendimento completo**, desenhe a integração:
   - Mapeie campos para dimensões/fatos existentes, ou proponha novos.
   - Identifique chaves/relações, especialmente com `dim_unidade`.
   - Atualize `DW_MODELO_DADOS.md`.
   - Atualize a linha correspondente em `DW_CATALOGO_FONTES.md`.
   - Registre a decisão no log de `DW_PLANEJAMENTO.md` (data, decisão,
     motivo).

## Regra crítica

Não pule o passo 3 (dúvidas) para chegar direto ao passo 4 (desenho),
mesmo que a fonte pareça simples ou autoexplicativa. Esse é exatamente o
comportamento que este projeto está evitando desde a fundação do
planejamento: nunca presumir onde os dados estão ou o que significam.
