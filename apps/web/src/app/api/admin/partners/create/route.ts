import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createPartnerSchema = z.object({
  inn: z.string(),
  kpp: z.string().optional(),
  nameFull: z.string(),
  nameShort: z.string().optional(),
  addressLegal: z.string().optional(),
  phoneMain: z.string().optional(),
  email: z.string().email().optional(),
  guid1c: z.string().optional(),
  createLogin: z.boolean().optional(),
  loginEmail: z.string().email().optional(),
  loginPassword: z.string().min(6).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = createPartnerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      inn,
      kpp,
      nameFull,
      nameShort,
      addressLegal,
      phoneMain,
      email,
      guid1c,
      createLogin,
      loginEmail,
      loginPassword,
    } = result.data;

    // Create partner
    const partner = await prisma.partner.create({
      data: {
        inn,
        kpp,
        nameFull,
        nameShort,
        addressLegal,
        phoneMain,
        email,
        guid1c,
        lastSyncAt: new Date(),
      },
    });

    // Create user login if requested
    let user = null;
    if (createLogin && loginEmail && loginPassword) {
      const passwordHash = await bcrypt.hash(loginPassword, 10);
      
      user = await prisma.user.create({
        data: {
          email: loginEmail,
          passwordHash,
          role: 'partner',
          partnerId: partner.id,
          firstName: nameShort?.split(' ')[0] || nameFull.split(' ')[0],
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });
    }

    return NextResponse.json({
      partner,
      user,
      message: 'Партнёр успешно создан',
    });
  } catch (error) {
    console.error('Create partner error:', error);
    return NextResponse.json(
      { error: 'Ошибка создания партнёра' },
      { status: 500 }
    );
  }
}
