import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file received in upload request');
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check if the file is a PDF
    if (file.type !== 'application/pdf') {
      console.error('Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Convert the file to a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      console.log('Creating uploads directory');
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, file.name);
    console.log('Saving file to:', filePath);
    
    try {
      await writeFile(filePath, buffer);
      console.log('File saved successfully');

      return NextResponse.json({
        message: 'File uploaded successfully',
        filename: file.name,
        size: file.size
      });
    } catch (writeError) {
      console.error('Error writing file:', writeError);
      return NextResponse.json(
        { error: 'Error saving file' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    );
  }
} 