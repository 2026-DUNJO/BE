const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SOURCE_DB_HOST,
    port: Number(process.env.SOURCE_DB_PORT),
    user: process.env.SOURCE_DB_USER,
    password: process.env.SOURCE_DB_PASSWORD,
    database: process.env.SOURCE_DB_NAME,
  });

  console.log('✅ Railway MySQL 연결 성공');

  const tables = [
    'User',
    'SpotifyAccount',
    'UserLocation',
    'Invitation',
  ];

  const backup = {};

  for (const table of tables) {
    const [rows] = await connection.query(
      `SELECT * FROM \`${table}\` ORDER BY id`
    );

    backup[table] = rows;

    console.log(`📦 ${table}: ${rows.length}개`);
  }

  fs.writeFileSync(
    './scripts/railway-backup.json',
    JSON.stringify(backup, null, 2),
    'utf8'
  );

  await connection.end();

  console.log('');
  console.log('✅ 백업 완료');
  console.log('📁 scripts/railway-backup.json');
}

main().catch((error) => {
  console.error('❌ 백업 실패');
  console.error(error);
  process.exit(1);
});