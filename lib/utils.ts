import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function chunkText(text: string, maxTokens: number): string[] {
  // Rough estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  const chunks: string[] = [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // If a single paragraph is too long, split it by sentences
      if (paragraph.length > maxChars) {
        const sentences = paragraph.split(/[.!?]+/);
        let currentSentenceChunk = '';
        
        for (const sentence of sentences) {
          if (currentSentenceChunk.length + sentence.length > maxChars) {
            chunks.push(currentSentenceChunk.trim());
            currentSentenceChunk = sentence;
          } else {
            currentSentenceChunk += sentence;
          }
        }
        if (currentSentenceChunk) {
          chunks.push(currentSentenceChunk.trim());
        }
      } else {
        chunks.push(paragraph.trim());
      }
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
