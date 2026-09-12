# Plano de implementação — páginas públicas pré-lançamento

**Escopo:** a landing page pública (`/`) e a página pública de preços (`/precos`), com revisão de copy e da apresentação dos planos antes do lançamento. Este documento transforma as marcações em vermelho e os trechos riscados das sete capturas fornecidas em requisitos implementáveis; não trata as marcações como conteúdo visual a ser reproduzido.

## Objetivo e limites

- Alterar a landing em `webapp/src/app/(marketing)/page.tsx` e a página pública de preços em `webapp/src/app/(marketing)/precos/page.tsx`, sem mudar seus CTAs, links, tokens de design ou responsividade já existentes.
- Preservar a fonte de verdade de preço em `webapp/src/config/pricing.ts`: valores devem continuar ser formatados com `formatarBRL` e os textos do trial devem continuar usar `TRIAL`.
- Não alterar autenticação, banco de dados, checkout, AbacatePay ou `/planos` do produto autenticado nesta entrega, a menos que a decisão comercial da seção **Preço acima de quatro obras** seja aprovada para todo o produto.

## Critério de leitura das anotações

- Texto riscado: remover/substituir.
- Texto em vermelho: inserir no lugar indicado.
- Quando a anotação completa uma frase, aplicar a frase final de forma gramatical e sem a sobreposição visual das marcações.

## Alterações a implementar

### 1. Hero

No parágrafo descritivo, substituir a promessa centrada em WhatsApp pela copy abaixo:

> Relatórios semanais com avanço físico, financeiro, fotos, clima e dados contratuais — acompanhe sua obra de perto!

Manter título, botões, links, animações e largura máxima atuais. Atualizar também `metadata.description`, pois ela hoje repete a promessa removida e deve refletir a nova copy (sem precisar reproduzi-la literalmente).

### 2. Proposta de valor

1. Trocar o título para: **Pare de acompanhar a sua obra apenas recebendo fotos.**
2. Manter as colunas comparativas “Sem a plataforma” e “Com a plataforma”, que continuam coerentes com a proposta.
3. Abaixo das colunas, adicionar três blocos de copy, separados e com leitura confortável no desktop e no mobile:

   > É necessário ter uma plataforma semanal consolidada que ajudará a acompanhar o avanço do seu patrimônio bem de perto.

   > Transformamos a comunicação entre construtores e clientes em uma experiência de total transparência, organização e confiança. Nossa plataforma permite que construtores apresentem a evolução de suas obras de forma prática e contínua, enquanto os clientes acompanham cada etapa do investimento semanalmente e de qualquer lugar.

   > Mais do que um relatório de obra, entregamos tranquilidade para quem constrói e segurança para quem investe.

4. Aplicar o primeiro texto como complemento/linha de apoio da proposta e os dois seguintes como argumentos institucionais abaixo do comparativo. Usar uma largura de leitura limitada e `text-cinza-2` para não competir com o `h2`; não usar negrito apenas porque as anotações foram escritas em vermelho.

> **Nota de copy:** a imagem usa “consolidado”; o plano adota “consolidada” para concordar com “plataforma”. Se a redação literal for mandatória, manter o texto da imagem sem essa correção.

### 3. Seções explicativas do app

#### Como funciona

Simplificar os três passos. No array local da seção, manter somente `n` e `t`; remover o campo `d` e não renderizar o parágrafo explicativo. O resultado deve exibir apenas:

| Número | Título |
| --- | --- |
| 01 | Crie a obra |
| 02 | Envie o relatório |
| 03 | Cliente acompanha |

Preservar a grade de três colunas em telas a partir de 800 px e o empilhamento no mobile. A redução de conteúdo deve ser compensada apenas por espaçamento vertical apropriado, sem inserir novos elementos gráficos.

#### Conteúdo do relatório

1. Trocar o título para: **O que estará no relatório**.
2. Atualizar os dois itens anotados:

   - `Avanço físico ponderado por etapa` → `Avanço físico ponderado por etapa da obra`.
   - `Financeiro: medições, materiais, aditivos` → `Financeiro: medições, materiais e aditivos`.

3. Conservar os outros quatro itens, sua ordem e a grade atual.

### 4. Planos mensais

#### Alteração visual/copy na landing

Manter os dois primeiros cartões alimentados por `PLANOS`:

| Cartão | Copy e preço |
| --- | --- |
| 1 obra | `1 obra`, valor atual de `PLANOS[obra_1]`, relatórios ilimitados |
| Recomendado | `3 obras`, valor atual de `PLANOS[obra_3]`, relatórios ilimitados |

