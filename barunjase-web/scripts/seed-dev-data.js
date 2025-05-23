// 더미 데이터 시드 스크립트

import { seedDummyData } from '../lib/db/seedData.js';

async function main() {
  try {
    console.log('Starting to seed dummy data...');
    await seedDummyData();
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding dummy data:', error);
    process.exit(1);
  }
}

main(); 