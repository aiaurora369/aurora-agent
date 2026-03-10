require('dotenv').config();
console.log('X keys present:');
console.log('  X_API_KEY:', !!process.env.X_API_KEY);
console.log('  X_API_SECRET:', !!process.env.X_API_SECRET);
console.log('  X_ACCESS_TOKEN:', !!process.env.X_ACCESS_TOKEN);
console.log('  X_ACCESS_TOKEN_SECRET:', !!process.env.X_ACCESS_TOKEN_SECRET);
