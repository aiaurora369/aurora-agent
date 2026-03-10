require('dotenv').config();

console.log('API Key length:', process.env.X_API_KEY?.length, '| starts:', process.env.X_API_KEY?.substring(0,5));
console.log('API Secret length:', process.env.X_API_SECRET?.length, '| starts:', process.env.X_API_SECRET?.substring(0,5));
console.log('Access Token length:', process.env.X_ACCESS_TOKEN?.length, '| starts:', process.env.X_ACCESS_TOKEN?.substring(0,5));
console.log('Access Secret length:', process.env.X_ACCESS_TOKEN_SECRET?.length, '| starts:', process.env.X_ACCESS_TOKEN_SECRET?.substring(0,5));

// Check for hidden characters
const keys = ['X_API_KEY','X_API_SECRET','X_ACCESS_TOKEN','X_ACCESS_TOKEN_SECRET'];
keys.forEach(k => {
  const v = process.env[k] || '';
  if (v !== v.trim()) console.log('WARNING: whitespace in', k);
  if (/[^a-zA-Z0-9\-_]/.test(v)) console.log('WARNING: unusual chars in', k, ':', v.replace(/[a-zA-Z0-9\-_]/g, '.'));
});
