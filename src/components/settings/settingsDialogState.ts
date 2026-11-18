import { create } from 'zustand'
import { useSettings } from '../../services/settings.js'

/** 设置弹窗的分组：通用设置 / 模型与接口 / 长期记忆 / 数据管理 */
export type SettingsSection = 'general' | 'model' | 'memory' | 'data'

/** 设置弹窗：侧边栏底部、没有 API Key 时的操作与 401 提示都可以打开；section 为打开时选中的分组 */
export const useSettingsDialog = create(() => ({
  open: false,
  section: 'general' as SettingsSection,
}))

export const openSettings = (section: SettingsSection) =>
  useSettingsDialog.setState({ open: true, section })

export const closeSettings = () => useSettingsDialog.setState({ open: false })

const SETUP_SEEN_KEY = 'hl-dsc:setup-seen'

/**
 * 自定义 API 允许不填 Key（本地/内网端点很常见），因此发送前不做任何密钥拦截。
 * 保留此函数只为兼容既有调用点。
 */
export const ensureApiKey = () => true

/** 首次打开时引导配置接口；只提示一次，关闭后不再拦截聊天。 */
export const promptInitialSetup = () => {
  if (new URLSearchParams(window.location.search).has('preview')) {
    return
  }
  try {
    if (localStorage.getItem(SETUP_SEEN_KEY) === '1') {
      return
    }
    localStorage.setItem(SETUP_SEEN_KEY, '1')
  } catch {
    // localStorage 不可用时仍然展示一次引导
  }
  const { apiKey, chatProtocol, apiOrigin } = useSettings.getState()
  if (!apiKey?.trim() && chatProtocol !== 'local' && !apiOrigin.trim()) {
    openSettings('model')
  }
}
