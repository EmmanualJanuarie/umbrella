import axios from 'axios';
import { isPortfolioDemo } from '../config/runtime';
import { installPortfolioDemoAdapter } from '../demo/portfolio-api';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const DEFAULT_API_TIMEOUT_MS = 45000;

export const api = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_API_TIMEOUT_MS,
  withCredentials: true,
});

axios.defaults.timeout = DEFAULT_API_TIMEOUT_MS;
axios.defaults.withCredentials = true;

if (isPortfolioDemo) {
  installPortfolioDemoAdapter(api, axios);
}
