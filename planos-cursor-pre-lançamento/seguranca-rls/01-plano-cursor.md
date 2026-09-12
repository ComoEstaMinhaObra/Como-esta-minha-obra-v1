# Plano de implementação — Cursor

Leia primeiro `00-plano-mestre.md`. Este documento é executável como checklist. Não acessar produção.

## 0. Regras invioláveis

- Trabalhar somente no checkout local e em branch com prefixo `codex/` ou na branch indicada pelo usuário.
- Antes de editar, rodar `git status --short` e registrar os arquivos já modificados.
- Preservar integralmente alterações preexistentes em:
  - `webapp/src/app/(marketing)/page.tsx`;
  - `webapp/src/app/(marketing)/precos/page.tsx`;
  - `logo-CEMO.png`;
  - planos não relacionados.
- Não alterar migrations `0001`, `0002` e `0003`.
- Criar migrations novas com `supabase migration new <nome>`.
- Não executar comandos remotos: `supabase link`, `supabase db push`, Management API, Vercel, Cloudflare ou AbacatePay real.
- Não usar `service_role`/secret em Client Component.
- Não considerar filtro da UI como autorização.
- Não afrouxar teste para fazê-lo passar.
- Se a baseline entregue pelo Codex mostrar drift incompatível, parar e documentar; não adivinhar o estado de produção.

## 1. Entregáveis

### Migrations novas

Criar, no mínimo, migrations separadas para:

1. `security_enums` — apenas novos valores de enum.
2. `security_expand` — tabelas, colunas, índices, backfill, constraints e RPCs novas.
3. `security_lockdown` — policies, grants, default privileges e triggers finais.

Separar uma quarta migration se a validação de constraints ou o volume do backfill exigir. Não misturar `ALTER TYPE ... ADD VALUE` com uso imediato do valor novo.

### Código

- Server actions convertidas para RPCs.
- Pipeline de relatório em duas fases.
- Versões e retificações imutáveis.
- Fluxo de convite/cobrança com estado pendente.
- Portal do proprietário baseado em snapshots publicados.
- Storage endurecido.
- Rate limit persistente.
- CSP/headers/Auth/logs.
- Testes pgTAP e integração com JWT real.
- CI bloqueante.
- Tipos do Supabase regenerados.
- Documentação da matriz de acesso.

## 2. Modelo de autorização final

Criar `webapp/supabase/SECURITY.md` com a matriz a seguir e mantê-la igual ao schema:

| Recurso | Empreiteiro | Proprietário | Admin | Mutação permitida |
|---|---|---|---|---|
| Perfil | Próprio | Próprio | RPC operacional | Somente `nome` próprio |
| Assinatura/uso | Própria | Própria se também cliente pagante | RPC operacional | Backend/webhook |
| Obra ativa | Própria | Compartilhada e ativa | RPC operacional | RPC |
| Obra arquivada | Resumo mínimo via RPC | Nada | RPC operacional | Nada, salvo rotina futura de purga |
| Rascunho | Próprio | Nada | Nada | RPC de rascunho |
| Versão publicada | Própria | Compartilhada e ativa | Metadados operacionais | Nada |
| Ledgers/etapas | Próprios | Nada direto | Nada direto | RPC de envio/retificação |
| Acessos | Da própria obra | Própria associação mínima | Metadados operacionais | RPC/outbox |
| Clima | Próprio | Somente snapshot publicado | Nada | Cron/backend |
| Webhooks/outbox | Nada | Nada | RPC operacional sanitizada | Backend |
| Fotos | Próprias, conforme estado | Apenas versão publicada | Nada | Reserva + Storage policy |
| PDF | Versão publicada própria | Versão publicada compartilhada | Nada | Backend, create-only |

## 3. Schema privado, grants e helpers

### 3.1 Schema

- Criar schema `private` não exposto pela Data API.
- Revogar `CREATE` de `public`, `anon` e `authenticated` nos schemas aplicáveis.
- Mover ou recriar helpers internos em `private`:
  - `private.is_admin()`;
  - `private.eh_dono_obra_ativa(uuid)`;
  - `private.tem_acesso_obra_ativa(uuid)`;
  - validadores de assinatura, rascunho, etapa e versão;
  - consumo de rate limit.
