#!/usr/bin/env node
/**
 * CLI script to promote a user to administrator
 * Usage: node server/scripts/makeAdmin.js <email>
 */

import { db } from '../src/db.js';

const email = process.argv[2];

if (!email || !email.includes('@')) {
  console.error('\n❌ Usage: node server/scripts/makeAdmin.js <user-email>\n');
  process.exit(1);
}

const trimmed = email.trim().toLowerCase();

const user = db.get('SELECT * FROM users WHERE LOWER(email) = ?', [trimmed]);

if (!user) {
  console.error(`\n❌ User not found with email: ${trimmed}`);
  console.error('Available users in database:');
  const allUsers = db.all('SELECT id, name, email, role, status FROM users');
  console.table(allUsers);
  process.exit(1);
}

db.run("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?", [user.id]);

const now = new Date().toISOString();
db.run(
  `INSERT INTO admin_audit_logs (
    id, admin_id, admin_email, action, target_type, target_id, target_email, details, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    `audit_cli_${Date.now()}`,
    'cli_system',
    'system_cli',
    'user.role_change',
    'user',
    user.id,
    user.email,
    `Promoted to administrator via CLI script (was ${user.role || 'user'})`,
    now
  ]
);

console.log(`\n🎉 Success! User "${user.name}" (${user.email}) is now an ADMINISTRATOR.`);
console.log('They can now access the admin console at: /admin\n');
process.exit(0);
