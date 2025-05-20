export interface PDF {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  pdf_id: string;
  user_id: string;
  status: 'pending' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      pdfs: {
        Row: PDF;
        Insert: Omit<PDF, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PDF, 'id'>>;
      };
      submissions: {
        Row: Submission;
        Insert: Omit<Submission, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Submission, 'id'>>;
      };
    };
  };
} 