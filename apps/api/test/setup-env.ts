import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.join(__dirname, '..', '.env.test'), override: true });
