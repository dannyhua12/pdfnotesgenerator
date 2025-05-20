import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, file.name);
    
    try {
      await writeFile(filePath, buffer);

      return NextResponse.json({
        message: 'File uploaded successfully',
        filename: file.name,
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