import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const users = await prisma.user.findMany({
      where: role ? { role: role as any } : undefined,
      include: {
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
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match the old structure for the frontend
    const transformedUsers = users.map(user => ({
      ...user,
      managedPartners: user.managedPartners.map(mp => mp.partner),
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, inn, password, role, firstName, lastName, partnerIds } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password and role are required' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        inn,
        passwordHash,
        role,
        firstName,
        lastName,
        managedPartners: {
          create: partnerIds?.map((id: number) => ({ partnerId: id })) || [],
        },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, email, inn, password, role, firstName, lastName, partnerIds, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateData: any = {
      email,
      inn,
      role,
      firstName,
      lastName,
      isActive,
    };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (partnerIds) {
      updateData.managedPartners = {
        deleteMany: {},
        create: partnerIds.map((id: number) => ({ partnerId: id })),
      };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
