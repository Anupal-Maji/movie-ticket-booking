// seedBookings.js
// Fills the bookings table in moviedb_test with 50,000 realistic fake rows.
// This NEVER touches your real moviedb database - it has its own separate
// connection, hardcoded to moviedb_test, so there is no way it can reach
// your real data even if your .env changes later.
//
// Run from your movie-app folder:
//   node seedBookings.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const TOTAL_ROWS = 50000;
const BATCH_SIZE = 1000; // insert 1000 rows at a time, easy on an i3 laptop

const movieNames = [
  'Pushpa 2', 'RRR', 'KGF Chapter 2', 'Jailer', 'Animal',
  'Kalki 2898 AD', 'Salaar', 'Leo', 'Fighter', 'Stree 2'
];

const theatreNames = [
  'PVR Cinemas Bengaluru', 'PVR Bengaluru', 'INOX Garuda Mall',
  'Cinepolis Nexus Koramangala', 'PVR Orion Mall', 'INOX Forum Mall'
];

const statuses = ['confirmed', 'pending', 'cancelled', 'timeout', 'failed'];
// Weighted so most bookings look "confirmed", like a real app
const statusWeights = [70, 10, 10, 5, 5];

function pickWeighted(list, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    if (r < weights[i]) return list[i];
    r -= weights[i];
  }
  return list[list.length - 1];
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomDateWithinLastYear() {
  const now = new Date();
  const past = new Date();
  past.setFullYear(now.getFullYear() - 1);
  const time = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(time);
}

function formatDateTime(d) {
  // MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function formatDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  // Hardcoded to moviedb_test on purpose - this script must never be able
  // to accidentally point at your real database.
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: 'moviedb_test',
  });

  console.log('Connected to moviedb_test. Seeding', TOTAL_ROWS, 'fake bookings...');

  let inserted = 0;

  for (let batchStart = 0; batchStart < TOTAL_ROWS; batchStart += BATCH_SIZE) {
    const rowsInThisBatch = Math.min(BATCH_SIZE, TOTAL_ROWS - batchStart);
    const values = [];
    const placeholders = [];

    for (let i = 0; i < rowsInThisBatch; i++) {
      const n = batchStart + i + 1;
      const createdAt = randomDateWithinLastYear();
      const showDate = formatDateOnly(createdAt);
      const status = pickWeighted(statuses, statusWeights);
      const amount = (Math.floor(Math.random() * 8) + 1) * 50; // 50 to 400

      values.push(
        `seed_user_${n}`,
        `seed_user_${n}@example.com`,
        randomFrom(movieNames),
        Math.floor(Math.random() * 10) + 1, // fake movie_id
        randomFrom(theatreNames),
        showDate,
        `${Math.floor(Math.random() * 12) + 1}:00 PM`,
        `A${n % 20}`,
        `SEED_PAY_${n}`,        // tagged so it's easy to find and delete
        amount.toFixed(2),
        status,
        formatDateTime(createdAt)
      );
      placeholders.push('(?,?,?,?,?,?,?,?,?,?,?,?)');
    }

    const sql = `
      INSERT INTO bookings
        (user_name, user_email, movie_name, movie_id, theatre_name,
         show_date, show_time, seat_numbers, payment_id, total_amount,
         booking_status, created_at)
      VALUES ${placeholders.join(',')}
    `;

    await db.execute(sql, values);
    inserted += rowsInThisBatch;
    console.log(`Inserted ${inserted} / ${TOTAL_ROWS}`);
  }

  console.log('Done. moviedb_test.bookings now has', TOTAL_ROWS, 'fake rows.');
  await db.end();
}

main().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
