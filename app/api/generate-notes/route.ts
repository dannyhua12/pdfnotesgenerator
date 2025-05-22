import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { supabase } from "@/lib/supabase";

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

export async function POST(request: NextRequest) {
  try {
    console.log('Starting notes generation process...');
    const body = await request.json();
    const { pdfId, fileUrl } = body;

    if (!pdfId || !fileUrl) {
      console.error('Missing parameters:', { pdfId, fileUrl });
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
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
      .eq('id', pdfId);

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
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
