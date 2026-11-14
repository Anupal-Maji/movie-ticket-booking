
 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const redisClient = require('../config/redisClient');
 
async function adminLogin(req, res) {
  const { username, password } = req.body;
 
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
 
  try {
    const [rows] = await db.query(
      'SELECT id, username, password_hash, role FROM admins WHERE username = ?',
      [username]
    );
 
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
 
    const admin = rows[0];
    const passwordMatches = await bcrypt.compare(password, admin.password_hash);
 
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
 
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
 
    await db.query('UPDATE admins SET last_login = NOW() WHERE id = ?', [admin.id]);
 
    res.json({ token, role: admin.role, expiresIn: '2h' });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
}
 
async function adminLogout(req, res) {
  try {
    const token = req.token; 

    await redisClient.set(`blacklist:${token}`, 'true', { EX: 7200 });
 
    res.json({ message: 'Logged out successfully. This token is now invalid.' });
  } catch (err) {
    console.error('Admin logout error:', err);
    res.status(500).json({ error: 'Server error during logout.' });
  }
}
 
module.exports = { adminLogin, adminLogout };
