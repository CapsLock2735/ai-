import { Redis } from '@upstash/redis';
import * as bcrypt from 'bcrypt-ts';

export const config = {
  runtime: 'edge',
};

const redis = Redis.fromEnv({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// --- 认证逻辑 (不变) ---
async function handleAuth(payload) {
    const { action, username, password } = payload;
    if (!username || !password || !action) {
        throw { status: 400, message: '缺少认证参数' };
    }
    
    const userKey = `user:${username}`;
    if (action === 'register') {
        if (await redis.get(userKey)) {
            throw { status: 409, message: '用户名已存在' };
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const token = crypto.randomUUID();
        await redis.set(userKey, { passwordHash });
        await redis.set(`token:${token}`, username);
        return { status: 201, body: { message: '注册成功', token } };
    }
    if (action === 'login') {
        const user = await redis.get(userKey);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            throw { status: 401, message: '用户名或密码错误' };
        }
        const token = crypto.randomUUID();
        await redis.set(`token:${token}`, username);
        return { status: 200, body: { message: '登录成功', token } };
    }
    throw { status: 400, message: '无效的认证操作' };
}

// --- 设置逻辑 (不变) ---
async function handleSettings(request, username) {
    const settingsKey = `settings:${username}`;
    if (request.method === 'GET') {
        const settings = await redis.get(settingsKey);
        return { status: 200, body: { username, settings: settings || null } };
    }
    if (request.method === 'POST') {
        const settingsData = await request.json();
        await redis.set(settingsKey, settingsData);
        return { status: 200, body: { message: '设置已保存至云端' } };
    }
    throw { status: 405, message: '无效的设置操作方法' };
}

// --- 新增：运行时状态逻辑 ---
async function handleRuntime(request, username) {
    const runtimeKey = `runtime:${username}`;
    if (request.method === 'GET') {
        const runtimeState = await redis.get(runtimeKey);
        return { status: 200, body: { runtime: runtimeState || null } };
    }
    if (request.method === 'POST') {
        const runtimeData = await request.json();
        // 设置一个过期时间，比如 24 小时，避免旧数据永久留存
        await redis.set(runtimeKey, runtimeData, { ex: 86400 }); 
        return { status: 200, body: { message: '运行时状态已同步' } };
    }
    throw { status: 405, message: '无效的运行时操作方法' };
}


// --- 主处理函数 (修改) ---
export default async function handler(request) {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const url = new URL(request.url);
        const route = url.searchParams.get('route');

        let result;
        if (route === 'auth') {
            const payload = await request.json();
            result = await handleAuth(payload);
        } else {
            // 对于 settings 和 runtime，都需要先验证 token
            const authHeader = request.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw { status: 401, message: '未提供授权 Token' };
            }
            const token = authHeader.split(' ')[1];
            const username = await redis.get(`token:${token}`);
            if (!username) {
                throw { status: 403, message: '无效或过期的 Token' };
            }

            if (route === 'settings') {
                result = await handleSettings(request, username);
            } else if (route === 'runtime') {
                result = await handleRuntime(request, username);
            } else {
                throw { status: 404, message: '无效的路由' };
            }
        }
        
        return new Response(JSON.stringify(result.body), { status: result.status, headers });

    } catch (error) {
        const status = error.status || 500;
        const message = error.message || '服务器内部错误';
        console.error('API Handler Error:', { status, message, error });
        return new Response(JSON.stringify({ message }), { status, headers });
    }
}
