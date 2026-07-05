/**
 * 返乡日记 V2 - 认证配置
 * JWT密钥、bcrypt轮数、手机短信配置
 */
module.exports = {
  jwt: {
    accessSecret: process.env.JWT_SECRET || 'change-me-in-production-min-32-chars!!',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret-min-32-chars!',
    accessExpiresIn: '24h',
    refreshExpiresIn: '7d',
  },
  bcrypt: {
    saltRounds: 12,
  },
  sms: {
    devCode: process.env.DEV_SMS_CODE || '888888',
    codeExpiresMinutes: 5,
    resendInterval: 60, // seconds
  },
  keyDerivation: {
    iterations: 100000,
    keyLength: 32, // 256 bits
    cacheTTL: 4 * 60 * 60 * 1000, // 4 hours in ms
  },
}
