import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import { renderToBuffer } from '@react-pdf/renderer';
import InvoiceDocument from './InvoiceDocument';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = parseInt(params.id);
    
    // Get order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check permissions
    if (session.role !== 'admin' && order.partnerId !== session.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate UID for barcode
    const invoiceUid = order.invoiceUid || `ORD-${order.id}-${Date.now()}`;
    
    // Update order with UID if not set
    if (!order.invoiceUid) {
      await prisma.order.update({
        where: { id: orderId },
        data: { invoiceUid },
      });
    }

    // Create PDF document
    const doc = InvoiceDocument({ order, invoiceUid });
    
    // Render to buffer
    const buffer = await renderToBuffer(doc);

    // Return PDF
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice_${order.orderNumber1c || order.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
