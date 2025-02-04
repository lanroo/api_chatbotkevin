import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password, otpToken } = req.body;
      const result = await authService.login(email, password, otpToken);
      return res.json(result);
    } catch (error) {
      return res.status(401).json({ error: (error as Error).message });
    }
  }

  async enable2FA(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const result = await authService.enable2FA(userId);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  }
}
