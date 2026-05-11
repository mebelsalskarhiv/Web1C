import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import { z } from 'zod';

const mergePartnersSchema = z.object({
  sourcePartnerId: z.number(),
  targetPartnerId: z.number(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = mergePartnersSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { sourcePartnerId, targetPartnerId, reason } = result.data;

    if (sourcePartnerId === targetPartnerId) {
      return NextResponse.json(
        { error: 'Нельзя объединить партнёра с самим собой' },
        { status: 400 }
      );
    }

    // Get partners
    const [sourcePartner, targetPartner] = await Promise.all([
      prisma.partner.findUnique({ where: { id: sourcePartnerId } }),
      prisma.partner.findUnique({ where: { id: targetPartnerId } }),
    ]);

    if (!sourcePartner || !targetPartner) {
      return NextResponse.json(
        { error: 'Один из партнёров не найден' },
        { status: 404 }
      );
    }

    // Merge in transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Transfer users
      await tx.user.updateMany({
        where: { partnerId: sourcePartnerId },
        data: { partnerId: targetPartnerId },
      });

      // Transfer orders
      await tx.order.updateMany({
        where: { partnerId: sourcePartnerId },
        data: { partnerId: targetPartnerId },
      });

      // Merge financial data
      await tx.partner.update({
        where: { id: targetPartnerId },
        data: {
          balanceDebit: sourcePartner.balanceDebit.toNumber() + targetPartner.balanceDebit.toNumber(),
          balanceCredit: sourcePartner.balanceCredit.toNumber() + targetPartner.balanceCredit.toNumber(),
        },
      });

      // Mark source as merged
      await tx.partner.update({
        where: { id: sourcePartnerId },
        data: {
          mergedIntoId: targetPartnerId,
          isMerged: true,
        },
      });

      // Log merge history
      await tx.partnerMergeHistory.create({
        data: {
          sourcePartnerId,
          targetPartnerId,
          mergedById: session.userId,
          reason: reason || null,
        },
      });
    });

    return NextResponse.json({
      message: 'Партнёры успешно объединены',
      targetPartnerId,
    });
  } catch (error) {
    console.error('Merge partners error:', error);
    return NextResponse.json(
      { error: 'Ошибка объединения партнёров' },
      { status: 500 }
    );
  }
}
