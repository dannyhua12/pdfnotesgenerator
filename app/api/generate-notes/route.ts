import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { supabase } from "@/lib/supabase";
import { createClient } from '@supabase/supabase-js';

// Constants
const MAX_TOKENS = 8000; // GPT-4 context window limit
const MAX_REQUESTS_PER_HOUR = 10; // Rate limiting

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim()
});

// Helper function to verify user authentication
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

// Helper function to check rate limiting
async function checkRateLimit(userId: string) {
  const { data: requests, error } = await supabase
    .from('rate_limits')
    .select('count, last_request')
    .eq('user_id', userId)
    .eq('endpoint', 'generate-notes')
    .single();

  if (error) {
    // If no record exists, create one
    await supabase
      .from('rate_limits')
      .insert({
        user_id: userId,
        endpoint: 'generate-notes',
        count: 1,
        last_request: new Date().toISOString()
      });
    return true;
  }

  const lastRequest = new Date(requests.last_request);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  if (lastRequest < hourAgo) {
    // Reset count if last request was more than an hour ago
    await supabase
      .from('rate_limits')
      .update({
        count: 1,
        last_request: now.toISOString()
      })
      .eq('user_id', userId)
      .eq('endpoint', 'generate-notes');
    return true;
  }

  if (requests.count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  // Increment count
  await supabase
    .from('rate_limits')
    .update({
      count: requests.count + 1,
      last_request: now.toISOString()
    })
    .eq('user_id', userId)
    .eq('endpoint', 'generate-notes');

  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check rate limiting
    const isAllowed = await checkRateLimit(user.id);
    if (!isAllowed) {
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
      .eq('user_id', user.id)
      .single();

    if (pdfError || !pdf) {
      return NextResponse.json(
        { error: "PDF not found or unauthorized" },
        { status: 403 }
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
          content: `You are a helpful assistant that generates detailed, well-formatted study notes from PDF content.\n\nFormatting Guidelines:\n\n1. Use clear section headings (##)\n2. Use bullet points, numbered lists, and tables where appropriate\n3. Render all math using LaTeX (in $$...$$ or \( ... \))\n4. Highlight key terms in bold\n5. Add a summary at the end of each section\n6. Use markdown for all formatting.\n\nIf the PDF contains math, use proper LaTeX notation for all equations.`
        },
        {
          role: "user",
          content: `Please generate comprehensive, well-structured study notes from the following PDF content. Follow all the formatting guidelines provided:\n\n${text}`
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
      .eq('user_id', user.id); // Ensure user can only update their own PDFs

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
