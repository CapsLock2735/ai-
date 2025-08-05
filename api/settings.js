// /api/settings.js
import { kv } from '@vercel/kv';

async function getUsernameFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const userData = await kv.get(`token:${token}`);
  return userData ? userData.username : null;
}

export default async function handler(request) {
  try {
    const username = await getUsernameFromToken(request);
    if (!username) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const settingsKey = `settings:${username}`;

    if (request.method === 'GET') {
      const settings = await kv.get(settingsKey);
      return new Response(JSON.stringify(settings || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } 
    
    if (request.method === 'POST') {
      const settingsData = await request.json();
      await kv.set(settingsKey, settingsData);
      return new Response(JSON.stringify({ message: 'Settings saved successfully.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}