import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { redis } from "../../../config/redis";

const prisma = new PrismaClient();

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || "default_secret";
  private readonly REFRESH_SECRET =
    process.env.REFRESH_TOKEN_SECRET || "refresh_secret";
  private readonly ACCESS_TOKEN_TTL = "15m";
  private readonly REFRESH_TOKEN_TTL = "7d";
  private readonly SALT_ROUNDS = 12;

  // Gerar par de tokens (access + refresh)
  private generateTokenPair(userId: string, tenantId: string): TokenPair {
    const accessToken = jwt.sign({ userId, tenantId }, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_TTL,
    });

    const refreshToken = jwt.sign({ userId, tenantId }, this.REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_TTL,
    });

    return { accessToken, refreshToken };
  }

  // Hash de senha
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verificar senha
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Login com 2FA
  async login(
    email: string,
    password: string,
    otpToken?: string
  ): Promise<TokenPair | { require2FA: true }> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      throw new Error("Credenciais inválidas");
    }

    const validPassword = await this.verifyPassword(password, user.password);
    if (!validPassword) {
      throw new Error("Credenciais inválidas");
    }

    // Verificar 2FA se estiver ativado
    if (user.mfaEnabled) {
      if (!otpToken) {
        return { require2FA: true };
      }

      const isValidOTP = authenticator.verify({
        token: otpToken,
        secret: user.mfaSecret || "",
      });

      if (!isValidOTP) {
        throw new Error("Código 2FA inválido");
      }
    }

    // Gerar tokens
    const tokens = this.generateTokenPair(user.id, user.tenantId);

    // Armazenar refresh token no Redis
    await redis.setex(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60, // 7 dias em segundos
      tokens.refreshToken
    );

    return tokens;
  }

  // Ativar 2FA
  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Usuário não encontrado");

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, "KevinBot", secret);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: true,
      },
    });

    return {
      secret,
      qrCode: otpauth,
    };
  }

  // Verificar token de acesso
  async verifyAccessToken(
    token: string
  ): Promise<{ userId: string; tenantId: string }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        userId: string;
        tenantId: string;
      };
      return decoded;
    } catch (error) {
      throw new Error("Token inválido");
    }
  }
}
