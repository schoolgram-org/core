import { Client } from 'pg';
import { DATABASE_URL } from './config';

const client = new Client({
    connectionString: DATABASE_URL,
});

export const connectDB = async () => {
    await client.connect();
};

export const saveUserData = async (login: string, password: string, school: string, url: string) => {
    const query = 'INSERT INTO users(login, password, school, url) VALUES($1, $2, $3, $4)';
    await client.query(query, [login, password, school, url]);
};

export const closeDB = async () => {
    await client.end();
};
