
const express = require('express');
const router = express.Router();
 
const { adminLogin, adminLogout } = require('../controllers/adminAuthController');
const { verifyAdminToken } = require('../middleware/adminAuth');
const {
  getRevenue,
  getPopularMovies,
  getBusiestTheatres,
  getPeakBookingHours,
  getCancellationRate,
} = require('../controllers/analyticsController');
 

router.post('/login', adminLogin);
 

router.post('/logout', verifyAdminToken, adminLogout);
 

router.get('/analytics/revenue', verifyAdminToken, getRevenue);
router.get('/analytics/popular-movies', verifyAdminToken, getPopularMovies);
router.get('/analytics/busiest-theatres', verifyAdminToken, getBusiestTheatres);
router.get('/analytics/peak-hours', verifyAdminToken, getPeakBookingHours);
router.get('/analytics/cancellation-rate', verifyAdminToken, getCancellationRate);
 
module.exports = router;