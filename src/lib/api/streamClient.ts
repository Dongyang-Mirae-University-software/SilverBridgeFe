import axios from 'axios';

export const streamClient = axios.create({
  baseURL: '/api/streams',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});
