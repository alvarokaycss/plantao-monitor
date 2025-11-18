/**
 * ATENÇÃO: AINDA NÃO FOI ADICIONADA A FUNCIONALIDADE DE TESTES
 * EM AMBIENTE SANDBOX (POST/regras/testar)
 * LEMBRETE PRA ADICIONAR!!!
 */

require("dotenv").config(); // carrega .env pra dentro de process

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const process = require("process");
const path = require("path");
const pkg = require("./package.json");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account-key.json");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configurações básicas e de verificação de variáveis ambiente
const PORT=process.env.PORT || 8000;
const DATABASE_URL=process.env.DATABASE_URL;
const SCHEMA=process.env.DB_SCHEMA ? process.env.DB_SCHEMA.trim() : undefined;

if (!SCHEMA) {
    console.error("ERRO: variável DB_SCHEMA não definida ou está vazia. Verifique seu arquivo .env.");
    process.exit(1);
};

if (!DATABASE_URL) {
    console.error("ERRO: variável DATABASE_URL não definida. Crie um .env na raiz ou defina a variável.");
    process.exit(1);
};

// Inicialização do Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK inicializado!!");
} catch (error) {
  console.error("ERRO ao inicializar Firebase Admin:", error.message);
  process.exit(1);
}

// PERMISSÕES DE USUÁRIO (ACESSO ÀS TELAS E ROTAS DA APLICAÇÃO)
// Não estou utilizando ainda
// Perfis da aplicação
const P_ADMIN=['admin'];
const P_ADMIN_OP=['admin', 'operator'];
const P_TODOS=['admin', 'operator', 'viewer'];
// Recursos da Aplicação
const R_REGRAS='TELA_REGRAS';
const R_ESCALAS='TELA_ESCALAS';
const R_USUARIOS='TELA_USUARIOS';
const R_CONFIGS='TELA_CONFIGS'; // (Admin precisa desse recurso pra acessar todas as rotas de config)
const R_NENHUM=null; // Para telas de acesso padrão (Incidentes e KPIs)


/**
 * Middleware de Autenticação e Provisionamento
 * Verifica o Token do Firebase, carrega ou cria o usuário no Postgres.
 * Atenção: A função realiza o cadastro validações e afins, qualquer coisinha buga.
 */
const checkAuth = async (req, res, next) => {
  const authorization = req.headers.authorization;

  // 1. Validação inicial de presença
  if (!authorization) {
    return res.status(401).json({ error: "Token de autorização ausente." });
  }

  // 2. (Divide por espaço, pega o último pedaço)
  // Isso resolve problemas de "Bearer  token" (espaço duplo) ou "bearer token" (lowercase)
  const parts = authorization.split(' ');
  if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
    return res.status(401).json({ error: "Token mal formatado. Formato esperado: 'Bearer <token>'" });
  }

  const idToken = parts[1];

  // console.log("[checkAuth] Token extraído:", idToken.substring(0, 10) + "...");

  let decodedToken;

  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Erro ao verificar token Firebase:", error.code);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: "Token expirado. Faça login novamente." });
    }
    if (error.code === 'auth/argument-error') {
      return res.status(400).json({ error: "Token inválido ou vazio." });
    }
    return res.status(403).json({ error: "Falha na autorização." });
  }

  const { uid, email, name } = decodedToken;
  let client;

  try {
    client = await pool.connect();

    // (Mantive sua lógica original de Provisionamento aqui para baixo)
    // Passo 1: Tenta inserir o usuário de forma atómica.
    const insertQuery = `
      INSERT INTO ${SCHEMA}.usuario (uid_firebase, id_perfil, email, nome, ativo)
      VALUES ($1, 3, $2, $3, TRUE)
      ON CONFLICT (uid_firebase) DO NOTHING;
    `;
    // Fallback para nome se não vier do Google
    const nomeUsuario = name || email.split('@')[0]; 
    await client.query(insertQuery, [uid, email, nomeUsuario]);

    // Passo 2: Busca o perfil.
    const userQuery = `
      SELECT 
          u.id_usuario, u.nome, u.ativo,
          p.nome AS perfil_nome,
          ARRAY_REMOVE(ARRAY_AGG(r.chave_recurso), NULL) AS recursos
      FROM ${SCHEMA}.usuario u
      JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
      LEFT JOIN ${SCHEMA}.usuario_recursos ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN ${SCHEMA}.recursos r ON ur.id_recurso = r.id_recurso
      WHERE u.uid_firebase = $1
      GROUP BY u.id_usuario, p.nome;
    `;
    
    const { rows } = await client.query(userQuery, [uid]);

    if (rows.length === 0) {
        console.error(`[checkAuth] FALHA CRÍTICA: UID ${uid} não encontrado.`);
        return res.status(500).json({ error: "Falha ao provisionar perfil de usuário." });
    }

    const userProfile = rows[0];
    // console.log(`[checkAuth] Usuário autenticado: ${userProfile.email} (ID: ${userProfile.id_usuario})`);
    req.user = userProfile;
    next();

  } catch (err) {
    console.error("Erro no middleware checkAuth (DB):", err);
    res.status(500).json({ error: "Erro interno ao processar autorização." });
  } finally {
    if (client) client.release();
  }
};


/**
 * Middleware de Autorização (AuthZ)
 * Verifica o req.user (do checkAuth) contra a matriz_permissoes.md
 * Ainda não estou utilizando problemas com login
 */
const checkPermission = (recursoChave, perfisPermitidos) => {
  return (req, res, next) => {
    // req.user foi anexado pelo middleware checkAuth
    const { perfil_nome, recursos } = req.user;

    // 1. Checagem de Visibilidade (Toggle)
    if (recursoChave && !recursos.includes(recursoChave)) {
      return res.status(403).json({ error: `Acesso negado. Requer o toggle de recurso: ${recursoChave}` });
    }
    
    // 2. Checagem de Ação (Perfil)
    if (!perfisPermitidos.includes(perfil_nome)) {
      return res.status(403).json({ error: `Ação não permitida para o seu perfil (${perfil_nome}). Requer um dos: [${perfisPermitidos.join(', ')}]` });
    }

    // 3. Sucesso
    next();
  };
};

// Pool de conexões (BD Postgres)
const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Lista de tabelas permitidas (Plantão Monitor) / evita SQL injection
const TABLES = {
  perfis: "perfil",
  roles: "roles",
  tipos_canal_notificacao: "tipos_canal_notificacao",
  bancos: "banco_dados",
  recursos: "recursos",
  usuarios: "usuario",
  configuracoes_notificacao: "configuracoes_notificacao",
  usuario_recursos: "usuario_recursos",
  escalas: "escala",
  regras: "regra",
  regras_roles: "regra_role",
  incidentes: "incidente",
  log_execucoes: "log_execucoes_regras",
  log_notificacoes: "log_notificacoes",
  log_auditoria: "log_auditoria_alteracoes",
};

