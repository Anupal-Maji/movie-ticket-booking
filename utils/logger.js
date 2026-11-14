const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../email-errors.log');

function logEmailFailure(bookingDetails, errorMessage) {

  const now = new Date();

  const timestamp = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const logEntry = `
[${timestamp}] EMAIL FAILED
  Booking ID : #${bookingDetails.booking_id}
  User       : ${bookingDetails.user_name}
  Email      : ${bookingDetails.user_email}
  Movie      : ${bookingDetails.movie_name}
  Theatre    : ${bookingDetails.theatre_name}
  Show Date  : ${bookingDetails.show_date}
  Show Time  : ${bookingDetails.show_time}
  Seats      : ${bookingDetails.seat_numbers}
  Payment ID : ${bookingDetails.payment_id}
  Reason     : ${errorMessage}
`;

fs.appendFileSync(LOG_FILE, logEntry, 'utf8');

console.error(`Failure logged to email-errors.log`);
}

module.exports = { logEmailFailure };
