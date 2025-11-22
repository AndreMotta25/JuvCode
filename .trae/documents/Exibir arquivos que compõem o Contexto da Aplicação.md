## Objetivo
- Exibir, na seção “Contexto da Aplicação”, a lista de arquivos atualmente incluídos no contexto de código (incluídos manualmente e via contexto inteligente), com quantidade total e ações simples.

## Fontes dos dados
- Usar os handlers/utilitários já existentes:
  - `src/ipc/handlers/context_paths_handlers.ts` — obter/alterar caminhos de contexto atuais.
  - `src/ipc/utils/context_paths_utils.ts` — validar/normalizar `AppChatContext`.
  - `src/ipc/handlers/intelligent_context_handlers.ts` — construir/consultar contexto inteligente.
  - `src/utils/minimalContext.ts` e `src/utils/intelligentContext.ts` — geração de contexto (fallback e ranking).
  - Opcional: `src/ipc/utils/versioned_codebase_context.ts` para distinguir conteúdo versionado quando útil.

## Ajustes de UI
- Em `src/components/chat/DyadCodebaseContext.tsx`:
  - Renderizar uma lista dos caminhos retornados pelos handlers IPC, agrupando por “incluídos manualmente” e “incluídos automaticamente”.
  - Mostrar contagem (ex.: “12 arquivos no contexto”).
  - Ações por item: abrir no editor, copiar caminho, remover do contexto (quando aplicável).
  - Estados: carregando, vazio, erro de IPC.
- Em `src/components/ContextFilesPicker.tsx`:
  - Garantir sincronização da seleção com a lista exibida (atualizar após inclusão/remoção).

## Interação IPC
- Criar uma chamada inicial para obter os caminhos do contexto e assinar atualizações (se houver eventos de mudança via IPC). Caso não exista push, refazer fetch após ações do usuário.

## Segurança e performance
- Não exibir conteúdo do arquivo, apenas caminhos.
- Usar renderização virtual para listas longas, evitando queda de performance.

## Validação
- Testar manualmente: incluir/remover arquivos e verificar atualização imediata.
- Verificar estados de vazio/erro.
- Validar que a lista corresponde ao que os handlers retornam e à seleção do Picker.