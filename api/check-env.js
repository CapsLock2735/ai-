// /api/check-env.js
// 这个文件是我们的“诊断工具”，用来检查服务器环境变量

export default async function handler(request) {
  // 我们要检查的环境变量的名称
  // Vercel 会自动设置这些变量，可能是 KV_ 开头，也可能是 UPSTASH_ 开头
  const keysToCheck = [
    'KV_URL',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'KV_REST_API_READ_ONLY_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];

  // 创建一个对象来存储我们找到的结果
  const foundVariables = {};

  // 遍历我们要检查的每一个key
  for (const key of keysToCheck) {
    // process.env 是 Node.js 中存放所有环境变量的地方
    // 我们检查这个key是否存在，并且有值
    if (process.env[key]) {
      // 如果找到了，就把它存到我们的结果对象里
      // 为了安全，我们只显示部分token，不暴露完整的密钥
      if (key.includes('TOKEN')) {
        foundVariables[key] = `Exists, starts with: ${process.env[key].substring(0, 4)}...`;
      } else {
        foundVariables[key] = process.env[key];
      }
    }
  }

  // 将我们找到的所有环境变量以 JSON 格式返回给浏览器
  return new Response(JSON.stringify(foundVariables, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}