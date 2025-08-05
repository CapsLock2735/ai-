import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

async function getUsernameByToken(token) {
    if (!token) return null;
    return await kv.get(`token:${token}`);
}

export default async function handler(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ message: '未提供授权 Token' }), { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const username = await getUsernameByToken(token);
    if (!username) {
        return new Response(JSON.stringify({ message: '无效或过期的 Token' }), { status: 403 });
    }

    const settingsKey = `settings:${username}`;

    try {
        if (request.method === 'GET') {
            const settings = await kv.get(settingsKey);
            return new Response(JSON.stringify({ username, settings: settings || null }), { status: 200 });
        }

        if (request.method === 'POST') {
            const settingsData = await request.json();
            await kv.set(settingsKey, settingsData);
            return new Response(JSON.stringify({ message: '设置已保存至云端' }), { status: 200 });
        }

        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });

    } catch (error) {
        console.error('Settings API Error:', error);
        return new Response(JSON.stringify({ message: '服务器内部错误' }), { status: 500 });
    }
}