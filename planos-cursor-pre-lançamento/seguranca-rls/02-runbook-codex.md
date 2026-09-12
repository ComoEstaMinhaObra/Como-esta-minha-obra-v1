# Runbook operacional — Codex

Leia `00-plano-mestre.md` e o resultado entregue pelo Cursor. Este runbook contém as tarefas que exigem maior cuidado, acesso externo ou permissões elevadas.

## C0. Baseline de produção — somente leitura

### C0.1 Guardas

- Confirmar visualmente o project ref e que ele é produção.
- Não consultar conteúdo de obras, snapshots, fotos, emails ou payloads.
- Exportações temporárias ficam em diretório seguro e são removidas ao final.
- Não imprimir chaves, URLs assinadas ou connection strings.
- Se a conexão falhar, não aplicar nada; resolver acesso primeiro.

### C0.2 Inventário

Coletar somente catálogo/configuração:

- `supabase migration list`;
- schema-only dump de `public`, schemas privados relevantes e objetos necessários de `storage`;
- tabelas, colunas, enums, constraints, índices e triggers;
- `pg_policies`;
- grants e default ACLs;
- funções com proprietário, `prosecdef`, `proconfig/search_path` e grants de execução;
- buckets, MIME, limite, publicidade e policies;
- configuração Auth: confirmação, senha, CAPTCHA, rate limits, JWT/refresh;
- plano da organização, disponibilidade de Branching e cotas/custos;
- existência e validade de backup.

Não salvar valores secretos no repositório.

### C0.3 Relatório de baseline

Produzir relatório sanitizado contendo:

- migrations locais × remotas;
- drift encontrado;
- policies/grants perigosos;
- dados legados potencialmente incompatíveis, apenas por contagem;
- plano/cota do Supabase;
- opção de staging escolhida e custo máximo estimado;
- bloqueios para o Cursor.

Se as migrations remotas não forem equivalentes às locais, o Cursor não inicia até receber a baseline reconciliada.

## C1. Revisão independente da entrega do Cursor

### C1.1 Diff

- Confirmar que alterações preexistentes foram preservadas.
- Confirmar que `0001`–`0003` não mudaram.
- Ler integralmente toda migration nova e toda função `SECURITY DEFINER`.
- Verificar `search_path = ''` e nomes qualificados.
- Verificar grants antes das policies.
- Procurar DML direto remanescente em ações comerciais.
- Procurar `upsert: true` no bucket de PDFs.
- Verificar que o admin não ganhou acesso amplo.
- Verificar que o frontend não importa o admin client.
- Verificar que erros não devolvem stack/SQL/PII.

### C1.2 Execução local limpa

Em ambiente limpo:

- instalar dependências pelo lockfile;
- subir Supabase local;
- aplicar migrations desde zero;
- executar lint do banco e pgTAP;
- executar testes com JWT real;
- executar testes de concorrência;
- typecheck, lint, unit e build;
- executar audit de dependências;
- inspecionar CSP em build de produção local.

Não avançar com teste flaky, skipped ou `continue-on-error`.

## C2. Provisionar staging/preview com menor custo

### C2.1 Escolha

Usar esta ordem:

1. Produção Pro com Branching: criar Preview Branch efêmero, data-less, Micro, não persistente.
2. Produção Free com vaga: criar segundo projeto Free com região compatível.
3. Sem opção gratuita/barata: parar e pedir autorização apresentando valor antes de criar.

Não criar persistent branch se preview efêmero atender. Não habilitar “Include production data”.

### C2.2 Isolamento

- Usar credenciais exclusivas do ambiente.
- Configurar somente chaves AbacatePay de desenvolvimento.
- Usar remetente de email de teste ou desabilitar envio externo real.
- Usar Turnstile em modo/test key quando disponível.
- Seed somente sintético, com nomes e emails obviamente de teste.
- Nunca copiar dump de dados ou objetos de produção.

### C2.3 Custo

- Registrar hora de criação.
- Definir lembrete operacional para excluir/pausar no mesmo dia.
- Ao terminar, registrar horas e custo estimado.
- Preview branches não são cobertos por compute credits; apagar imediatamente após C4.

## C3. Aplicar e validar no ambiente isolado

### C3.1 Aplicação

