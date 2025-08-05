import * as bcrypt from 'bcrypt-ts';
import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

// 盐的轮次，越高越安全，但性能开销越大
const SALT_ROUNDS = 10;

export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const { action, username, password } = await request.json();

        if (!username || !password || !action) {
            return new Response(JSON.stringify({ message: '缺少参数' }), { status: 400 });
        }

        const userKey = `user:${username}`;

        if (action === 'register') {
            const existingUser = await kv.get(userKey);
            if (existingUser) {
                return new Response(JSON.stringify({ message: '用户名已存在' }), { status: 409 });
            }

            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            const token = crypto.randomUUID();
            
            await kv.set(userKey, { passwordHash });
            await kv.set(`token:${token}`, username); // 建立 token -> username 的反向索引

            return new Response(JSON.stringify({ message: '注册成功', token }), { status: 201 });
        }

        if (action === 'login') {
            const user = await kv.get(userKey);
            if (!user) {
                return new Response(JSON.stringify({ message: '用户名或密码错误' }), { status: 401 });
            }

            const passwordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!passwordMatch) {
                return new Response(JSON.stringify({ message: '用户名或密码错误' }), { status: 401 });
            }

            const token = crypto.randomUUID();
            await kv.set(`token:${token}`, username); // 每次登录都生成新 token

            return new Response(JSON.stringify({ message: '登录成功', token }), { status: 200 });
        }

        return new Response(JSON.stringify({ message: '无效的操作' }), { status: 400 });

    } catch (error) {
        console.error('Auth API Error:', error);
        return new Response(JSON.stringify({ message: '服务器内部错误' }), { status: 500 });
    }
}
