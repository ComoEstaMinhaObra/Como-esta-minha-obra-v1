# Plano mestre — Segurança RLS, isolamento e regras de negócio

**Data:** 05/09/2026  
**Status:** aprovado para implementação, sujeito aos gates deste documento  
**Prioridade:** P0 antes do lançamento; P1 na sequência, sem misturar mudanças comerciais

## 1. Objetivo

Garantir que as regras de autorização e de negócio permaneçam válidas quando a API do Supabase, o PostgREST, o Storage ou as RPCs forem chamados diretamente, sem passar pela interface Next.js.

O aceite exige:

- isolamento entre tenants;
- ausência de escrita direta em operações comerciais;
- publicação e retificação de relatórios por versões imutáveis;
- cobrança de acesso extra antes da concessão do acesso;
- constraints contra referências cruzadas entre obras;
- privilégios mínimos para `anon`, `authenticated` e funções;
- testes com usuários reais do Supabase Auth, JWTs reais e chamadas diretas às APIs;
- headers, autenticação, rate limit, Storage, logs e CI endurecidos.

## 2. Decisões fechadas

1. O projeto Supabase atualmente vinculado é **produção**.
2. Os limites comerciais deste trabalho continuam sendo os planos atuais; a oferta “Acima de 4 obras” permanece fora deste escopo. A autorização deve usar `assinaturas.limite_obras`, sem codificar o número 5 nas policies ou RPCs.
3. Obra arquivada aparece ao empreiteiro apenas como **metadados de listagem**; conteúdo, fotos, relatórios e PDFs deixam de ser acessíveis.
4. O portal do proprietário deve ser derivado exclusivamente de versões/snapshots publicados.
5. Trial expirado fica somente leitura.
6. Compartilhamentos são revogados logicamente e preservam auditoria.
7. Ao remover o destinatário gratuito, o destinatário cobrado mais antigo remanescente passa a ser gratuito e gera a compensação cabível.
8. Arquivar obra revoga acessos e cria as compensações de e-mails extras.
9. Revogação de URLs assinadas já emitidas está **fora deste ciclo**. Novas autorizações devem ser negadas imediatamente; URLs já emitidas mantêm a validade original. Registrar esse risco no backlog.
10. Relatório inicial só se torna `enviado` depois de o PDF definitivo estar armazenado e validado.
11. Retificação corrige dados, mantém a versão original imutável, registra motivo/autor/data, aplica efeitos por deltas e gera novo PDF.
12. Somente o empreiteiro responsável pode retificar.
13. Admin acessa apenas dados operacionais, nunca conteúdo completo de relatórios ou fotos.
14. Autenticação: senha mínima de 10 caracteres, requisitos fortes, confirmação de e-mail, troca segura com reautenticação, Turnstile e proteção contra senhas vazadas quando disponível no plano Supabase.
15. Rate limit de ações autenticadas será persistido no Postgres/Supabase.
16. Limites de buckets: capas/fotos WebP até 2 MiB; PDFs até 10 MiB.
17. HSTS inicial sem `preload` e sem `includeSubDomains`.
18. Retenção: logs de aplicação sem PII, conforme a retenção da plataforma e com meta de 30 dias; webhooks sanitizados por 90 dias.
19. Testes: Supabase local na CI e ambiente remoto isolado antes de produção.
20. Cursor escreve migrations, aplicação e testes. Codex cuida de inventário remoto, ambiente de staging/preview, configurações externas, aplicação de migrations e rollout de produção.

## 3. Regra adicional para retificação

Para evitar recálculo em cascata de relatórios posteriores, a v1 permite retificar somente o **relatório enviado mais recente da obra**.

- Se já houver relatório posterior, o erro deve ser corrigido em um novo relatório de ajuste.
- A nova versão pode corrigir avanço, financeiro, prazo, atividades e fotos.
- O avanço corrigido não pode ficar abaixo do avanço registrado no relatório publicado imediatamente anterior.
- O snapshot e o PDF anteriores nunca são atualizados ou apagados.
- A versão vigente muda apenas depois de o novo PDF estar pronto.
- O proprietário vê a versão vigente por padrão e pode consultar o histórico de versões.
- A publicação da retificação envia uma notificação específica ao proprietário.

## 4. Ordem obrigatória de execução

| Gate | Responsável | Resultado necessário |
|---|---|---|
| C0 | Codex | Inventário remoto somente leitura, confirmação de migrations, plano/custo e baseline sanitizada |
| U1 | Cursor | Implementação completa em código e migrations novas, somente local |
| C1 | Codex | Revisão de segurança e execução local independente |
| C2 | Codex | Criação do ambiente remoto isolado de menor custo e aplicação nele |
| C3 | Codex | Testes com Auth/JWT/PostgREST/Storage reais no ambiente isolado |
| U2 | Cursor | Correção de qualquer falha encontrada, ainda sem produção |
| C4 | Codex | Nova validação integral; relatório de prontidão |
| H1 | Humano | Autorização explícita para produção após ler o relatório |
| C5 | Codex | Rollout controlado em produção e smoke não destrutivo |

