import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { setSession } from '@/lib/auth/token';
import { z } from 'zod';

const loginSchema = z.object({
  login: z.string().min(1, 'Введите email или ИНН'),
  password: z.string().min(1, 'Введите пароль'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { login, password } = result.data;

    // Search by email OR INN
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: login },
          { inn: login },
        ],
      },
      include: {
        partner: {
          select: {
            id: true,
            nameFull: true,
            inn: true,
          },
        },
        managedPartners: {
          include: {
            partner: {
              select: {
                id: true,
                nameFull: true,
                inn: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный логин или пароль' },
        { status: 401 }
      );
    }

    const transformedManagedPartners = user.managedPartners.map(mp => mp.partner);

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Учетная запись заблокирована' },
        { status: 403 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Неверный логин или пароль' },
        { status: 401 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    await setSession({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'partner' | 'customer',
      partnerId: user.partnerId ?? undefined,
      inn: user.inn ?? undefined,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        partnerId: user.partnerId,
        managedPartners: transformedManagedPartners,
        firstName: user.firstName,
        lastName: user.lastName,
        partner: user.partner,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
