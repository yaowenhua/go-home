<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import styles from './Login.module.css'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// ============ Tab State ============
const activeTab = ref('login')
const tabs = [
  { key: 'login', label: '登录' },
  { key: 'register', label: '注册' },
  { key: 'forgot', label: '忘记密码' },
]

// ============ Login Form ============
const loginForm = reactive({
  phone: '',
  password: '',
})
const loginErrors = reactive({ phone: '', password: '' })
const loginSubmitting = ref(false)
const loginError = ref('')

// ============ Register Form ============
const registerForm = reactive({
  phone: '',
  password: '',
  confirmPassword: '',
  name: '',
})
const registerErrors = reactive({ phone: '', password: '', confirmPassword: '', name: '' })
const registerSubmitting = ref(false)
const registerError = ref('')

// ============ Forgot Password Form ============
const forgotForm = reactive({
  phone: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
})
const forgotErrors = reactive({ phone: '', code: '', newPassword: '', confirmPassword: '' })
const forgotStep = ref('send') // 'send' | 'reset'
const forgotSubmitting = ref(false)
const forgotError = ref('')
const codeTimer = ref(0)
let codeInterval = null

// ============ Validation ============
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

function validatePassword(password) {
  return password.length >= 6
}

// ============ Login ============
async function handleLogin() {
  let valid = true
  loginErrors.phone = ''
  loginErrors.password = ''
  loginError.value = ''

  if (!loginForm.phone) {
    loginErrors.phone = '请输入手机号'
    valid = false
  } else if (!validatePhone(loginForm.phone)) {
    loginErrors.phone = '请输入正确的11位手机号'
    valid = false
  }

  if (!loginForm.password) {
    loginErrors.password = '请输入密码'
    valid = false
  } else if (!validatePassword(loginForm.password)) {
    loginErrors.password = '密码至少6位'
    valid = false
  }

  if (!valid) return

  loginSubmitting.value = true
  try {
    await authStore.login(loginForm.phone, loginForm.password)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    loginError.value = err.message || '登录失败，请检查手机号和密码'
  } finally {
    loginSubmitting.value = false
  }
}

// ============ Register ============
async function handleRegister() {
  let valid = true
  registerErrors.phone = ''
  registerErrors.password = ''
  registerErrors.confirmPassword = ''
  registerErrors.name = ''
  registerError.value = ''

  if (!registerForm.phone) {
    registerErrors.phone = '请输入手机号'
    valid = false
  } else if (!validatePhone(registerForm.phone)) {
    registerErrors.phone = '请输入正确的11位手机号'
    valid = false
  }

  if (!registerForm.password) {
    registerErrors.password = '请输入密码'
    valid = false
  } else if (!validatePassword(registerForm.password)) {
    registerErrors.password = '密码至少6位，需包含字母和数字'
    valid = false
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    registerErrors.confirmPassword = '两次密码输入不一致'
    valid = false
  }

  if (!valid) return

  registerSubmitting.value = true
  try {
    const name = registerForm.name.trim() || undefined
    await authStore.register(registerForm.phone, registerForm.password, name)
    router.push('/')
  } catch (err) {
    registerError.value = err.message || '注册失败，请重试'
  } finally {
    registerSubmitting.value = false
  }
}

// ============ Forgot Password ============
async function handleSendCode() {
  let valid = true
  forgotErrors.phone = ''
  forgotError.value = ''

  if (!forgotForm.phone) {
    forgotErrors.phone = '请输入手机号'
    valid = false
  } else if (!validatePhone(forgotForm.phone)) {
    forgotErrors.phone = '请输入正确的11位手机号'
    valid = false
  }

  if (!valid) return

  forgotSubmitting.value = true
  try {
    await authApi.sendCode(forgotForm.phone)
    forgotStep.value = 'reset'
    startCodeTimer()
  } catch (err) {
    forgotError.value = err.message || '发送验证码失败'
  } finally {
    forgotSubmitting.value = false
  }
}

