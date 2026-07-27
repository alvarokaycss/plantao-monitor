---
name: tcc-workflow-manager
description: Gerencia o ciclo de vida de Issues, Milestones e o quadro Kanban do GitHub Projects, mantendo o task.md local sincronizado.
---

# TCC Workflow Manager

Esta skill coordena o fluxo organizacional do projeto **Plantão Monitor**, garantindo que o desenvolvimento siga as etapas profissionais do TCC.

## Diretrizes de Execução

### 1. Inicialização de Tarefas
* Antes de iniciar qualquer codificação, verifique qual Issue do GitHub Projects está ativa.
* Garanta que o card correspondente no GitHub Projects seja movido para a coluna **Doing** (Em Progresso).
* Sincronize a tarefa no arquivo local `task.md` movendo-a para a seção `## 🔄 Em Progresso (Doing)` e marcando-a com `[/]`.

### 2. Criação de Issues
* Sempre que surgir a necessidade de uma refatoração ou nova funcionalidade, sugira a criação de uma nova Issue estruturada.
* Cada Issue deve conter:
  * **Objetivo:** O que será resolvido.
  * **Critérios de Conclusão:** Checklist claro de metas.
  * **Dependências:** Se há outras tarefas que precisam acabar antes.
* Vincule a Issue à Milestone correspondente no GitHub.

### 3. Conclusão de Tarefas & Sincronização
* Após a verificação dos testes, instrua o usuário a commitar e dar push no código para o GitHub.
* Lembre o usuário de:
  * Mover a Issue para **Done** (Concluído) no GitHub Projects.
  * Fechar a Issue correspondente.
  * Mover a tarefa para a seção `## Done ✅` do `task.md` local, marcando-a com `[x]`.
  * Sincronizar os avanços na página do Notion `TCC - Projeto` inserindo o registro na seção modular correspondente (Seção 1.1 a 1.5).

### 4. Gestão de Milestones
* Respeite a ordem lógica das Milestones acordadas no TCC:
  1. *Milestone 1:* Refatoração do Backend e Docs (Atual)
  2. *Milestone 2:* Migração para TypeScript
  3. *Milestone 3:* Novo Frontend React
  4. *Milestone 4:* TailwindCSS
  5. *Milestone 5:* Documentação Final
  6. *Milestone 6:* Preparação da Defesa do TCC
