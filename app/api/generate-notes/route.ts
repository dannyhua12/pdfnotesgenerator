import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { join } from "path";
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

// Constants
const MAX_TOKENS = 8000; // GPT-4 context window limit
const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim()
});

export async function POST(request: NextRequest) {
  let filePath: string | null = null;
  
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }

    filePath = join(UPLOAD_DIR, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    const text = docs.map((doc: Document) => doc.pageContent).join("\n\n");

    // Estimate token count (rough estimation)
    const estimatedTokens = text.length / 4;
    if (estimatedTokens > MAX_TOKENS) {
      return NextResponse.json(
        { error: "PDF content too large to process. Please use a shorter document." },
        { status: 400 }
      );
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Generate concise, well-structured study notes from the following PDF text. Follow these guidelines:

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

Here's the text to analyze:

${text}`,
          },
        ],
      });

      // Clean up the uploaded file after processing
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        console.error('Failed to delete file:', cleanupError);
        // Don't throw error as the main operation succeeded
      }

      return NextResponse.json({ notes: completion.choices[0].message.content });
    } catch (gptError: unknown) {
      // Handle specific OpenAI errors
      if (gptError instanceof Error) {
        if (gptError.message.toLowerCase().includes('token')) {
          return NextResponse.json(
            { error: "Token limit exceeded. Please use a shorter document." },
            { status: 400 }
          );
        }
        if (gptError.message.toLowerCase().includes('rate')) {
          return NextResponse.json(
            { error: "Rate limit exceeded. Please try again later." },
            { status: 429 }
          );
        }
      }
      return NextResponse.json(
        { error: "OpenAI request failed", details: gptError instanceof Error ? gptError.message : "Unknown error" },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    // Ensure file cleanup even if an error occurred
    if (filePath && existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        console.error('Failed to delete file in cleanup:', cleanupError);
      }
    }
  }
}
