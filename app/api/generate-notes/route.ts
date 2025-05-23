import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { OptimizedNoteGenerator } from '@/app/utils/optimizedNoteGeneration';

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const noteGenerator = new OptimizedNoteGenerator(process.env.OPENAI_API_KEY.trim());

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => {
            cookieStore.set({ name, value, ...options });
          },
          remove: (name, options) => {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('No session found in generate-notes route');
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401 }
      );
    }

    console.log('Starting notes generation process...');
    const body = await request.json();
    const { pdfId, fileUrl } = body;

    if (!pdfId || !fileUrl) {
      console.error('Missing parameters:', { pdfId, fileUrl });
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify PDF ownership
    const { data: pdf, error: pdfError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('id', pdfId)
      .eq('user_id', session.user.id)
      .single();

    if (pdfError || !pdf) {
      console.error('PDF ownership verification failed:', pdfError);
      return NextResponse.json(
        { error: "PDF not found or unauthorized" },
        { status: 404 }
      );
    }

    // Validate file URL
    if (!fileUrl.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return NextResponse.json(
        { error: "Invalid file URL" },
        { status: 400 }
      );
    }

    console.log('Fetching PDF from URL:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error('Failed to fetch PDF:', response.status, response.statusText);
      throw new Error('Failed to fetch PDF from storage');
    }

    console.log('Converting PDF to buffer...');
    const pdfBuffer = await response.arrayBuffer();

    // Update status to in_progress
    await supabase
      .from('pdfs')
      .update({ 
        notes_generation_status: 'in_progress',
        notes_generation_progress: 0
      })
      .eq('id', pdfId);

    try {
      // Generate notes using the optimized generator with progress updates
      const notes = await noteGenerator.generateNotes(
        Buffer.from(pdfBuffer),
        async (progress) => {
          await supabase
            .from('pdfs')
            .update({ notes_generation_progress: progress })
            .eq('id', pdfId);
        }
      );

      // Update the database with the generated notes
      const { error: updateError } = await supabase
        .from('pdfs')
        .update({ 
          notes,
          notes_generation_status: 'completed',
          notes_generation_progress: 100
        })
        .eq('id', pdfId)
        .eq('user_id', session.user.id);

      if (updateError) {
        console.error('Error updating PDF with notes:', updateError);
        return NextResponse.json(
          { error: "Failed to save notes" },
          { status: 500 }
        );
      }

      console.log('Notes saved to database successfully');
      return NextResponse.json({ success: true, notes });
    } catch (error) {
      console.error('Error generating notes:', error);
      
      // Update status to failed
      await supabase
        .from('pdfs')
        .update({ 
          notes_generation_status: 'failed',
          notes_generation_progress: 0
        })
        .eq('id', pdfId);

      return NextResponse.json(
        { error: "Failed to generate notes" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in generate-notes route:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
