const db = require('../config/db');

const TIMEOUT_MINUTES = 2;
const TIMEOUT_MS      = TIMEOUT_MINUTES * 60 * 1000;

const releaseExpiredBookings = async () => {
    try {
        console.log('Checking for expired bookings...');

        const [expiredPayments] = await db.query(
            `SELECT p.*, b.booking_status 
             FROM payments p
             JOIN bookings b ON p.booking_id = b.id
             WHERE p.status = 'pending'
             AND b.booking_status = 'pending'
             AND p.created_at < NOW() - INTERVAL ? MINUTE`,
            [TIMEOUT_MINUTES]
        );

        if (expiredPayments.length === 0) {
            console.log('No expired bookings found');
            return;
        }

        console.log(` Found ${expiredPayments.length} expired booking(s)`);

        // Process each expired payment
        for (const payment of expiredPayments) {

            try {
                // Step 1: Mark payment as cancelled
                await db.query(

                    `UPDATE payments 
                     SET status = 'cancelled',
                         failure_reason = 'Payment timeout - user did not complete payment'
                     WHERE id = ?`,
                    [payment.id]
                );

                // Step 2: Mark booking as timed out
                await db.query(
                    `UPDATE bookings
                     SET booking_status = 'timeout'
                     WHERE id = ?
                     AND booking_status = 'pending'`,
                    [payment.booking_id]
                );

                // Step 3: Mark idempotency key as processed
                // (prevents this booking from being retried)
                await db.query(
                    `UPDATE idempotency_keys
                     SET status = 'processed'
                     WHERE booking_id = ?
                     AND status = 'pending'`,
                    [payment.booking_id]
                );

                console.log(` Booking #${payment.booking_id} released (timeout)`);

            } catch (innerError) {
                // If one booking fails, continue with others
                console.error(
                    ` Failed to release booking #${payment.booking_id}:`,

                    innerError
                );
            }
        }

    } catch (error) {
        console.error(' Timeout job error:', error);
    }
};

// ─────────────────────────────────────────
// Start the job — runs every 1 minute
// ─────────────────────────────────────────
const startTimeoutJob = () => {
    console.log(' Payment timeout job started!');
    console.log(`   Checks every 1 minute`);
    console.log(`   Releases bookings pending > ${TIMEOUT_MINUTES} minutes`);

    // Run immediately when server starts
    releaseExpiredBookings();

    // Then run every 60 seconds
    setInterval(releaseExpiredBookings, 60 * 1000);
};

module.exports = { startTimeoutJob };