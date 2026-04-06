import { PrismaClient, Role, RecordType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- Users ---
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const analystHash = await bcrypt.hash('Analyst@123', 12);
  const viewerHash = await bcrypt.hash('Viewer@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@finance.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@finance.com',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@finance.com' },
    update: {},
    create: {
      name: 'Analyst User',
      email: 'analyst@finance.com',
      passwordHash: analystHash,
      role: Role.ANALYST,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@finance.com' },
    update: {},
    create: {
      name: 'Viewer User',
      email: 'viewer@finance.com',
      passwordHash: viewerHash,
      role: Role.VIEWER,
    },
  });

  // --- Categories ---
  const categoryData = [
    { name: 'Salaries', type: RecordType.EXPENSE },
    { name: 'Office Supplies', type: RecordType.EXPENSE },
    { name: 'Software Subscriptions', type: RecordType.EXPENSE },
    { name: 'Travel & Entertainment', type: RecordType.EXPENSE },
    { name: 'Utilities', type: RecordType.EXPENSE },
    { name: 'Product Sales', type: RecordType.INCOME },
    { name: 'Service Revenue', type: RecordType.INCOME },
    { name: 'Investment Returns', type: RecordType.INCOME },
    { name: 'Consulting Fees', type: RecordType.INCOME },
    { name: 'Grants', type: RecordType.INCOME },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryData) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categories[cat.name] = created.id;
  }

  // --- Sample financial records ---
  const records = [
    {
      title: 'Monthly Salary Payment - March',
      amount: 45000,
      type: RecordType.EXPENSE,
      categoryId: categories['Salaries'],
      date: new Date('2024-03-31'),
      createdById: admin.id,
    },
    {
      title: 'Q1 Product Sales Revenue',
      amount: 128500.5,
      type: RecordType.INCOME,
      categoryId: categories['Product Sales'],
      date: new Date('2024-03-31'),
      createdById: analyst.id,
    },
    {
      title: 'Cloud Infrastructure - March',
      amount: 3200.75,
      type: RecordType.EXPENSE,
      categoryId: categories['Software Subscriptions'],
      date: new Date('2024-03-15'),
      createdById: analyst.id,
    },
    {
      title: 'Consulting Contract - Acme Corp',
      amount: 15000,
      type: RecordType.INCOME,
      categoryId: categories['Consulting Fees'],
      date: new Date('2024-02-28'),
      createdById: admin.id,
    },
    {
      title: 'Team Offsite - February',
      amount: 8750.25,
      type: RecordType.EXPENSE,
      categoryId: categories['Travel & Entertainment'],
      date: new Date('2024-02-20'),
      createdById: analyst.id,
    },
    {
      title: 'Annual Software License - Figma',
      amount: 1440,
      type: RecordType.EXPENSE,
      categoryId: categories['Software Subscriptions'],
      date: new Date('2024-01-15'),
      createdById: admin.id,
    },
    {
      title: 'Service Revenue - January',
      amount: 62000,
      type: RecordType.INCOME,
      categoryId: categories['Service Revenue'],
      date: new Date('2024-01-31'),
      createdById: analyst.id,
    },
  ];

  for (const record of records) {
    await prisma.financialRecord.create({ data: record });
  }

  console.log('✓ Seed complete');
  console.log('\nTest credentials:');
  console.log('  Admin:   admin@finance.com / Admin@123');
  console.log('  Analyst: analyst@finance.com / Analyst@123');
  console.log('  Viewer:  viewer@finance.com / Viewer@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
