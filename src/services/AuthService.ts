import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { Redis } from "ioredis";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

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
    const user = (await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    })) as any; // Temporary type casting until Prisma migration is fixed

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
    const user = (await prisma.user.findUnique({
      where: { id: userId },
    })) as any;
    if (!user) throw new Error("Usuário não encontrado");

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, "KevinBot", secret);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: true,
      } as any,
    });

    return {
      secret,
      qrCode: otpauth,
    };
  }

  // Renovar tokens usando refresh token
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, this.REFRESH_SECRET) as {
        userId: string;
        tenantId: string;
      };

      // Verificar se o refresh token está na blacklist
      const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new Error("Token inválido");
      }

      // Verificar se o refresh token está armazenado
      const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        throw new Error("Token inválido");
      }

      // Gerar novos tokens
      const tokens = this.generateTokenPair(decoded.userId, decoded.tenantId);

      // Atualizar refresh token no Redis
      await redis.setex(
        `refresh_token:${decoded.userId}`,
        7 * 24 * 60 * 60,
        tokens.refreshToken
      );

      // Invalidar refresh token antigo
      await redis.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, "1");

      return tokens;
    } catch (error) {
      throw new Error("Token inválido");
    }
  }

  // Logout (invalidar tokens)
  async logout(userId: string, refreshToken: string): Promise<void> {
    await Promise.all([
      // Remover refresh token
      redis.del(`refresh_token:${userId}`),
      // Adicionar refresh token à blacklist
      redis.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, "1"),
    ]);
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
