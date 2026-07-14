import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Runs after an array of express-validator checks on a route; returns 400
// with a clear field-level error list instead of letting bad input through.
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: (e as any).path, message: e.msg })),
    });
  }
  next();
};