- Toda função `SECURITY DEFINER` deve usar `SET search_path = ''` e relações totalmente qualificadas.
- Revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated` por padrão; conceder individualmente somente às RPCs públicas necessárias.
- Policies devem chamar helpers privados, nunca depender de metadata editável pelo usuário.

### 3.2 Privilégios finais

- `anon`: sem `SELECT/INSERT/UPDATE/DELETE` nas tabelas do produto; sem `EXECUTE` em RPCs comerciais; sem acesso a buckets privados.
- `authenticated`: `SELECT` estritamente necessário, `UPDATE(nome)` em `profiles` e `EXECUTE` nas RPCs allowlisted.
- Remover todos os `FOR ALL` finais.
- Policies sempre com `TO authenticated`.
- Revogar `fn_avanco_geral` de `anon`.
- `service_role` permanece somente em módulos server-only.
- Admin deve usar RPCs operacionais específicas; não criar policy ampla de admin sobre relatórios, snapshots, atividades ou fotos.

## 4. Integridade referencial entre tenants

### 4.1 Chaves compostas

Adicionar unicidade necessária para FKs compostas:

- `obras(id, owner_id)` quando necessário;
- `etapas(id, obra_id)`;
- `relatorios(id, obra_id)`;
- `atividades(id, obra_id, relatorio_id, etapa_id)` ou estrutura equivalente;
- `relatorio_versoes(id, relatorio_id, obra_id)`.

### 4.2 Relações obrigatórias

Garantir declarativamente:

- relatório pertence à obra;
- etapa pertence à mesma obra do relatório;
- lançamento pertence à mesma obra e à versão indicada;
- atividade pertence à mesma obra, relatório, versão e etapa;
- foto pertence à mesma obra, relatório, versão, etapa e atividade quando houver;
- dias aditivados/ajustes pertencem à mesma obra, relatório e versão;
- acesso pertence à obra do titular responsável;
- `storage_path` começa pelos IDs da obra, relatório, versão e etapa esperados;
- `pdf_path` contém obra, relatório, número da versão e hash esperado.

Usar backfill antes de `VALIDATE CONSTRAINT`. Criar inicialmente como `NOT VALID` quando isso reduzir lock. Se houver dado inválido, gerar relatório de IDs para o Codex; não apagar nem corrigir silenciosamente.

Adicionar `UNIQUE(storage_path)` e unicidade para `pdf_path`/versão.

## 5. Obras, assinatura e rascunhos

### 5.1 Criação de obra

Endurecer `fn_criar_obra` ou substituí-la mantendo compatibilidade temporária:

- `auth.uid()` obrigatório;
- lock da assinatura antes da contagem;
- `trial` exige `now() <= trial_fim`;
- `ativa` usa `limite_obras` do banco;
- inadimplente/cancelada/trial expirado rejeitam;
- contar somente obras não arquivadas;
- validar datas, campos obrigatórios, coordenadas, valores e etapas;
- gerar obra, etapas e sinal na mesma transação;
- nunca aceitar `owner_id` do cliente;
- código de erro estável e mapeado para mensagem da UI.

### 5.2 Rascunhos

Criar RPC `fn_salvar_rascunho`:

- cria ou atualiza somente rascunho da própria obra ativa;
- trial precisa estar vigente; assinatura ativa também permite;
- número é calculado no banco sob lock da obra;
- cliente não envia número autoritativo;
- atualização exige relatório ainda `rascunho`;
- valida versão do JSON, IDs de etapas, limites, valores e no máximo 12 fotos por etapa;
- rejeita foto sem reserva correspondente;
- impede dois rascunhos com o mesmo número;
- retorna `relatorio_id` e número.

Substituir DML direto em `relatorio-actions.ts` pela RPC. Manter filtros na aplicação apenas como UX adicional.

## 6. Versões, publicação e retificação

### 6.1 Estrutura de versões

Criar enum de estado da versão, por exemplo `processando`, `publicada`, `falhou`.

Criar `relatorio_versoes` com, no mínimo:

- `id uuid`;
- `relatorio_id uuid`;
- `obra_id uuid`;
- `numero int > 0`;
- `tipo` (`original` ou `retificacao`);
- `status`;
- `snapshot jsonb not null` congelado no preparo;
- `motivo text`, obrigatório em retificação;
- `criado_por uuid not null`;
- `criado_em`, `publicado_em`;
- `pdf_path text unique`;
- `pdf_sha256 text` com formato hexadecimal de 64 caracteres;
- unicidade `(relatorio_id, numero)`.

Adicionar ao relatório lógico:

- estado `processando` para o primeiro envio;
- `versao_atual_id`;
- vínculo de versão pendente quando necessário;
- erro operacional sanitizado, sem stack ou PII.

O conteúdo publicado deve viver na versão. `relatorios` mantém identidade, número lógico, status e ponteiro atual. Planejar a retirada posterior de `relatorios.snapshot` e `relatorios.pdf_path`; não criar duas fontes autoritativas permanentes.

Fazer backfill de todo relatório já enviado como versão 1. Não alterar o conteúdo do snapshot antigo.

### 6.2 Preparar envio inicial

Criar RPC autenticada `fn_preparar_envio_relatorio`:

- lock de relatório, obra e assinatura em ordem consistente;
- reconsultar status depois dos locks;
- rejeitar obra arquivada, assinatura inválida e relatório não rascunho;
- validar rascunho completo e fotos;
- garantir no máximo um primeiro envio `processando` por obra;
- calcular e congelar o snapshot;
- criar versão 1 `processando`;
- marcar relatório lógico como `processando`;
- **não** aplicar ainda avanço, financeiro ou prazo;
- retornar somente `versao_id`, dados mínimos para renderização e snapshot.

### 6.3 PDF create-only

No backend:

- renderizar exclusivamente do snapshot congelado;
- calcular SHA-256 do buffer;
- caminho canônico: `{obraId}/{relatorioId}/v{numero}-{sha256}.pdf`;
- `contentType: application/pdf`;
- `upsert: false` sempre;
- nunca remover ou atualizar PDF publicado;
- se o mesmo caminho já existir após falha parcial, confirmar que corresponde ao hash esperado e continuar sem sobrescrever.

Nenhum usuário autenticado recebe permissão de escrita no bucket `pdfs`.

### 6.4 Finalizar envio inicial

Criar RPC somente-backend `fn_finalizar_envio_relatorio`:

- não conceder `EXECUTE` a `anon` ou `authenticated`;
- conferir versão pendente, caminho canônico, hash, objeto existente, MIME e limite de tamanho;
- revalidar estado da obra/assinatura e baseline do snapshot;
- aplicar avanço, lançamentos, atividades, fotos e prazo na mesma transação;
- vincular todos os efeitos à versão 1;
- marcar a versão `publicada` e o relatório `enviado`;
- gravar `versao_atual_id`;
- incrementar uso de trial exatamente uma vez;
- ser idempotente: chamada repetida retorna o resultado existente sem duplicar efeitos.

E-mail é enviado somente após commit. Falha de e-mail não desfaz publicação, mas entra em fila/retry sem PII no log.

### 6.5 Retificação

Adicionar ação “Retificar relatório” somente no relatório enviado mais recente da obra.

Fluxo:

1. Exigir motivo não vazio e confirmação explícita.
2. Abrir formulário preenchido pela versão vigente.
3. `fn_preparar_retificacao` valida proprietário, obra ativa, última posição, ausência de outra versão pendente e assinatura vigente.
4. Criar nova versão `processando`, sem trocar `versao_atual_id`.
5. Gerar novo PDF create-only.
6. `fn_finalizar_retificacao`, somente-backend, calcula e aplica deltas auditáveis e troca o ponteiro atual atomicamente.
7. Notificar proprietários com template específico.

Regras:

- versão anterior permanece publicada e consultável;
- relatório mantém o mesmo número; apenas a versão aumenta;
- avanço corrigido pode diminuir em relação à versão corrigida, mas nunca abaixo do relatório lógico anterior;
- criar registro/evento auditável para cada ajuste de avanço;
- financeiro é corrigido com lançamentos delta, nunca por update/delete de lançamento antigo;
- prazo é corrigido com movimento delta assinado, nunca por update/delete do registro antigo;
- atividades/fotos corrigidas são novas linhas ligadas à nova versão; linhas antigas permanecem;
- snapshots posteriores não existem, pois somente o último relatório pode ser retificado;
- a versão atual anterior continua sendo servida até a nova versão finalizar.

Atualizar PDF route para:

- servir a versão atual por padrão;
- aceitar versão histórica explicitamente;
- autorizar novamente via RLS antes de assinar URL;
- nunca gerar ou sobrescrever PDF em um `GET` público;
- retornar estado “processando” sem transformar leitura em escrita.

## 7. Imutabilidade no banco

Criar triggers que bloqueiem `UPDATE`/`DELETE` em:

- versões publicadas;
- snapshots publicados;
- efeitos ligados a versões publicadas;
- atividades/fotos publicadas;
- movimentos financeiros e de prazo publicados;
- objetos lógicos necessários para auditoria.

Exceções devem ser transições unidirecionais e validadas:

- versão `processando` → `publicada` com PDF/hash preenchidos uma vez;
- atualização de ponteiro `versao_atual_id` pela finalização de retificação;
- alterações de estado da outbox.

Não usar flag fornecida pelo cliente para ignorar trigger. Se um ajuste de avanço diminuir `pct_atual`, o trigger deve exigir uma retificação pendente válida e um evento de ajuste correspondente criado na mesma transação.

## 8. Compartilhamentos e billing

### 8.1 Estados

Expandir `acesso_status` para incluir `pendente_cobranca` e `revogado`.

Adicionar:

- `revogado_em`;
- `revogado_por`;
- campos mínimos para auditoria;
- unicidade parcial para impedir dois acessos efetivos do mesmo e-mail/usuário na obra.

O `user_id` é a identidade autoritativa depois da associação. E-mail serve para convite, não para autorização contínua.

### 8.2 Criação

RPC `fn_solicitar_acesso_obra`:

- proprietário da obra e obra ativa;
- normalizar e validar e-mail;
- rejeitar o próprio e-mail do empreiteiro;
- lock da obra/assinatura/acessos;
- primeiro acesso efetivo: gratuito;
- demais: somente assinatura ativa com `abacatepay_subscription_id` válido;
- acesso pago nasce `pendente_cobranca` e não é reconhecido por `tem_acesso_obra_ativa`;
- se a conta já existe, associar `auth.users.id` de forma interna sem expor busca de usuários;
- se não existe, `handle_new_user` só ativa convite já liberado; nunca ativa pendência de cobrança ou revogado.

### 8.3 Outbox

Criar tabela privada de outbox com:

- ID e chave interna única;
- assinatura/acesso/obra;
- operação `add`/`subtract`;
- estado `pendente`, `processando`, `confirmado`, `falhou`, `incerto`;
- tentativas e próximo retry;
- `abacatepay_usage_id` e parcela quando confirmados;
- erro sanitizado;
- timestamps.

O endpoint `record-usage` documentado pelo AbacatePay não oferece chave de idempotência. Portanto:

- resposta inequívoca de sucesso: confirmar acesso e gravar uso;
- `429` inequívoco: retry com backoff;
- `4xx` de regra: falha terminal, sem acesso;
- timeout, reset de conexão ou `5xx` após envio: marcar `incerto`, **não** repetir automaticamente e **não** conceder acesso;
- operação `incerto` exige reconciliação no dashboard/atendimento do AbacatePay;
- falha de banco depois de resposta de sucesso pode repetir apenas a finalização local usando o `usage_id` recebido, nunca uma segunda chamada ao provedor.

Referência: https://docs.abacatepay.com/pages/subscriptions/record-usage

### 8.4 Revogação e arquivamento

- Revogar acesso no banco imediatamente.
- Não apagar linha histórica.
- Se cobrado no ciclo atual, criar `subtract`.
- Se o gratuito foi removido, promover o acesso cobrado mais antigo a gratuito e criar compensação.
- Arquivar revoga todos e cria compensações necessárias na mesma decisão transacional; chamadas externas continuam via outbox.
- `tem_acesso_obra_ativa` exige obra não arquivada e acesso `ativo`.
- E-mail só é enviado após confirmação efetiva.

### 8.5 Webhook

- Adicionar `event_id` próprio e `UNIQUE(provedor, event_id)` em `webhooks_log`.
- Fazer claim idempotente por insert/upsert antes de processar.
- Duas entregas concorrentes do mesmo evento não podem processar billing duas vezes.
- Não procurar idempotência com `contains(payload, ...)`.
- Persistir payload allowlisted/sanitizado.
- Renovação cria uma operação de outbox determinística por evento/parcela, não chama cobrança repetidamente.

## 9. Storage

### 9.1 Buckets

- `capas`: privado, `image/webp`, 2 MiB.
- `fotos`: privado, `image/webp`, 2 MiB.
- `pdfs`: privado, `application/pdf`, 10 MiB.

### 9.2 Capas

- Mutação somente pelo dono de obra ativa.
- Caminho fixo `{obraId}/capa.webp`.
- Atualização de `obras.foto_capa_path` via RPC, nunca DML direto.
- Proprietário acessa capa somente de obra compartilhada ativa.

### 9.3 Fotos

Antes do upload, RPC reserva linha com obra, relatório, versão/rascunho, etapa, caminho e estado.

- Upload só é aceito se a reserva pertence ao usuário, à obra ativa e ao rascunho/processamento correto.
- Máximo 12 por etapa/relatório é contado sob lock.
- Cliente envia apenas WebP comprimido; banco e bucket repetem a validação possível.
- Proprietário lê somente fotos referenciadas por versão publicada.
- Empreiteiro pode remover somente foto ainda não publicada.
- Foto publicada não pode ser sobrescrita ou apagada.

### 9.4 PDFs

- Nenhuma policy de INSERT/UPDATE/DELETE para `authenticated`.
- SELECT somente quando o objeto corresponde a versão publicada de obra própria ou compartilhada ativa.
- Não usar policy baseada apenas no primeiro segmento `obraId`.
- Não usar `upsert`.

## 10. Portal do proprietário

Refatorar `src/lib/cliente/carregar-dados.ts` e páginas relacionadas:

- fonte principal: `relatorios` enviados + `relatorio_versoes` publicadas;
- versão atual por padrão;
- etapas, financeiro, prazo, atividades e clima vêm do snapshot publicado;
- galeria usa paths das versões publicadas;
- não consultar diretamente `etapas`, `lancamentos`, `dias_aditivados` ou `clima_snapshots` para formar conteúdo do proprietário;
- preview de rascunho continua exclusivo do empreiteiro;
- obra arquivada retorna sem acesso;
- histórico mostra número da versão, motivo, autor/data e PDF correspondente, sem expor dados pessoais desnecessários.

## 11. Rate limit

Implementar em schema privado com chave hash/UUID, nunca armazenar e-mail ou IP bruto.

Limites iniciais:

| Ação | Limite |
|---|---|
| Convite | 10 por hora por usuário |
| Preparar envio/retificação | 10 por hora por usuário |
| Salvar rascunho | 120 por hora por usuário |
| Checkout/troca/cancelamento | 5 a cada 15 minutos por usuário |
| Geocodificação | 10 por hora por usuário |

Requisitos:

- contador atômico com `INSERT ... ON CONFLICT ...` e janela definida;
- consumo antes de chamada cara/externa;
- retorno estável `RATE_LIMITED` e UI adequada;
- limpeza agendada de janelas expiradas;
- nunca usar Map/memória do processo Next.js;
- Auth público usa rate limits nativos do Supabase + Turnstile.

## 12. Headers e autenticação

### 12.1 Headers

Adicionar:

- `Strict-Transport-Security: max-age=31536000` somente em produção, sem `preload` e sem `includeSubDomains`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` negando sensores/câmera/microfone/geolocalização não usados;
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` e `form-action 'self'` na CSP.

Integrar CSP com o middleware existente sem perder cookies renovados ou headers em redirects.

- Gerar nonce por request nas rotas auth/app/cliente/admin.
- Permitir apenas origem `self`, origem exata do Supabase e endpoints do Turnstile necessários.
- AbacatePay e Resend são server-side e não entram em `connect-src` do browser.
- `frame-src` deve considerar o PDF em URL assinada do Supabase e o Turnstile.
- Usar `Content-Security-Policy-Report-Only` em desenvolvimento/staging; o ambiente de produção recebe policy enforced somente após os testes C3/C4.
- Não usar wildcard amplo `https:`.

### 12.2 Auth

Código e config local devem refletir:

- senha mínima de 10 caracteres;
- letras minúsculas, maiúsculas, dígitos e símbolos;
- confirmação de e-mail obrigatória;
- troca de senha com reautenticação;
- mensagens genéricas que não confirmem existência de conta;
- remover a mensagem atual que revela “este e-mail já possui conta”;
- Turnstile em cadastro e recuperação; resetar o desafio após tentativa;
- proteção de senha vazada quando o projeto permitir.

As configurações remotas serão aplicadas pelo Codex; o Cursor implementa frontend, env schema e documentação, sem usar secrets.

## 13. Logs e retenção

Criar utilitário server-only de logging seguro:

- permitir código do evento, correlation ID, status e identificadores internos quando necessários;
- proibir email, nome, endereço, link assinado, token, chave, corpo bruto do provedor e snapshot;
- sanitizar mensagens de erro externas antes de persistir/exibir;
- remover payloads completos dos `console.info` de e-mails;
- não logar `AbacatePayError.body` bruto;
- retorno ao cliente nunca inclui stack ou erro SQL completo.

Webhook:

- persistir somente `event_id`, evento, IDs externos necessários, estado, erro sanitizado e timestamps;
- sanitizar registros existentes no rollout;
- criar rotina de purga após 90 dias;
- manter índices para idempotência antes da purga.

Documentar que a meta de 30 dias para logs de aplicação depende da retenção configurável do provedor de hosting; independentemente disso, logs novos não contêm PII.

## 14. Admin

Substituir leituras diretas por RPCs operacionais:

- KPIs agregados;
- contas com ID, nome mínimo, plano/status e contagens;
- obras com ID, nome mínimo, status e datas;
- webhooks/outbox com campos sanitizados;
- ação de reprocessamento somente para estados seguros.

Admin não recebe snapshot, rascunho, notas, fotos, endereços completos ou PDF. Não criar bypass administrativo genérico.

## 15. Testes obrigatórios

### 15.1 pgTAP

Criar testes sob `webapp/supabase/tests/database/` cobrindo:

- RLS habilitada em todas as tabelas expostas;
- inexistência de policy `FOR ALL` no schema final;
- grants de `anon` e `authenticated`;
- allow/deny de SELECT/INSERT/UPDATE/DELETE;
- execução permitida/negada de cada função;
- `search_path` seguro de toda `SECURITY DEFINER`;
- constraints compostas;
- triggers de imutabilidade;
- rate limit atômico;
- idempotência de envio, retificação e webhook;
- backfill de versão 1.

### 15.2 Integração com JWT real

Criar suíte separada, por exemplo `e2e/security-direct.spec.ts`, que:

1. Cria usuários sintéticos via Admin API do Supabase local/staging.
2. Faz login por senha como cada usuário para obter JWT real.
3. Chama PostgREST/Storage/RPC diretamente, sem passar pelas server actions.
4. Limpa somente os fixtures prefixados da execução.

Casos mínimos:

- A não lê nem altera obra de B e vice-versa.
- Usuário não compartilhado não lê obra.
- Proprietário lê somente obra explicitamente compartilhada e ativa.
- Convite pendente de cobrança não concede acesso.
- Revogação e arquivamento bloqueiam novas consultas e novas URLs assinadas.
- Proprietário não lê rascunho nem foto reservada de rascunho.
- INSERT direto em `obras` falha; RPC respeita limite.
- Duas criações concorrentes na última vaga resultam em exatamente uma obra.
- INSERT direto em `obra_acessos` falha.
- Dois convites concorrentes não obtêm dois “primeiros e-mails grátis”.
- Assinatura sem provider ID não cria acesso pago.
- Relatório enviado e todos os efeitos são imutáveis.
- Duas finalizações não duplicam lançamentos, dias, fotos ou uso de trial.
- PDF publicado não pode ser sobrescrito, atualizado ou apagado pelo usuário.
- UUID de etapa/relatório/atividade de outra obra falha por constraint.
- Retificação preserva v1, cria v2, aplica deltas e troca o ponteiro uma vez.
- Retificação de relatório que não é o último falha.
- Usuário B não retifica relatório de A.
- `anon` recebe negação ou conjunto vazio em todas as superfícies privadas e não executa RPCs comerciais.
- Admin recebe apenas respostas operacionais.
- Rate limits devolvem 429/`RATE_LIMITED` sem executar efeito externo.

Para updates RLS, sempre verificar o estado final da linha; não aceitar apenas HTTP 2xx/4xx como prova.

### 15.3 Testes de aplicação

- Envio inicial: rascunho → processando → PDF → enviado → e-mail.
- Falha de PDF mantém relatório não publicado e retry idempotente.
- Retificação mantém v1 disponível até v2 publicar.
- Falha/timeout do AbacatePay mantém acesso pendente.
- Sucesso de billing ativa acesso e envia convite uma vez.
- Remoção/arquivamento revoga e cria compensação.
- Portal do proprietário não muda com novo rascunho.
- Auth não enumera conta e exige regras de senha/CAPTCHA.
- CSP não bloqueia Supabase, PDF ou Turnstile nas rotas previstas.

## 16. CI

Atualizar `.github/workflows/ci.yml`:

- remover `continue-on-error: true` dos testes relevantes;
- adicionar job bloqueante de Supabase local;
- iniciar stack local;
- aplicar todas as migrations desde zero;
- rodar `supabase db lint` e `supabase test db`;
- rodar a suíte de JWT/PostgREST/Storage reais contra a stack local;
- rodar `npm audit --omit=dev --audit-level=high`;
- manter typecheck, lint, unit e build;
- garantir cleanup do Supabase local mesmo em falha;
- não usar secrets de produção.

Adicionar `.github/dependabot.yml` semanal para npm e GitHub Actions, agrupando atualizações menores quando seguro.

## 17. Arquivos existentes que exigem revisão

Lista mínima, não exaustiva:

- `webapp/supabase/migrations/*` — somente novas migrations;
- `webapp/supabase/config.toml`;
- `webapp/src/lib/database.types.ts` — regenerar;
- `webapp/src/lib/supabase/admin.ts`;
- `webapp/src/lib/gating.ts`;
- `webapp/src/lib/abacatepay.ts`;
- `webapp/src/lib/abacatepay-webhook.ts`;
- `webapp/src/lib/pdf/gerar.ts`;
- `webapp/src/lib/cliente/carregar-dados.ts`;
- `webapp/src/lib/email/enviar.ts`;
- `webapp/src/lib/supabase/middleware.ts`;
- `webapp/src/middleware.ts`;
- `webapp/next.config.ts`;
- actions de criação de obra, rascunho, envio, arquivamento e compartilhamento;
- rota de PDF, webhook e cron;
- telas de feed/relatório/cliente/admin/auth;
- `.github/workflows/ci.yml`;
- `webapp/.env.example`.

## 18. Verificações finais do Cursor

Executar e registrar saídas resumidas:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. `supabase db reset`
6. `supabase db lint`
7. `supabase test db`
8. suíte de segurança com JWT real contra Supabase local
9. `npm audit --omit=dev --audit-level=high`

Depois:

- revisar `git diff --check`;
- listar arquivos alterados;
- confirmar que nenhum segredo foi adicionado;
- confirmar que migrations históricas não mudaram;
- confirmar que não houve conexão remota;
- entregar ao Codex um resumo de decisões, riscos e qualquer dado legado incompatível.

## 19. Condições de parada

Parar sem improvisar se:

- a baseline remota divergir das migrations históricas;
- o backfill encontrar relação cruzada ou snapshot inválido;
- for necessária deleção de dado real;
- a documentação do AbacatePay não permitir distinguir resposta segura de estado incerto;
- um teste P0 falhar;
- CSP exigir origem externa não documentada;
- o código exigir acesso à produção ou secret não fornecido.

## 20. Prompt mestre para delegação

> Implemente exclusivamente o plano `planos-cursor-pre-lançamento/seguranca-rls/01-plano-cursor.md`, respeitando `00-plano-mestre.md`. Trabalhe somente no repositório local. Não acesse produção, não rode `supabase link` ou `db push`, não leia `.env.local`, não altere as migrations 0001–0003 e preserve todas as mudanças preexistentes não relacionadas. Use migrations novas no padrão expandir → aplicação → lockdown. Implemente código, SQL, testes, tipos, CI e documentação. Não marque a tarefa concluída enquanto typecheck, lint, unit, build, reset local, db lint, pgTAP, testes diretos com JWT real e audit de dependências não estiverem verdes. Se encontrar drift, dado legado inválido, ambiguidade no provedor ou necessidade de produção, pare e documente o bloqueio em vez de assumir.

