/**
 * 返乡日记 V2 - 一次性迁移脚本：清空 entries.content 明文
 *
 * 目的：让日记明文从 DB 彻底退出，任何路径（含直查 SQLite）都读不到明文。
 * 安全承诺 = 数据已删除（DD-A1.3），本脚本不提供任何回写/恢复明文逻辑。
 *
 * ⚠️ 一次性、不可逆操作。执行前必须先备份：
 *   cp backend/data/return-home.db backend/data/return-home-backup-$(date +%Y%m%d).db
 *
 * 用法：
 *   # 1) 备份（必须先做）
 *   cp backend/data/return-home.db backend/data/return-home-backup-$(date +%Y%m%d).db
 *
 *   # 2) dry-run 强校验（不写库）：校验将清空的行数、各明文长度、密文可解密且 == 明文
 *   node backend/scripts/clearPlaintext.js --dry-run
 *
 *   # 3) 真跑（写库，清空 content）
 *   node backend/scripts/clearPlaintext.js
 *
 * 密码来源（用于校验密文可解密）：
 *   - 环境变量 CLEAR_PLAINTEXT_PASSWORD（推荐，脚本化）
 *   - 或交互式 stdin 输入
 *   禁止硬编码密码，禁止把明文密码写入 DB。
 *
 * 防御性检查（不满足即 abort，退出码非 0，绝不丢数据）：
 *   1. 「有明文但无密文」的孤儿行必须为 0，否则 abort。
 *   2. 对每个「有明文」的行，用其所属用户的密钥解密 content_encrypted，
 *      必须成功且结果 === content，否则 abort。
 *
 * 主语句：UPDATE entries SET content = '' WHERE content IS NOT NULL AND TRIM(content) != ''
 * 注意：
 *   - 使用 SET content = ''（而非 ALTER TABLE DROP COLUMN），符合产品口径禁令（SQLite 兼容性）。
 *   - entries.content 列在 V1 schema 中为 NOT NULL，SQLite 不允许 SET NULL（会抛 NOT NULL 约束错误）。
 *     因此置为空字符串 ''。空串非明文内容，且 DD-A1.1 的判定条件为
 *     `content IS NOT NULL AND TRIM(content) != ''`，置 '' 后 TRIM('') = '' 不满足 != ''，判定为 0，通过。
 *     content 列仍保留但永不再写入真实明文。
 */

const path = require('path')
const readline = require('readline')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'return-home.db')

const KEY_ITERATIONS = 100000
const KEY_LENGTH = 32

const isDryRun = process.argv.includes('--dry-run')

/**
 * 从用户密码派生 AES-256 加密密钥（与后端 keyService.deriveKey 一致）
 */
function deriveKey(password, contentSalt) {
  return crypto.pbkdf2Sync(password, contentSalt, KEY_ITERATIONS, KEY_LENGTH, 'sha256')
}

/**
 * 解密 AES-256-GCM 密文（与 cryptoService.decrypt 一致）
 */
