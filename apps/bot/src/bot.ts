import TelegramBot from 'node-telegram-bot-api';
import { connectDB, closeDB } from './database';
import { TELEGRAM_TOKEN } from './config';
import { handleStart, handleUserData } from './commands';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const userData: any = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    handleStart(bot, chatId);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;

    if (message !== '/start') {
        await handleUserData(bot, chatId, message, userData);
    }
});

const startBot = async () => {
    await connectDB();
    console.log('Бот запущен...');
};

startBot().catch(console.error);

process.on('SIGINT', async () => {
    await closeDB();
    process.exit();
});
