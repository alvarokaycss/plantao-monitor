// src/types/express.d.ts

import { IUserProfile } from './user';

/**
 * Extensão do namespace global do Express para incluir propriedades customizadas na requisição (req)
 */
declare global {
    namespace Express {
        interface Request {
            user?: IUserProfile;
            io?: any;
        }
    }
}
