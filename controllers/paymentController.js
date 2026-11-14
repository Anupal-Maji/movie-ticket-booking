const razorpayInstance = require('../config/razorpay');
const crypto = require('crypto');
const db = require('../config/db');
const { confirmSeatBooking } = require('./seatBookingHelper');

const createOrder = async (req, res) => {
    try {
        const { booking_id } = req.body;
 
        if (!booking_id) {
            return res.status(400).json({
                success: false,
                message: 'booking_id is required'
            });
        }
 
        const [bookingRows] = await db.query(
            'SELECT * FROM bookings WHERE id = ?',
            [booking_id]
        );
 
        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
 
        const booking = bookingRows[0];

        const amount = Number(booking.total_amount);
 
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking amount.'
            });
        }
 
        if (booking.booking_status === 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'This booking is already confirmed'
            });
        }
 
        const amountInPaise = Math.round(amount * 100);
        const idempotencyKey = crypto.randomUUID();
 
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `booking_${booking_id}_${Date.now()}`,
        });
 
        await db.query(
            'INSERT INTO idempotency_keys (idempotency_key, booking_id, status) VALUES (?, ?, ?)',
            [idempotencyKey, booking_id, 'pending']
        );
 
        await db.query(
            `INSERT INTO payments
            (booking_id, razorpay_order_id, razorpay_payment_id, amount, currency, status)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [booking_id, razorpayOrder.id, null, amountInPaise, 'INR', 'pending']
        );
 
        res.status(200).json({
            success: true,
            order_id: razorpayOrder.id,
            amount: amountInPaise,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID,
            idempotency_key: idempotencyKey,
        });
 
    } catch (error) {
        console.error("=== CREATE ORDER ERROR ===");
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Something went wrong while creating order'
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            booking_id,
            idempotency_key
        } = req.body;
 
        if (
            !razorpay_payment_id ||
            !razorpay_order_id   ||
            !razorpay_signature  ||
            !booking_id          ||
            !idempotency_key
        ) {
            return res.status(400).json({
                success: false,
                message: 'Missing payment details'
            });
        }
 
        const [existingKey] = await db.query(
            'SELECT * FROM idempotency_keys WHERE idempotency_key = ?',
            [idempotency_key]
        );
 
        if (existingKey.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid idempotency key'
            });
        }

        if (String(existingKey[0].booking_id) !== String(booking_id)) {
            return res.status(400).json({
                success: false,
                message: 'Idempotency key does not match this booking'
            });
        }
 
        if (existingKey[0].status === 'processed') {
            return res.status(200).json({
                success: true,
                message: 'Payment already processed (duplicate request blocked)',
                alreadyProcessed: true
            });
        }

        const [orderRows] = await db.query(
            'SELECT booking_id FROM payments WHERE razorpay_order_id = ?',
            [razorpay_order_id]
        );
 
        if (
            orderRows.length === 0 ||
            String(orderRows[0].booking_id) !== String(booking_id)
        ) {
            return res.status(400).json({
                success: false,
                message: 'This payment order does not belong to this booking'
            });
        }
 
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        const generatedBuffer = Buffer.from(generatedSignature, 'hex');
        const receivedBuffer = Buffer.from(String(razorpay_signature), 'hex');
        const isGenuine =
            generatedBuffer.length === receivedBuffer.length &&
            crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
 
        if (!isGenuine) {
            await db.query(
                `UPDATE payments
                 SET status = 'failed',
                     failure_reason = 'Signature mismatch - possible fraud'
                 WHERE razorpay_order_id = ?`,
                [razorpay_order_id]
            );
 
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed. Possible fraud detected.'
            });
        }
 
        await db.query(
            `UPDATE payments
             SET status = 'paid',
                 razorpay_payment_id = ?,
                 razorpay_signature = ?
             WHERE razorpay_order_id = ?`,
            [razorpay_payment_id, razorpay_signature, razorpay_order_id]
        );
 
        const [bookingRows] = await db.query(
            'SELECT movie_id, seat_numbers FROM bookings WHERE id = ?',
            [booking_id]
        );
 
        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
 
        const seatConfirmed = await confirmSeatBooking(
            bookingRows[0].movie_id,
            bookingRows[0].seat_numbers
        );
 
        if (!seatConfirmed) {
            await db.query(
                `UPDATE payments
                 SET status = 'failed',
                     failure_reason = 'Seat lock expired before payment completed'
                 WHERE razorpay_order_id = ?`,
                [razorpay_order_id]
            );
 
            await db.query(
                `UPDATE bookings
                 SET booking_status = 'failed'
                 WHERE id = ?`,
                [booking_id]
            );
 
            return res.status(409).json({
                success: false,
                message: 'Your seat hold expired before payment completed. Please select your seat again and retry.'
            });
        }
 
        await db.query(
            `UPDATE bookings
             SET booking_status = 'confirmed'
             WHERE id = ?`,
            [booking_id]
        );
 
        await db.query(
            `UPDATE idempotency_keys
             SET status = 'processed'
             WHERE idempotency_key = ?`,
            [idempotency_key]
        );
 
        res.status(200).json({
            success: true,
            message: 'Payment verified successfully!',
            payment_id: razorpay_payment_id
        });
 
    } catch (error) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed due to server error'
        });
    }
};

module.exports = { createOrder, verifyPayment };
 