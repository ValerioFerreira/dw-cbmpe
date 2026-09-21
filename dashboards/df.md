# Prompt padrão — construção de dashboards CBMPE prontos para integração

> Copie e cole este texto como primeira mensagem em um novo chat para começar um dashboard
> diferente (ex: Vacinações, Ocorrências, ou qualquer outro setor). Ajuste só os campos entre
> `[colchetes]`.

---

Vou te mandar prints de dashboards do Metabase para criarmos um novo dashboard aqui, seguindo exatamente o mesmo processo e padrão técnico que já usamos no Dashboard DF (CBMPE). O objetivo final é deixar o dashboard **pronto e aguardando apenas a integração do banco de dados real**, que outra pessoa (Valério) vai fazer depois.

**Projeto:** [nome do dashboard/setor, ex: "Dashboard Vacinações (DAS)"]
**Escopo:** independente dos outros dashboards do guarda-chuva CBMPE (PLAN DLOG, Ocorrências, DF, etc.) — não cruze dados nem suposições entre eles.

## Regras de dados — siga à risca

1. **Nunca infira ou invente.** Se um valor, rótulo ou lógica não estiver claro num print, pare e pergunte, ou peça o SQL/CSV/export daquele quadrante específico.
2. **Valide antes de construir.** Sempre que possível, cruze o que está no print com um SQL, CSV ou tabela exportada. Reconciliação de total (soma das partes bate com o card de total) é o método mais confiável quando não há CSV disponível.
3. **Documente qualidade de dado, não corrija silenciosamente.** Se encontrar inconsistências (grafias duplicadas de uma mesma unidade, categorias estranhas, totais que não batem), **sinalize explicitamente e pergunte como proceder** — não decida sozinho. Uma vez que o usuário decidir (ex: normalizar grafias), registre a decisão e o motivo.
4. **Divergências sem explicação ficam marcadas, não escondidas.** Se um card de total não bate com o detalhamento, construa os dois mesmo assim, mas com um destaque visual de alerta e uma nota explicando a divergência — nunca ajuste um valor para "bater" artificialmente.
5. **Marque confirmado vs. não confirmado.** Todo dado tem uma origem rastreável (print, SQL, CSV) e um status de validação. Isso deve aparecer tanto na documentação quanto como comentário no código/contrato de dados.

## Padrão visual

- Siga a paleta de cores, tipografia e alinhamentos já estabelecidos nos outros dashboards ("Planilhas corporativas integradas": navy/branco, grid, cards).
- **Não aproxime cores de memória.** Se eu mandar um print do sistema anfitrião (Painel de Controle) ou de um dashboard de referência, extraia os tokens reais por amostragem de pixel (cor de título, texto secundário, bordas, badges etc.) em vez de estimar visualmente.
- Se eu não mandar nenhuma referência visual nesta sessão, avise que precisa dela antes de montar o HTML (o ambiente reseta entre sessões e você não guarda arquivos de conversas anteriores).

## Pergunta obrigatória antes de montar a "casca" do dashboard

**Antes de construir sidebar, topbar, breadcrumb ou qualquer chrome de página**, pergunte: este dashboard vai ser standalone, ou vai ser **embutido como um card dentro de um sistema que eu já tenho** (ex: Painel de Controle)? Isso muda completamente o que precisa ser construído:
- **Embutido**: o HTML deve ser só o conteúdo do card (tabs + filtros + gráficos), sem sidebar/topbar/breadcrumb/título de página — o sistema anfitrião já fornece isso.
- **Standalone**: aí sim a casca completa faz sentido.

## Requisitos técnicos — dashboard "pronto para integração" significa

1. **Zero dependência de rede externa.** Chart.js (ou outra lib de gráfico) embutido inline no `<script>` (via npm local, nunca CDN). Fontes web também embutidas via `@font-face` em base64 (ex: `@fontsource/inter` do npm) — nada de `fonts.googleapis.com`.
2. **Contrato de dados formalizado.** Um objeto JS único (`DASHBOARD_DATA`) no topo do script, bem comentado, com o formato exato que cada campo espera (números puros, nunca string formatada; nomes já normalizados; flags de `confirmado`). Esse objeto é o único lugar que quem for integrar o banco precisa substituir.
3. **Funções de render reutilizáveis.** Cada gráfico tem sua própria função que destrói a instância anterior (`chart.destroy()`) e recria a partir do `DASHBOARD_DATA` atual — isso é o que permite um re-render de verdade quando o filtro mudar, não só na carga inicial.
4. **Filtros fiéis ao Metabase original, por aba.** Cada aba tem exatamente os filtros que tinha no original (algumas abas têm Mês+Unidade, outras só Unidade — não generalize). Filtro dispara `reloadDashboardData(tabId, filtros)`, que é o ponto único de integração (documentado com `// TODO (integração)`).
5. **Spinner de carregamento testável.** Ao trocar um filtro, os cards da aba escurecem com overlay + spinner por um tempo simulado, mesmo sem backend real — deixa o componente pronto e visualmente testável.
6. **Estado vazio.** Se os dados de um gráfico vierem vazios, mostrar uma mensagem ("Nenhum dado encontrado...") em vez de um canvas em branco.
7. **Listas de opção centralizadas.** Nunca duplicar uma lista (ex: unidades) em vários `<select>` no HTML — definir uma vez em JS e popular todos os selects a partir dela.
8. **Responsividade básica.** Grids colapsam para 1 coluna abaixo de ~900px; tabs viram scroll horizontal; filtros quebram linha.

## Documentação — mantenha um arquivo de status por projeto

Crie e mantenha atualizado um `status_<nome-do-projeto>.md` com:
- O que foi validado (com a fonte: print, SQL, CSV) e o que ainda não foi
- Decisões tomadas (ex: normalização de grafia) com data e motivo
- Divergências encontradas, mesmo sem solução ainda
- Pendências claras, cada uma com "o que falta" e "de quem depende"

## Memória entre sessões

Sempre que eu disser algo que vai ser relevante em uma sessão futura mas que eu não vou lembrar de repetir (ex: "não tenho acesso ao SQL dessa aba", "esse card não bate com aquele, vamos resolver depois"), **salve isso na sua memória explicitamente** usando a ferramenta de memória — não confie só em deixar escrito no arquivo de status, porque eu posso começar uma conversa nova sem reabrir o arquivo.

## Fluxo de trabalho esperado

1. Eu mando print(s) de uma aba/dashboard do Metabase.
2. Você lê o que der pra ler com segurança e me diz explicitamente o que não consegue confirmar.
3. Eu mando SQL, CSV, ou confirmo manualmente os pontos em aberto.
4. Você valida (idealmente por reconciliação de total) antes de escrever qualquer HTML.
5. Só então monta/atualiza o dashboard, atualiza o arquivo de status, e me diz o que ainda falta.
6. No fim de cada rodada, você me dá um resumo claro do que está pronto, o que está pendente, e de quem cada pendência depende.

---

**Objetivo final combinado:** todos os dashboards do guarda-chuva CBMPE devem chegar a este mesmo nível de prontidão — estrutura, visual e contrato de dados 100% prontos, documentados, sem nenhum dado inventado, esperando só a conexão com o banco real.