async function handleResetPassword() {
  let valid = true
  forgotErrors.code = ''
  forgotErrors.newPassword = ''
  forgotErrors.confirmPassword = ''
  forgotError.value = ''

  if (!forgotForm.code) {
    forgotErrors.code = '请输入验证码'
    valid = false
  }
  if (!forgotForm.newPassword) {
    forgotErrors.newPassword = '请输入新密码'
    valid = false
  } else if (!validatePassword(forgotForm.newPassword)) {
    forgotErrors.newPassword = '密码至少6位'
    valid = false
  }
  if (forgotForm.newPassword !== forgotForm.confirmPassword) {
    forgotErrors.confirmPassword = '两次密码输入不一致'
    valid = false
  }

  if (!valid) return

  forgotSubmitting.value = true
  try {
    await authApi.resetPassword({
      phone: forgotForm.phone,
      code: forgotForm.code,
      newPassword: forgotForm.newPassword,
    })
    activeTab.value = 'login'
    forgotForm.phone = ''
    forgotForm.code = ''
    forgotForm.newPassword = ''
    forgotForm.confirmPassword = ''
    forgotStep.value = 'send'
    loginError.value = '密码重置成功，请使用新密码登录'
  } catch (err) {
    forgotError.value = err.message || '密码重置失败'
  } finally {
    forgotSubmitting.value = false
  }
}

function startCodeTimer() {
  codeTimer.value = 60
  if (codeInterval) clearInterval(codeInterval)
  codeInterval = setInterval(() => {
    codeTimer.value--
    if (codeTimer.value <= 0) {
      clearInterval(codeInterval)
      codeInterval = null
    }
  }, 1000)
}

function canResend() {
  return codeTimer.value <= 0
}

// ============ Tab Switch ============
function switchTab(key) {
  activeTab.value = key
  loginError.value = ''
  registerError.value = ''
  forgotError.value = ''
}

// Import authApi for forgot password flow
import { authApi } from '../api/auth'
</script>

