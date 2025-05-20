import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate safe filename
    const fileExtension = path.extname(file.name).toLowerCase();
    const safeFilename = `${randomUUID()}${fileExtension}`;
    const filePath = join(UPLOAD_DIR, safeFilename);
    
    try {
      await writeFile(filePath, buffer);

      return NextResponse.json({
        message: 'File uploaded successfully',
        filename: safeFilename, // Return the safe filename instead of original
        originalName: file.name,
        size: file.size
      });
    } catch {
      return NextResponse.json(
        { error: 'Error saving file' },
        { status: 500 }
      );
    }

  } catch {
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    );
  }
} 