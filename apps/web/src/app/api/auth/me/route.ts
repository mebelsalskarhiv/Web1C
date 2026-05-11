import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/token';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithPartners = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        managedPartners: {
          include: {
            partner: true,
          },
        },
      },
    });

    if (!userWithPartners) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const {
      managedPartners,
      passwordHash, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...user
    } = userWithPartners;

    const enrichedUser = {
      ...user,
      managedPartners: managedPartners.map((mp) => mp.partner),
    };

    return NextResponse.json({ user: enrichedUser });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
