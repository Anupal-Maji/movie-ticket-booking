const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function buildEmailHTML(bookingDetails) {

  const templatePath = path.join(__dirname,'../templates/confirmationEmail.hbs');

  const templateSource = fs.readFileSync(templatePath, 'utf8');

  const template = handlebars.compile(templateSource);

  return template(bookingDetails);
}  

async function sendConfirmationEmail(bookingDetails) {
  

  const htmlContent = buildEmailHTML(bookingDetails);

  const mailOptions = {
    from: `"Movie Ticket Booking" <${process.env.EMAIL_USER}>`,
    to: bookingDetails.user_email,
    subject: `Booking Confirmed - ${bookingDetails.movie_name}`,
    html: htmlContent
  };

  return await transporter.sendMail(mailOptions);
}


module.exports = {
  sendConfirmationEmail
};
  