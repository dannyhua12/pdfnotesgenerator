import { supabase } from './supabase';

export async function uploadPDF(file: File, userId: string): Promise<string> {
  try {
    // Validate file
    if (!file.type.includes('pdf')) {
      throw new Error('File must be a PDF');
    }

    // 1. Upload file to Supabase Storage
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
      throw new Error('Failed to upload file to storage');
    }

    if (!fileData) {
      throw new Error('No upload data returned');
    }

    // 2. Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL');
    }

    // 3. Create database entry
    const { data: pdfData, error: insertError } = await supabase
      .from('pdfs')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
      })
      .select()
      .single();

    if (insertError) {
      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from('pdfs')
        .remove([filePath]);
      
      throw new Error(`Failed to create database entry: ${insertError.message}`);
    }

    if (!pdfData) {
      throw new Error('No data returned from database insert');
    }

    // 4. Generate notes
    try {
      const notesResponse = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          pdfId: pdfData.id,
          fileUrl: publicUrl
        }),
      });

      if (!notesResponse.ok) {
        const errorData = await notesResponse.json();
        throw new Error(errorData.error || 'Failed to generate notes');
      }

      const notesData = await notesResponse.json();

      // Update the PDF record with the generated notes
      const { error: updateError } = await supabase
        .from('pdfs')
        .update({ notes: notesData.notes })
        .eq('id', pdfData.id);

      if (updateError) {
        throw new Error('Failed to save notes to database');
      }
    } catch (notesError) {
      console.error('Error fetching notes:', notesError);
      throw notesError;
    }

    return pdfData.id;
  } catch (error) {
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

export async function deletePDF(pdfId: string, userId: string): Promise<void> {
  try {
    // 1. Get the PDF record to get the file path
    const { data: pdfData, error: fetchError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('id', pdfId)
      .single();

    if (fetchError) {
      throw new Error('Failed to fetch PDF record');
    }

    if (!pdfData) {
      throw new Error('PDF not found');
    }

    // Verify ownership
    if (pdfData.user_id !== userId) {
      throw new Error('Unauthorized to delete this PDF');
    }

    // 2. Delete the file from storage
    const filePath = pdfData.file_url.split('/').pop();
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('pdfs')
        .remove([`${userId}/${filePath}`]);

      if (storageError) {
        throw new Error('Failed to delete file from storage');
      }
    }

    // 3. Delete the database record
    const { error: deleteError } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', pdfId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error('Failed to delete PDF record');
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error('An unknown error occurred');
  }
} 