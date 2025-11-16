# Plano para Corrigir o Erro "Failed to run query: OK (200)"

## Problema Identificado

O erro "Sorry, there was an error processing your request: Error: Failed to run query: OK (200)" está ocorrendo porque:

1. O arquivo `src/supabase_admin/supabase_context.ts` está chamando diretamente `supabase.runQuery()` (linha 69)
2. Quando a API do Supabase retorna status 200 (OK) em vez de 201 (Created), a biblioteca `@dyad-sh/supabase-management-js` está tratando isso como um erro
3. Já existe uma versão corrigida da função em `src/supabase_admin/supabase_management_client_fixed.ts` que trata o status 200 como sucesso

## Solução Proposta

### 1. Modificar `src/supabase_admin/supabase_context.ts`

**Arquivo:** `src/supabase_admin/supabase_context.ts`
**Linha 2:** Adicionar import da função `executeSupabaseSql`
```typescript
import { IS_TEST_BUILD } from "@/ipc/utils/test_utils";
import { getSupabaseClient, executeSupabaseSql } from "./supabase_management_client_fixed";
import { SUPABASE_SCHEMA_QUERY } from "./supabase_schema_query";
```

**Linha 69-72:** Substituir a chamada direta a `runQuery` pela função corrigida:
```typescript
// Antes:
const schema = await supabase.runQuery(
  supabaseProjectId,
  SUPABASE_SCHEMA_QUERY,
);

// Depois:
const schemaResult = await executeSupabaseSql({
  supabaseProjectId,
  query: SUPABASE_SCHEMA_QUERY,
});
const schema = JSON.parse(schemaResult);
```

### 2. Verificar outros arquivos que possam ter o mesmo problema

Verificar se há outros arquivos chamando diretamente `supabase.runQuery()`:

1. `src/ipc/processors/response_processor.ts` - Já está importando do arquivo `_fixed.ts`
2. `src/ipc/handlers/app_handlers.ts` - Já está importando do arquivo `_fixed.ts`
3. `src/ipc/handlers/supabase_handlers.ts` - Já está importando do arquivo `_fixed.ts`

### 3. Testar a solução

Após fazer as modificações:
1. Reiniciar a aplicação
2. Tentar executar uma consulta SQL no Supabase
3. Verificar se o erro ainda ocorre

## Implementação

Para implementar esta solução, você deve:

1. Usar o modo Code para editar o arquivo `src/supabase_admin/supabase_context.ts`
2. Fazer as modificações indicadas acima
3. Testar a funcionalidade

## Explicação Técnica

A função `executeSupabaseSql` no arquivo `_fixed.ts` (linhas 141-178) trata o caso em que a API retorna status 200:

```typescript
// Check if it's a SupabaseManagementAPIError with status 200
if (error instanceof SupabaseManagementAPIError && error.response?.status === 200) {
  logger.warn("Supabase API returned 200 OK instead of 201 Created, treating as success");
  
  // Try to parse the response body manually
  try {
    const responseText = await error.response.text();
    // If we can parse it as JSON, return it
    JSON.parse(responseText);
    return responseText;
  } catch (parseError) {
    // If parsing fails, return the original error
    throw error;
  }
}
```

Isso garante que respostas com status 200 sejam tratadas como sucesso em vez de erro.