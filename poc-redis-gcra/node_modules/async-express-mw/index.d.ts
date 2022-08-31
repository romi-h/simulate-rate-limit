declare module 'async-express-mw' {
  import { Request, Response, NextFunction } from 'express';

  function asyncMw(
    fn: (
      req: Request & Record<any, any>,
      res: Response & Record<any, any>,
      ...next: [NextFunction]
    ) => any
  ): any;

  export = asyncMw;
}
