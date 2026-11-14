// Run this once to generate a hashed password for your admin account.
// Usage:  node config/hashPassword.js YourChosenPassword
//
// Copy the printed hash into sql/001_admin_dashboard_setup.sql,
// then run that SQL file against your database.
//
// npm install bcrypt   (if not already installed)

const bcrypt = require('bcrypt');

const plainPassword = process.argv[2];

if (!plainPassword) {
  console.log('Usage: node config/hashPassword.js YourChosenPassword');
  process.exit(1);
}

const SALT_ROUNDS = 10;

bcrypt.hash(plainPassword, SALT_ROUNDS, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  console.log('\nHashed password (copy this into your SQL INSERT):\n');
  console.log(hash);
  console.log('\nDone. Never store the plain password anywhere.\n');
});
