/**
 * Database seed script
 * Creates initial admin user and default settings
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminEmail = 'admin@web1c.local';
  const adminPassword = 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: passwordHash,
      role: 'admin',
      firstName: 'Администратор',
      lastName: 'Системы',
      isActive: true,
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // Create default settings
  const settings = [
    { key: 'onec_url', value: 'http://localhost:8080/hs/odata', description: '1C OData URL' },
    { key: 'onec_user', value: 'odata_user', description: '1C OData username' },
    { key: 'onec_password', value: '', description: '1C OData password', isEncrypted: true },
    { key: 'sync_interval', value: '300', description: 'Sync interval in seconds' },
    { key: 'auto_sync_enabled', value: 'true', description: 'Auto sync enabled' },
    { key: 'reserve_on_order', value: 'true', description: 'Reserve products on order' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
    console.log(`Created setting: ${setting.key}`);
  }

  console.log('Database seed completed!');
  console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
  console.log(`Admin credentials: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
