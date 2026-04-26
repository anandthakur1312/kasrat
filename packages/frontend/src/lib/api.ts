import { mockApi } from './mockApi';
import { realApi } from './realApi';

export const api = import.meta.env.VITE_USE_REAL_API === '1' ? realApi : mockApi;
