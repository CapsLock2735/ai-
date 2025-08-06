import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = Redis.fromEnv({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// --- 增加带重试的 getUsernameByToken 函数 ---
async function getUsernameByTokenWithRetry(token, retries = 3, delay = 100) {
    for (let i = 0; i < retries; i++) {
        try {
            const username = await redis.get(`token:${token}`);
            if (username) {
                // 成功获取，立即返回
                console.log(`Attempt ${i + 1}: Successfully found username for token.`);
                return username;
            }
            // 未找到，打印警告，准备重试
            console.warn(`Attempt ${i + 1}: Username not found for token. Retrying in ${delay}ms...`);
        } catch (error) {
            // 如果 redis 命令本身出错，也打印并重试
            console.error(`Attempt ${i + 1}: Redis error`, error);
        }
        // 等待一小段时间再进行下一次尝试
        if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    // 所有重试都失败后，返回 null
    console.error(`All ${retries} retries failed to find username for token.`);
    return null;
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

    // --- 使用带重试的函数 ---
    const username = await getUsernameByTokenWithRetry(token);
    if (!username) {
        // 即使重试后依然失败，我们返回一个明确的 403 错误，而不是让它变成 404
        return new Response(JSON.stringify({ message: '无效或过期的 Token (after retries)' }), { status: 403, headers });
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
