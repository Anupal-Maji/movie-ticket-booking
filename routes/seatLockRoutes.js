const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/lock', async (req, res) => {
    const { showId, seatNumber, userId } = req.body;

    if (!showId || !seatNumber || !userId) {
        return res.status(400).json({
            success: false,
            message: 'showId, seatNumber and userId are required'
        });
    }

    let connection;
    let transactionStarted = false;

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [existingSeats] = await connection.query(
            `SELECT id, user_id, status, expires_at
             FROM seat_locks
             WHERE show_id = ? AND seat_number = ?
             FOR UPDATE`,
            [showId, seatNumber]
        );

        if (existingSeats.length > 0) {
            const seat = existingSeats[0];

            if (seat.status === 'booked') {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    success: false,
                    message: 'Seat is already booked'
                });
            }
            if (
                seat.status === 'locked' &&
                seat.expires_at &&
                new Date(seat.expires_at).getTime() > Date.now()
            ) {
                if (String(seat.user_id) !== String(userId)) {
                    await connection.rollback();
                    transactionStarted = false;

                    return res.status(409).json({
                        success: false,
                        message: 'Seat is currently locked by another user'
                    });
                }

                await connection.query(
                    `UPDATE seat_locks
                     SET locked_at = NOW(),
                         expires_at = DATE_ADD(NOW(), INTERVAL 2 MINUTE)
                     WHERE id = ?`,
                    [seat.id]
                );
            } else {
                await connection.query(
                    `UPDATE seat_locks
                     SET user_id = ?,
                         status = 'locked',
                         locked_at = NOW(),
                         expires_at = DATE_ADD(NOW(), INTERVAL 2 MINUTE)
                     WHERE id = ?`,
                    [userId, seat.id]
                );
            }
        } else {
            await connection.query(
                `INSERT INTO seat_locks
                 (show_id, seat_number, user_id, status, locked_at, expires_at)
                 VALUES
                 (?, ?, ?, 'locked', NOW(), DATE_ADD(NOW(), INTERVAL 2 MINUTE))`,
                [showId, seatNumber, userId]
            );
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(200).json({
            success: true,
            message: 'Seat locked successfully for 2 minutes'
        });

    } catch (error) {

        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Seat was just taken by another user'
            });
        }

        console.error('Seat locking error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to lock the seat'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
