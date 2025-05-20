import { supabase } from './supabase';
import type { Database } from '../types/database';

export async function uploadPDF(
  file: File,
  userId: string
) {
  // 1. Upload file to Supabase Storage
  const { data: fileData, error: uploadError } = await supabase.storage
    .from('pdfs')
    .upload(`${userId}/${file.name}`, file);

  if (uploadError) throw uploadError;

  // 2. Create record in pdfs table
  const { data: pdfRecord, error: dbError } = await supabase
    .from('pdfs')
    .insert({
      user_id: userId,
      file_name: file.name,
      file_url: fileData.path,
      file_size: file.size,
    })
    .select()
    .single();

  if (dbError) throw dbError;

  return pdfRecord;
}

export async function createSubmission(
  pdfId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      pdf_id: pdfId,
      user_id: userId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserPDFs(userId: string) {
  const { data, error } = await supabase
    .from('pdfs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getUserSubmissions(userId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      pdfs (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
} 