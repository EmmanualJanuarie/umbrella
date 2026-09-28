import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = env.VITE_API_URL
  const portfolioDemo = env.VITE_PORTFOLIO_DEMO === 'true'

  if (!apiUrl && !portfolioDemo) {
    throw new Error(`VITE_API_URL is required for the ${mode} frontend build`)
  }

  if (apiUrl) {
    const parsedApiUrl = new URL(apiUrl)
    const localApi = parsedApiUrl.hostname === 'localhost' || parsedApiUrl.hostname === '127.0.0.1'
    if (!localApi && parsedApiUrl.protocol !== 'https:') {
      throw new Error(
        `Refusing to build an HTTPS frontend with insecure VITE_API_URL: ${apiUrl}`,
      )
    }
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const githubPagesBase = portfolioDemo && process.env.GITHUB_ACTIONS === 'true' && repositoryName
    ? `/${repositoryName}/`
    : '/'

  return {
    plugins: [react()],
    base: githubPagesBase,
  }
})