// FUNÇÕES UTILITÁRIAS

/**
 * selectAll(tableKey)
 * - tableKey: chave amigável (ex: "usuarios", "regras")
 * - valida e executa SELECT * FROM <table>
 */
async function selectAll(tableKey) {
  const tableName = TABLES[tableKey];
  if (!tableName) {
    const error = new Error("Tabela não permitida");
    error.code = "TABLE_NOT_ALLOWED";
    throw error;
  }

  const client = await pool.connect();
  try {
    // Usamos ORDER BY 1 para dar uma ordem estável por PK
    const q = `SELECT * FROM ${SCHEMA}.${tableName} ORDER BY 1;`;
    const { rows } = await client.query(q);
    // Aplicamos a conversão de linha
    return rows;
    /**      * se surgir alguma tabela que precisa ser convertida utilizaremos o
     * rows.map(convertRow) no return, e lembrar de adicionar a função a este
     * script.
     */  
  } finally {
    client.release();
  }
}

/**
 * selectIncidentesFiltrados(filtros)
 * - Busca incidentes com base em filtros (status, prioridade)
 * - Constrói uma query SQL parametrizada e segura para evitar SQL Injection.
 */
async function selectIncidentesFiltrados(filtros = {}) {
  const { status, prioridade } = filtros;

  const client = await pool.connect();
  try {
    const condicoes = []; 
    const valores = []; 
    let queryIndex = 1;

    if (status) {
      const statusValidos = ['ABERTO', 'RECONHECIDO', 'FECHADO'];
      if (statusValidos.includes(status.toUpperCase())) {
        condicoes.push(`status = $${queryIndex}`);
        valores.push(status.toUpperCase());
        queryIndex++;
      }
    }

    const prioridadeVal = asInteger(prioridade);
    if (prioridadeVal) {
      condicoes.push(`prioridade_registro = $${queryIndex}`);
      valores.push(prioridadeVal);
      queryIndex++;
    }

    // CORREÇÃO AQUI: Query encostada na margem esquerda para evitar caracteres ocultos
    let q = `SELECT i.*, r.nome as nome_regra FROM ${SCHEMA}.incidente i LEFT JOIN ${SCHEMA}.regra r ON i.id_regra = r.id_regra`;

    if (condicoes.length > 0) {
      q += ` WHERE ${condicoes.join(' AND ')}`;
    }
    
    q += ` ORDER BY data_abertura DESC;`; 
    
    const { rows } = await client.query(q, valores);
    return rows;

  } finally {
    client.release();
  }
}

/**
 * selectRegrasFiltradas(filtros)
 * - Busca regras com base em filtros (prioridade, nome)
 * - Constrói uma query SQL parametrizada e segura.
 */
async function selectRegrasFiltradas(filtros = {}) {
  const { prioridade, nome } = filtros;

  const client = await pool.connect();
  try {
    const condicoes = []; // Array para as condições (ex: "prioridade = $1")
    const valores = [];   // Array para os valores (ex: [1])
    let queryIndex = 1;

    // Adiciona filtro de prioridade, se fornecido
    const prioridadeVal = asInteger(prioridade); // Reutiliza a função helper
    if (prioridadeVal) {
      condicoes.push(`prioridade = $${queryIndex}`);
      valores.push(prioridadeVal);
      queryIndex++;
    }

    // Adiciona filtro de nome (pesquisa "contém", case-insensitive)
    if (nome && typeof nome === 'string' && nome.trim().length > 0) {
      condicoes.push(`nome ILIKE $${queryIndex}`);
      valores.push(`%${nome.trim()}%`);
      queryIndex++;
    }

    // Monta a query final
    let q = `
            SELECT 
                r.*, 
                ARRAY_REMOVE(ARRAY_AGG(rr.id_role), NULL) AS roles_id 
            FROM ${SCHEMA}.regra r
            LEFT JOIN ${SCHEMA}.regra_role rr ON r.id_regra = rr.id_regra
        `;
        if (condicoes.length > 0) {
          q += ` WHERE ${condicoes.join(' AND ')}`;
        }
        
        // Agrupa e ordena
        q += ` GROUP BY r.id_regra ORDER BY nome ASC;`;
    
    // Executa a query segura (parametrizada)
    const { rows } = await client.query(q, valores);
    return rows;

  } finally {
    client.release();
  }
}

/**
 * selectUsuariosFiltrados(filtros)
 * - Busca usuários com base em filtros (id_perfil, pesquisa por nome/email)
 * - Constrói uma query SQL parametrizada e segura.
 */
async function selectUsuariosFiltrados(filtros = {}) {
  const { id_perfil, pesquisa } = filtros;

  const client = await pool.connect();
  try {
    const condicoes = []; // Array para as condições (ex: "id_perfil = $1")
    const valores = [];   // Array para os valores (ex: [1])
    let queryIndex = 1;

    // Adiciona filtro de Perfil, se fornecido
    const idPerfilVal = asInteger(id_perfil); // Reutiliza a função helper
    if (idPerfilVal) {
      condicoes.push(`id_perfil = $${queryIndex}`);
      valores.push(idPerfilVal);
      queryIndex++;
    }

    // Adiciona filtro de pesquisa (nome OU email, case-insensitive)
    if (pesquisa && typeof pesquisa === 'string' && pesquisa.trim().length > 0) {
      // (nome ILIKE $X OR email ILIKE $X)
      condicoes.push(`(nome ILIKE $${queryIndex} OR email ILIKE $${queryIndex})`);
      valores.push(`%${pesquisa.trim()}%`);
      queryIndex++;
    }

    // Monta a query final
    // Nota: O SELECT * aqui é seguro, pois é na nossa tabela de usuários.
    let q = `SELECT * FROM ${SCHEMA}.usuario`;
    if (condicoes.length > 0) {
      q += ` WHERE ${condicoes.join(' AND ')}`;
    }
    
    // Ordena por nome
    q += ` ORDER BY nome ASC;`; 
    
    // Executa a query segura (parametrizada)
    const { rows } = await client.query(q, valores);
    return rows;

  } finally {
    client.release();
  }
}

/**
 * Tenta converter um valor para um Inteiro positivo.
 * Retorna null se não for um inteiro > 0.
 */
function asInteger(v) {
  const n = Number(v);
  if (Number.isInteger(n) && n > 0) {
    return n;
  }
  return null;
}

/**
 * Normaliza uma entrada (string, data) para um timestamp ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
 * Retorna null se a data for inválida.
 */
function normalizeDateToISO(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // Formato do 'TIMESTAMP WITH TIME ZONE'
}

/**
 * Calcula o status dinâmico de uma regra (Ativa, Adiada, Silenciada)
 */
