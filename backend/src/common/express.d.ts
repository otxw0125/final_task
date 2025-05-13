import { User } from '../users/interface/user.interface';  // ← interface 폴더명에 맞춰서

declare global {
  namespace Express {
    interface Request {
      /** 로그인 시 SessionSerializer·Passport가 채워 주는 user */
      user: User;
    }
  }
}