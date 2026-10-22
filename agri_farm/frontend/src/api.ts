import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: BASE_URL,
});

// Automatically add token to headers if it exists.
// X-Access-Token is a fallback for reverse proxies that strip Authorization.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['X-Access-Token'] = token;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Offline request queueing response interceptor
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // Only auto-queue writes when the browser is genuinely offline. A missing
        // response while online (CORS, timeout, server down, validation error) is
        // surfaced as a real error instead of being silently queued as "saved".
        if (!navigator.onLine && originalRequest && ['post', 'put', 'patch', 'delete'].includes(originalRequest.method.toLowerCase())) {
            const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
            
            // Prevent duplicate queueing of identical requests
            const alreadyQueued = queue.some(item => item.url === originalRequest.url && JSON.stringify(item.data) === JSON.stringify(originalRequest.data));
            if (!alreadyQueued) {
                const newRequest = {
                    id: Date.now().toString(),
                    url: originalRequest.url,
                    method: originalRequest.method.toLowerCase(),
                    data: typeof originalRequest.data === 'string' ? JSON.parse(originalRequest.data) : originalRequest.data
                };
                queue.push(newRequest);
                localStorage.setItem('offline_request_queue', JSON.stringify(queue));
                window.dispatchEvent(new CustomEvent('offline-request-queued', { detail: queue.length }));
            }
            
            const parsed = typeof originalRequest.data === 'string'
                ? (() => { try { return JSON.parse(originalRequest.data); } catch { return {}; } })()
                : (originalRequest.data || {});
            const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            return Promise.resolve({
                data: { status: "ok", offline: true, _id: localId, ...parsed }
            });
        }
        return Promise.reject(error);
    }
);

// --- AUTH / USER ROUTES ---
export const signup = (username, email, password, role = "worker") => {
    return api.post('/signup', { username, email, password, role });
};
export const getMe = () => api.get('/users/me');

export const login = (email, password) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    return api.post('/login', params);
};
export const logout = () => api.post('/logout');

export const getUsers = () => api.get('/users');
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const requestProfileCode = () => api.post('/request-profile-code');
export const changePassword = (currentPassword, newPassword, code = "") => {
    return api.post('/change-password', { currentPassword, newPassword, code });
};
export const updateMe = (email, code = "", avatar_base64 = null) => {
    return api.put('/users/me', { email, code, avatar_base64 });
};
export const editWorkerProfile = (id, newUsername, newPassword, adminPassword) => {
    return api.patch(`/users/${id}/edit`, { newUsername, newPassword, adminPassword });
};

// --- AUTOMATION SETTINGS ---
export const getAutomations = () => api.get('/settings/automations');
export const saveAutomations = (settings) => api.put('/settings/automations', settings);
export const triggerImmediateDigest = (payload) => api.post('/settings/automations/trigger', payload);
export const getFarmLocation = () => api.get('/settings/location');
export const saveFarmLocation = (payload) => api.put('/settings/location', payload);
export const checkSetup = () => api.get('/check-setup');
export const forgotPassword = (email) => api.post('/forgot-password', { email });
export const resetPassword = (email, code, newPassword) => {
    return api.post('/reset-password', { email, code, newPassword });
};

// --- CROPS ROUTES ---
export const getCrops = (skip = 0, limit = 100) => api.get(`/crops?skip=${skip}&limit=${limit}`);
export const addCrop = (crop) => api.post('/crops', crop);
export const updateCrop = (id, crop) => api.put(`/crops/${id}`, crop);
export const deleteCrop = (id) => api.delete(`/crops/${id}`);

// --- FINANCE ROUTES ---
export const getFinance = (skip = 0, limit = 100) => api.get(`/finance?skip=${skip}&limit=${limit}`);
export const addFinance = (entry) => api.post('/finance', entry);
export const updateFinance = (id, entry) => api.put(`/finance/${id}`, entry);
export const deleteFinance = (id) => api.delete(`/finance/${id}`);

// --- TASKS ROUTES ---
export const getTasks = (skip = 0, limit = 100) => api.get(`/tasks?skip=${skip}&limit=${limit}`);
export const addTask = (task) => api.post('/tasks', task);
export const updateTask = (id, task) => api.put(`/tasks/${id}`, task);
export const completeTask = (id) => api.patch(`/tasks/${id}`);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

