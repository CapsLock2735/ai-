// /api/auth.js
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(request, response) {
  // Vercel Edge Functions use the Request and Response API standard
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { username } = await request.json();
    if (!username || username.length < 3) {
      return new Response(JSON.stringify({ message: 'Username must be at least 3 characters long.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const userKey = `user:${username}`;
    let user = await kv.get(userKey);

    if (user) {
      return new Response(JSON.stringify({ message: 'Login successful.', token: user.token, username: user.username }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      const newUser = {
        username: username,
        token: uuidv4(),
        createdAt: new Date().toISOString(),
      };
      await kv.set(userKey, newUser);
      await kv.set(`token:${newUser.token}`, { username: newUser.username });
      
      return new Response(JSON.stringify({ message: 'User created successfully.', token: newUser.token, username: newUser.username }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}