function calcularStatusRegra(regra) {
  const agora = new Date();
  
  // Checa se está Adiada
  if (regra.data_adiar_inicio && regra.data_adiar_fim) {
    // Converte as strings ISO do banco para objetos Date para comparar
    if (agora >= new Date(regra.data_adiar_inicio) && agora <= new Date(regra.data_adiar_fim)) {
      return 'Adiada';
    }
  }
  
  // Checa se está Silenciada
  if (regra.data_silenciar_inicio && regra.data_silenciar_fim) {
    if (agora >= new Date(regra.data_silenciar_inicio) && agora <= new Date(regra.data_silenciar_fim)) {
      return 'Silenciada';
    }
  }
  
  // Senão, está Ativa
  return 'Ativa';
}

// -------------------------
// ROTAS DO PLANTÃO MONITOR (AGORA PROTEGIDAS)
// -------------------------

// ----------------------------------
// ENDPOINTS PARA TABELAS AUXILIARES 
// ----------------------------------

app.get("/perfis", async (req, res) => {
  try {
    const data = await selectAll("perfis");
    res.json(data);
  } catch (error) {
    console.error("ERROR /perfis", error);
    res.status(500).json({error: "Erro ao buscar perfis"});
  }
});

app.get("/bancos", async (req, res) => {
  try {
    const data = await selectAll("bancos");
    res.json(data);
  } catch (error) {
    console.error("ERROR /bancos", error);
    res.status(500).json({error: "Erro ao buscar bancos"})
  }
});

app.get("/roles", checkAuth, async (req, res) => {
  try {
    const data = await selectAll("roles");
    res.json(data);
  } catch (error) {
    console.error("ERROR /roles", error);
    res.status(500).json({ error: "Erro ao buscar roles"})
  }
});

app.get("/tipos_canal_notificacao", async (req, res) => {
  try {
    const data = await selectAll("tipos_canal_notificacao");
    res.json(data);
  } catch (error) {
    console.error("ERROR /tipos_canal_notificacao", error);
    res.status(500).json({ error: "Erro ao buscar tipos de canal" })
  }
});

app.get("/recursos", async (req, res) => {
  try {
   const data = await selectAll("recursos");
   res.json(data); 
  } catch (error) {
    console.error("ERROR /recursos", error);
    res.status(500).json({ error: "Erro ao buscar recursos" });
  }
});

app.get("/usuario_recursos", async (req, res) => {
  try {
    const data = await selectAll("usuario_recursos");
    res.json(data);
  } catch (error) {
    console.error("ERROR /usuario_recursos", error);
    res.status(500).json({ error: "Erro ao buscar recursos" });
  }
});

app.get("/configuracoes_notificacao", async (req, res) => {
  try {
   const data = await selectAll("configuracoes_notificacao");
   res.json(data); 
  } catch (error) {
    console.error("ERROR /configuracoes_notificacao", error);
    res.status(500).json({ error: "Erro ao buscar configurações de notificação" })
  }
});

// ----------------------------------
// ENDPOINTS PARA TABELAS PRINCIPAIS 
// ----------------------------------

// TABELA USUARIO
app.get("/usuarios", checkAuth, async (req, res) => {
  try {
    const { id_perfil, pesquisa } = req.query;
    const data = await selectUsuariosFiltrados({ id_perfil, pesquisa });
    res.json(data)
  } catch (error) {
    console.error("ERROR /usuarios", error)
    res.status(500).json({error: "Erro ao buscar usuarios"})
  }
});


// TELA DE PERFIL DO USUÁRIO
// (ATUALIZADO: Rota /eu/detalhes para o próprio usuário)
app.get("/usuarios/eu/detalhes", async (req, res) => {
  // Pega o ID do token verificado, não do parâmetro
  const idUsuarioVal = req.user.id_usuario; 

  const client = await pool.connect();
  try {
    // Query 1: Buscar a informação principal do usuário
    const userQuery = `
      SELECT 
        u.id_usuario, u.email, u.nome, 
        u.notificacao_push_som, u.notificacao_janela_inicio, u.notificacao_janela_fim, 
        u.ativo, u.id_perfil, p.nome as nome_perfil
      FROM ${SCHEMA}.usuario u
      JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
      WHERE u.id_usuario = $1;
    `;
    const userRes = await client.query(userQuery, [idUsuarioVal]);

    if (userRes.rows.length === 0) {
      // Isso não deve acontecer se o checkAuth funcionou
      return res.status(404).json({ error: "Usuário do token não encontrado no banco." });
    }
    const usuario = userRes.rows[0];

    // Query 2: Buscar as configurações de notificação (para os toggles)
    const configQuery = `
      SELECT 
        c.id_configuracao_notificacao, 
        c.id_tipo_canal, 
        c.endereco_notificacao, 
        c.habilitado, 
        c.nome_dispositivo, 
        t.nome AS nome_canal
      FROM ${SCHEMA}.configuracoes_notificacao c
      JOIN ${SCHEMA}.tipos_canal_notificacao t ON c.id_tipo_canal = t.id_tipo_canal
      WHERE c.id_usuario = $1
      ORDER BY t.nome;
    `;
    const configRes = await client.query(configQuery, [idUsuarioVal]);

    // Combina as duas queries na resposta
    const resposta = {
      info: usuario,
      configuracoes: configRes.rows // Um array com as preferências (toggles)
    };
    
    res.json(resposta);

  } catch (error) {
    console.error(`ERROR /usuarios/eu/detalhes`, error);
    res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
  } finally {
    if (client) client.release();
  }
});

