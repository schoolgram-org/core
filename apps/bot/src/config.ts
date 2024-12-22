import dotenv from 'dotenv';

dotenv.config();

export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
export const DATABASE_URL = process.env.DATABASE_URL!;
