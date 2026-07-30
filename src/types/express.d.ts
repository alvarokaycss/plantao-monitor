// src/types/express.d.ts

import { IUserProfile } from '../models/user.model';

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
