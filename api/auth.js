import { Redis } from '@upstash/redis';
import * as bcrypt from 'bcrypt-ts';

export const config = {
  runtime: 'edge',
};

// --- 初始化 Redis 客户端 ---
// Redis.fromEnv() 会自动从 process.env 读取 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN
// Vercel 在连接 KV 存储时，会自动创建这些变量（或者等价的 KV_... 和 REDIS_... 变量）
// 为了保险起见，我们让它同时能识别 Vercel KV 的环境变量
const redis = Redis.fromEnv({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const SALT_ROUNDS = 10;

export default async function handler(request) {
    const headers = { 'Content-Type': 'application/json' };

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers });
    }

    try {
        const { action, username, password } = await request.json();

        if (!username || !password || !action) {
            return new Response(JSON.stringify({ message: '缺少参数' }), { status: 400, headers });
        }

        const userKey = `user:${username}`;
        const tokenKeyPrefix = 'token:';

        if (action === 'register') {
            const existingUser = await redis.get(userKey);
            if (existingUser) {
                return new Response(JSON.stringify({ message: '用户名已存在' }), { status: 409, headers });
            }

            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            const token = crypto.randomUUID();
            
            // 使用 redis.set()
            await redis.set(userKey, { passwordHash });
            await redis.set(`${tokenKeyPrefix}${token}`, username);

            return new Response(JSON.stringify({ message: '注册成功', token }), { status: 201, headers });
        }

        if (action === 'login') {
            const user = await redis.get(userKey);
            if (!user) {
                return new Response(JSON.stringify({ message: '用户名或密码错误' }), { status: 401, headers });
            }

            const passwordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!passwordMatch) {
                return new Response(JSON.stringify({ message: '用户名或密码错误' }), { status: 401, headers });
            }

            const token = crypto.randomUUID();
            await redis.set(`${tokenKeyPrefix}${token}`, username);

            return new Response(JSON.stringify({ message: '登录成功', token }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ message: '无效的操作' }), { status: 400, headers });

    } catch (error) {
        console.error('Auth API Handler Error:', error);
        return new Response(JSON.stringify({ message: '服务器内部错误' }), { status: 500, headers });
    }
}