function decrypt(encryptedStr, key) {
  if (!encryptedStr) return null
  const { c: ciphertext, i: ivHex, t: authTagHex } = JSON.parse(encryptedStr)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex'),
    { authTagLength: 16 }
  )
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function main() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  console.log(`[clearPlaintext] DB: ${DB_PATH}`)
  console.log(`[clearPlaintext] mode: ${isDryRun ? 'DRY-RUN (不写库)' : 'EXECUTE (写库)'}`)

  // ---- 1) 检查孤儿明文（有明文但无密文）----
  const orphan = db
    .prepare(
      "SELECT COUNT(*) as c FROM entries WHERE content IS NOT NULL AND TRIM(content) != '' AND (content_encrypted IS NULL OR content_encrypted = '')"
    )
    .get()
  console.log(`[clearPlaintext] 孤儿明文（有明文无密文）行数: ${orphan.c}`)
  if (orphan.c > 0) {
    console.error('[clearPlaintext] ABORT: 存在「有明文但无密文」的孤儿行，清空将永久丢失数据。请先处理后再运行。')
    process.exit(1)
  }

  // ---- 2) 找出所有明文行 ----
  const plainRows = db
    .prepare(
      "SELECT id, user_id, content, content_encrypted FROM entries WHERE content IS NOT NULL AND TRIM(content) != ''"
    )
    .all()

  if (plainRows.length === 0) {
    console.log('[clearPlaintext] 无明文行，无需清空。')
    db.close()
    return
  }

  console.log(`[clearPlaintext] 将清空明文行数: ${plainRows.length}`)
  for (const row of plainRows) {
    console.log(
      `   - id=${row.id} user=${row.user_id} 明文长度=${String(row.content).length} 有密文=${row.content_encrypted ? '是' : '否'}`
    )
  }

  // ---- 3) 校验每个明文行的密文可解密且 === 明文 ----
  // 按用户分组，收集需要用到的用户 content_salt
  const userIds = [...new Set(plainRows.map((r) => r.user_id))]
  const users = db
    .prepare('SELECT id, content_salt FROM users WHERE id IN (' + userIds.map(() => '?').join(',') + ')')
    .all(...userIds)
  const saltByUser = new Map(users.map((u) => [u.id, u.content_salt]))

  // 读取用户密码（env 或交互）
  const passwords = new Map()
  for (const uid of userIds) {
    const salt = saltByUser.get(uid)
    if (!salt) {
      console.error(`[clearPlaintext] ABORT: 用户 ${uid} 缺少 content_salt，无法派生密钥校验密文。`)
      process.exit(1)
    }
    let pwd = process.env.CLEAR_PLAINTEXT_PASSWORD
    if (pwd) {
      // dry-run 也用同一个 env 密码校验；真跑同用户组共用
    } else {
      if (userIds.length === 1) {
        // 支持交互输入（一次）
        pwd = await promptPassword(`用户 ${uid} 的登录密码（仅用于本地校验密文，不落库）: `)
      } else {
        console.error(
          `[clearPlaintext] ABORT: 多用户场景必须通过环境变量 CLEAR_PLAINTEXT_PASSWORD 提供密码，且所有有明文行的用户需使用同一密码才能一次校验。当前用户 ${uid} 需要密码。`
        )
        process.exit(1)
      }
    }
    passwords.set(uid, pwd)
  }

  let validationFailures = 0
  for (const row of plainRows) {
    const key = deriveKey(passwords.get(row.user_id), saltByUser.get(row.user_id))
    try {
      if (!row.content_encrypted) {
        console.error(`[clearPlaintext] 校验失败: id=${row.id} 无密文（不应发生，孤儿检查已过）。`)
        validationFailures++
        continue
      }
      const decrypted = decrypt(row.content_encrypted, key)
      if (decrypted !== row.content) {
        console.error(
          `[clearPlaintext] 校验失败: id=${row.id} 密文解密结果与明文不一致（密钥可能错误或密文损坏）。`
        )
        validationFailures++
      } else {
        console.log(`[clearPlaintext] 校验通过: id=${row.id} 密文可解密且 === 明文`)
      }
    } catch (e) {
      console.error(`[clearPlaintext] 校验失败: id=${row.id} 解密异常: ${e.message}`)
      validationFailures++
    }
  }

  if (validationFailures > 0) {
    console.error(`[clearPlaintext] ABORT: 有 ${validationFailures} 行密文校验失败，终止以保证不丢数据。`)
    process.exit(1)
  }

  // ---- 4) dry-run 提前返回（不写库）----
  if (isDryRun) {
    console.log(`\n[clearPlaintext] DRY-RUN 完成：将清空 ${plainRows.length} 行明文，所有密文校验通过。数据库未修改。`)
    db.close()
    return
  }

  // 再次确认（交互）——避免误执行
  const confirmed = await promptConfirm(
    `\n确认执行？将清空 ${plainRows.length} 行 entries.content 明文（不可逆）。输入 YES 继续: `
  )
  if (confirmed !== 'YES') {
    console.log('[clearPlaintext] 已取消，未写入。')
    db.close()
    process.exit(0)
  }

  // ---- 5) 主语句：清空明文（列 NOT NULL，写 '' 而非 NULL）----
  const info = db
    .prepare("UPDATE entries SET content = '' WHERE content IS NOT NULL AND TRIM(content) != ''")
    .run()
  console.log(`[clearPlaintext] 已清空 ${info.changes} 行 entries.content（置为空串）。`)

  // ---- 6) 自证：清空后不应再有明文行（DD-A1.1）----
  const after = db
    .prepare("SELECT COUNT(*) as c FROM entries WHERE content IS NOT NULL AND TRIM(content) != ''")
    .get()
  if (after.c !== 0) {
    console.error(`[clearPlaintext] 警告: 清空后仍有 ${after.c} 行明文，请检查。`)
  } else {
    console.log('[clearPlaintext] 自证通过: content 明文已全部清空 (count=0)。')
  }

  db.close()
  console.log('\n[clearPlaintext] 完成。备份是唯一回滚源：请保留 backend/data/return-home-backup-*.db。')
}

/**
 * 交互式读取密码（推荐用环境变量 CLEAR_PLAINTEXT_PASSWORD）
 */
function promptPassword(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (ans) => resolve(ans.trim()))
  }).finally(() => rl.close())
}

/**
 * 交互式确认
 */
function promptConfirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (ans) => resolve(ans.trim()))
  }).finally(() => rl.close())
}

main().catch((err) => {
  console.error('[clearPlaintext] 未处理异常:', err)
  process.exit(1)
})
