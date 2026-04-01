export interface User {
  id: number
  telegram_id: number
  name: string
  username?: string
  position?: string
  is_admin: boolean
  is_approved: boolean
  is_blocked: boolean
}

export interface ShiftBreak {
  id: number
  type: 'lunch' | 'break'
  start_time: string
}

export interface Shift {
  id: number
  date: string
  start_time?: string
  end_time?: string
  status: 'active' | 'closed'
  duration_minutes?: number
  active_break?: ShiftBreak | null
}

export interface Task {
  id: number
  text: string
  assignment_status: 'assigned' | 'in_progress' | 'done'
  created_at: string
}

export interface TaskDetail {
  id: number
  text: string
  created_at: string
  assignees: { id: number; name: string; position?: string; status: string }[]
}

export interface AdminTask {
  id: number
  text: string
  creator_name?: string
  cnt_assigned: number
  cnt_in_progress: number
  cnt_done: number
  created_at: string
}

export interface Report {
  done?: string
  problems?: string
  plans?: string
  created_at?: string
}

export interface AdminReport extends Report {
  user_id: number
  name: string
  position?: string
  rating?: number | null
  rated_by?: number | null
}

export interface ShiftOverview {
  id: number
  name: string
  position?: string
  status?: string
  start_time?: string
  end_time?: string
}

export interface Notification {
  id: number
  text: string
  type: string
  is_read: boolean
  created_at: string
}

export interface Stats {
  assigned: number
  in_progress: number
  done: number
  late_count: number
  late_minutes: number
  shifts_month: number
  total_work_minutes: number
  avg_rating: number | null
}

export interface UserHistory {
  shifts: {
    id: number
    date: string
    start_time?: string
    end_time?: string
    status: string
    duration_minutes?: number
  }[]
  reports: {
    date: string
    done?: string
    problems?: string
    plans?: string
  }[]
  tasks: {
    id: number
    text: string
    status: string
    created_at: string
  }[]
}