// (Protegido: Admin pode ver detalhes de *qualquer* usuário)
app.get("/usuarios/:id/detalhes", async (req, res) => {
  const { id } = req.params;
  const idUsuarioVal = asInteger(id);

  if (!idUsuarioVal) {
    return res.status(400).json({ error: "ID de usuário inválido." });
  }

  const client = await pool.connect();
  try {
    // Query 1: Buscar a informação principal do usuário
    const userQuery = `
      SELECT 
        u.id_usuario, u.email, u.nome, 
        u.notificacao_push_som, u.notificacao_janela_inicio, u.notificacao_janela_fim, 
        u.ativo, u.id_perfil, p.nome as nome_perfil
      FROM ${SCHEMA}.usuario u
      JOIN ${SCHEMA}.perfil p ON u.id_perfil = p.id_perfil
      WHERE u.id_usuario = $1;
    `;
    const userRes = await client.query(userQuery, [idUsuarioVal]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    const usuario = userRes.rows[0];

    // Query 2: Buscar as configurações de notificação (para os toggles)
    const configQuery = `
      SELECT 
        c.id_configuracao_notificacao, 
        c.id_tipo_canal, 
        c.endereco_notificacao, 
        c.habilitado, 
        c.nome_dispositivo, 
        t.nome AS nome_canal
      FROM ${SCHEMA}.configuracoes_notificacao c
      JOIN ${SCHEMA}.tipos_canal_notificacao t ON c.id_tipo_canal = t.id_tipo_canal
      WHERE c.id_usuario = $1
      ORDER BY t.nome;
    `;
    const configRes = await client.query(configQuery, [idUsuarioVal]);

    // Combina as duas queries na resposta
    const resposta = {
      info: usuario,
      configuracoes: configRes.rows // Um array com as preferências (toggles)
    };
    
    res.json(resposta);

  } catch (error) {
    console.error(`ERROR /usuarios/${idUsuarioVal}/detalhes`, error);
    res.status(500).json({ error: "Erro ao buscar detalhes do usuário" });
  } finally {
    if (client) client.release();
  }
});

// (Rota de 'POST /usuarios' removida)
// Esta nova rota PUT é para o Admin (RF03) configurar o usuário

/**
 * Endpoint de Configuração de Usuário (RF03)
 * Atende ao modal de Adicionar/Editar usuário
 * Permite ao Admin ativar, definir perfil e permissões (toggles).
 */
app.put("/usuarios/:id/configuracao", async (req, res) => {
  const { id } = req.params;
  const idUsuarioParaConfigurar = asInteger(id);

  if (!idUsuarioParaConfigurar) {
    return res.status(400).json({ error: "ID de usuário inválido." });
  }

  // O body esperado é o que o Admin define na tela
  const {
    id_perfil,
    ativo,
    recursos, // Array de IDs de recursos (toggles), ex: [1, 2]
    notificacoes // Array de objetos, ex: [{ id_tipo_canal: 2, endereco_notificacao: "email@..."}, ...]
  } = req.body || {};

  // 1. Validação
  const idPerfilVal = asInteger(id_perfil);
  if (!idPerfilVal) {
    return res.status(400).json({ error: "id_perfil é obrigatório e deve ser um número inteiro positivo." });
  }
  
  // Validar 'recursos' (toggles) - pode ser array vazio
  const recursosVal = (Array.isArray(recursos) ? recursos : []).map(asInteger).filter(id => id !== null);
  
  // Validar 'notificacoes' (canais) - pode ser array vazio
  const notificacoesVal = (Array.isArray(notificacoes) ? notificacoes : []).filter(n => 
    asInteger(n.id_tipo_canal) && n.endereco_notificacao
  );
  
  // 2. Atualização no Banco (Transação)
  const client = await pool.connect();
  try {
    // Inicia a transação
    await client.query('BEGIN');

    // --- Passo 1: Atualizar a tabela 'usuario' (perfil e status ativo)
    // (MODIFICADO: 'ativo' agora é controlado pelo Admin. Se a funcionalidade foi removida,
    // o 'ativo' que vier do body será usado. Se o admin não mandar, será 'undefined'
    // e o 'Boolean(undefined)' vira 'false'. Vamos garantir que seja 'true' se
    // a funcionalidade de ativação foi removida, ou usar o valor do body se veio.)
    const statusAtivo = (ativo === undefined) ? true : Boolean(ativo);
    
    const updateUsuarioQuery = `
      UPDATE ${SCHEMA}.usuario 
      SET 
        id_perfil = $1,
        ativo = $2
      WHERE id_usuario = $3;
    `;
    // Usamos 'statusAtivo' aqui
    await client.query(updateUsuarioQuery, [idPerfilVal, statusAtivo, idUsuarioParaConfigurar]);

    // --- Passo 2: Atualizar 'usuario_recursos' (M:N) (Toggles)
    // Abordagem "Delete-then-Insert": mais simples de implementar
    await client.query(`DELETE FROM ${SCHEMA}.usuario_recursos WHERE id_usuario = $1`, [idUsuarioParaConfigurar]);
    
    if (recursosVal.length > 0) {
      const insertRecursosQuery = 'INSERT INTO ' + `${SCHEMA}.usuario_recursos` + ' (id_usuario, id_recurso) VALUES ' + 
          recursosVal.map((id, index) => `($1, $${index + 2})`).join(', ');
      await client.query(insertRecursosQuery, [idUsuarioParaConfigurar, ...recursosVal]);
    }

    // --- Passo 3: Atualizar 'configuracoes_notificacao' (1:N) (Canais)
    // (Esta lógica pode ser complexa - por enquanto, vamos só atualizar o que foi enviado)
    // (Uma API PUT/PATCH mais robusta lidaria com adição/remoção/edição individual)
    await client.query(`DELETE FROM ${SCHEMA}.configuracoes_notificacao WHERE id_usuario = $1`, [idUsuarioParaConfigurar]);

    if (notificacoesVal.length > 0) {
      const insertNotificacoesQuery = 'INSERT INTO ' + `${SCHEMA}.configuracoes_notificacao` + 
          ' (id_usuario, id_tipo_canal, endereco_notificacao, habilitado, nome_dispositivo) VALUES ' + 
          notificacoesVal.map((n, i) => 
            `($1, $${i*5 + 2}, $${i*5 + 3}, $${i*5 + 4}, $${i*5 + 5})`
          ).join(', ');
      
      const notificacoesValues = notificacoesVal.flatMap(n => 
        [
          asInteger(n.id_tipo_canal), 
          n.endereco_notificacao, 
          n.habilitado !== false, // Default true
          n.nome_dispositivo || null
        ]
      );
      
      await client.query(insertNotificacoesQuery, [idUsuarioParaConfigurar, ...notificacoesValues]);
    }

    // Finaliza a transação
    await client.query('COMMIT');
    
    // Sucesso (200 - OK)
    return res.status(200).json({ message: "Configurações do usuário atualizadas com sucesso." });

  } catch (err) {
    // Se algo der errado, desfaz a transação
    await client.query('ROLLBACK');

    // Violação de FK (ex: id_perfil não existe) -> code 23503
    if (err && err.code === "23503") {
      return res.status(409).json({ error: "Falha ao configurar usuário: id_perfil ou outro ID referenciado não foi encontrado." });
    }
    // Outros erros
    console.error(`Erro ao configurar usuário ${idUsuarioParaConfigurar}:`, err);
    return res.status(500).json({ error: "Erro interno ao configurar usuário" });
  } finally {
    if (client) client.release();
  }
});


//TABELA ESCALA
app.get("/escalas", async (req, res) => {
  try {
    const data = await selectAll("escalas");
    res.json(data)
  } catch (error) {
    console.error("ERROR /escalas", error)
    res.status(500).json({error: "Erro ao buscar escalas"})
  }
});

app.post("/escalas", checkAuth, async (req, res) => {
  const { id_usuario, id_role, data_inicio, data_fim } = req.body || {};

  // 1. Validação dos campos obrigatórios (NOT NULL)
  if (!id_usuario || !id_role || !data_inicio || !data_fim) {
    return res.status(400).json({ error: "Campos obrigatórios: id_usuario, id_role, data_inicio, data_fim" });
  }

  // 2. Normalização e Validação de Tipos
  const idUsuarioVal = asInteger(id_usuario);
  const idRoleVal = asInteger(id_role); 
  
  if (!idUsuarioVal || !idRoleVal) { 
    return res.status(400).json({ error: "id_usuario e id_role devem ser números inteiros positivos." });
  }

  const dataInicioVal = normalizeDateToISO(data_inicio);
  const dataFimVal = normalizeDateToISO(data_fim);
  if (!dataInicioVal || !dataFimVal) {
    return res.status(400).json({ error: "data_inicio ou data_fim inválidas. Use uma data válida." });
  }

  // Validação de regra de negócio (CK_escala_datas)
  if (new Date(dataFimVal) <= new Date(dataInicioVal)) {
    return res.status(400).json({ error: "data_fim deve ser maior que data_inicio." });
  }

  // 3. Inserção no Banco
  const client = await pool.connect();
  try {
    // CORREÇÃO: Adicionado ${SCHEMA} para consistência
    const insertQuery = `
      INSERT INTO ${SCHEMA}.escala (id_usuario, id_role, data_inicio, data_fim)
      VALUES ($1, $2, $3, $4)
      RETURNING id_escala, id_usuario, id_role, data_inicio, data_fim;
    `;
    const values = [idUsuarioVal, idRoleVal, dataInicioVal, dataFimVal];
    
    const { rows } = await client.query(insertQuery, values);
    
    // Sucesso (201 - Created)
    return res.status(201).json(rows[0]);

  } catch (error) {
    // Violação de chave estrangeira (ex: id_usuario ou id_role não existe) -> code 23503
    if (error && error.code === "23503") {
      return res.status(409).json({ error: "Usuário (id_usuario) ou Role (id_role) não encontrado." });
    }
    // Outros erros
    console.error("Erro ao inserir escala:", error);
    return res.status(500).json({ error: "Erro interno ao cadastrar escala" });
  } finally {
    if (client) client.release();
  }
});


// TABELA INCIDENTE
app.get("/incidentes", checkAuth, async (req, res) => {
  try {
    const { status, prioridade } = req.query;

    const data = await selectIncidentesFiltrados( {status, prioridade} );
    res.json(data)
  } catch (error) {
    console.error("ERROR /incidentes", error)
    res.status(500).json({error: "Erro ao buscar incidentes"})
  }
});

app.get("/incidentes/:id/detalhes", checkAuth, async (req, res) => {
  const { id } = req.params;
  const idIncidenteVal = asInteger(id);

  if (!idIncidenteVal) {
    return res.status(400).json({ error: "ID de incidente inválido." });
  }

  const client = await pool.connect();
  try {
    // Query única que busca o incidente e os nomes (regra, usuario_ack, usuario_fechamento)
    const query = `
      SELECT 
        i.*,
        r.nome AS nome_regra,
        u_ack.nome AS nome_usuario_ack,
        u_close.nome AS nome_usuario_fechamento
      FROM ${SCHEMA}.incidente i
      LEFT JOIN ${SCHEMA}.regra r ON i.id_regra = r.id_regra
      LEFT JOIN ${SCHEMA}.usuario u_ack ON i.id_usuario_ack = u_ack.id_usuario
      LEFT JOIN ${SCHEMA}.usuario u_close ON i.id_usuario_fechamento = u_close.id_usuario
      WHERE i.id_incidente = $1;
    `;
    
    const { rows } = await client.query(query, [idIncidenteVal]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Incidente não encontrado." });
    }
    
    res.json(rows[0]); // Retorna o objeto único com todos os dados

  } catch (error) {
    console.error(`ERROR /incidentes/${idIncidenteVal}/detalhes`, error);
    res.status(500).json({ error: "Erro ao buscar detalhes do incidente" });
  } finally {
    if (client) client.release();
  }
});

// Aqui já é necessário um middleware de verificação de perfil
// FUNCIONALIDADE DE ACK DO INCIDENTE 
app.post("/incidentes/:id/ack", checkAuth, async (req, res) => {
  const { id } = req.params;
  const id_usuario_ack = req.user.id_usuario; 

  const idIncidenteVal = asInteger(id);
  const idUsuarioVal = asInteger(id_usuario_ack);

  if (!idIncidenteVal || !idUsuarioVal) {
    return res.status(400).json({ error: "ID do incidente e id_usuario_ack são obrigatórios e devem ser inteiros." });
  }

  const client = await pool.connect();
  try {
    // Usamos UPDATE ... WHERE status = 'ABERTO'
    // Se dois operadores clicarem,
    // apenas o primeiro terá sucesso.
    const updateQuery = `
      UPDATE ${SCHEMA}.incidente
      SET 
        status = 'RECONHECIDO',
        data_ack = CURRENT_TIMESTAMP,
        id_usuario_ack = $1
      WHERE
        id_incidente = $2
        AND status = 'ABERTO' -- Importante: Só pode dar ACK em incidentes ABERTOS
      RETURNING *;
    `;
    
    const { rows } = await client.query(updateQuery, [idUsuarioVal, idIncidenteVal]);

    if (rows.length === 0) {
      // Se rows = 0, ou o incidente não existe (404)
      // ou ele não estava 'ABERTO' (409 Conflict)
      return res.status(409).json({ error: "Incidente não encontrado ou já estava Reconhecido/Fechado." });
    }
    
    res.json(rows[0]); // Retorna o incidente atualizado

  } catch (error) {
    // Violação de FK (usuário não existe)
    if (error && error.code === "23503") {
      return res.status(404).json({ error: "Usuário (id_usuario_ack) não encontrado." });
    }
    console.error(`ERROR /incidentes/${idIncidenteVal}/ack`, error);
    res.status(500).json({ error: "Erro interno ao reconhecer incidente" });
  } finally {
    if (client) client.release();
  }
});

// Funcionalidade de CLOSE DO INCIDENTE
app.post("/incidentes/:id/close", checkAuth, async (req, res) => {
  const { id } = req.params;
  const { comentario_incidente } = req.body;

  const id_usuario_fechamento = req.user.id_usuario;

  const idIncidenteVal = asInteger(id);
  const idUsuarioVal = asInteger(id_usuario_fechamento);

  if (!idIncidenteVal || !idUsuarioVal) {
    return res.status(400).json({ error: "ID do incidente e id_usuario_fechamento são obrigatórios." });
  }
  
  const comentarioVal = (comentario_incidente && String(comentario_incidente).trim()) ? String(comentario_incidente).trim() : null;

  const client = await pool.connect();
  try {
    const updateQuery = `
          UPDATE ${SCHEMA}.incidente
          SET 
            status = 'FECHADO',
            data_fechamento = CURRENT_TIMESTAMP,
            id_usuario_fechamento = $1,
            comentario_incidente = $2
          WHERE
            id_incidente = $3
            AND status = 'RECONHECIDO'
          RETURNING *;
        `;
        
        // LOG DE DEBUG: Veja exatamente a string que está indo para o banco
        console.log("DEBUG QUERY:", updateQuery);
    
    const { rows } = await client.query(updateQuery, [idUsuarioVal, comentarioVal, idIncidenteVal]);

    if (rows.length === 0) {
      // Se rows = 0, ou o incidente não existe (404 não encontrado)
      // ou ele não estava 'RECONHECIDO' (409 Conflito)
      return res.status(409).json({ error: "Incidente não encontrado ou não estava 'Reconhecido' (deve-se dar ACK primeiro)." });
    }
    
    res.json(rows[0]); // Retorna o incidente atualizado

  } catch (error) {
    // Violação de FK (usuário não existe)
    if (error && error.code === "23503") {
      return res.status(404).json({ error: "Usuário (id_usuario_fechamento) não encontrado." });
    }
    console.error(`ERROR /incidentes/${idIncidenteVal}/close`, error);
    res.status(500).json({ error: "Erro interno ao fechar incidente" });
  } finally {
    if (client) client.release();
  }
});


// GET DE KPIS
// Todos os usuários logados podem ver)
app.get("/kpis", checkAuth, async (req, res) => {

  // 1. Queries Limpas (tava tando MUITO ERRO de sintaxe e deixei todas retas)
  const plantonistaQuery = `SELECT u.nome, e.data_inicio, e.data_fim FROM ${SCHEMA}.escala e JOIN ${SCHEMA}.usuario u ON e.id_usuario = u.id_usuario WHERE NOW() BETWEEN e.data_inicio AND e.data_fim ORDER BY e.data_inicio ASC LIMIT 1;`;

  const contagensQuery = `SELECT COUNT(*) FILTER (WHERE status = 'ABERTO') AS abertos, COUNT(*) FILTER (WHERE status = 'RECONHECIDO') AS reconhecidos FROM ${SCHEMA}.incidente;`;

  const metricasQuery = `SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_ack - data_abertura)) / 60)), 0) AS mtta_minutos, COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (data_fechamento - data_abertura)) / 60)), 0) AS mttr_minutos FROM ${SCHEMA}.incidente WHERE status IN ('RECONHECIDO', 'FECHADO');`;

  const client = await pool.connect();
  try {
    const [plantonistaRes, contagensRes, metricasRes] = await Promise.all([
      client.query(plantonistaQuery),
      client.query(contagensQuery),
      client.query(metricasQuery)
    ]);

    // 2. Verificação Defensiva (Garante que .rows existe antes de acessar)
    const plantonistaRow = (plantonistaRes && plantonistaRes.rows) ? plantonistaRes.rows[0] : null;
    const contagensRow = (contagensRes && contagensRes.rows) ? contagensRes.rows[0] : { abertos: 0, reconhecidos: 0 };
    const metricasRow = (metricasRes && metricasRes.rows) ? metricasRes.rows[0] : { mtta_minutos: 0, mttr_minutos: 0 };

    const resposta = {
      plantonista_atual: plantonistaRow,
      contagens: {
        abertos: Number(contagensRow.abertos || 0),
        reconhecidos: Number(contagensRow.reconhecidos || 0)
      },
      metricas: {
        mtta_minutos: Number(metricasRow.mtta_minutos || 0),
        mttr_minutos: Number(metricasRow.mttr_minutos || 0)
      }
    };

    res.json(resposta);

  } catch (error) {
    console.error("ERROR /kpis", error);
    res.status(500).json({ error: "Erro ao buscar KPIs" });
  } finally {
    if (client) client.release();
  }
});


// TABELA REGRA
app.get("/regras", checkAuth, async (req, res) => {
  try {
    const { prioridade, nome } = req.query;
    const data = await selectRegrasFiltradas({ prioridade, nome });
    res.json(data)
  } catch (error) {
    console.error("ERROR /regras", error)
    res.status(500).json({error: "Erro ao buscar regras"})
  }
});

app.get("/regras/:id/detalhes", checkAuth, async (req, res) => {
  const { id } = req.params;
  const idRegraVal = asInteger(id);
  
  if (!idRegraVal) {
    return res.status(400).json({ error: "ID da regra deve ser um número inteiro positivo." });
  }

  const client = await pool.connect();
  try {
    // Query 1: Limpa e em linha única
    const regraQuery = `SELECT r.*, criador.nome AS nome_criador, atualizador.nome AS nome_atualizador FROM ${SCHEMA}.regra r LEFT JOIN ${SCHEMA}.usuario criador ON r.id_usuario_criador = criador.id_usuario LEFT JOIN ${SCHEMA}.usuario atualizador ON r.id_usuario_atualizacao = atualizador.id_usuario WHERE r.id_regra = $1;`;
    
    // Query 2: Limpa e em linha única
    const logQuery = `SELECT * FROM ${SCHEMA}.log_execucoes_regras WHERE id_regra = $1 ORDER BY data_execucao DESC LIMIT 1;`;

    // Executa as queries
    const regraRes = await client.query(regraQuery, [idRegraVal]);
    
    if (regraRes.rows.length === 0) {
      return res.status(404).json({ error: "Regra não encontrada." });
    }
    
    const regra = regraRes.rows[0];
    
    // Segunda query (log)
    const logRes = await client.query(logQuery, [idRegraVal]);
    const ultimoLog = logRes.rows.length > 0 ? logRes.rows[0] : null;

    // Calcular o status (Ativa/Adiada/Silenciada)
    const statusCalculado = calcularStatusRegra(regra);

    // Montar a resposta
    const resposta = {
      info: {
        ...regra,
        status_calculado: statusCalculado, 
      },
      ultimo_log: ultimoLog 
    };

    res.json(resposta);

  } catch (error) {
    console.error(`ERROR /regras/${idRegraVal}/detalhes`, error);
    res.status(500).json({ error: "Erro ao buscar detalhes da regra" });
  } finally {
    if (client) client.release();
  }
});

app.post("/regras", checkAuth, async (req, res) => {
  const {
    id_banco_dados,
    nome,
    consulta_sql,
    intervalo_minutos,
    qnt_erro_max,
    prioridade,
    roles, // Espera um array de IDs de roles, ex: [1, 2]
    // Campos opcionais
    descricao,
    janela_inicio,
    janela_fim,
    data_adiar_inicio,
    data_adiar_fim,
    data_silenciar_inicio,
    data_silenciar_fim,
  } = req.body || {};
  
  const id_usuario_criador = req.user.id_usuario;

  // 1. Validação dos campos obrigatórios (NOT NULL)
  if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos || !id_usuario_criador) {
    return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos" });
  }
  
  if (!Array.isArray(roles) || roles.length === 0) {
     return res.status(400).json({ error: "O campo 'roles' é obrigatório e deve ser um array de IDs (ex: [1, 2])." });
  }

  // 2. Normalização e Validação de Tipos
  const idBancoVal = asInteger(id_banco_dados);
  const idUsuarioCriadorVal = asInteger(id_usuario_criador);
  const intervaloVal = asInteger(intervalo_minutos);
  // Defaults do Schema
  const prioridadeVal = asInteger(prioridade) || 3; 
  const qntErroMaxVal = Number(qnt_erro_max) >= 0 ? Number(qnt_erro_max) : 1;

  if (!idBancoVal || !idUsuarioCriadorVal || !intervaloVal) {
     return res.status(400).json({ error: "id_banco_dados, id_usuario_criador e intervalo_minutos devem ser números inteiros positivos." });
  }
  
  // Validar o array de roles
  const rolesVal = roles.map(asInteger).filter(id => id !== null);
  if (rolesVal.length !== roles.length || rolesVal.length === 0) {
    return res.status(400).json({ error: "O array 'roles' deve conter apenas números inteiros positivos." });
  }

  // 3. Inserção no Banco (Transação)
  const client = await pool.connect();
  try {
    // Inicia a transação
    await client.query('BEGIN');

    // --- Passo 1: Inserir na tabela 'regra'
    const insertRegraQuery = `
      INSERT INTO ${SCHEMA}.regra (
        id_banco_dados, nome, consulta_sql, intervalo_minutos, qnt_erro_max, prioridade, 
        id_usuario_criador, descricao, janela_inicio, janela_fim,
        data_adiar_inicio, data_adiar_fim, data_silenciar_inicio, data_silenciar_fim,
        data_criacao
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      RETURNING *; 
    `;
    const regraValues = [
      idBancoVal, nome, consulta_sql, intervaloVal, qntErroMaxVal, prioridadeVal,
      idUsuarioCriadorVal, 
      descricao || null, 
      janela_inicio || '00:00:00', // Default do Schema
      janela_fim || '23:59:59', // Default do Schema
      normalizeDateToISO(data_adiar_inicio), 
      normalizeDateToISO(data_adiar_fim),
      normalizeDateToISO(data_silenciar_inicio), 
      normalizeDateToISO(data_silenciar_fim)
    ];
    
    const { rows: regraRows } = await client.query(insertRegraQuery, regraValues);
    const novaRegra = regraRows[0];

    // --- Passo 2: Inserir na tabela 'regra_role' (M:N)
    const newRegraId = novaRegra.id_regra;
    
    // Prepara a query de M:N
    const insertRolesQuery = 'INSERT INTO ' + `${SCHEMA}.regra_role` + ' (id_regra, id_role) VALUES ' + 
        rolesVal.map((id, index) => `($1, $${index + 2})`).join(', ');

    await client.query(insertRolesQuery, [newRegraId, ...rolesVal]);

    // Finaliza a transação
    await client.query('COMMIT');
    
    // Sucesso (201 - Created)
    // Retorna a regra criada E os roles associados (para o frontend atualizar o estado)
    return res.status(201).json({ ...novaRegra, roles: rolesVal });

  } catch (err) {
    // Se algo der errado, desfaz a transação
    await client.query('ROLLBACK');

    // Violação de chave estrangeira (ex: id_usuario, id_banco_dados ou um id_role não existe) -> code 23503
    if (err && err.code === "23503") {
      return res.status(409).json({ error: "Falha ao criar regra: id_banco_dados, id_usuario_criador ou um dos IDs em 'roles' não foi encontrado." });
    }
    // Outros erros
    console.error("Erro ao inserir regra:", err);
    return res.status(500).json({ error: "Erro interno ao cadastrar regra" });
  } finally {
    if (client) client.release();
  }
});

