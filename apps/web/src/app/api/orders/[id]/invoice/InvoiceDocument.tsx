import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register Russian font
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
      fontWeight: 300,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    paddingTop: 30,
    paddingLeft: 30,
    paddingRight: 30,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderColor: '#333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  infoBlock: {
    marginBottom: 15,
  },
  infoLabel: {
    fontWeight: 700,
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 10,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableCol: {
    flex: 1,
    paddingHorizontal: 5,
  },
  tableColSmall: {
    width: 50,
    paddingHorizontal: 5,
  },
  tableColMedium: {
    width: 80,
    paddingHorizontal: 5,
  },
  headerText: {
    fontWeight: 700,
    fontSize: 9,
    textAlign: 'center',
  },
  cellText: {
    fontSize: 9,
    textAlign: 'center',
  },
  cellTextLeft: {
    fontSize: 9,
    textAlign: 'left',
  },
  cellTextRight: {
    fontSize: 9,
    textAlign: 'right',
  },
  totalSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#333',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalText: {
    fontWeight: 700,
    fontSize: 12,
    marginRight: 5,
  },
  totalValue: {
    fontWeight: 700,
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    fontSize: 8,
    color: '#666',
  },
  barcodeSection: {
    marginTop: 20,
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  barcodeText: {
    fontSize: 8,
    color: '#666',
    marginBottom: 5,
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 5,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  signatureValue: {
    fontSize: 10,
    fontWeight: 500,
  },
});

interface OrderItem {
  id: number;
  productName: string;
  productArticle: string | null;
  quantity: NumericLike;
  unit: string | null;
  price: NumericLike;
  discountPercent: NumericLike;
  total: NumericLike;
  product: {
    guid1c: string;
  } | null;
}

type NumericLike = number | string | { toNumber: () => number; toString: () => string };

interface Partner {
  nameFull: string;
  inn: string | null;
  kpp: string | null;
  addressLegal: string | null;
  phoneMain: string | null;
  email: string | null;
}

interface Order {
  id: number;
  orderNumber1c: string | null;
  orderNumberWeb: string | null;
  orderDate: Date | string | null;
  totalAmount: NumericLike;
  discountAmount: NumericLike | null;
  deliveryAddress: string | null;
  deliveryDate: Date | string | null;
  commentUser: string | null;
  items: OrderItem[];
  partner: Partner | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string;
  } | null;
}

interface InvoiceDocumentProps {
  order: Order;
  invoiceUid: string;
}

export default function InvoiceDocument({ order, invoiceUid }: InvoiceDocumentProps) {
  const orderNumber = order.orderNumber1c || order.orderNumberWeb || String(order.id);
  const orderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString('ru-RU') : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ТОВАРНАЯ НАКЛАДНАЯ</Text>
          <Text style={styles.subtitle}>№ {orderNumber} от {orderDate}</Text>
        </View>

        {/* Order Info */}
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Заказчик:</Text>
              <Text style={styles.infoValue}>
                {order.partner?.nameFull || 'Не указан'}
              </Text>
              {order.partner?.inn && (
                <Text style={styles.infoValue}>
                  ИНН: {order.partner.inn} {order.partner.kpp && `/ КПП: ${order.partner.kpp}`}
                </Text>
              )}
              {order.partner?.addressLegal && (
                <Text style={styles.infoValue}>
                  Адрес: {order.partner.addressLegal}
                </Text>
              )}
            </View>
            <View style={{ width: 150, alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>УИД:</Text>
              <Text style={{ ...styles.infoValue, fontWeight: 700 }}>{invoiceUid}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Info */}
        {(order.deliveryAddress || order.deliveryDate) && (
          <View style={styles.infoBlock}>
            <View style={styles.infoRow}>
              {order.deliveryDate && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Дата доставки:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(order.deliveryDate).toLocaleDateString('ru-RU')}
                  </Text>
                </View>
              )}
              {order.deliveryAddress && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Адрес доставки:</Text>
                  <Text style={styles.infoValue}>{order.deliveryAddress}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Items Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableColSmall, styles.headerText]}>№</Text>
            <Text style={[styles.tableColMedium, styles.headerText]}>Артикул</Text>
            <Text style={[styles.tableCol, styles.headerText]}>Наименование</Text>
            <Text style={[styles.tableColSmall, styles.headerText]}>Кол-во</Text>
            <Text style={[styles.tableColSmall, styles.headerText]}>Ед.</Text>
            <Text style={[styles.tableColSmall, styles.headerText]}>Цена</Text>
            <Text style={[styles.tableColSmall, styles.headerText]}>Сумма</Text>
          </View>

          {/* Rows */}
          {order.items.map((item, index) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.tableColSmall, styles.cellText]}>{index + 1}</Text>
              <Text style={[styles.tableColMedium, styles.cellTextLeft]}>
                {item.productArticle || '-'}
              </Text>
              <Text style={[styles.tableCol, styles.cellTextLeft]}>{item.productName}</Text>
              <Text style={[styles.tableColSmall, styles.cellText]}>
                {Number(item.quantity).toLocaleString('ru-RU')}
              </Text>
              <Text style={[styles.tableColSmall, styles.cellText]}>{item.unit || 'шт'}</Text>
              <Text style={[styles.tableColSmall, styles.cellTextRight]}>
                {Number(item.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </Text>
              <Text style={[styles.tableColSmall, styles.cellTextRight]}>
                {Number(item.total).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalText}>Итого:</Text>
          <Text style={styles.totalValue}>
            {Number(order.totalAmount).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </Text>
        </View>

        {/* Barcode with UID */}
        <View style={styles.barcodeSection}>
          <Text style={styles.barcodeText}>Штрих-код УИД: {invoiceUid}</Text>
          <Text style={{ ...styles.infoValue, letterSpacing: 1.5 }}>{`*${invoiceUid}*`}</Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Отпустил:</Text>
            <Text style={styles.signatureValue}>_________________</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Получил:</Text>
            <Text style={styles.signatureValue}>_________________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            Документ сгенерирован автоматически {new Date().toLocaleString('ru-RU')} | 
            Web1C Shop | Страница {1}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
