# Plano de Correção do Erro Supabase "Failed to run query: OK (200)"

## Problema Identificado

O erro ocorre no `token_count_handlers` quando a API do Supabase retorna status 200 em vez do esperado 201, causando falha no processamento da resposta. O log de erro mostra:

```
09:50:43.020 (token_count_handlers) > Error in : args: [{"chatId":10,"input":""}] Error: Failed to run query: OK (200)
```

## Causa Raiz

A função `executeSupabaseSql` em `src/supabase_admin/supabase_management_client_fixed.ts` tenta tratar status 200 como sucesso, mas o tratamento atual tem falhas no parse da resposta.

## Fluxo do Problema

```mermaid
graph TD
    A[Token Count Handler] --> B[getSupabaseContext]
    B --> C[executeSupabaseSql]
    C --> D[API Supabase retorna 200 OK]
    D --> E[Tenta parse da resposta]
    E --> F[Falha no parse]
    F --> G[Erro: Failed to run query: OK (200)]
    G --> H[Token count falha]
```

## Solução Completa

### 1. Melhorar Tratamento de Erros de Status 200

**Arquivo**: `src/supabase_admin/supabase_management_client_fixed.ts`
**Função**: `executeSupabaseSql` (linhas 141-200)

**Alterações Propostas**:

```typescript
export async function executeSupabaseSql({
  supabaseProjectId,
  query,
}: {
  supabaseProjectId: string;
  query: string;
}): Promise<string> {
  if (IS_TEST_BUILD) {
    return "{}";
  }

  const supabase = await getSupabaseClient();
  
  try {
    // Use the original runQuery method
    const result = await supabase.runQuery(supabaseProjectId, query);
    return JSON.stringify(result);
  } catch (error) {
    // Check if it's a SupabaseManagementAPIError with status 200
    if (error instanceof SupabaseManagementAPIError && error.response?.status === 200) {
      logger.warn("Supabase API returned 200 OK instead of 201 Created, treating as success");
      
      // Try to get the response body and parse it
      try {
        const responseText = await error.response.text();
        logger.info(`Response body for status 200: ${responseText}`);
        
        if (responseText && responseText.trim()) {
          // Try to parse as JSON first
          try {
            const parsedResponse = JSON.parse(responseText);
            return JSON.stringify(parsedResponse);
          } catch (jsonError) {
            logger.warn(`Response body is not valid JSON: ${jsonError}`);
            // Try to extract JSON-like content from the response
            const jsonMatch = responseText.match(/\{.*\}/);
            if (jsonMatch) {
              logger.info(`Extracted JSON from response: ${jsonMatch[0]}`);
              return jsonMatch[0];
            }
          }
        } else {
          logger.warn("Empty response body for status 200, returning empty object");
          // If response body is empty, return empty object
          return "{}";
        }
      } catch (parseError) {
        logger.error(`Failed to parse response body: ${parseError}`);
        // If parsing fails, try to extract any available data from error message
        try {
          if (error.message && error.message.includes("OK (200)")) {
            // Extract any JSON-like content from the error message
            const jsonMatch = error.message.match(/\{.*\}/);
            if (jsonMatch) {
              logger.info(`Extracted JSON from error message: ${jsonMatch[0]}`);
              return jsonMatch[0];
            }
          }
        } catch (extractError) {
          logger.error(`Failed to extract JSON from error message: ${extractError}`);
        }
        
        // If all parsing fails, return empty object as fallback
        logger.warn("All parsing attempts failed, returning empty object");
        return "{}";
      }
    }
    
    // For other errors, re-throw them with more context
    logger.error(`Supabase query failed for project ${supabaseProjectId}: ${error}`);
    throw error;
  }
}
```

### 2. Adicionar Logging Aprimorado

**Alterações Propostas**:

- Adicionar logs detalhados em cada etapa do processamento
- Incluir informações do projeto ID e query em caso de erro
- Logar respostas completas (limitadas a 1000 caracteres) para depuração
- Separar logs por nível (info, warn, error) com contexto adequado

### 3. Validar Respostas

**Alterações Propostas**:

- Validar se o corpo da resposta não é nulo ou vazio
- Implementar múltiplos estratégias de parse JSON
- Fallback para extração de JSON de texto não estruturado
- Retornar objeto vazio seguro em caso de falha total

### 4. Implementar Fallback Robusto

**Alterações Propostas**:

- Estratégia 1: Parse JSON direto
- Estratégia 2: Extração de JSON padrão de texto
- Estratégia 3: Extração de JSON da mensagem de erro
- Final: Retornar "{}" como fallback seguro

## Testes Propostos

### 1. Teste Unitário para Resposta Válida

```typescript
it("should handle valid JSON response body", async () => {
  const mockResponse = {
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve('{"tables": [], "functions": []}'),
  } as any;

  const error = new SupabaseManagementAPIError(
    "Failed to run query: OK (200)",
    mockResponse
  );

  jest.mock("../supabase_admin/supabase_management_client_fixed", () => ({
    ...jest.requireActual("../supabase_admin/supabase_management_client_fixed"),
    getSupabaseClient: jest.fn().mockResolvedValue({
      runQuery: jest.fn().mockRejectedValue(error),
    }),
  }));

  const result = await executeSupabaseSql({
    supabaseProjectId: "test-project",
    query: "SELECT 1",
  });

  expect(result).toBe('{"tables": [], "functions": []}');
});
```

### 2. Teste para Resposta Vazia

```typescript
it("should handle empty response body", async () => {
  const mockResponse = {
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve(""),
  } as any;

  const error = new SupabaseManagementAPIError(
    "Failed to run query: OK (200)",
    mockResponse
  );

  // ... similar setup

  const result = await executeSupabaseSql({
    supabaseProjectId: "test-project",
    query: "SELECT 1",
  });

  expect(result).toBe("{}");
});
```

### 3. Teste para JSON Inválido

```typescript
it("should handle invalid JSON response", async () => {
  const mockResponse = {
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve("invalid json content"),
  } as any;

  const error = new SupabaseManagementAPIError(
    "Failed to run query: OK (200)",
    mockResponse
  );

  // ... similar setup

  const result = await executeSupabaseSql({
    supabaseProjectId: "test-project",
    query: "SELECT 1",
  });

  expect(result).toBe("{}");
});
```

## Benefícios Esperados

1. **Resolução do Erro**: O token count handler não mais falha com status 200
2. **Melhor Depuração**: Logs detalhados facilitam identificação de problemas futuros
3. **Robustez**: Múltiplas estratégias de fallback garantem operação contínua
4. **Manutenibilidade**: Código mais claro e bem documentado

## Próximos Passos

1. Implementar as alterações no arquivo `supabase_management_client_fixed.ts`
2. Executar testes unitários para validar a solução
3. Testar integração com o token count handler
4. Documentar a solução para futuras referências

## Arquivos Afetados

- `src/supabase_admin/supabase_management_client_fixed.ts`
- `src/__tests__/supabase_token_count_fix.test.ts` (para adicionar novos testes)
- `src/ipc/handlers/token_count_handlers.ts` (para verificar se precisa de ajustes adicionais)

## Considerações de Segurança

- Não expor informações sensíveis nos logs
- Validar todas as respostas antes de processar
- Manter tratamento de erros robusto sem expor detalhes internos