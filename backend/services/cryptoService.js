/**
 * 返乡日记 V2 - AES-256-GCM 加解密服务
 * 使用 Node.js 内置 crypto 模块
 */

const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12       // bytes (96 bits) — GCM recommended
const AUTH_TAG_LENGTH = 16 // bytes (128 bits)

/**
 * 加密明文内容
 * @param {string} plaintext - 明文内容
 * @param {Buffer} encryptionKey - 32 bytes AES-256 密钥
 * @returns {string} JSON 字符串 {c, i, t}
 *   c = ciphertext (hex)
 *   i = initialization vector (hex)
 *   t = auth tag (hex)
 */
function encrypt(plaintext, encryptionKey) {
  if (!plaintext) return null
  if (!encryptionKey || !Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new Error('Invalid encryption key: must be a 32-byte Buffer')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    c: encrypted,
    i: iv.toString('hex'),
    t: authTag.toString('hex'),
  })
}

/**
 * 解密密文到明文
 * @param {string} encryptedStr - JSON 字符串 {c, i, t}
 * @param {Buffer} encryptionKey - 32 bytes AES-256 密钥
 * @returns {string} 明文内容
 */
function decrypt(encryptedStr, encryptionKey) {
  if (!encryptedStr) return null
  if (!encryptionKey || !Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new Error('Invalid encryption key: must be a 32-byte Buffer')
  }

  let data
  try {
    data = JSON.parse(encryptedStr)
  } catch {
    throw new Error('Invalid encrypted data format: not valid JSON')
  }

  const { c: ciphertext, i: ivHex, t: authTagHex } = data

  if (!ciphertext || !ivHex || !authTagHex) {
    throw new Error('Missing required encrypted data fields: c, i, t')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey,
    Buffer.from(ivHex, 'hex'),
    { authTagLength: AUTH_TAG_LENGTH }
  )

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * 批量重加密（用于修改密码时的数据迁移）
 * @param {Array<{id: string, content_encrypted: string}>} entries - 条目列表
 * @param {Buffer} oldKey - 旧加密密钥
 * @param {Buffer} newKey - 新加密密钥
 * @returns {Array<{id: string, content_encrypted: string}>} 重加密后的条目
 */
function batchReencrypt(entries, oldKey, newKey) {
  return entries.map((entry) => {
    if (!entry.content_encrypted) {
      // 无加密内容：尝试用旧内容解密（兼容旧数据）
      return entry
    }
    const plaintext = decrypt(entry.content_encrypted, oldKey)
    const newEncrypted = encrypt(plaintext, newKey)
    return { id: entry.id, content_encrypted: newEncrypted }
  })
}

module.exports = { encrypt, decrypt, batchReencrypt }
