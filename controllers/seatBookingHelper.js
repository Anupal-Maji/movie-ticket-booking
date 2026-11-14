const db = require('../config/db');

/**
 * Confirms all seats for a booking as permanently 'booked' in seat_locks,
 * after payment has been verified as successful.
 *
 * Returns true if every seat was successfully confirmed.
 * Returns false if any seat's lock was missing or expired — meaning the
 * hold was lost before payment finished, and the payment should NOT be
 * treated as a valid seat reservation.
 */
async function confirmSeatBooking(movieId, seatNumbersString) {
    const seatNumbers = seatNumbersString
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (seatNumbers.length === 0) {
        console.log('confirmSeatBooking: no seat numbers provided');
        return false;
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        for (const seatNumber of seatNumbers) {
            const [existing] = await connection.query(
                `SELECT * FROM seat_locks
                 WHERE show_id = ? AND seat_number = ?
                 FOR UPDATE`,
                [movieId, seatNumber]
            );

            if (existing.length === 0) {
                console.log(`confirmSeatBooking: no lock found for seat ${seatNumber} (show ${movieId})`);
                await connection.rollback();
                return false;
            }

            const seat = existing[0];

            if (seat.status === 'booked') {
                continue;
            }

            if (seat.status === 'locked' && new Date(seat.expires_at).getTime() < Date.now()) {
                console.log(`confirmSeatBooking: lock expired for seat ${seatNumber} (show ${movieId})`);
                await connection.rollback();
                return false;
            }

            await connection.query(
                `UPDATE seat_locks
                 SET status = 'booked'
                 WHERE id = ?`,
                [seat.id]
            );
        }

        await connection.commit();
        console.log(`confirmSeatBooking: confirmed seats [${seatNumbers.join(', ')}] for show ${movieId}`);
        return true;

    } catch (error) {
        await connection.rollback();
        console.error('confirmSeatBooking error:', error);
        return false;
    } finally {
        connection.release();
    }
}

module.exports = { confirmSeatBooking };