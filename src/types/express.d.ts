// src/types/express.d.ts

import { IUserProfile } from '../models/user.model';

declare global {
    namespace Express {
        interface Request {
            user?: IUserProfile;
            io?: any;
        }
    }
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: IUserProfile;
        io?: any;
    }
}
