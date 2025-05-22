export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      pdfs: {
        Row: {
          id: string
          created_at: string
          user_id: string
          file_name: string
          file_url: string
          file_size: number
          updated_at: string
          notes: string | null
          notes_generation_status: 'pending' | 'in_progress' | 'completed' | 'failed'
          notes_generation_progress: number
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          file_name: string
          file_url: string
          file_size: number
          updated_at?: string
          notes?: string | null
          notes_generation_status?: 'pending' | 'in_progress' | 'completed' | 'failed'
          notes_generation_progress?: number
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          file_name?: string
          file_url?: string
          file_size?: number
          updated_at?: string
          notes?: string | null
          notes_generation_status?: 'pending' | 'in_progress' | 'completed' | 'failed'
          notes_generation_progress?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      notes_generation_status_type: 'pending' | 'in_progress' | 'completed' | 'failed'
    }
  }
} 