import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface AdminRequest extends Request {
  adminUser?: { username: string };
}

export function adminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { username: string };
    req.adminUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}
