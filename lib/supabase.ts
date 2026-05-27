import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Employee = {
  id: string
  name: string
  email: string
  password: string
  designation: string
}

export type WorkEntry = {
  id?: string
  employee_email: string
  employee_name: string
  date: string
  category: string
  business_area: string
  report_name: string
  etl_job_name: string
  task_details: string
  time_taken: number
  status: 'Complete' | 'WIP'
  goals: string
  comment: string
  created_at?: string
}

export const GOALS = [
  'AI / Productivity / Innovation',
  'Cost Optimization',
  'Automation Projects',
  'Dashboard Development/Enhancement',
  'Gold Layer Modelling/ Implementation',
  'Backup & Recovery',
  'ETL Development/Enhancement',
  'Genie Development/Enhancement',
]

export const CATEGORIES = [
  'Power BI',
  'Common',
  'ETL',
  'Data Quality',
  'Automation',
  'Other',
]

export const BUSINESS_AREAS = [
  'Common',
  'DS - Data Collection',
  'DS - Model Development',
  'DS - Data Quality',
  'PowerBI Develop',
  'Training/Workshop',
  'Data Issues Det.',
  'Other',
]

export const EMPLOYEES = [
  { name: 'Aalia Dandawala', email: 'aalia_dandawala@welspun.com' },
  { name: 'Sundari Maurya', email: 'sundari_maurya@welspun.com' },
  { name: 'Shravan Jadhav', email: 'shravan_jadhav@welspun.com' },
  { name: 'Sharad Yadav', email: 'sharad_yadav1@welspun.com' },
  { name: 'Sanjeev Singh', email: 'sanjeev_singh@welspun.com' },
  { name: 'Riya Agarwal', email: 'riya_agarwal@welspun.com' },
  { name: 'Rajesh Mishra', email: 'rajesh_mishra@welspun.com' },
  { name: 'Deepika Dalvi', email: 'deepika_dalvi@welspun.com' },
  { name: 'Hemil Shah', email: 'hemil_shah@welspun.com' },
]
