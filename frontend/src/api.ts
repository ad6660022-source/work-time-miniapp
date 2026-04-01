const BASE = '/api'

let _initData = ''

export function setInitData(data: string) {
  _initData = data
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-init-data': _initData,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body)
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, body)
const del = <T>(path: string) => request<T>('DELETE', path)

// Auth
export const api = {
  auth: {
    me: () => get<{ status: string; user?: import('./types').User }>('/auth/me'),
    register: (name: string) => post<{ status: string; user?: import('./types').User }>('/auth/register', { name }),
  },
  shifts: {
    today: () => get<{ shift: import('./types').Shift | null }>('/shifts/today'),
    start: () => post<{ shift: import('./types').Shift }>('/shifts/start'),
    end: () => post<{ shift: import('./types').Shift }>('/shifts/end'),
    overview: () => get<{ overview: import('./types').ShiftOverview[]; date: string; time: string }>('/shifts/overview'),
    breakStart: (type: 'lunch' | 'break') => post<{ break: import('./types').ShiftBreak }>('/shifts/break/start', { type }),
    breakEnd: () => post<{ status: string }>('/shifts/break/end'),
  },
  tasks: {
    my: () => get<{ tasks: import('./types').Task[] }>('/tasks/my'),
    all: () => get<{ tasks: import('./types').AdminTask[] }>('/tasks/all'),
    detail: (id: number) => get<{ task: import('./types').TaskDetail }>(`/tasks/${id}`),
    create: (text: string, assignee_ids: number[]) =>
      post<{ task: import('./types').TaskDetail }>('/tasks', { text, assignee_ids }),
    update: (id: number, text: string) =>
      put<{ task: import('./types').TaskDetail }>(`/tasks/${id}`, { text }),
    delete: (id: number) => del<{ status: string }>(`/tasks/${id}`),
    clearCompleted: () => del<{ archived: number }>('/tasks'),
    updateStatus: (id: number, status: string) =>
      patch<{ status: string }>(`/tasks/${id}/status`, { status }),
  },
  users: {
    all: () => get<{ users: import('./types').User[] }>('/users'),
    employees: () => get<{ employees: import('./types').User[] }>('/users/employees'),
    pending: () => get<{ pending: import('./types').User[] }>('/users/pending'),
    approve: (id: number, position: string) => post(`/users/${id}/approve`, { position }),
    update: (id: number, data: Partial<import('./types').User>) => patch(`/users/${id}`, data),
    stats: (id: number) => get<{ stats: import('./types').Stats }>(`/users/${id}/stats`),
    schedule: (id: number) => get<{ schedule: { work_days: number[]; shift_start: string; shift_end: string } | null }>(`/users/${id}/schedule`),
    updateSchedule: (id: number, data: { work_days: number[]; shift_start: string; shift_end: string }) =>
      put(`/users/${id}/schedule`, data),
    history: (id: number) => get<import('./types').UserHistory>(`/users/${id}/history`),
    clearShifts: (id: number) => del<{ deleted: number }>(`/users/${id}/shifts`),
  },
  reports: {
    today: () => get<{ report: import('./types').Report | null }>('/reports/today'),
    submit: (done: string, problems: string, plans: string) =>
      post('/reports', { done, problems, plans }),
    dates: () => get<{ dates: string[] }>('/reports/dates'),
    byDate: (date: string) => get<{ reports: import('./types').AdminReport[] }>(`/reports/${date}`),
    rate: (date: string, userId: number, rating: number) =>
      post<{ status: string; rating: number }>(`/reports/${date}/${userId}/rate`, { rating }),
  },
  announcements: {
    send: (text: string) => post<{ sent: number }>('/announcements', { text }),
  },
  attendance: {
    startCheck: () => post<{ check_id: number; expires_at: string }>('/attendance/check'),
    respond: () => post<{ status: string }>('/attendance/respond'),
    cancel: () => post<{ status: string }>('/attendance/cancel'),
    active: () => get<{ check: { id: number; seconds_left: number; user_responded: boolean; responses: { name: string }[] } | null }>('/attendance/active'),
    notifications: () => get<{ notifications: import('./types').Notification[]; unread_count: number }>('/attendance/notifications'),
    markRead: () => post('/attendance/notifications/read'),
  },
}
