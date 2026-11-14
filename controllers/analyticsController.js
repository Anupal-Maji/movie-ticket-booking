// All analytics queries use SQL aggregation (SUM, COUNT, GROUP BY) so the
// database does the heavy lifting — we never pull raw rows into Node and
// loop over them in memory. Each result is cached in Redis for a short TTL
// so repeated dashboard loads don't re-run expensive queries every time.
//
// NOTE: This version matches the REAL bookings table schema:
//   - booking_status (enum: pending/confirmed/failed/cancelled/timeout)
//     is used for filtering — NOT the unused `status` column, which is
//     always 'confirmed' by default and never actually changes.
//   - total_amount is the real revenue column (not `amount`).
//   - theatres are stored as theatre_name text directly on bookings —
//     there is no theatre_id foreign key, so no JOIN is used.

const db = require('../config/db'); // <-- adjust to match your existing MySQL connection file
const { getOrSetCache } = require('../config/cacheHelper');

// ---------- 1. Revenue: daily, weekly, monthly ----------
async function getRevenue(req, res) {
  try {
    const data = await getOrSetCache('analytics:revenue', 60, async () => {
      const [daily] = await db.query(`
        SELECT DATE(created_at) AS date, SUM(total_amount) AS revenue
        FROM bookings
        WHERE booking_status = 'confirmed'
          AND created_at >= CURDATE() - INTERVAL 30 DAY
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      const [weekly] = await db.query(`
        SELECT YEARWEEK(created_at, 1) AS week, SUM(total_amount) AS revenue
        FROM bookings
        WHERE booking_status = 'confirmed'
          AND created_at >= CURDATE() - INTERVAL 12 WEEK
        GROUP BY YEARWEEK(created_at, 1)
        ORDER BY week DESC
      `);

      const [monthly] = await db.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total_amount) AS revenue
        FROM bookings
        WHERE booking_status = 'confirmed'
          AND created_at >= CURDATE() - INTERVAL 12 MONTH
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `);

      return { daily, weekly, monthly };
    });

    res.json(data);
  } catch (err) {
    console.error('getRevenue error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue analytics.' });
  }
}

// ---------- 2. Most popular movies ----------
// Uses movie_name directly (bookings already stores it), so no JOIN needed
// even though movie_id also exists — this avoids failing on rows where
// movie_id might be NULL (it's a nullable column in your schema).
async function getPopularMovies(req, res) {
  try {
    const data = await getOrSetCache('analytics:popular_movies', 120, async () => {
      const [rows] = await db.query(`
        SELECT movie_name, COUNT(*) AS total_bookings
        FROM bookings
        WHERE booking_status = 'confirmed'
        GROUP BY movie_name
        ORDER BY total_bookings DESC
        LIMIT 10
      `);
      return rows;
    });

    res.json(data);
  } catch (err) {
    console.error('getPopularMovies error:', err);
    res.status(500).json({ error: 'Failed to fetch popular movies.' });
  }
}

// ---------- 3. Busiest theatres (by booking count) ----------
// Your schema has no theatres table linked by ID and no seat-capacity
// column to compute a true occupancy RATE, so this reports total
// confirmed bookings per theatre_name instead — a fair stand-in until
// a theatres table with capacity exists.
async function getBusiestTheatres(req, res) {
  try {
    const data = await getOrSetCache('analytics:busiest_theatres', 120, async () => {
      const [rows] = await db.query(`
        SELECT theatre_name, COUNT(*) AS total_bookings
        FROM bookings
        WHERE booking_status = 'confirmed'
        GROUP BY theatre_name
        ORDER BY total_bookings DESC
        LIMIT 10
      `);
      return rows;
    });

    res.json(data);
  } catch (err) {
    console.error('getBusiestTheatres error:', err);
    res.status(500).json({ error: 'Failed to fetch busiest theatres.' });
  }
}

// ---------- 4. Peak booking hours ----------
async function getPeakBookingHours(req, res) {
  try {
    const data = await getOrSetCache('analytics:peak_hours', 300, async () => {
      const [rows] = await db.query(`
        SELECT HOUR(created_at) AS hour, COUNT(*) AS total_bookings
        FROM bookings
        WHERE booking_status = 'confirmed'
        GROUP BY HOUR(created_at)
        ORDER BY total_bookings DESC
      `);
      return rows;
    });

    res.json(data);
  } catch (err) {
    console.error('getPeakBookingHours error:', err);
    res.status(500).json({ error: 'Failed to fetch peak booking hours.' });
  }
}

// ---------- 5. Cancellation rate ----------
async function getCancellationRate(req, res) {
  try {
    const data = await getOrSetCache('analytics:cancellation_rate', 300, async () => {
      const [[row]] = await db.query(`
        SELECT
          COUNT(*) AS total_bookings,
          SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
          ROUND(
            SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*) * 100,
            2
          ) AS cancellation_rate_percent
        FROM bookings
      `);
      return row;
    });

    res.json(data);
  } catch (err) {
    console.error('getCancellationRate error:', err);
    res.status(500).json({ error: 'Failed to fetch cancellation rate.' });
  }
}

module.exports = {
  getRevenue,
  getPopularMovies,
  getBusiestTheatres,
  getPeakBookingHours,
  getCancellationRate,
};