<template>
  <div :class="styles.page">
    <div :class="styles.container">
      <!-- Header -->
      <div :class="styles.header">
        <span :class="styles.logo">🏡</span>
        <h1 :class="styles.title">返乡</h1>
        <p :class="styles.subtitle">记录生活的点滴，珍惜当下的时光</p>
      </div>

      <!-- Login Tab -->
      <form v-if="activeTab === 'login'" :class="styles.form" @submit.prevent="handleLogin">
        <div :class="styles.field">
          <label :class="styles.label">手机号</label>
          <input
            type="tel"
            :class="[styles.input, loginErrors.phone && styles.inputError]"
            v-model="loginForm.phone"
            placeholder="请输入手机号"
            maxlength="11"
            autocomplete="tel"
          />
          <p v-if="loginErrors.phone" :class="styles.fieldError">{{ loginErrors.phone }}</p>
        </div>

        <div :class="styles.field">
          <label :class="styles.label">密码</label>
          <input
            type="password"
            :class="[styles.input, loginErrors.password && styles.inputError]"
            v-model="loginForm.password"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
          <p v-if="loginErrors.password" :class="styles.fieldError">{{ loginErrors.password }}</p>
        </div>

        <p v-if="loginError" :class="styles.formError">{{ loginError }}</p>

        <button
          type="submit"
          :class="styles.submitBtn"
          :disabled="loginSubmitting"
        >
          {{ loginSubmitting ? '登录中...' : '登录' }}
        </button>

        <p :class="styles.switchHint">
          还没有账号？
          <a href="#" @click.prevent="switchTab('register')">立即注册</a>
        </p>
      </form>

      <!-- Register Tab -->
      <form v-if="activeTab === 'register'" :class="styles.form" @submit.prevent="handleRegister">
        <div :class="styles.field">
          <label :class="styles.label">手机号</label>
          <input
            type="tel"
            :class="[styles.input, registerErrors.phone && styles.inputError]"
            v-model="registerForm.phone"
            placeholder="请输入手机号"
            maxlength="11"
            autocomplete="tel"
          />
          <p v-if="registerErrors.phone" :class="styles.fieldError">{{ registerErrors.phone }}</p>
        </div>

        <div :class="styles.field">
          <label :class="styles.label">昵称</label>
          <input
            type="text"
            :class="styles.input"
            v-model="registerForm.name"
            placeholder="你的昵称（选填）"
            maxlength="20"
          />
        </div>

        <div :class="styles.field">
          <label :class="styles.label">密码</label>
          <input
            type="password"
            :class="[styles.input, registerErrors.password && styles.inputError]"
            v-model="registerForm.password"
            placeholder="至少6位，包含字母和数字"
            autocomplete="new-password"
          />
          <p v-if="registerErrors.password" :class="styles.fieldError">{{ registerErrors.password }}</p>
        </div>

        <div :class="styles.field">
          <label :class="styles.label">确认密码</label>
          <input
            type="password"
            :class="[styles.input, registerErrors.confirmPassword && styles.inputError]"
            v-model="registerForm.confirmPassword"
            placeholder="再次输入密码"
            autocomplete="new-password"
          />
          <p v-if="registerErrors.confirmPassword" :class="styles.fieldError">{{ registerErrors.confirmPassword }}</p>
        </div>

        <p v-if="registerError" :class="styles.formError">{{ registerError }}</p>

        <button
          type="submit"
          :class="styles.submitBtn"
          :disabled="registerSubmitting"
        >
          {{ registerSubmitting ? '注册中...' : '注册' }}
        </button>

        <p :class="styles.switchHint">
          已有账号？
          <a href="#" @click.prevent="switchTab('login')">立即登录</a>
        </p>
      </form>

      <!-- Forgot Password Tab -->
      <div v-if="activeTab === 'forgot'" :class="styles.form">
        <!-- Step 1: Send code -->
        <div v-if="forgotStep === 'send'">
          <div :class="styles.field">
            <label :class="styles.label">手机号</label>
            <input
              type="tel"
              :class="[styles.input, forgotErrors.phone && styles.inputError]"
              v-model="forgotForm.phone"
              placeholder="请输入注册时的手机号"
              maxlength="11"
            />
            <p v-if="forgotErrors.phone" :class="styles.fieldError">{{ forgotErrors.phone }}</p>
          </div>

          <p v-if="forgotError" :class="styles.formError">{{ forgotError }}</p>

          <button
            :class="styles.submitBtn"
            :disabled="forgotSubmitting"
            @click="handleSendCode"
          >
            {{ forgotSubmitting ? '发送中...' : '发送验证码' }}
          </button>
        </div>

        <!-- Step 2: Reset password -->
        <div v-else>
          <div :class="styles.field">
            <label :class="styles.label">验证码</label>
            <div :class="styles.codeRow">
              <input
                type="text"
                :class="[styles.input, styles.codeInput, forgotErrors.code && styles.inputError]"
                v-model="forgotForm.code"
                placeholder="6位验证码"
                maxlength="6"
              />
              <button
                :class="[styles.codeBtn, !canResend() && styles.codeBtnDisabled]"
                :disabled="!canResend()"
                @click="handleSendCode"
              >
                {{ canResend() ? '重新发送' : `${codeTimer}s` }}
              </button>
            </div>
            <p v-if="forgotErrors.code" :class="styles.fieldError">{{ forgotErrors.code }}</p>
          </div>

          <div :class="styles.field">
            <label :class="styles.label">新密码</label>
            <input
              type="password"
              :class="[styles.input, forgotErrors.newPassword && styles.inputError]"
              v-model="forgotForm.newPassword"
              placeholder="至少6位"
              autocomplete="new-password"
            />
            <p v-if="forgotErrors.newPassword" :class="styles.fieldError">{{ forgotErrors.newPassword }}</p>
          </div>

          <div :class="styles.field">
            <label :class="styles.label">确认新密码</label>
            <input
              type="password"
              :class="[styles.input, forgotErrors.confirmPassword && styles.inputError]"
              v-model="forgotForm.confirmPassword"
              placeholder="再次输入新密码"
              autocomplete="new-password"
            />
            <p v-if="forgotErrors.confirmPassword" :class="styles.fieldError">{{ forgotErrors.confirmPassword }}</p>
          </div>

          <p v-if="forgotError" :class="styles.formError">{{ forgotError }}</p>

          <button
            :class="styles.submitBtn"
            :disabled="forgotSubmitting"
            @click="handleResetPassword"
          >
            {{ forgotSubmitting ? '重置中...' : '重置密码' }}
          </button>
        </div>

        <p :class="styles.switchHint">
          想起密码了？
          <a href="#" @click.prevent="switchTab('login')">返回登录</a>
        </p>
      </div>
    </div>
  </div>
</template>
