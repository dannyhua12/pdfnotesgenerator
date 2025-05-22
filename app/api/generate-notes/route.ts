import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Constants
const MAX_TOKENS = 8000; // GPT-4 context window limit
const MAX_REQUESTS_PER_HOUR = 20;

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

    console.log('Generating notes with OpenAI...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert note-taker and educator that creates comprehensive, well-structured study notes from PDF content. Your goal is to help students understand and retain the material effectively.

Formatting Guidelines:
1. Start with a clear title and brief overview of the document
2. Use hierarchical headings (## for main sections, ### for subsections)
3. For each section:
   - Begin with key concepts and definitions
   - Use bullet points for important details
   - Include relevant examples where appropriate
   - Add a brief summary at the end
4. Format all mathematical content using LaTeX (in $$...$$ or \( ... \))
5. Use tables for comparing concepts or presenting structured data
6. Highlight key terms in **bold**
7. Use numbered lists for sequential steps or processes
8. Include diagrams or visual descriptions where relevant
9. Add a comprehensive summary at the end
10. Use markdown for all formatting

Additional Guidelines:
- Break down complex concepts into digestible parts
- Include real-world applications where relevant
- Add memory aids or mnemonics for important concepts
- Cross-reference related concepts within the notes
- Include practice questions or key points to remember
- Maintain a consistent and professional tone
- Ensure all mathematical equations are properly formatted in LaTeX
- Use clear transitions between sections`
        },
        {
          role: "user",
          content: `Please generate comprehensive, well-structured study notes from the following PDF content. Follow all the formatting guidelines provided and ensure the notes are detailed, informative, and easy to understand:\n\n${text}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const notes = completion.choices[0].message.content;
    console.log('Notes generated successfully');

    console.log('Updating database with notes...');
    const { error: updateError } = await supabase
      .from('pdfs')
      .update({ notes })
      .eq('id', pdfId)
      .eq('user_id', session.user.id); // Ensure user owns the PDF

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
    console.error('Error in generate-notes route:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
