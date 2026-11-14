const { confirmSeatBooking } = require('./controllers/seatBookingHelper');

confirmSeatBooking(1, 'F9').then(result => {
    console.log('confirmSeatBooking result:', result);
    process.exit(0);
});