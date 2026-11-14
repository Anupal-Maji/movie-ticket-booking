const crypto = require('crypto');
const db = require('../config/db');
const { confirmSeatBooking } = require('../controllers/seatBookingHelper');
 
// CHANGES IN THIS VERSION (everything else works as before):
// 1. The signature is checked against the RAW request body (req.rawBody),
//    which is what Razorpay signs. It falls back to the old behaviour if
//    server.js has not been changed yet.
// 2. The signature comparison is timing-safe.
// 3. A missing RAZORPAY_WEBHOOK_SECRET is reported clearly instead of crashing.
// 4. payment.captured now also turns the seat lock into a booked seat
//    (confirmSeatBooking), exactly like Verify Payment does. If the seat hold
//    was already lost, the booking is marked failed and logged for a refund.
// 5. A payment that Verify Payment already rejected because the seat hold
//    expired is NOT turned back into a confirmed booking.
// 6. A late payment.failed event cannot undo a payment already marked paid.
// 7. Real errors now return 500, so Razorpay retries the webhook later.
//    This is safe because every step can be repeated without harm.
 
const handleRazorpayWebhook = async (req, res) => {
    try {
        const razorpaySignature = req.headers['x-razorpay-signature'];
        if (!razorpaySignature) {
            console.log('No signature found');
            return res.status(400).json({ success: false, message: 'No signature' });
        }
 
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('RAZORPAY_WEBHOOK_SECRET is missing in .env');
            return res.status(500).json({ success: false, message: 'Webhook is not configured' });
        }
 
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        if (!req.rawBody) {
            console.warn('req.rawBody missing - update express.json() in server.js (see instructions)');
        }
 
        const generatedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');
 
        const generatedBuffer = Buffer.from(generatedSignature, 'hex');
        const receivedBuffer = Buffer.from(String(razorpaySignature), 'hex');
        const isGenuine =
            generatedBuffer.length === receivedBuffer.length &&
            crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
 
        if (!isGenuine) {
            console.log('Fake signature detected!');
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }
 
        console.log('Webhook signature verified!');
 
        const event = req.body.event;
        const paymentEntity =
            req.body.payload && req.body.payload.payment && req.body.payload.payment.entity;
        console.log('Webhook event:', event);
 
        if (event === 'payment.captured') {
            await handlePaymentCaptured(paymentEntity);
        } else if (event === 'payment.failed') {
            await handlePaymentFailed(paymentEntity);
        } else if (event === 'order.paid') {
            console.log('Order paid event received');
        } else {
            console.log('Unhandled event:', event);
        }
 
        res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error) {
        console.error('Webhook Error:', error);
        // 500 tells Razorpay to try again later.
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
};
 
async function handlePaymentCaptured(paymentEntity) {
    if (!paymentEntity) return;
 
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;
    console.log('Payment captured:', razorpayPaymentId);
 
    const [payments] = await db.query(
        'SELECT * FROM payments WHERE razorpay_order_id = ?',
        [razorpayOrderId]
    );
 
    if (payments.length === 0) {
        console.log('Payment not found for order:', razorpayOrderId);
        return;
    }
 
    const payment = payments[0];
 
    // Duplicate event: already handled.
    if (payment.status === 'paid') {
        console.log('Already processed:', razorpayPaymentId);
        return;
    }
 
    // Verify Payment already rejected this payment because the seat hold was lost.
    // Do not bring the booking back to life. A manual refund is needed.
    if (
        payment.status === 'failed' &&
        payment.failure_reason &&
        String(payment.failure_reason).startsWith('Seat')
    ) {
        console.log('REFUND NEEDED: payment', razorpayPaymentId, 'was captured but the seat hold was already lost.');
        return;
    }
 
    const [bookings] = await db.query(
        'SELECT id, movie_id, seat_numbers FROM bookings WHERE id = ?',
        [payment.booking_id]
    );
 
    if (bookings.length === 0) {
        console.log('Booking not found for payment:', razorpayPaymentId);
        return;
    }
 
    const booking = bookings[0];
 
    const seatConfirmed = await confirmSeatBooking(booking.movie_id, booking.seat_numbers);
 
    if (!seatConfirmed) {
        await db.query(
            `UPDATE payments
             SET status = 'failed',
                 razorpay_payment_id = ?,
                 failure_reason = 'Seat lock expired before payment was captured (refund needed)'
             WHERE razorpay_order_id = ?`,
            [razorpayPaymentId, razorpayOrderId]
        );
        await db.query(
            'UPDATE bookings SET booking_status = ? WHERE id = ?',
            ['failed', booking.id]
        );
        console.log('REFUND NEEDED: booking', booking.id, 'payment', razorpayPaymentId, '- seat hold was lost.');
        return;
    }
 
    await db.query(
        'UPDATE payments SET status = ?, razorpay_payment_id = ? WHERE razorpay_order_id = ?',
        ['paid', razorpayPaymentId, razorpayOrderId]
    );
    await db.query(
        'UPDATE bookings SET booking_status = ? WHERE id = ?',
        ['confirmed', booking.id]
    );
    // So a later Verify Payment call from the browser is treated as a harmless repeat.
    await db.query(
        "UPDATE idempotency_keys SET status = 'processed' WHERE booking_id = ? AND status = 'pending'",
        [booking.id]
    );
 
    console.log('Booking confirmed via webhook! ID:', booking.id);
}
 
async function handlePaymentFailed(paymentEntity) {
    if (!paymentEntity) return;
 
    const razorpayOrderId = paymentEntity.order_id;
    const errorReason = paymentEntity.error_description || 'Payment failed';
    console.log('Payment failed for order:', razorpayOrderId);
 
    const [payments] = await db.query(
        'SELECT booking_id, status FROM payments WHERE razorpay_order_id = ?',
        [razorpayOrderId]
    );
 
    if (payments.length === 0) {
        console.log('Payment not found for order:', razorpayOrderId);
        return;
    }
 
    // A late "failed" event must never undo a payment that already succeeded.
    if (payments[0].status === 'paid') {
        console.log('Ignoring late failed event: order is already paid', razorpayOrderId);
        return;
    }
 
    await db.query(
        'UPDATE payments SET status = ?, failure_reason = ? WHERE razorpay_order_id = ?',
        ['failed', errorReason, razorpayOrderId]
    );
    await db.query(
        'UPDATE bookings SET booking_status = ? WHERE id = ?',
        ['failed', payments[0].booking_id]
    );
    console.log('Booking marked failed. ID:', payments[0].booking_id);
}
 
module.exports = handleRazorpayWebhook;
 