import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuditLogService } from './auditLogService.js';

const prisma = new PrismaClient();

export type PublicUser = {
	id: string;
	email: string;
	role: string;
	createdAt: Date;
};

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	role: z.enum(['USER', 'ADMIN']).default('USER')
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string()
});

export class AuthService {
	static async register(data: z.infer<typeof registerSchema>): Promise<PublicUser> {
		const { email, password, role } = registerSchema.parse(data);
		
		// Check if user already exists
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			throw new Error('User already exists');
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 12);
		
		// Create user
		const user = await prisma.user.create({
			data: { email, passwordHash, role }
		});

		await AuditLogService.record({
			actorUserId: user.id,
			action: 'USER_CREATED',
			targetType: 'User',
			targetId: user.id,
			meta: { email: user.email, role: user.role }
		});

		const { passwordHash: _, ...rest } = user;
		return rest as PublicUser;
	}

	static async login(data: z.infer<typeof loginSchema>): Promise<{ user: PublicUser; token: string }> {
		const { email, password } = loginSchema.parse(data);
		
		// Find user
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			throw new Error('Invalid credentials');
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.passwordHash);
		if (!isValidPassword) {
			throw new Error('Invalid credentials');
		}

		// Generate JWT token
		const token = jwt.sign(
			{ userId: user.id, email: user.email, role: user.role },
			process.env.JWT_SECRET || 'fallback-secret',
			{ expiresIn: '24h' }
		);

		await AuditLogService.record({
			actorUserId: user.id,
			action: 'USER_LOGIN',
			targetType: 'User',
			targetId: user.id,
			meta: { email: user.email, role: user.role }
		});

		const { passwordHash: _, ...rest } = user;
		return { user: rest as PublicUser, token };
	}

	static async verifyToken(token: string): Promise<{ userId: string; email: string; role: string }> {
		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
			return {
				userId: decoded.userId,
				email: decoded.email,
				role: decoded.role
			};
		} catch (error) {
			throw new Error('Invalid token');
		}
	}
}
