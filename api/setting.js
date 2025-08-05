import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

async function getUsernameByToken(token) {
    // 增加日志，确认函数被调用
    console.log('Attempting to get username for a token.');
    if (!token) {
        console.error('getUsernameByToken received a null or undefined token.');
        return null;
    }
    try {
        const username = await kv.get(`token:${token}`);
        if (!username) {
            console.warn(`Token not found in KV store. Token: ${token}`);
            return null;
        }
        console.log(`Successfully found username: ${username} for token.`);
        return username;
    } catch (error) {
        console.error(`KV error in getUsernameByToken for token ${token}:`, error);
        return null;
    }
}

export default async function handler(request) {
    const headers = { 'Content-Type': 'application/json' };

    // 检查请求方法，如果不是 GET 或 POST，提前拒绝
    if (request.method !== 'GET' && request.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ message: '未提供授权 Token' }), { status: 401, headers });
    }
    const token = authHeader.split(' ')[1];

    const username = await getUsernameByToken(token);
    if (!username) {
        return new Response(JSON.stringify({ message: '无效或过期的 Token' }), { status: 403, headers });
    }

    const settingsKey = `settings:${username}`;

    try {
        if (request.method === 'GET') {
            console.log(`Handling GET request for user: ${username}`);
            const settings = await kv.get(settingsKey);
            return new Response(JSON.stringify({ username, settings: settings || null }), { status: 200, headers });
        }

        if (request.method === 'POST') {
            console.log(`Handling POST request for user: ${username}`);
            const settingsData = await request.json();
            await kv.set(settingsKey, settingsData);
            return new Response(JSON.stringify({ message: '设置已保存至云端' }), { status: 200, headers });
        }
    } catch (error) {
        console.error(`API logic error for user ${username}. Method: ${request.method}. Error:`, error);
        return new Response(JSON.stringify({ message: '服务器内部错误' }), { status: 500, headers });
    }
}
