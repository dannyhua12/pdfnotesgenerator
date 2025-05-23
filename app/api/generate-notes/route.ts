import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { chunkText } from '@/lib/utils';

// Constants
const MAX_TOKENS = 8000; // GPT-4 context window limit
const MAX_REQUESTS_PER_HOUR = 20;

// Constants for chunking
const CHUNK_SIZE = 4000; // tokens
const MAX_PARALLEL_REQUESTS = 3;

// Rate limiting map
const rateLimit = new Map<string, { count: number; timestamp: number }>();

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim()
});

// Rate limiting middleware
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimit.get(userId);

  if (!userLimit) {
    rateLimit.set(userId, { count: 1, timestamp: now });
    return true;
  }

  if (now - userLimit.timestamp > 3600000) { // 1 hour
    rateLimit.set(userId, { count: 1, timestamp: now });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Helper function to detect if content contains LaTeX
function containsLatex(text: string): boolean {
  const latexPatterns = [
    /\$[^$]+\$/g,  // Inline math
    /\$\$[^$]+\$\$/g,  // Display math
    /\\begin\{[^}]+\}/g,  // LaTeX environments
    /\\[a-zA-Z]+(\{[^}]+\})?/g  // LaTeX commands
  ];
  return latexPatterns.some(pattern => pattern.test(text));
}

// Helper function to preserve LaTeX in text
function preserveLatex(text: string): string {
  return text.replace(/\$[^$]+\$/g, match => `[LATEX]${match}[LATEX]`)
             .replace(/\$\$[^$]+\$\$/g, match => `[LATEX]${match}[LATEX]`)
             .replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, match => `[LATEX]${match}[LATEX]`);
}

// Helper function to restore LaTeX in text
function restoreLatex(text: string): string {
  return text.replace(/\[LATEX\](.*?)\[LATEX\]/g, '$1');
}

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

    // Define updateProgress inside the handler to access supabase
    const updateProgress = async (pdfId: string, progress: number) => {
      await supabase
        .from('pdfs')
        .update({ 
          notes_generation_progress: progress,
          notes_generation_status: progress === 100 ? 'completed' : 'in_progress'
        })
        .eq('id', pdfId);
    };

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('No session found in generate-notes route');
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
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
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    console.log('Loading PDF content...');
    const loader = new PDFLoader(pdfBlob);
    const docs = await loader.load();
    const text = docs.map((doc: Document) => doc.pageContent).join("\n\n");

    console.log('PDF content loaded, estimating token count...');
    const estimatedTokens = text.length / 4;
    if (estimatedTokens > MAX_TOKENS) {
      console.error('Token limit exceeded:', estimatedTokens);
      return NextResponse.json(
        { error: "PDF content too large to process. Please use a shorter document." },
        { status: 400 }
      );
    }

    // Split text into chunks
    const chunks = chunkText(text, CHUNK_SIZE);
    
    // Process chunks in parallel with a limit
    const chunkPromises = chunks.map(async (chunk, index) => {
      // Check if chunk contains LaTeX
      const hasLatex = containsLatex(chunk);
      const processedChunk = hasLatex ? preserveLatex(chunk) : chunk;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert note-taker. Generate detailed, well-structured notes for section ${index + 1} of ${chunks.length}. 
            Follow these guidelines:
            1. Use markdown formatting
            2. Bold important terms and concepts using **term**
            3. Use headers (# for main sections, ## for subsections)
            4. Create bullet points for key ideas
            5. Include relevant examples
            6. Maintain consistency with other sections
            7. If you see [LATEX] tags, preserve them exactly as they are
            8. Add a brief summary at the end of each section`
          },
          {
            role: "user",
            content: `Generate notes for this section:\n\n${processedChunk}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        console.error('No content generated for chunk', index);
        return `Error: No content generated for section ${index + 1}`;
      }

      let notes = content;
      // Restore LaTeX if it was present
      if (hasLatex) {
        notes = restoreLatex(notes);
      }
      return notes;
    });

    // Process chunks in batches to avoid rate limits
    const results = [];
    for (let i = 0; i < chunkPromises.length; i += MAX_PARALLEL_REQUESTS) {
      const batch = chunkPromises.slice(i, i + MAX_PARALLEL_REQUESTS);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      // Update progress
      const progress = Math.round(((i + batch.length) / chunkPromises.length) * 100);
      await updateProgress(pdfId, progress);
    }

    // Combine and format the results
    const notes = results.join('\n\n');

    // Add a table of contents at the beginning
    const toc = generateTableOfContents(notes);
    const finalNotes = `${toc}\n\n${notes}`;

    console.log('Notes generated successfully');

    console.log('Updating database with notes...');
    const { error: updateError } = await supabase
      .from('pdfs')
      .update({ notes: finalNotes })
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
    return NextResponse.json({ success: true, notes: finalNotes });
  } catch (error) {
    console.error('Error in generate-notes route:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to generate table of contents
function generateTableOfContents(notes: string): string {
  const headers = notes.match(/^#+ .+$/gm) || [];
  const toc = headers.map(header => {
    const levelMatch = header.match(/^#+/);
    if (!levelMatch) return `- ${header.replace(/^#+\s+/, '')}`;
    const level = levelMatch[0].length;
    const title = header.replace(/^#+\s+/, '');
    const indent = '  '.repeat(level - 1);
    return `${indent}- ${title}`;
  }).join('\n');

  return `# Table of Contents\n\n${toc}`;
}
