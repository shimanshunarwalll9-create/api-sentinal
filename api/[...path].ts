import type { Request, Response } from 'express';
import app from '../backend/index.js";

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
