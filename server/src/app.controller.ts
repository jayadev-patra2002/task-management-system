import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";

@Controller()
export class AppController {
  @Get()
  getHome(@Res() res: Response) {
    res.type("html").send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta
            name="google-site-verification"
            content="NpW1-198OHJq_j3bodZo6sSCVwSvfBUpiNm-fjGsUc0"
          />
          <title>Task Management API</title>
        </head>
        <body>
          <h1>Task Management API</h1>
        </body>
      </html>
    `);
  }
}