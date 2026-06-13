import { Request, Response } from 'express';
import { authOf } from '../utils/requestAuth';

/** Returns the authenticated principal — handy for clients to confirm session + role. */
export function meController(req: Request, res: Response): void {
  res.status(200).json(authOf(req));
}
