const db = require('../config/db');

const CLEANUP_INTERVAL_SECONDS = 30;

const releaseExpiredSeatLocks = async () => {
    try {
        console.log('Checking for expired seat locks...');

        const [result] = await db.query(
            `DELETE FROM seat_locks
             WHERE status = 'locked'
             AND expires_at < NOW()`
        );

        if (result.affectedRows === 0) {
            console.log('No expired seat locks found');
            return;
        }

        console.log(`🔓 Released ${result.affectedRows} expired seat lock(s)`);

    } catch (error) {
        console.error('❌ Seat cleanup job error:', error);
    }
};

// ─────────────────────────────────────────
// Start the job — runs every 30 seconds
// ─────────────────────────────────────────
const startSeatCleanupJob = () => {
    console.log('🚀 Seat lock cleanup job started!');
    console.log(`   Checks every ${CLEANUP_INTERVAL_SECONDS} seconds`);
    console.log(`   Releases seat locks past their expiry time`);

    // Run immediately when server starts
    releaseExpiredSeatLocks();

    // Then run every 30 seconds
    setInterval(releaseExpiredSeatLocks, CLEANUP_INTERVAL_SECONDS * 1000);
};

module.exports = { startSeatCleanupJob };
