require('dotenv/config');

const fs = require('fs');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL이 없습니다.');
  }

  const backup = JSON.parse(
    fs.readFileSync('./scripts/railway-backup.json', 'utf8')
  );

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const client = await pool.connect();

  try {
    console.log('✅ Neon PostgreSQL 연결 성공');

    await client.query('BEGIN');

    // 1. User
    for (const row of backup.User) {
      await client.query(
        `
        INSERT INTO "User"
          ("id", "userId", "passwordHash", "nickname", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          row.id,
          row.userId,
          row.passwordHash,
          row.nickname,
          row.createdAt,
          row.updatedAt,
        ]
      );
    }

    console.log(`📦 User: ${backup.User.length}개`);

    // 2. SpotifyAccount
    for (const row of backup.SpotifyAccount) {
      await client.query(
        `
        INSERT INTO "SpotifyAccount"
          (
            "id",
            "userId",
            "spotifyUserId",
            "accessToken",
            "refreshToken",
            "expiresAt",
            "createdAt",
            "updatedAt"
          )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          row.id,
          row.userId,
          row.spotifyUserId,
          row.accessToken,
          row.refreshToken,
          row.expiresAt,
          row.createdAt,
          row.updatedAt,
        ]
      );
    }

    console.log(`📦 SpotifyAccount: ${backup.SpotifyAccount.length}개`);

    // 3. UserLocation
    for (const row of backup.UserLocation) {
      await client.query(
        `
        INSERT INTO "UserLocation"
          ("id", "userId", "latitude", "longitude", "updatedAt")
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          row.id,
          row.userId,
          row.latitude,
          row.longitude,
          row.updatedAt,
        ]
      );
    }

    console.log(`📦 UserLocation: ${backup.UserLocation.length}개`);

    // 4. Invitation
    for (const row of backup.Invitation) {
      await client.query(
        `
        INSERT INTO "Invitation"
          (
            "id",
            "senderId",
            "receiverId",
            "spotifyTrackId",
            "trackTitle",
            "trackArtist",
            "albumImage",
            "spotifyUrl",
            "status",
            "createdAt",
            "updatedAt"
          )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          row.id,
          row.senderId,
          row.receiverId,
          row.spotifyTrackId,
          row.trackTitle,
          row.trackArtist,
          row.albumImage,
          row.spotifyUrl,
          row.status,
          row.createdAt,
          row.updatedAt,
        ]
      );
    }

    console.log(`📦 Invitation: ${backup.Invitation.length}개`);

    // autoincrement sequence 맞추기
    const tables = [
      'User',
      'SpotifyAccount',
      'UserLocation',
      'Invitation',
    ];

    for (const table of tables) {
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX("id") FROM "${table}"), 1),
          (SELECT COUNT(*) > 0 FROM "${table}")
        )
      `);
    }

    await client.query('COMMIT');

    console.log('');
    console.log('🎉 Railway → Neon 데이터 이전 완료');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('');
    console.error('❌ 데이터 이전 실패');
    console.error(error);

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();