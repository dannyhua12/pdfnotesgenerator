export type PDF = {
  id: string;
  created_at: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  updated_at: string;
  notes: string | null;
  notes_generation_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes_generation_progress: number;
}; 