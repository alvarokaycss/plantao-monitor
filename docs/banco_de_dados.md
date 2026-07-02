# 🗄️ Modelagem e Estrutura do Banco de Dados - Plantão Monitor

O **Plantão Monitor** utiliza o **PostgreSQL** como seu banco de dados relacional sob o schema `qq_monitor`. A estrutura é projetada para gerenciar as regras de negócio de monitoramento, orquestrar a fila de execução, gerir as escalas on-call de plantonistas e auditar logs de incidentes e notificações.

---

## 🗃️ Dicionário de Tabelas

### 1. Gestão de Acesso e Perfis (Segurança)

* **`perfil`**: Define as permissões globais de ação dos usuários.
  * `id_perfil` (Serial, PK)
  * `nome` (Varchar, Unique) — Valores padrão: `admin`, `operator`, `viewer`.
* **`recursos`**: Telas ou funcionalidades do sistema protegidas por autorização.
  * `id_recurso` (Serial, PK)
  * `chave_recurso` (Varchar, Unique) — Ex: `TELA_REGRAS`, `TELA_ESCALAS`.
  * `nome_amigavel` (Varchar).
* **`usuario`**: Cadastro principal integrado à autenticação do Firebase.
  * `id_usuario` (Serial, PK)
  * `uid_firebase` (Varchar, Unique) — ID de autenticação do Firebase.
  * `id_perfil` (Int, FK para `perfil`) — Define o nível de acesso do usuário.
  * `email` (Varchar, Unique) e `nome` (Varchar).
  * `notificacao_push_som` (Varchar) e `notificacao_janela_inicio`/`notificacao_janela_fim` (Time) — Janela de silenciamento "não perturbe".
  * `ativo` (Boolean) — Bloqueia acessos até que o usuário seja ativado por um Admin.
* **`usuario_recursos`**: Tabela de associação (N para N) para liberação granular de recursos por usuário.
  * `id_usuario` (Int, FK) e `id_recurso` (Int, FK) como PK composta.
* **`configuracoes_notificacao`**: Guarda os canais de contato ativos de cada usuário.
  * `id_configuracao_notificacao` (Serial, PK)
  * `id_usuario` (Int, FK)
  * `id_tipo_canal` (Int, FK para `tipos_canal_notificacao`)
  * `endereco_notificacao` (Text, Unique) — Tokens de navegador (push), endereços de e-mail ou números de celular.
  * `habilitado` (Boolean) e `nome_dispositivo` (Varchar).

---

### 2. Gestão de Escalas e Plantões (On-Call)

* **`roles`**: Etiquetas ou grupos de regras (ex: "Faturamento", "Infraestrutura").
  * `id_role` (Serial, PK) e `nome` (Varchar, Unique).
* **`escala`**: Vincula um plantonista ativo a um determinado grupo (`role`) em uma janela de tempo.
  * `id_escala` (Serial, PK)
  * `id_usuario` (Int, FK) — Plantonista responsável.
  * `id_role` (Int, FK) — Grupo de monitoramento.
  * `data_inicio` e `data_fim` (Timestamp com timezone).

---

### 3. Regras de Monitoramento

* **`regra`**: Contém a definição das queries SQL e comportamento de execução.
  * `id_regra` (Serial, PK)
  * `id_banco_dados` (Int, FK) — Qual banco de dados executar (Postgres / Oracle).
  * `nome` (Varchar), `descricao` (Text) e `consulta_sql` (Text) — Query de verificação de anomalias.
  * `intervalo_minutos` (Int) — Periodicidade de execução.
  * `janela_inicio` e `janela_fim` (Time) — Janela horária em que a regra é válida.
  * `qnt_erro_max` (SmallInt) — Tentativas antes de alarmar.
  * `prioridade` (SmallInt) — Severidade de 1 (Crítica) a 3 (Baixa).
  * `data_adiar_inicio` / `data_adiar_fim` — Silenciamento temporário da regra.

---

### 4. Orquestração e Incidentes

* **`fila_runner`**: Fila de controle de execução de regras em tempo real (Orquestrador ➡️ Executor).
  * `id_fila` (BigSerial, PK)
  * `id_regra` (Int, FK)
  * `status` (Varchar) — `PENDENTE`, `CONCLUIDO` ou `FALHA`.
  * `tentativas` (Int) — Contador de execuções (para retentativas em caso de falha de conexão).
  * `data_agendamento`, `data_inicio_processamento`, `data_fim_processamento` e `mensagem_erro`.
* **`incidente`**: Alertas ativos abertos pelo Executor Python.
  * `id_incidente` (BigSerial, PK)
  * `id_regra` (Int, FK)
  * `status` (Varchar) — `ABERTO`, `RECONHECIDO` ou `FECHADO`.
  * `prioridade_registro` (SmallInt) — Herdada da regra.
  * `data_abertura`, `data_ack` (Reconhecimento) e `data_fechamento`.
  * `id_usuario_ack` e `id_usuario_fechamento` (Int, FKs).
  * `comentario_incidente` (Text) e `dados_amostra` (JSON) — Captura do resultado da query SQL geradora da anomalia.
  * `nivel_escalonamento` (Int) — Controla qual nível da escala de aviso o incidente está.
* **`regra_escalonamento`**: Configurações de transição de alertas caso incidentes não recebam ACK.
  * `id_escalonamento` (Serial, PK)
  * `id_regra` (Int, FK)
  * `minutos_apos_abertura` (Int)
  * `id_role_destino` (Int, FK) — Próximo grupo na escala.
  * `id_tipo_canal` (Int, FK) — Canal de acionamento do escalonamento.

---

### 5. Auditoria e Telemetria

* **`log_execucoes_regras`**: Telemetria do Runner para verificar tempo de execução e eficácia das queries.
  * `id_log_execucao` (BigSerial, PK)
  * `id_regra` (Int, FK)
  * `data_execucao` (Timestamp), `duracao_ms` (Int) e `status_execucao` (Varchar: `SUCESSO`/`FALHA`).
  * `resultado_contagem` (Int) — Quantidade de linhas retornadas pela query.
  * `id_incidente_gerado` (BigInt, FK).
* **`log_notificacoes`**: Auditoria do envio de e-mails/webhooks.
  * `id_log_notificacao` (BigSerial, PK), `id_incidente` (BigInt, FK), `id_usuario_destinatario` (Int, FK), `status_envio` (`ENVIADO`/`FALHA`), `destino_envio` e `mensagem_erro`.
* **`log_auditoria_alteracoes`**: Rastro de modificações manuais de dados por usuários do sistema.
  * `id_log_auditoria` (BigSerial, PK)
  * `id_usuario` (Int, FK) — Quem realizou a alteração.
  * `acao` (Varchar) — `INSERT`, `UPDATE` ou `DELETE`.
  * `tabela_afetada` (Varchar) e `id_registro_afetado` (BigInt).
  * `dados_antigos` e `dados_novos` (JSON) — Estado da linha antes e depois da modificação.
