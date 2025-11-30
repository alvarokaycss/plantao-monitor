UPDATE usuario 
SET 
    ativo = TRUE, 
    id_perfil = 1  -- 1 = Admin
WHERE email = 'seuemailaqui@gmail.com';

INSERT INTO usuario_recursos (id_usuario, id_recurso)
SELECT 
    (SELECT id_usuario FROM usuario WHERE email = 'seuemailaqui@gmail.com'), -- Busca ID do seu usuário
    id_recurso
FROM recursos
ON CONFLICT (id_usuario, id_recurso) DO NOTHING; -- Evita erro se já tiver algum