Substituir o terceiro cartão fixo “5 obras” por uma apresentação comercial para obras adicionais:

- Título: **Acima de 4 obras**.
- Composição exibida: **R$ 319,90/mês + R$ 99,90/mês/obra**.
- Linha de apoio: **A partir de 4 obras**.
- Não exibir a copy antiga “Até 5 obras · relatórios ilimitados”.

Como esse cartão deixa de corresponder diretamente a `PLANOS[obra_5]`, parar de renderizar a grade com `PLANOS.map` sem distinção. Declarar os dois cartões-base a partir de `PLANOS` e o cartão comercial especial como uma estrutura explícita no componente, mantendo o destaque visual do plano recomendado.

Adicionar abaixo dos cartões a observação indicada:

> O envio de relatório ocorre para um e-mail cadastrado; haverá o acréscimo de R$ 29,90/mês por e-mail adicional de envio do relatório.

O botão **Começar grátis** permanece inalterado e continua levando a `/entrar`.

#### Página pública `/precos` e comparativo

Aplicar a mesma proposta comercial da landing em `webapp/src/app/(marketing)/precos/page.tsx`, sem mudar a estrutura de três cartões, os seus botões nem a tabela semântica de comparação.

1. Atualizar o texto introdutório para:

   > 14 dias grátis com emissão de 1 relatório. Valores em reais, cobrados mensalmente.

   Remover, portanto, “Sem cartão no trial” desse texto. A cópia continua usando `TRIAL.dias` e `TRIAL.limiteRelatorios`, por exemplo: `{TRIAL.dias} dias grátis com emissão de {TRIAL.limiteRelatorios} relatório.`

2. Nos cartões, manter “1 obra” e “3 obras” (incluindo o destaque **Recomendado**) com seus valores atuais e trocar o terceiro por:

   | Elemento | Conteúdo final |
   | --- | --- |
   | Título | `Acima de 4 obras` |
   | Preço | `R$ 319,90/mês + R$ 99,90/mês/obra` |
   | Capacidade | `A partir de 4 obras ativas` |
   | Itens incluídos | `Relatórios ilimitados` e `Página do cliente + PDF` |

   Em todos os três cartões, remover somente o sufixo `+ clima` do resumo “Página do cliente + PDF + clima”; não remover o recurso de clima do produto nem da tabela comparativa, porque ela continua marcada como “Sim” na anotação.

3. Refatorar a renderização dos cartões de `/precos` para não assumir que cada cartão vem diretamente de `PLANOS.map`: os dois primeiros continuam derivados de `PLANOS`, e o terceiro é a oferta comercial específica. Preservar os três botões **Começar grátis** com destino `/entrar`.

4. Na tabela **Comparativo**, substituir exclusivamente a terceira coluna e a célula de capacidade:

   | Local | Antes | Depois |
   | --- | --- | --- |
   | Cabeçalho da 3ª coluna | `5 obras` | `A partir de 4 obras` |
   | Linha “Obras ativas”, 3ª coluna | `5` | `Acima de 4 obras` |

   Manter os demais recursos da terceira coluna como estão: relatórios ilimitados, página do cliente, PDF, clima automático e 1º e-mail por obra grátis. Isso conserva a tabela como descrição funcional, enquanto o cartão comunica a regra comercial.

5. Renomear a seção **E-mail extra** para **E-mail adicional**. Manter sua regra e o valor dinâmico atual: primeiro e-mail por obra gratuito e destinatários seguintes cobrados por ciclo, consolidados na próxima parcela.

#### Ponto de decisão obrigatório antes de codificar

Há uma divergência entre a imagem e o modelo comercial do repositório:

- A imagem propõe `R$ 99,90/mês/obra` acima de quatro obras.
- O código e o checkout aceitam apenas os planos fixos 1, 3 e 5 obras; o terceiro custa `R$ 499,90`, e o único adicional existente é e-mail por `R$ 29,90`.

Para esta tarefa, tratar a nova composição como **copy de pré-lançamento das páginas públicas**, sem alterar `pricing.ts`, `.env.example`, testes, produtos AbacatePay ou rotas de checkout. Antes de publicar, o responsável comercial deve escolher uma das opções abaixo:

1. **Apenas páginas públicas (escopo deste plano):** manter o produto/checkout atual e definir a conversão de “acima de 4 obras” via contato/atendimento antes de liberar uma compra direta; nesse caso, não prometer um fluxo de contratação automática inexistente.
2. **Nova regra comercial de fato:** abrir uma tarefa própria para substituir `obra_5` por um plano escalável, configurar produto(s) e cobrança de uso no AbacatePay, atualizar limites/gating, página `/precos`, `/planos`, webhook, testes e documentação. Não implementar isso como efeito colateral da edição da landing.

