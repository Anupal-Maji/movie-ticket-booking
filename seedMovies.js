// seedMovies.js
// Fills the movies table in moviedb_test with 5,000 fake movies, so Task 1's
// filtering can be tested at the "5,000+ movies" scale the brief asks for.
// This NEVER touches your real moviedb: the database name is typed in below.
//
// Run from your movie-app folder:
//   node seedMovies.js
 
const mysql = require('mysql2/promise');
require('dotenv').config();
 
const TOTAL_ROWS = 5000;
const BATCH_SIZE = 1000;
 
const genres = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Romance', 'Horror', 'Animation'];
const languages = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam'];
 
function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
 
function randomRating() {
  // decimal(3,1): 1.0 to 9.9
  return (Math.floor(Math.random() * 90) / 10 + 1).toFixed(1);
}
 
function randomReleaseDate() {
  const start = new Date('1990-01-01').getTime();
  const end = new Date('2026-06-30').getTime();
  const d = new Date(start + Math.random() * (end - start));
  return d.toISOString().slice(0, 10);
}
 
async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: 'moviedb_test',
  });
 
  console.log('Connected to moviedb_test. Seeding', TOTAL_ROWS, 'fake movies...');
 
  let inserted = 0;
 
  for (let batchStart = 0; batchStart < TOTAL_ROWS; batchStart += BATCH_SIZE) {
    const rows = Math.min(BATCH_SIZE, TOTAL_ROWS - batchStart);
    const values = [];
    const placeholders = [];
 
    for (let i = 0; i < rows; i++) {
      const n = batchStart + i + 1;
      values.push(
        `Test Movie ${n}`,
        randomFrom(genres),
        randomFrom(languages),
        randomRating(),
        randomReleaseDate(),
        null
      );
      placeholders.push('(?,?,?,?,?,?)');
    }
 
    await db.execute(
      `INSERT INTO movies (title, genre, language, rating, release_date, trailer_url)
       VALUES ${placeholders.join(',')}`,
      values
    );
 
    inserted += rows;
    console.log(`Inserted ${inserted} / ${TOTAL_ROWS}`);
  }
 
  console.log('Done. moviedb_test.movies now has', TOTAL_ROWS, 'fake movies.');
  await db.end();
}
 
main().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
 