const pool = require('./config/db');

async function testConnection() {
    try {
        console.log('Testing MySQL Database connection...');
        const [rows] = await pool.query('SELECT 1 + 1 AS solution');
        console.log('Database connected successfully!');
        console.log('Test Query Result:', rows[0].solution);
        process.exit(0);
    } catch (error) {
        console.error('Database connection failed!');
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

testConnection();