### 5. FAQ → Dúvidas

1. Renomear o título da seção de **Perguntas frequentes** para **Dúvidas**. O identificador da constante pode continuar `FAQ`, pois é interno; se for renomeado, fazer a alteração de forma consistente.
2. Aplicar as perguntas e respostas anotadas:

| Item | Conteúdo final |
| --- | --- |
| Trial — pergunta | `Na versão Trial, é solicitada a inclusão de método de pagamento?` |
| Trial — resposta | `Não. Você tem ${TRIAL.dias} dias e ${TRIAL.limiteRelatorios} envio de relatório sem inclusão de método de pagamento. O checkout só aparece na conversão.` |
| Cancelamento — pergunta | `Posso cancelar quando quiser?` |
| Cancelamento — resposta | `Você pode cancelar a sua assinatura quando quiser e ela fica disponível até o vencimento do período.` |
| E-mail — pergunta | `O que é e-mail adicional?` |
| E-mail — resposta | Manter o texto atual, incluindo o valor dinâmico de `EMAIL_EXTRA`. |

3. Manter sem alteração as perguntas “E se eu precisar de mais obras?” e “Meus dados estão seguros?”, exceto se a decisão de preço acima de quatro obras mudar o fluxo real de upgrade; nesse caso, revisar a primeira resposta na tarefa comercial correspondente.
4. Preservar a semântica `dl`/`dt`/`dd`, divisores e a acessibilidade atual.

## Arquivos previstos

| Arquivo | Mudança |
| --- | --- |
| `webapp/src/app/(marketing)/page.tsx` | Todas as alterações de copy, simplificação dos passos, cartão comercial específico, observação de e-mail e título/conteúdo de Dúvidas. |
| `webapp/src/app/(marketing)/precos/page.tsx` | Copy do trial, cartões 1/3/acima de 4 obras, tabela Comparativo e seção E-mail adicional. |
| `webapp/src/config/pricing.ts` e `webapp/.env.example` | Sem mudança neste escopo; são fontes de verdade do checkout atual. |
| `webapp/src/config/pricing.test.ts` | Sem mudança neste escopo; atualizar somente na tarefa de nova regra comercial. |

## Sequência de execução para Cursor

1. Criar uma branch de trabalho, preservar qualquer alteração não relacionada e abrir `webapp/src/app/(marketing)/page.tsx` e `webapp/src/app/(marketing)/precos/page.tsx`.
2. Atualizar hero e metadados; conferir que o parágrafo continua cabendo no `max-w-md` em desktop e mobile.
3. Aplicar proposta de valor e inserir os textos institucionais sem alterar as listas comparativas.
4. Simplificar “Como funciona” e ajustar “O que estará no relatório”.
5. Refatorar somente a renderização dos cartões da landing para suportar o terceiro cartão especial, sem tocar na configuração de preços ou em checkout.
6. Incluir a observação de e-mail adicional e atualizar a seção Dúvidas.
7. Aplicar a cópia do trial, os cartões, o Comparativo e “E-mail adicional” em `/precos`, reutilizando as constantes de preço/trial já existentes onde elas ainda representam a oferta.
8. Rodar, a partir de `webapp`, `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build`.
9. Fazer QA manual em `/` e `/precos` nas larguras aproximadas de 375 px, 800 px e 1440 px; validar quebra de linha, contraste, foco/links dos botões, rolagem horizontal controlada da tabela e ausência das copies riscadas.
10. Registrar a decisão comercial do cartão “Acima de 4 obras” antes do deploy. Se a opção 2 for escolhida, não publicar as páginas públicas com uma oferta que o checkout não consegue contratar.

## Critérios de aceite

- A hero comunica dados contratuais e acompanhamento próximo; a antiga menção a “WhatsApp eterno” não aparece no HTML nem nos metadados.
- A proposta de valor fala de acompanhar a obra além de receber fotos e contém os argumentos institucionais da anotação.
- “Como funciona” exibe apenas números e títulos; o relatório usa o título e os dois itens revisados.
- A landing mostra 1 obra, 3 obras recomendado e a oferta “Acima de 4 obras” conforme a imagem, além da regra de e-mail adicional.
- A seção se chama “Dúvidas” e contém as três alterações de FAQ sem perder o uso das constantes dinâmicas.
- A página `/precos` mostra a copy de trial revisada, três cartões alinhados à oferta anotada, comparativo com “A partir de 4 obras” e a seção “E-mail adicional”.
- O build, lint, typecheck e testes passam; o layout continua responsivo e os CTAs existentes continuam funcionais.
