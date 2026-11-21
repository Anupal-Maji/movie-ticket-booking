const mysql = require('mysql2/promise');
require('dotenv').config();

const useSsl = process.env.DB_SSL === 'true';
let ssl;
if (useSsl) {
    ssl = process.env.DB_CA
        ? { ca: process.env.DB_CA }
        : { rejectUnauthorized: false };
}

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'moviedb',
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

(async () => {
    try {
        const connection = await db.getConnection();
        console.log('Connected to MySQL database!');
        connection.release();
    } catch (err) {
        console.log('Database connection failed:', err.message);
    }
})();

module.exports = db;
