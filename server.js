
const { startTimeoutJob } = require('./jobs/timeoutJob');
const { startSeatCleanupJob } = require('./jobs/seatCleanupJob');
require('dotenv').config();
 
const express = require('express');
const db = require('./config/db');
const { validateYoutubeUrl } = require('./util');
 
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
 
const app = express();
 
// rawBody is kept so the payment webhook can check Razorpay's signature
// against the exact bytes Razorpay sent.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static('public'));
 
const seatLockRoutes = require('./routes/seatLockRoutes');
app.use('/api/seats', seatLockRoutes);
 
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
 
const PORT = process.env.PORT || 3000;
const MOVIES_PER_PAGE = 6;
 
function toArray(value) {
    if (!value) return [];
    return value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
}
 
app.get('/api/movies', async (req, res) => {
    try {
        const genres = toArray(req.query.genres);
        const languages = toArray(req.query.languages);
        const sortBy = req.query.sortBy || 'rating';
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * MOVIES_PER_PAGE;
 
        let whereClause = '';
        let queryValues = [];
        const conditions = [];
 
        if (genres.length > 0) {
            conditions.push(`genre IN (${genres.map(() => '?').join(',')})`);
            queryValues.push(...genres);
        }
 
        if (languages.length > 0) {
            conditions.push(`language IN (${languages.map(() => '?').join(',')})`);
            queryValues.push(...languages);
        }
 
        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }
 
        let orderBy = 'rating DESC';
        if (sortBy === 'release_date') orderBy = 'release_date DESC';
        else if (sortBy === 'title') orderBy = 'title ASC';
 
        const [countResult] = await db.query(
            `SELECT COUNT(*) AS total FROM movies ${whereClause}`,
            queryValues
        );
 
        const totalMovies = countResult[0].total;
        const totalPages = Math.ceil(totalMovies / MOVIES_PER_PAGE);
 
        const [movies] = await db.query(
            `SELECT * FROM movies ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            [...queryValues, MOVIES_PER_PAGE, offset]
        );
 
        movies.forEach(movie => {
            if (movie.trailer_url) {
                movie.trailer_url = validateYoutubeUrl(movie.trailer_url);
            }
        });
 
        res.status(200).json({
            success: true,
            movies,
            currentPage: page,
            totalPages,
            totalMovies
        });
 
    } catch (error) {
        console.error('Movies Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch movies' });
    }
});
 
// Filter counts.
// Genre counts take the chosen LANGUAGES into account (but not the chosen genres),
// and language counts take the chosen GENRES into account (but not the chosen
// languages). So every number matches what the user would see after ticking that
// box. Every genre and language is always returned (with 0 if nothing matches),
// so a ticked box never disappears from the list.
app.get('/api/filter-counts', async (req, res) => {
    try {
        const genres = toArray(req.query.genres);
        const languages = toArray(req.query.languages);
 
        const genreCountSql = languages.length > 0
            ? `SELECT genre,
                      COUNT(CASE WHEN language IN (${languages.map(() => '?').join(',')}) THEN 1 END) AS count
               FROM movies
               GROUP BY genre
               ORDER BY genre`
            : `SELECT genre, COUNT(*) AS count
               FROM movies
               GROUP BY genre
               ORDER BY genre`;
 
        const languageCountSql = genres.length > 0
            ? `SELECT language,
                      COUNT(CASE WHEN genre IN (${genres.map(() => '?').join(',')}) THEN 1 END) AS count
               FROM movies
               GROUP BY language
               ORDER BY language`
            : `SELECT language, COUNT(*) AS count
               FROM movies
               GROUP BY language
               ORDER BY language`;
 
        const [genreCounts] = await db.query(genreCountSql, languages);
        const [languageCounts] = await db.query(languageCountSql, genres);
 
        res.status(200).json({
            success: true,
            genres: genreCounts,
            languages: languageCounts
        });
 
    } catch (error) {
        console.error('Filter Count Error:', error);
        res.status(500).json({ success: false, message: 'Failed to load filter counts' });
    }
});
 
app.get('/api/movies/:id', async (req, res) => {
    try {
        const movieId = Number(req.params.id);
 
        if (!Number.isInteger(movieId)) {
            return res.status(400).json({ success: false, message: 'Invalid movie ID' });
        }
 
        const [movies] = await db.query(
            'SELECT * FROM movies WHERE id = ?',
            [movieId]
        );
 
        if (movies.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }
 
        const movie = movies[0];
 
        if (movie.trailer_url) {
            movie.trailer_url = validateYoutubeUrl(movie.trailer_url);
        }
 
        res.status(200).json({ success: true, data: movie });
 
    } catch (error) {
        console.error('Movies Details Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch movie' });
    }
});
 
app.get('/api/booking/:id', async (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
 
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });
        }
 
        const [rows] = await db.query(
            'SELECT * FROM bookings WHERE id = ?',
            [bookingId]
        );
 
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
 
        const booking = rows[0];
 
        res.status(200).json({
            success: true,
            booking: {
                movie_name: booking.movie_name,
                seats: booking.seat_numbers,
                show_time: booking.show_time,
                total_amount: booking.total_amount
            }
        });
 
    } catch (error) {
        console.error('Get Booking Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking'
        });
    }
});
 
app.post('/api/bookings', async (req, res) => {
    try {
        const {
            user_name,
            user_email,
            movie_name,
            movie_id,
            theatre_name,
            show_date,
            show_time,
            seat_numbers,
            payment_id,
            total_amount
        } = req.body;
 
        if (!user_name || !user_email || !movie_name || !movie_id || !theatre_name ||
            !show_date || !show_time || !seat_numbers || !payment_id || !total_amount) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all booking details'
            });
        }
 
        const [result] = await db.query(
            `INSERT INTO bookings 
            (user_name, user_email, movie_name, movie_id, theatre_name, 
             show_date, show_time, seat_numbers, payment_id, total_amount, booking_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [user_name, user_email, movie_name, movie_id, theatre_name,
             show_date, show_time, seat_numbers, payment_id, total_amount]
        );
 
 
        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            bookingId: result.insertId
        });
 
    } catch (error) {
        console.error('Booking Error:', error);
        res.status(500).json({ success: false, message: 'Booking failed' });
    }
});
 
app.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
 
    startTimeoutJob();
    startSeatCleanupJob();
});
 