# Diagrama do Fluxo do Erro e Solução

## Fluxo Atual (Com Problema)

```mermaid
graph TD
    A[supabase_context.ts] -->|Chama diretamente| B[supabase.runQuery]
    B -->|API retorna status 200| C[@dyad-sh/supabase-management-js]
    C -->|Trata 200 como erro| D[SupabaseManagementAPIError]
    D -->|Propaga erro| E[chat_stream_handlers.ts]
    E -->|Exibe mensagem| F["Sorry, there was an error processing your request:<br/>Error: Failed to run query: OK (200)"]
```

## Fluxo Corrigido (Solução Proposta)

```mermaid
graph TD
    A[supabase_context.ts] -->|Usa função corrigida| B[executeSupabaseSql do _fixed.ts]
    B -->|API retorna status 200| C[@dyad-sh/supabase-management-js]
    C -->|Detecta status 200| D[SupabaseManagementAPIError]
    D -->|Trata 200 como sucesso| E[Verifica e parse do response]
    E -->|Retorna resultado| F[JSON com resultado da query]
    F -->|Processamento normal| G[chat_stream_handlers.ts]
    G -->|Exibe resultado| H[Resposta normal sem erro]
```

## Arquivos Envolvidos

### Arquivos com Problema
- `src/supabase_admin/supabase_context.ts` (linha 69)
  - Chamada direta: `supabase.runQuery(supabaseProjectId, SUPABASE_SCHEMA_QUERY)`

### Arquivos com Solução
- `src/supabase_admin/supabase_management_client_fixed.ts` (linhas 141-178)
  - Função: `executeSupabaseSql()` que trata status 200 como sucesso

### Arquivos que Usam a Solução Corretamente
- `src/ipc/processors/response_processor.ts`
- `src/ipc/handlers/app_handlers.ts`
- `src/ipc/handlers/supabase_handlers.ts`

## Resumo da Correção Necessária

1. **Importar função corrigida** em `supabase_context.ts`
2. **Substituir chamada direta** por `executeSupabaseSql()`
3. **Parse do resultado** para manter compatibilidade

Essa mudança garantirá que todas as consultas SQL tratem o status 200 como sucesso, eliminando o erro "Failed to run query: OK (200)".