import { supabase } from './supabase';
import type { Database } from '@/types/supabase';

export async function uploadPDF(file: File, userId: string): Promise<string> {
  try {
    // Validate file
    if (!file.type.includes('pdf')) {
      throw new Error('File must be a PDF');
    }

    // 1. Upload file to local storage first
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error || 'Failed to upload file');
    }

    const { filename, originalName } = await uploadResponse.json();

    // 2. Generate notes
    const notesResponse = await fetch('/api/generate-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });

    if (!notesResponse.ok) {
      const error = await notesResponse.json();
      throw new Error(error.error || 'Failed to generate notes');
    }

    const { notes } = await notesResponse.json();

    // 3. Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const storageFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${storageFileName}`;

    const { data: fileData, error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Failed to upload file to storage');
    }

    if (!fileData) {
      throw new Error('No upload data returned');
    }

    // 4. Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL');
    }

    // 5. Create database entry with notes
    const { data: pdfData, error: insertError } = await supabase
      .from('pdfs')
      .insert({
        user_id: userId,
        file_name: originalName,
        file_url: publicUrl,
        file_size: file.size,
        notes: notes,
      })
      .select()
      .single();

    if (insertError) {
      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from('pdfs')
        .remove([filePath]);
      
      console.error('Database insert error:', insertError);
      console.error('Database error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      });
      throw new Error(`Failed to create database entry: ${insertError.message}`);
    }

    if (!pdfData) {
      throw new Error('No data returned from database insert');
    }

    return pdfData.id;
  } catch (error) {
    console.error('Error in uploadPDF:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred');
  }
}

export async function createSubmission(pdfId: string, userId: string) {
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