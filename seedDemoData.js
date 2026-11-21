// seedDemoData.js
// Adds 300 fake demo bookings to the ONLINE database so the admin dashboard
// has something to show. It refuses to run if DB_HOST is your own laptop, so it
// can never put fake bookings into your real local data.
//
// Run it in a PowerShell window where the online database settings are set
// (see the hosting instructions), from your movie-app folder:
//   node seedDemoData.js

require('dotenv').config();
const db = require('./config/db');

const host = process.env.DB_HOST || '';
if (['', 'localhost', '127.0.0.1'].includes(host)) {
  console.log('Stopped: DB_HOST points to your own laptop. This script is only for the online database.');
  process.exit(1);
}

const theatres = ['PVR Cinemas Bengaluru', 'INOX Garuda Mall', 'Cinepolis Nexus Koramangala', 'PVR Orion Mall'];
const statuses = ['confirmed', 'pending', 'cancelled', 'timeout', 'failed'];
const weights = [75, 8, 8, 5, 4];

function pick(list, w) {
  if (!w) return list[Math.floor(Math.random() * list.length)];
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    if (r < w[i]) return list[i];
    r -= w[i];
  }
  return list[list.length - 1];
}

function pad(n) { return String(n).padStart(2, '0'); }

function randomRecentDate() {
  const d = new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000);
  return d;
}

function sqlDateTime(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

(async () => {
  try {
    const [existing] = await db.query("SELECT COUNT(*) AS c FROM bookings WHERE payment_id LIKE 'DEMO_PAY_%'");
    if (existing[0].c > 0) {
      console.log('Demo data already exists (' + existing[0].c + ' rows). Nothing to do.');
      process.exit(0);
    }

    const [movies] = await db.query('SELECT id, title FROM movies');
    if (movies.length === 0) {
      console.log('No movies found. Import the movies data first.');
      process.exit(1);
    }

    const rows = [];
    for (let i = 1; i <= 300; i++) {
      const movie = pick(movies);
      const created = randomRecentDate();
      const seats = Math.floor(Math.random() * 3) + 1;
      rows.push([
        `Demo User ${i}`,
        `demo${i}@example.com`,
        movie.title,
        movie.id,
        pick(theatres),
        sqlDateTime(created).slice(0, 10),
        `${Math.floor(Math.random() * 6) + 1}:00 PM`,
        'A' + ((i % 8) + 1),
        `DEMO_PAY_${i}`,
        seats * 200,
        pick(statuses, weights),
        sqlDateTime(created),
      ]);
    }

    await db.query(
      `INSERT INTO bookings
        (user_name, user_email, movie_name, movie_id, theatre_name, show_date,
         show_time, seat_numbers, payment_id, total_amount, booking_status, created_at)
       VALUES ?`,
      [rows]
    );

    console.log('Done. Added 300 demo bookings.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
})();