app.put("/regras/:id", checkAuth, async (req, res) => {
  const { id } = req.params;
  const idRegraVal = asInteger(id);

  // Pega o usuário que está fazendo a alteração para logar (futuro)
  const id_usuario_atualizacao = req.user.id_usuario;

  if (!idRegraVal) {
    return res.status(400).json({ error: "ID da regra inválido." });
  }

  // Desestruturação do Body (Mesmos campos do POST)
  const {
    id_banco_dados,
    nome,
    consulta_sql,
    intervalo_minutos,
    qnt_erro_max,
    prioridade,
    roles, // Array de IDs [1, 2]
    descricao,
    janela_inicio,
    janela_fim,
    data_adiar_inicio,
    data_adiar_fim,
    data_silenciar_inicio,
    data_silenciar_fim,
  } = req.body || {};

  // 1. Validação Básica (Campos Obrigatórios)
  // Nota: id_banco_dados raramente muda, mas permitimos.
  if (!id_banco_dados || !nome || !consulta_sql || !intervalo_minutos) {
    return res.status(400).json({ error: "Campos obrigatórios: id_banco_dados, nome, consulta_sql, intervalo_minutos" });
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: "O campo 'roles' é obrigatório e deve ser um array de IDs." });
  }

  // 2. Normalização
  const idBancoVal = asInteger(id_banco_dados);
  const intervaloVal = asInteger(intervalo_minutos);
  const prioridadeVal = asInteger(prioridade) || 3;
  const qntErroMaxVal = Number(qnt_erro_max) >= 0 ? Number(qnt_erro_max) : 1;
  const rolesVal = roles.map(asInteger).filter(id => id !== null);

  const client = await pool.connect();
  try {
    // --- INÍCIO DA TRANSAÇÃO ---
    await client.query('BEGIN');

    // Passo A: Atualizar a tabela principal 'regra'
    const updateQuery = `
      UPDATE ${SCHEMA}.regra
      SET
        id_banco_dados = $1,
        nome = $2,
        consulta_sql = $3,
        intervalo_minutos = $4,
        qnt_erro_max = $5,
        prioridade = $6,
        descricao = $7,
        janela_inicio = $8,
        janela_fim = $9,
        data_adiar_inicio = $10,
        data_adiar_fim = $11,
        data_silenciar_inicio = $12,
        data_silenciar_fim = $13,
        id_usuario_atualizacao = $14,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id_regra = $15
      RETURNING id_regra;
    `;

    const values = [
      idBancoVal, nome, consulta_sql, intervaloVal, qntErroMaxVal, prioridadeVal,
      descricao || null,
      janela_inicio || '00:00:00',
      janela_fim || '23:59:59',
      normalizeDateToISO(data_adiar_inicio),
      normalizeDateToISO(data_adiar_fim),
      normalizeDateToISO(data_silenciar_inicio),
      normalizeDateToISO(data_silenciar_fim),
      id_usuario_atualizacao,
      idRegraVal
    ];

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK'); // Cancela tudo se a regra não existir
      return res.status(404).json({ error: "Regra não encontrada para atualização." });
    }

    // Passo B: Atualizar a relação M:N (Roles)
    // Estratégia "Limpar e Re-inserir": É mais seguro e simples que tentar adivinhar o "diff".
    
    // 1. Remove todas as associações antigas dessa regra
    await client.query(`DELETE FROM ${SCHEMA}.regra_role WHERE id_regra = $1`, [idRegraVal]);

    // 2. Insere as novas
    if (rolesVal.length > 0) {
      const insertRolesQuery = 'INSERT INTO ' + `${SCHEMA}.regra_role` + ' (id_regra, id_role) VALUES ' + 
         rolesVal.map((id, index) => `($1, $${index + 2})`).join(', ');
      
      await client.query(insertRolesQuery, [idRegraVal, ...rolesVal]);
    }

    // --- FIM DA TRANSAÇÃO ---
    await client.query('COMMIT');

    return res.status(200).json({ message: "Regra atualizada com sucesso.", id_regra: idRegraVal });

  } catch (error) {
    await client.query('ROLLBACK'); // Se der qualquer erro, desfaz tudo
    console.error(`Erro ao atualizar regra ${idRegraVal}:`, error);
    
    if (error.code === "23503") {
        return res.status(400).json({ error: "Violação de integridade (Banco ou Role inválido)." });
    }
    res.status(500).json({ error: "Erro interno ao atualizar regra." });
  } finally {
    if (client) client.release();
  }
});

