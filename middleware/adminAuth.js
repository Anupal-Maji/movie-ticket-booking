 
const jwt = require('jsonwebtoken');
const redisClient = require('../config/redisClient');
 
async function verifyAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
 
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Access denied.' });
  }
 
  const token = authHeader.split(' ')[1];
 
  try {

    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'This session has been logged out.' });
    }
 
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
 
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return res.status(403).json({ error: 'Insufficient privileges.' });
    }
 
    req.admin = decoded;   
    req.token = token;     
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
 
module.exports = { verifyAdminToken };
