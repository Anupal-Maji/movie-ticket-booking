// setAdminPassword.js
// Hashes a password with bcrypt and saves it straight into the admins table.
// You do NOT need to copy or paste any hash.
//
// Run from your movie-app folder:
//   node setAdminPassword.js admin_demo Demo@1234
//
// Uses your existing ./config/db connection and your .env settings.

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./config/db');

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log('Usage: node setAdminPassword.js <username> <password>');
    console.log('Example: node setAdminPassword.js admin_demo Demo@1234');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    // Make sure the admin row exists, then set its hash.
    const [existing] = await db.query(
      'SELECT id FROM admins WHERE username = ?',
      [username]
    );

    if (existing.length === 0) {
      await db.query(
        'INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)',
        [username, hash, 'admin']
      );
      console.log('Created new admin:', username);
    } else {
      await db.query(
        'UPDATE admins SET password_hash = ? WHERE username = ?',
        [hash, username]
      );
      console.log('Updated password for admin:', username);
    }

    // Prove it worked without printing the full hash.
    const [rows] = await db.query(
      'SELECT username, LEFT(password_hash, 7) AS hash_start, LENGTH(password_hash) AS hash_length FROM admins WHERE username = ?',
      [username]
    );
    console.log('Check:', rows[0]);
    console.log('If hash_start is $2b$10$ and hash_length is 60, it worked.');
    process.exit(0);
  } catch (err) {
    console.error('Something went wrong:', err.message);
    process.exit(1);
  }
}

main();
