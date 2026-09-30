import axios from 'axios'
import { ElMessage } from 'element-plus'

export const http = axios.create({
  baseURL: '/api',
  timeout: 120000,
  paramsSerializer: { indexes: null },
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail
    ElMessage.error(typeof detail === 'string' ? detail : '请求失败，请检查后端是否已启动')
    return Promise.reject(error)
  },
)
