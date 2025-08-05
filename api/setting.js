import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

async function getUserByToken(token) {
    // 我们需要一个反向查找：从token找到user
    // 注册时，我们用 user:username 存了用户信息
    // 我们需要一个新的索引: token:uuid -> username
    // 我们将在 auth.js 中创建这个索引
    const username = await kv.get(`token:${token}`);
    return username;
}

export default async function handler(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ message: '未授权' }), { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const username = await getUserByToken(token);
    if (!username) {
        return new Response(JSON.stringify({ message: '无效的Token' }), { status: 403 });
    }

    const settingsKey = `settings:${token}`;

    if (request.method === 'GET') {
        const settings = await kv.get(settingsKey);
        return new Response(JSON.stringify({ username, settings: settings || {} }), { status: 200 });
    }

    if (request.method === 'POST') {
        const settingsData = await request.json();
        await kv.set(settingsKey, settingsData);
        return new Response(JSON.stringify({ message: '设置已保存' }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
}