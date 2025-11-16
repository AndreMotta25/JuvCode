# Exemplo Prático - Sistema Inteligente de Contexto

## 🤔 O Que é Aquele Código?

Aquele código era apenas um **exemplo de como seria usado**, não algo que você precisa implementar agora. É como um "mockup" ou "protótipo" de como a funcionalidade funcionaria na prática.

## 🏗️ Como Seria na Prática

### Cenário Real:
Imagine que você, como usuário do Dyad, digita uma pergunta na interface:

```
Pergunta do usuário: "Como implementar autenticação JWT no meu app?"
```

### O Que Acontece Automaticamente:

#### **1. Análise Automática pela IA:**
```typescript
// O sistema automaticamente faz:
const query = "Como implementar autenticação JWT no meu app?";

// A IA extrai as keywords:
const keywords = ["autenticacao", "jwt", "implementar", "app"];
```

#### **2. Busca Inteligente Automática:**
```typescript
// O sistema automaticamente busca na sua base de código:
const arquivosEncontrados = await intelligentFileSearch("/caminho/do/projeto", "autenticacao jwt", 10);

// Resultado automático:
// [
//   { path: "src/auth/jwt.service.ts", score: 95 },
//   { path: "src/middleware/auth.ts", score: 88 },
//   { path: "src/utils/auth-helpers.ts", score: 82 },
//   { path: "pages/login.tsx", score: 67 },
//   { path: "components/LoginForm.tsx", score: 64 }
// ]
```

#### **3. Construção de Contexto Automática:**
```typescript
// O sistema automaticamente pega o conteúdo desses arquivos:
const contexto = await buildIntelligentContext("/caminho/do/projeto", "autenticacao jwt", 15);

// Resultado automático:
// {
//   files: [
//     {
//       path: "src/auth/jwt.service.ts",
//       content: "export class JWTService {\n  async generateToken(user: User): Promise<string> {\n    // ... código do JWT ...\n  }\n}",
//       relevanceScore: 95,
//       matchedKeywords: ["jwt", "autenticacao"]
//     },
//     {
//       path: "src/middleware/auth.ts", 
//       content: "export function authenticateJWT(req: Request, res: Response, next: NextFunction) {\n  // ... middleware de autenticação ...\n}",
//       relevanceScore: 88,
//       matchedKeywords: ["autenticacao", "jwt"]
//     }
//   ],
//   searchMethod: "intelligent",
//   totalFiles: 5
// }
```

#### **4. Usuário Vê o Resultado:**
O usuário não vê todo esse processo técnico. Ele só vê que o Dyad automaticamente encontrou os arquivos mais relevantes para sua pergunta sobre autenticação JWT e construiu um contexto inteligente com eles.

## 🎯 Como Funciona na Interface

### Interface Atual do Dyad:
```
[Área de Chat]
Usuário: "Como implementar autenticação JWT?"

[Dyad processa automaticamente]
┌─ Análise de query → Keywords extraídas
├─ Busca inteligente → Arquivos encontrados  
├─ Scoring de relevância → Ranking criado
└─ Contexto construído → Arquivos selecionados

[Resposta do Dyad]
Dyad: "Analisei sua base de código e encontrei 5 arquivos relevantes para implementação de JWT..."
```

### Interface Futura (com o sistema implementado):
```
[Configurações de Contexto]
┌─────────────────────────────────────┐
│ Estratégia de Seleção:              │
│ ○ Manual (padrões glob)             │
│ ● Automática (IA escolhe) ← VOCÊ ESCOLHE   │
│ ○ Híbrida (IA + fallback)           │
└─────────────────────────────────────┘

[Chat com Contexto Automático]
Usuário: "Sistema de login"

[Dyad automático]
┌─────────────────────────────────────┐
│ 📁 Arquivos selecionados pela IA:   │
│ • src/auth/LoginComponent.tsx (95%) │
│ • src/services/auth.service.ts (89%)│
│ • utils/auth-helpers.ts (76%)       │
│                                     │
│ Usando método: Busca Inteligente    │
│ ✅ 3 arquivos incluídos no contexto │
└─────────────────────────────────────┘
```

## 🛠️ Implementação Real

### Para Você (Usuário):
1. **Não precisa fazer nada técnico** - tudo é automático
2. **Só escolhe a estratégia** - Manual ou Automática
3. **Escreve sua pergunta** - Dyad faz o resto
4. **Recebe o contexto otimizado** - IA escolhe arquivos

### Para Desenvolvedores (Futuro):
Se quiser implementar isso futuramente, seria:

```typescript
// No componente de chat
const handleUserMessage = async (message: string) => {
  // 1. Extrai keywords automaticamente
  const keywords = extractKeywords(message);
  
  // 2. Busca arquivos automaticamente
  const relevantFiles = await intelligentFileSearch(appPath, message);
  
  // 3. Constrói contexto automaticamente  
  const context = await buildIntelligentContext(appPath, message);
  
  // 4. Usa no prompt do LLM
  const llmContext = context.files.map(f => f.content).join('\n\n');
  
  // 5. Envia para o LLM com contexto otimizado
  const response = await sendToLLM(message, llmContext);
  
  return response;
};
```

## 🎮 Exemplo Interativo

### Antes (Manual):
```
Usuário precisa configurar manualmente:
┌─────────────────────────────────────┐
│ Arquivos de Contexto:               │
│ [ ] src/auth/**                     │
│ [ ] utils/auth.ts                   │
│ [ ] components/LoginForm.tsx        │
│                                     │
│ ✋ Usuário tem que saber quais      │
│    arquivos são relevantes!         │
└─────────────────────────────────────┘
```

### Depois (Automático):
```
Usuário só digita:
┌─────────────────────────────────────┐
│ "Implementar JWT no login"          │
│                                     │
│ ✅ Dyad automaticamente:            │
│    • Analisa sua query              │
│    • Encontra arquivos relevantes   │
│    • Calcula scores de importância  │
│    • Constrói contexto otimizado    │
└─────────────────────────────────────┘
```

## 🎯 Resumo Simples

- **Aquele código era só um exemplo** de como funciona internamente
- **Você não precisa implementar** nada técnico agora
- **O benefício é**: Dyad escolhe automaticamente os arquivos certos
- **Você só**: Define se quer modo manual ou automático
- **Resultado**: Contexto mais relevante sem trabalho manual

É como ter um **assistente inteligente** que entende seu código e escolhe automaticamente os arquivos mais importantes para cada pergunta!