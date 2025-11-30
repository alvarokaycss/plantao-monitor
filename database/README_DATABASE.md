# Migrations do Banco de Dados - Plantão Monitor

Para configurar o banco de dados do zero, execute os scripts SQL na ordem abaixo utilizando seu DBeaver:

1.  **001_schema_inicial.sql**: Cria a estrutura base do sistema (Usuários, Regras, Incidentes).
2.  **002_adiciona_fila_runner.sql**: Cria a tabela `fila_runner` necessária para o funcionamento do serviço de execução de regras.

# Seeds do Banco de Dados - Plantão Monitor
1.  **001_seeds_iniciais.sql**: Adiciona todos os metadados necessários para o funcionamento do sistema.
2.  **002_seeds_admin_user.sql**: Adiciona as configurações de SUPERADMIN para o usuário recém cadastrado (Via Interface da plataforma).

**Nota:** A aplicação (Runner) espera que essas tabelas existam antes de iniciar.