// Ações programadas
app.patch("/regras/:id/acoes", checkAuth, async (req, res) => {
  const { id } = req.params;
  const idRegraVal = asInteger(id);
  const idUsuario = req.user.id_usuario;

  if (!idRegraVal) {
    return res.status(400).json({ error: "ID da regra inválido." });
  }

  // Body esperado: { tipo: 'adiar'|'silenciar'|'cancelar', inicio: 'ISO...', fim: 'ISO...' }
  const { tipo, inicio, fim } = req.body || {};

  // Validação básica
  if (tipo !== 'cancelar' && (!inicio || !fim)) {
      return res.status(400).json({ error: "Para agendar, início e fim são obrigatórios." });
  }

  const client = await pool.connect();
  try {
    // Preparar valores
    let dataAdiarInicio = null;
    let dataAdiarFim = null;
    let dataSilenciarInicio = null;
    let dataSilenciarFim = null;

    // Lógica de Exclusividade: Um limpa o outro
    if (tipo === 'adiar') {
        dataAdiarInicio = normalizeDateToISO(inicio);
        dataAdiarFim = normalizeDateToISO(fim);
    } else if (tipo === 'silenciar') {
        dataSilenciarInicio = normalizeDateToISO(inicio);
        dataSilenciarFim = normalizeDateToISO(fim);
    } 
    // Se for 'cancelar', tudo continua null (limpa tudo)

    const query = `
      UPDATE ${SCHEMA}.regra
      SET 
        data_adiar_inicio = $1,
        data_adiar_fim = $2,
        data_silenciar_inicio = $3,
        data_silenciar_fim = $4,
        id_usuario_atualizacao = $5,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id_regra = $6
    `;

    const values = [
        dataAdiarInicio, 
        dataAdiarFim, 
        dataSilenciarInicio, 
        dataSilenciarFim, 
        idUsuario, 
        idRegraVal
    ];

    await client.query(query, values);

    res.json({ message: "Ação da regra atualizada com sucesso." });

  } catch (error) {
    console.error(`Erro no PATCH /regras/${idRegraVal}/acoes:`, error);
    res.status(500).json({ error: "Erro interno ao atualizar ação da regra." });
  } finally {
    if (client) client.release();
  }
});

