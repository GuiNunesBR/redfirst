import path from 'node:path';

export const AUTH_DIR = path.resolve(process.cwd(), '.auth');
export const STORAGE_STATE = path.join(AUTH_DIR, 'admin.json');
export const ADMIN_FILE = path.join(AUTH_DIR, 'admin-user.json');