- Aplicar migrations na ordem exata.
- Regenerar/confirmar schema cache.
- Aplicar configurações Auth e bucket do ambiente.
- Fazer deploy de preview do Next.js apontado somente ao staging/branch.
- Verificar que nenhuma env de produção vazou.

### C3.2 Suíte obrigatória

Executar:

- pgTAP;
- testes diretos com JWT real;
- PostgREST CRUD allow/deny;
- Storage upload/download/update/delete allow/deny;
- criação concorrente de obra;
- convite concorrente;
- envio concorrente/idempotente;
- retificação e histórico;
- billing com AbacatePay dev e caso `incerto` simulado;
- arquivamento/revogação;
- Auth/Turnstile;
- CSP/headers;
- portal do proprietário baseado no snapshot;
- admin operacional.

Registrar status por item da checklist original.

## C4. Relatório de prontidão

Antes de pedir autorização para produção, apresentar:

- commit exato;
- migrations exatas;
- resumo do diff;
- resultado de todos os testes;
- duração/custo do ambiente isolado;
- drift resolvido;
- plano de rollout expand → app → lockdown;
- plano de recuperação;
- impacto esperado e janela;
- risco residual de URLs assinadas já emitidas;
- limitações do `record-usage` sem idempotency key;
- confirmação de que não há deleção de dados de negócio planejada, exceto sanitização/purga de logs já autorizada;
- qualquer requisito Pro, especialmente proteção de senha vazada.

Pedir autorização explícita. Sem resposta afirmativa, não tocar em produção.

## C5. Rollout em produção

### C5.1 Antes

- Confirmar backup recuperável e horário.
- Confirmar saúde do banco e ausência de migration concorrente.
- Confirmar deploy pronto e commit fixado.
- Confirmar que jobs/webhooks não serão duplicados durante rollout.
- Confirmar responsável humano disponível.
- Capturar métricas baseline sem PII.

### C5.2 Sequência

1. Aplicar migration de enums.
2. Aplicar migration de expansão/backfill.
3. Validar constraints e contagens; parar se houver inconsistência.
4. Fazer deploy da aplicação nova.
5. Smoke de criação/rascunho/leitura em fixture controlado ou teste não mutável previamente acordado.
6. Aplicar migration de lockdown.
7. Forçar/aguardar atualização do schema cache.
8. Aplicar configurações de buckets.
9. Aplicar Auth: senha, confirmação, troca segura, rate limits e proteção vazada se disponível.
10. Configurar Turnstile e validar cadastro/recuperação.
11. Ativar CSP enforced após confirmar Report-Only sem violações necessárias.
12. Validar webhooks/outbox com evento de desenvolvimento, nunca cobrança real de teste.

### C5.3 Sanitização e retenção

- Fazer backup antes.
- Sanitizar payloads antigos de webhook conforme migration revisada.
- Remover registros além de 90 dias somente se a migration aprovada assim determinar.
- Informar ao usuário o que foi apagado/sanitizado e como o backup pode ser usado.

### C5.4 Smoke final

Sem tocar em tenant real:

- `anon` negado;
- usuário A não acessa fixture B;
- proprietário acessa somente fixture compartilhada;
- rascunho/foto de rascunho negados;
- obra arquivada nega nova URL;
- DML direto de obra/acesso/relatório negado;
- PDF não aceita overwrite;
- headers presentes;
- logs não mostram PII;
- métricas de erro/latência dentro do esperado.

Apagar fixtures sintéticos autorizados e registrar a remoção.

## C6. Recuperação e parada segura

Parar imediatamente se:

- backup não estiver confirmado;
- backfill encontrar relação cruzada;
- uma migration produzir lock prolongado;
- o app novo falhar antes do lockdown;
- um teste P0 falhar;
- webhook/billing duplicar operação;
- CSP impedir autenticação ou acesso necessário;
- houver indício de acesso a tenant real.

Preferir correção forward-only. Não usar `git reset --hard`, `db reset`, restauração ampla ou edição manual de linha em produção. Restauração de backup é último recurso e exige nova autorização por interromper/escrever dados.

## C7. Encerramento

- Excluir Preview Branch ou pausar staging Free.
- Remover arquivos temporários que contenham schema/credenciais.
- Revogar credenciais temporárias.
- Registrar custo final.
- Entregar relatório com migrations, testes, alterações de configuração, sanitização, fixtures removidos e riscos residuais.
- Criar o backlog de revogação estrita de URLs assinadas.