app.delete("/regras/:id", checkAuth, async (req, res) => {
  const { id } = req.params;
  const idRegraVal = asInteger(id);

  if (!idRegraVal) {
    return res.status(400).json({ error: "ID da regra inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Remove associações com Roles (Tabela de ligação)
    await client.query(`DELETE FROM ${SCHEMA}.regra_role WHERE id_regra = $1`, [idRegraVal]);

    // 2. Tenta excluir a regra
    const query = `DELETE FROM ${SCHEMA}.regra WHERE id_regra = $1 RETURNING id_regra`;
    const { rowCount } = await client.query(query, [idRegraVal]);

    if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Regra não encontrada." });
    }

    await client.query('COMMIT');
    res.json({ message: "Regra excluída com sucesso." });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Erro ao excluir regra ${idRegraVal}:`, error);

    // Erro de Chave Estrangeira (FK): A regra tem incidentes ou logs vinculados
    if (error.code === '23503') {
        return res.status(409).json({ 
            error: "Não é possível excluir esta regra pois ela possui histórico (incidentes ou logs). Tente silenciá-la permanentemente." 
        });
    }

    res.status(500).json({ error: "Erro interno ao excluir regra." });
  } finally {
    if (client) client.release();
  }
});

// -------------------------------
// ENDPOINTS PARA TABELAS DE LOG
// -------------------------------


// TABELA DE REGISTRO DAS EXECUÇÕES DAS REGRAS
app.get("/log_execucoes", async (req, res) => {
  try {
    const data = await selectAll("log_execucoes");
    res.json(data)
  } catch (error) {
    console.error("ERROR /log_", error)
    res.status(500).json({error: "Erro ao buscar logs de execuções"})
  }
});


// TABELA DE REGISTRO DAS NOTIFICAÇÕES
app.get("/log_notificacoes", async (req, res) => {
  try {
    const data = await selectAll("log_notificacoes");
    res.json(data)
  } catch (error) {
  console.error("ERROR /log_", error)
  res.status(500).json({error: "Erro ao buscar logs de notificações"})
  }
});


// TABELA DE REGISTRO DAS AÇÕES DO USUÁRIO
app.get("/log_auditoria", async (req, res) => {
  try {
    const data = await selectAll("log_auditoria");
    res.json(data)
  } catch (error) {
    console.error("ERROR /log_", error)
    res.status(500).json({error: "Erro ao buscar logs de auditoria (alterações)"})
  }
});

// ROTA QUE INICIALIZA A APLIÇÃO (index.html)
// (Rota Pública - sem checkAuth)
app.get("/qqmonitor",  (req, res) => {
  const filePath = path.join.apply(__dirname, "public", "index.html");
  res.sendFile(filePath, (error) => {
    if (error) {
      console.error("Erro ao enviar index.html:", error);
      res.status(500).send("Erro ao carregar QQMonitor")
    }
  });
});

// ----------------------------
// INICIALIZAÇÃO DA APLICAÇÃO
// ----------------------------

// Health check
// (Rota Pública - sem checkAuth)
app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: pkg && pkg.name ? pkg.name : "shop-api-node",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(), // ideal para saber o momento da resposta
  });
});

// Tratamento de erros não capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

// Start
app.listen(PORT, () => {
  console.log(`API (Plantão Monitor) rodando em http://localhost:${PORT}`);
  console.log(`DB: ${DATABASE_URL ? "Conexao com BD OK!" : "Verificar coxexao com BD"}`);
});
