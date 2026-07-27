---
name: architecture-and-docs-guardian
description: Garante a integridade da arquitetura, a atualização da pasta docs/, a atualização do Graphify e provê aprendizado contextual sobre TypeScript e React.
---

# Architecture and Docs Guardian

Esta skill garante a consistência técnica, a documentação acadêmica e o conhecimento estrutural do projeto **Plantão Monitor**.

## Diretrizes de Execução

### 1. Guardião da Documentação Viva (`docs/`)
* Sempre que uma tarefa alterar:
  * O banco de dados (tabelas, campos, migrations ou relacionamentos).
  * A API Express (criação de novas rotas, mudança de middleware ou parâmetros).
  * A comunicação em tempo real (novos eventos WebSocket).
* **Você deve:**
  * Solicitar ao usuário a atualização do arquivo correspondente na pasta `docs/` (`docs/arquitetura.md` ou `docs/banco_de_dados.md`).
  * Apresentar o rascunho da documentação antes de salvá-la para aprovação do usuário.

### 2. Atualização do Graphify e Notion
* Após alterações significativas na estrutura de diretórios ou na assinatura das funções/módulos do sistema:
  * Rodar o comando de atualização do grafo:
    `& "C:\Users\kaycs\AppData\Roaming\Python\Python313\Scripts\graphify.exe" .`
  * E o comando de agrupamento:
    `& "C:\Users\kaycs\AppData\Roaming\Python\Python313\Scripts\graphify.exe" cluster-only C:\Users\kaycs\Dev\API_plantao_monitor`
* **Ao concluir marcos relevantes (Milestones/Issues grandes ou sub-tarefas chave):**
  * Atualizar a página oficial do TCC no Notion (`TCC - Projeto`) via MCP.
  * Respeitar a estrutura modular de seções da Monografia:
    - **Seção 1.1:** Arquitetura de Permissões & Modelo de Usuários (Regras de negócio, AuthN/AuthZ, `nome_dispositivo`).
    - **Seção 1.2:** Engenharia do Backend & Otimização de Pool.
    - **Seção 1.3:** Infraestrutura Docker & Banco de Dados.
    - **Seção 1.4:** Qualidade de Software, Testes & CI/CD.
    - **Seção 1.5:** Grafo de Conhecimento (Graphify) & Skills.

### 3. Aprendizado Contextual (TypeScript & React)
* **Antes de iniciar a escrita de código para migração para TypeScript:**
  * Forneça um resumo rápido de boas práticas de tipagem do Express/Node.js (ex: como tipar requisições, respostas, tratamento de tipos implícitos e evitar o uso de `any`).
* **Antes de iniciar a migração do frontend para React:**
  * Forneça diretrizes contextuais de arquitetura do React (ex: componentização, uso correto de Hooks como `useState`/`useEffect`, integração limpa com socket.io client).
  * Evite dar respostas longas e foque em dicas acionáveis para o desenvolvimento do TCC.