// --- BACKUP & RESTORE ---
export const getBackup = () => api.get('/backup');
export const restoreBackup = (payload) => api.post('/restore', payload);
export const getAutoBackup = () => api.get('/backup/auto');
export const restoreAutoBackup = () => api.post('/restore/auto');

export const getIrrigation = (cropId) => api.get(`/irrigation?crop_id=${encodeURIComponent(cropId || '')}`);
export const addIrrigation = (entry) => api.post('/irrigation', entry);
export const deleteIrrigation = (id) => api.delete(`/irrigation/${id}`);

export const getCropPhotos = (cropId) => api.get(`/crop-photos?crop_id=${encodeURIComponent(cropId || '')}`);
export const addCropPhoto = (entry) => api.post('/crop-photos', entry);
export const deleteCropPhoto = (id) => api.delete(`/crop-photos/${id}`);

export const getSprayLogs = (cropId) => api.get(`/spray?crop_id=${encodeURIComponent(cropId || '')}`);
export const addSprayLog = (entry) => api.post('/spray', entry);
export const deleteSprayLog = (id) => api.delete(`/spray/${id}`);

export const getLaborers = () => api.get('/laborers');
export const getTelegramStatus = () => api.get('/telegram/status');
export const createTelegramLinkCode = (payload) => api.post('/telegram/link-code', payload);
export const deleteTelegramLink = (chatId) => api.delete(`/telegram/links/${chatId}`);
// Supplier khata (money going out)
export const getSuppliers = () => api.get('/suppliers');
export const addSupplier = (payload) => api.post('/suppliers', payload);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);
export const getAllSupplierPayments = () => api.get('/suppliers/payments/all');
export const addSupplierPayment = (id, payload) => api.post(`/suppliers/${id}/payments`, payload);
export const updateSupplierPayment = (id, paymentId, payload) => api.put(`/suppliers/${id}/payments/${paymentId}`, payload);
export const deleteSupplierPayment = (id, paymentId) => api.delete(`/suppliers/${id}/payments/${paymentId}`);
export const getTelegramSettings = () => api.get('/telegram/settings');
export const saveTelegramSettings = (payload) => api.put('/telegram/settings', payload);
export const sendTelegramSummaryNow = () => api.post('/telegram/send-summary');
export const addLaborer = (entry) => api.post('/laborers', entry);
export const updateLaborer = (id, payload) => api.put(`/laborers/${id}`, payload);
export const deleteLaborer = (id) => api.delete(`/laborers/${id}`);

export const getAttendance = (month) => api.get(`/attendance?month=${encodeURIComponent(month || '')}`);
export const upsertAttendance = (entry) => api.post('/attendance', entry);
export const updateAttendance = (id, payload) => api.put(`/attendance/${id}`, payload);
export const deleteAttendance = (id) => api.delete(`/attendance/${id}`);
export const getLaborAdvances = () => api.get('/labor-advances');
export const addLaborAdvance = (entry) => api.post('/labor-advances', entry);
export const updateLaborAdvance = (id, payload) => api.put(`/labor-advances/${id}`, payload);
export const deleteLaborAdvance = (id) => api.delete(`/labor-advances/${id}`);
export const postLaborWages = (month) => api.post('/labor/post-wages', { month });

// --- INVENTORY ROUTES ---
export const getInventory = () => api.get('/inventory');
export const addInventory = (item) => api.post('/inventory', item);
export const updateInventory = (id, item) => api.put(`/inventory/${id}`, item);
export const deleteInventory = (id) => api.delete(`/inventory/${id}`);

// --- LIABILITIES ROUTES ---
export const getLiabilities = () => api.get('/liabilities');
export const addLiability = (item) => api.post('/liabilities', item);
export const updateLiability = (id, item) => api.put(`/liabilities/${id}`, item);
export const payLiability = (id) => api.put(`/liabilities/${id}/pay`);
export const deleteLiability = (id) => api.delete(`/liabilities/${id}`);

export const getDiaryMedia = (date: string) => api.get(`/diary-media/${encodeURIComponent(date)}`);
export const getDiaryEntries = () => api.get('/diary-media/entries');
export const saveDiaryMedia = (date: string, photos?: unknown[], entries?: unknown[]) => api.put(`/diary-media/${encodeURIComponent(date)}`, { ...(photos !== undefined ? { photos } : {}), ...(entries !== undefined ? { entries } : {}) });

export default api;
