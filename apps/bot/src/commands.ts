import { Bot } from 'node-telegram-bot-api';
import { saveUserData } from './database';

export const handleStart = async (bot: Bot, chatId: number) => {
    await bot.sendMessage(chatId, 'Введите ваш логин:');
};

export const handleUserData = async (bot: Bot, chatId: number, message: string, userData: any) => {
    if (!userData.login) {
        userData.login = message;
        await bot.sendMessage(chatId, 'Введите ваш пароль:');
    } else if (!userData.password) {
        userData.password = message;
        await bot.sendMessage(chatId, 'Введите вашу школу:');
    } else if (!userData.school) {
        userData.school = message;
        await bot.sendMessage(chatId, 'Введите URL:');
    } else if (!userData.url) {
        userData.url = message;
        await saveUserData(userData.login, userData.password, userData.school, userData.url);
        await bot.sendMessage(chatId, 'Данные сохранены! Выберите действие:', {
            reply_markup: {
                keyboard: [['Дневник', 'Оценки']],
                one_time_keyboard: true,
            },
        });
        // Сбросить данные после сохранения
        userData = {};
    }
};
