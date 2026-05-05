/**
 * Database Migration Runner — EAMS
 * 
 * Reads and executes SQL migration files in order.
 * 
 * Usage: node database/migrate.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
    // Create connection WITHOUT database selected first
    // (in case the database doesn't exist yet)
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 3306,
        multipleStatements: true  // Required for executing full SQL files
    });

    try {
        console.log('[MIGRATE] Connected to MySQL server.\n');

        // Read migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Ensures 001_, 002_, etc. order

        if (files.length === 0) {
            console.log('[MIGRATE] No migration files found.');
            return;
        }

        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf-8');

            console.log(`[MIGRATE] Running: ${file}`);
            await connection.query(sql);
            console.log(`[MIGRATE] ✓ ${file} — Success\n`);
        }

        // Verify tables created
        await connection.query(`USE ${process.env.DB_NAME}`);
        const [tables] = await connection.query('SHOW TABLES');
        console.log('═══════════════════════════════════════════');
        console.log('  MIGRATION COMPLETE');
        console.log('═══════════════════════════════════════════');
        console.log(`  Database: ${process.env.DB_NAME}`);
        console.log(`  Tables created:`);
        for (const row of tables) {
            const tableName = Object.values(row)[0];
            console.log(`    ✓ ${tableName}`);
        }
        console.log('═══════════════════════════════════════════\n');

    } catch (error) {
        console.error('[MIGRATE] ❌ Error:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

migrate().catch(() => process.exit(1));
