import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib';
import PDFParse from 'pdf-parse';

interface Chunk {
  text: string;
  pageNumber: number;
}

interface ProcessedChunk {
  notes: string;
  pageNumber: number;
}

interface ProgressCallback {
  (progress: number): void;
}

export class OptimizedNoteGenerator {
  private openai: OpenAI;
  private readonly CHUNK_SIZE = 4000; // Characters per chunk
  private readonly MAX_CONCURRENT_REQUESTS = 3; // Maximum parallel requests

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  private async extractTextFromPDF(pdfBuffer: Buffer): Promise<Chunk[]> {
    const pdfData = await PDFParse(pdfBuffer);
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let currentPageNumber = 1;

    // Split text into sentences for better chunking
    const sentences = pdfData.text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            pageNumber: currentPageNumber
          });
        }
        currentChunk = sentence;
        currentPageNumber = Math.ceil(chunks.length / (pdfData.numpages / 2)) + 1;
      } else {
        currentChunk += ' ' + sentence;
      }
    }

    // Add the last chunk if it exists
    if (currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        pageNumber: currentPageNumber
      });
    }

    return chunks;
  }

  private async processChunk(chunk: Chunk): Promise<ProcessedChunk> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert note-taker. Generate detailed, well-structured notes for page ${chunk.pageNumber}. 
            Follow these guidelines:
            1. Use markdown formatting
            2. Bold important terms and concepts using **term**
            3. Use headers (# for main sections, ## for subsections)
            4. Create bullet points for key ideas
            5. Include relevant examples
            6. Maintain consistency with other sections
            7. Add a brief summary at the end of each section`
          },
          {
            role: "user",
            content: `Generate notes for this page:\n\n${chunk.text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return {
        notes: response.choices[0].message.content || '',
        pageNumber: chunk.pageNumber
      };
    } catch (error) {
      console.error(`Error processing chunk from page ${chunk.pageNumber}:`, error);
      return {
        notes: `Error processing page ${chunk.pageNumber}. Please try again.`,
        pageNumber: chunk.pageNumber
      };
    }
  }

  private async processChunksInParallel(chunks: Chunk[], onProgress?: ProgressCallback): Promise<ProcessedChunk[]> {
    const results: ProcessedChunk[] = [];
    const chunksCopy = [...chunks];
    let processedCount = 0;

    while (chunksCopy.length > 0) {
      const batch = chunksCopy.splice(0, this.MAX_CONCURRENT_REQUESTS);
      const batchResults = await Promise.all(
        batch.map(chunk => this.processChunk(chunk))
      );
      results.push(...batchResults);
      
      processedCount += batch.length;
      if (onProgress) {
        const progress = Math.round((processedCount / chunks.length) * 100);
        onProgress(progress);
      }
    }

    return results.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  private generateTableOfContents(notes: string): string {
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

  public async generateNotes(pdfBuffer: Buffer, onProgress?: ProgressCallback): Promise<string> {
    try {
      // Extract and chunk the text
      const chunks = await this.extractTextFromPDF(pdfBuffer);
      
      // Process chunks in parallel
      const processedChunks = await this.processChunksInParallel(chunks, onProgress);
      
      // Combine all notes
      const combinedNotes = processedChunks
        .map(chunk => `## Page ${chunk.pageNumber}\n\n${chunk.notes}`)
        .join('\n\n');

      // Add table of contents
      const toc = this.generateTableOfContents(combinedNotes);
      const finalNotes = `${toc}\n\n${combinedNotes}`;

      return finalNotes;
    } catch (error) {
      console.error('Error generating notes:', error);
      throw new Error('Failed to generate notes. Please try again.');
    }
  }
} 