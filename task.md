# 📋 Quadro de Tarefas (Kanban) - Plantão Monitor

Este quadro acompanha a evolução do seu TCC e a modernização do projeto **Plantão Monitor** com testes automáticos e CI/CD.

## 🗂️ Backlog
- [ ] Adicionar testes para o orquestrador/executor Python (usando pytest) (Issue #2 - Futuro)
- [ ] Planejamento e Estruturação do novo Frontend em React (Issue #3)

## ⏳ A Fazer (To Do)
- [ ] Migração do Backend Express para TypeScript (Issue #2)

## 🔄 Em Progresso (Doing)
- [/] Migração do Backend Express para TypeScript (Issue #2)
  - [x] Sub-tarefa 2.1: Infraestrutura TypeScript (`tsconfig.json`, `package.json`)
  - [x] Sub-tarefa 2.2: Interfaces de Domínio (`src/types/user.ts`, `express.d.ts`)
  - [x] Sub-tarefa 2.3: Conexão PostgreSQL em TypeScript (`src/db/db.ts`)
  - [/] Sub-tarefa 2.4: Middleware de Autenticação (`src/middleware/authMiddleware.ts`)

## Done ✅
- [x] Organização e Escrita da Documentação de Arquitetura Inicial (Issue #1)
  - [x] Criar diretório `docs/`
  - [x] Escrever `docs/arquitetura.md` (Visão geral, componentes e fluxo de webhook/websocket)
  - [x] Escrever `docs/banco_de_dados.md` (Modelagem física, tabelas, schemas e queries do runner)
  - [x] Atualizar o Knowledge Graph rodando o Graphify
- [x] Setup completo de Docker Compose e Banco PostgreSQL (Porta 5433)
- [x] Copiar as skills do Superpowers para o diretório `.agents/skills` do projeto
- [x] Mover o projeto legado para a pasta unificada `C:\Users\kaycs\Dev\API_plantao_monitor`
- [x] Criar estrutura de testes de integração para as rotas do Express (usando Jest/Supertest)
- [x] Criar o primeiro teste de unidade simples no Node.js
- [x] Configurar o runner do GitHub Actions (`.github/workflows/ci.yml`) para rodar os testes a cada push/PR
