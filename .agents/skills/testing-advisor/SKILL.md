---
name: testing-advisor
description: Analisa diffs de implementação, identifica comportamentos alterados, gera matriz de testes e orienta a estratégia antes da escrita de código Jest.
---

# Testing Advisor

Esta skill é o consultor de estratégia de testes automatizados e aprendizado de QA do projeto **Plantão Monitor**. 

Ela atua imediatamente após a execução do plano (`executing-plans`), analisando o diff do código para construir uma visão estratégica de testes antes de escrever a sintaxe no Jest.

---

## 🔄 Fluxo de Trabalho Integrado

```
planning
   ↓
executing-plans
   ↓
testing-advisor  <-- [ESTA SKILL]
   ↓
Implementar testes (Jest)
   ↓
Executar testes (npm test)
   ↓
debugging (se necessário)
   ↓
code-review / requesting-code-review
```

---

## 📋 Diretrizes de Execução (Passo a Passo)

Sempre que a skill `testing-advisor` for invocada, o agente deve seguir estritamente estas 5 etapas:

### 1. Análise do Diff de Implementação
* Inspecionar as alterações recentes no git via `git diff` ou visualização dos arquivos modificados.
* Mapear quais funções, métodos, endpoints ou fluxos de dados foram criados, alterados ou removidos.

### 2. Identificação de Comportamentos & Regras Alteradas
* Listar os cenários de **Caminho Feliz (Happy Path)**.
* Listar os **Casos de Borda (Edge Cases)** e tratamento de erros (ex: token inválido, ID inexistente, campos nulos, falha de banco, timeout).

### 3. Construção da Matriz de Testes
* Montar uma tabela explicativa apresentando o que precisa ser testado:
  * **Cenário de Teste / Comportamento:** O que se quer validar.
  * **Entrada (Input):** Dados enviados (body, params, headers).
  * **Resultado Esperado (Output):** Status HTTP, mensagens de erro, mudanças no banco ou eventos emitidos.

### 4. Categorização dos Testes (Estratégia)
Classificar cada cenário da matriz no nível adequado de teste:
* **Unitários (Unit):** Para funções puras, validadores ou utilitários sem I/O de banco/rede.
* **De Integração (Integration):** Para rotas da API com banco de dados de teste/mocks de pool e rotas protegidas por middleware.
* **Manuais / E2E:** Para fluxos visuais de interface de usuário ou validação de ambiente real.

### 5. Guia Didático de Implementação no Jest
* Explicar didaticamente **o motivo** da escolha daquele teste antes de fornecer o snippet do Jest.
* Fornecer o código de teste Jest limpo e legível (usando `describe`, `test`/`it`, `expect`, `supertest` e mocks adequados).
