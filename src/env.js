// Render define RENDER=true en sus servidores; NODE_ENV=production cubre cualquier otro hosting
module.exports = { isProduction: process.env.RENDER === "true" || process.env.NODE_ENV === "production" };
