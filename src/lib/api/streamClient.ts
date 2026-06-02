import axios from 'axios';

export const streamClient = axios.create({
  baseURL: '/api/streams',
  timeout: 10 * 60 * 1000,
  headers: { 'Content-Type': 'application/json' },
});
