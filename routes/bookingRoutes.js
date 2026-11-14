const express = require('express');
const router = express.Router();

const db = require('../db');
const { addToEmailQueue } = require('../utils/emailQueue');
router.post('/book-ticket', async(req,res) => {

    console.log(req.body);

  const {
      user_name,
      user_email,
      movie_name,
      theatre_name,
      show_date,
      show_time,
      seat_numbers,
      payment_id
  } = req.body;

  if (
       !user_name ||
       !user_email ||
       !movie_name ||
       !theatre_name ||
       !show_date ||
       !show_time ||
       !seat_numbers ||
       !payment_id 
  ) {
       return res.status(400).json({
          success: false,
          message: 'Please provide all the booking details'
       });
  }
  
  const query = `
      INSERT INTO bookings
      (
          user_name,
          user_email,
          movie_name,
          theatre_name,
          show_date,
          show_time,
          seat_numbers,
          payment_id
      )    
      VALUES (?,?,?,?,?,?,?,?)
    `;
    
    const values = [
        user_name,
        user_email,
        movie_name,
        theatre_name,
        show_date,
        show_time,
        seat_numbers,
        payment_id
    ];

    try {
      
      console.log('Running INSERT query...');

      const [result] = await db.query(query, values);

      console.log('INSERT successful');
      
      res.status(201).json ({
            success: true,
            message: 'Booking confirmed!',
            booking_id: result.insertId
    });

    addToEmailQueue({
        user_name,
        user_email,
        movie_name,
        theatre_name,
        show_date,
        show_time,
        seat_numbers,
        payment_id,
        booking_id: result.insertId
    });

    console.log('Email queue called');

  } catch (error) {
      
      console.error('Booking SQL Error:', error.message);

      return res.status(500).json({
          success: false,
          message: error.message
      });
  }  
  });

      module.exports = router;