Nenhum gate pode ser pulado. Falha em qualquer teste P0 bloqueia o próximo gate.

## 5. Separação de responsabilidade

### Cursor

- Pode editar somente o repositório local.
- Cria novas migrations; nunca altera `0001_schema.sql`, `0002_rpcs.sql` ou `0003_owner_acesso_cliente.sql`.
- Não executa `supabase link`, `db push`, SQL Editor remoto, Vercel, Cloudflare, AbacatePay real ou qualquer comando com credencial de produção.
- Não lê nem imprime `.env.local`.
- Não toca nas alterações existentes de landing/preços, no logo ou em outros planos não relacionados.
- Implementa exatamente o arquivo `01-plano-cursor.md`.

### Codex

- Executa o arquivo `02-runbook-codex.md`.
- Pode usar acessos externos somente dentro do gate correspondente.
- Antes de qualquer escrita em produção, mostra o diff, resultado dos testes, riscos residuais e pede autorização explícita.
- Nunca copia dados reais para staging/preview; usa seed sintético.

## 6. Estratégia de ambiente com menor custo

1. Desenvolvimento e CI sempre usam Supabase local, custo zero.
2. Se produção estiver em Pro, preferir um **Preview Branch efêmero**, sem dados de produção, criado somente para a validação e apagado no mesmo dia. A documentação atual informa cobrança a partir de US$ 0,01344 por hora de branch Micro, sem taxa fixa do branch.
3. Se produção estiver no Free e houver uma das duas vagas gratuitas disponível, criar um segundo projeto Free e pausá-lo ao terminar.
4. Se nenhuma dessas opções estiver disponível, o Codex deve parar e apresentar o menor custo encontrado antes de criar recurso pago. Não há autorização prévia para nova assinatura ou upgrade.

Referências:

- https://supabase.com/docs/guides/deployment/branching
- https://supabase.com/docs/guides/platform/manage-your-usage/branching
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/pricing

## 7. Estratégia de rollout sem janela incompatível

Usar expandir → migrar aplicação → restringir:

1. **Migration de enums:** adiciona novos valores, sem usá-los no mesmo arquivo.
2. **Migration de expansão:** adiciona schemas, tabelas, colunas, índices, constraints `NOT VALID`, backfill e novas RPCs. Mantém temporariamente as policies antigas para o app atual continuar funcionando.
3. Deploy da aplicação que usa somente as novas RPCs e o novo modelo.
4. Validar o novo fluxo.
5. **Migration de lockdown:** remove `FOR ALL`, revoga DML/EXECUTE e ativa policies mínimas, triggers de imutabilidade e constraints já validadas.
6. Validar novamente.
7. Migration de contrato/limpeza somente em ciclo posterior, depois de estabilidade comprovada.

Não editar migrations já aplicadas. Não usar `db reset` ou rollback destrutivo em produção.

## 8. Risco residual aceito

URLs assinadas de fotos e PDFs emitidas antes de arquivamento/revogação continuam válidas até expirar. Este plano garante bloqueio imediato para novas consultas e novas URLs, mas não implementa proxy autenticado para invalidar URLs antigas.

Criar item de backlog: “Revogação estrita de mídia: proxy autenticado, `Cache-Control: private, no-store` e remoção de URLs assinadas do cliente”.

## 9. Definition of Done

- Todos os testes P0 passam localmente e no ambiente remoto isolado.
- Os testes usam pelo menos: empreiteiro A, empreiteiro B, proprietário convidado e usuário sem compartilhamento, todos com JWTs reais.
- Nenhuma operação comercial relevante permanece disponível por DML direto.
- Nenhuma policy final usa `FOR ALL`.
- Toda policy declara `TO authenticated` ou papel mais restrito.
- `anon` não lê tabelas, objetos privados ou executa RPCs comerciais.
- Relatório, versões, snapshots e PDFs publicados são imutáveis.
- Retificação preserva a versão anterior e aplica deltas auditáveis.
- Acesso extra não é concedido antes da confirmação inequívoca do AbacatePay.
- Referências cruzadas entre obras falham por constraint, não somente por código da UI.
- Portal do proprietário não consulta tabelas vivas para compor informações publicadas.
- CI de segurança é bloqueante.
- Typecheck, lint, unit, pgTAP, integração de segurança e build estão verdes.
- Relatório final do Codex contém backup confirmado, migrations aplicadas, smoke, riscos residuais e custo do ambiente de teste.

