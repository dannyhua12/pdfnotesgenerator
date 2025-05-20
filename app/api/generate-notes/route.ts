import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { join } from "path";

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }

    const filePath = join(process.cwd(), 'uploads', filename);
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    const text = docs.map((doc: Document) => doc.pageContent).join("\n\n");

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

      return NextResponse.json({ notes: completion.choices[0].message.content });
    } catch (gptError: unknown) {
      return NextResponse.json({ error: "OpenAI request failed", details: gptError instanceof Error ? gptError.message : "Unknown error" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
