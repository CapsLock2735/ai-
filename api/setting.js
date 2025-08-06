import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = Redis.fromEnv({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

async function getUsernameByToken(token) {
    if (!token) return null;
    try {
        return await redis.get(`token:${token}`);
    } catch (error) {
        console.error(`Redis error in getUsernameByToken for token ${token}:`, error);
        return null;
    }
}

export default async function handler(request) {
    const headers = { 'Content-Type': 'application/json' };

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
            const settings = await redis.get(settingsKey);
            return new Response(JSON.stringify({ username, settings: settings || null }), { status: 200, headers });
        }

        if (request.method === 'POST') {
            const settingsData = await request.json();
            await redis.set(settingsKey, settingsData);
            return new Response(JSON.stringify({ message: '设置已保存至云端' }), { status: 200, headers });
        }
    } catch (error) {
        console.error(`API logic error for user ${username}. Method: ${request.method}. Error:`, error);
        return new Response(JSON.stringify({ message: '服务器内部错误' }), { status: 500, headers });
    }
}
