import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { createClient } from "@supabase/supabase-js";

// Constants
const MAX_TOKENS = 8000; // GPT-4 context window limit

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
          content: `You are a professional note-taker and educator. Your task is to create comprehensive, well-structured study notes from PDF content. Follow these guidelines:

1. Format:
   - Use **bold** for main section titles
   - Use *italic* for subsection titles
   - Use bullet points (•) for all content
   - Add line breaks between major sections
   - Keep each point brief and clear

2. Structure:
   - Start with main topic in bold
   - Break down into logical subsections
   - Use nested bullet points for related concepts
   - Include examples as separate bullet points
   - End each major section with a brief summary

3. Content:
   - Focus on key concepts and definitions
   - Include important formulas and theorems
   - Add practical examples where relevant
   - Highlight critical points with sub-bullets

4. Math Formatting:
   - Use LaTeX for all mathematical expressions
   - Inline math should be wrapped in single $ signs (e.g., $x^2 + y^2 = z^2$)
   - Display math should be wrapped in double $ signs (e.g., $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$)
   - Use proper LaTeX notation for all mathematical symbols
   - Format equations and formulas clearly with proper spacing

5. Key Terms and Definitions:
   - Identify and **bold** all key terms and their definitions
   - Format definitions as: "**Term**: Definition"
   - Group related terms together
   - Include examples after each definition where relevant
   - Highlight important properties or characteristics of each term
   - Use bullet points to list multiple definitions or properties

6. Visual Organization:
   - Use clear hierarchical structure
   - Add spacing between sections for readability
   - Use consistent formatting throughout
   - Include section numbers for easy reference

7. Additional Elements:
   - Add "Key Takeaways" at the end of each major section
   - Include "Important Notes" boxes for critical information
   - Add "Examples" sections where relevant
   - Include "Practice Questions" if appropriate

Remember to maintain a clear, academic tone while making the content accessible and easy to understand.`
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
    console.error('Error generating notes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate notes" },
      { status: 500 }
    );
  }
}
