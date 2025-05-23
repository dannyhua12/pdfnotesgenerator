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
      flashcards: {
        Row: {
          id: string
          pdf_id: string
          user_id: string
          front_content: string
          back_content: string
          difficulty: 'easy' | 'medium' | 'hard'
          last_reviewed: string | null
          next_review: string | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pdf_id: string
          user_id: string
          front_content: string
          back_content: string
          difficulty?: 'easy' | 'medium' | 'hard'
          last_reviewed?: string | null
          next_review?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pdf_id?: string
          user_id?: string
          front_content?: string
          back_content?: string
          difficulty?: 'easy' | 'medium' | 'hard'
          last_reviewed?: string | null
          next_review?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          created_at: string
          pdf_id: string
          user_id: string
          status: 'pending' | 'completed' | 'failed'
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          pdf_id: string
          user_id: string
          status: 'pending' | 'completed' | 'failed'
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          pdf_id?: string
          user_id?: string
          status?: 'pending' | 'completed' | 'failed'
          notes?: string | null
          updated_at?: string
        }
      }
    }
    Enums: {
      difficulty_level: 'easy' | 'medium' | 'hard'
    }
  }
} 