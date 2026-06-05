import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const GOALS = [
  'Genie',
  'Automation',
  'Reporting',
  'Data Quality',
  'Other',
]

export const CATEGORIES = [
  'Meeting - Internal/Stakeholder',
  'Documentation - PBI/BRS/ETL/DS/Model',
  'PowerBI Development',
  'Data Issues Detection/Correction',
  'Training/Workshops',
  'ETL Development',
  'Data Modelling',
  'Business Requirements Discussions',
  'Data Mapping',
  'UAT testing Power BI',
  'Emails - Stakeholder Communication',
  'DS - Model Development',
  'DS - Data Collection',
  'Databricks Activities',
  'Other',
]

export const BUSINESS_AREAS = [
  'Common',
  'Sales - B2C',
  'Sales - B2B',
  'CEO',
  'Marketing',
  'Manufacturing',
  'Finance',
  'HR',
  'SCM',
  'Internal',
]

export interface WorkEntry {
  id?: number
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