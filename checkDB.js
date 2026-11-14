// checkDb.js
// Tests the database login the same way the app does.
// It NEVER prints the password, only its length and yes/no results.
//
// Run from your movie-app folder:
//   node checkDb.js
 
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
 
// What is written in the .env file itself
const fileValues = dotenv.parse(fs.readFileSync(path.join(process.cwd(), '.env')));
 
// What the app receives (dotenv does not replace variables that already exist
// in Windows, so an old DB_PASS setting would win here)
dotenv.config({ quiet: true });
 
const fromFile = fileValues.DB_PASS || '';
const fromApp = process.env.DB_PASS || '';
 
console.log('DB_HOST in .env file            :', JSON.stringify(fileValues.DB_HOST));
console.log('DB_USER in .env file            :', JSON.stringify(fileValues.DB_USER));
console.log('DB_NAME in .env file            :', JSON.stringify(fileValues.DB_NAME));
console.log('Password length in .env file    :', fromFile.length);
console.log('Password length the app receives:', fromApp.length);
console.log('Same value in file and in app?  :', fromFile === fromApp);
console.log('');
 
async function tryLogin(label, host, password) {
  try {
    const connection = await mysql.createConnection({
      host,
      port: 3306,
      user: fileValues.DB_USER || 'root',
      password,
      database: fileValues.DB_NAME || 'moviedb',
    });
    await connection.query('SELECT 1');
    await connection.end();
    console.log(label, '-> OK');
  } catch (err) {
    console.log(label, '-> FAILED:', err.code, '-', err.message);
  }
}
 
(async () => {
  await tryLogin('Login with the .env file value    @ 127.0.0.1', '127.0.0.1', fromFile);
  await tryLogin('Login with the value the app gets @ 127.0.0.1', '127.0.0.1', fromApp);
  await tryLogin('Login with the .env file value    @ localhost', 'localhost', fromFile);
})();
 