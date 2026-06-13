import { Request, Response } from 'express';
import { getHealth } from '../services/health.service';

export function healthController(_req: Request, res: Response): void {
  res.status(200).json(getHealth());
}
