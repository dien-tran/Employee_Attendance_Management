/**
 * Seed Data Script — EAMS
 * 
 * Seeds the database with:
 * 1. Departments (from front-end mock-data)
 * 2. Admin account (bcrypt hashed password)
 * 3. Sample employees (matching front-end mock-data)
 * 4. Face data records for employees
 * 
 * Usage: node database/seeds/seed_data.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../../config/db');

const SALT_ROUNDS = 10;

// ============================================================
// 1. Departments — from front-end mock-data.ts
// ============================================================
const departments = [
    'Engineering',
    'Product',
    'Design',
    'Human Resources',
    'Analytics',
    'Marketing'
];

// ============================================================
// 2. Users — Admin + Employees matching front-end mock-data
// ============================================================
const usersData = [
    // Admin account
    {
        name: 'Admin User',
        email: 'admin@company.com',
        phone: '0900000000',
        password: 'admin123',
        role: 'ADMIN',
        department: null,
        position: 'System Administrator',
        avatar_url: null
    },
    // Employees (matching front-end mock-data.ts)
    {
        name: 'Dien Tran',
        email: 'dientran@gmail.com',
        phone: '0987654321',
        password: '123123',
        role: 'USER',
        department: 'Engineering',
        position: 'Senior Developer',
        avatar_url: null,
    },
    {
        name: 'Sarah Chen',
        email: 'sarah.chen@company.com',
        phone: '0900000001',
        password: 'user123',
        role: 'USER',
        department: 'Engineering',
        position: 'Senior Developer',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    }
];

// ============================================================
// Seed Execution
// ============================================================
async function seed() {
    let connection;

    try {
        connection = await pool.getConnection();
        console.log('[SEED] Connected to database.\n');

        // --- Disable FK checks for clean seed ---
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // --- Clear existing data (reverse dependency order) ---
        console.log('[SEED] Clearing existing data...');
        await connection.query('TRUNCATE TABLE attendance_audit_logs');
        await connection.query('TRUNCATE TABLE attendance_logs');
        await connection.query('TRUNCATE TABLE attendance_records');
        await connection.query('TRUNCATE TABLE devices');
        await connection.query('TRUNCATE TABLE face_data');
        await connection.query('TRUNCATE TABLE users');
        await connection.query('TRUNCATE TABLE departments');
        console.log('[SEED] ✓ Tables cleared.\n');

        // --- Re-enable FK checks ---
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        // --- 1. Seed Departments ---
        console.log('[SEED] Inserting departments...');
        const deptMap = {};
        for (const dept of departments) {
            const [result] = await connection.query(
                'INSERT INTO departments (name) VALUES (?)',
                [dept]
            );
            deptMap[dept] = result.insertId;
            console.log(`  ✓ ${dept} (id: ${result.insertId})`);
        }
        console.log(`[SEED] ✓ ${departments.length} departments inserted.\n`);

        // --- 2. Seed Users ---
        console.log('[SEED] Inserting users...');
        const userIdMap = {};
        for (const user of usersData) {
            const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
            const departmentId = user.department ? deptMap[user.department] : null;

            const [result] = await connection.query(
                `INSERT INTO users (name, email, phone, password_hash, role, department_id, position, avatar_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user.name,
                    user.email,
                    user.phone,
                    hashedPassword,
                    user.role,
                    departmentId,
                    user.position,
                    user.avatar_url
                ]
            );
            userIdMap[user.email] = result.insertId;
            const roleTag = user.role === 'ADMIN' ? 'ADMIN' : 'USER';
            console.log(`  ✓ ${user.name} [${roleTag}] (id: ${result.insertId})`);
        }
        console.log(`[SEED] ✓ ${usersData.length} users inserted.\n`);

        // --- 3. Seed Face Data (for non-admin users, matching FE mock idx % 3 !== 0) ---
        console.log('[SEED] Inserting face data...');
        let faceCount = 0;
        const employeeUsers = usersData.filter(u => u.role === 'USER');
        for (let i = 0; i < employeeUsers.length; i++) {
            const user = employeeUsers[i];
            const userId = userIdMap[user.email];
            const hasFaceData = i % 3 !== 0; // Matches FE mock pattern

            if (hasFaceData) {
                await connection.query(
                    `INSERT INTO face_data (user_id, registered_at)
                     VALUES (?, ?)`,
                    [
                        userId,
                        new Date()
                    ]
                );
            }
            faceCount++;
            const badge = hasFaceData ? 'yes' : 'no';
            console.log(`  ${badge} ${user.name} — hasFaceData: ${hasFaceData}`);
        }
        console.log(`[SEED] ✓ ${faceCount} face data records inserted.\n`);

        // --- Summary ---
        console.log('═══════════════════════════════════════════');
        console.log('  SEED COMPLETE');
        console.log('═══════════════════════════════════════════');
        console.log(`  Departments : ${departments.length}`);
        console.log(`  Users       : ${usersData.length} (1 Admin + ${usersData.length - 1} Users)`);
        console.log(`  Face Data   : ${faceCount}`);
        console.log('───────────────────────────────────────────');
        console.log('  🔑 Admin Login:');
        console.log('     Email    : admin@company.com');
        console.log('     Password : admin123');
        console.log('  🔑 User Login:');
        console.log('     Email    : dientran@gmail.com');
        console.log('     Password : 123123');
        console.log('═══════════════════════════════════════════\n');

    } catch (error) {
        console.error('[SEED] ❌ Error:', error.message);
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

seed().catch(() => process.exit(1));
