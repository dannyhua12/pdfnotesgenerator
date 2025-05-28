import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf'];
const MAX_REQUESTS_PER_MINUTE = 10;

// Rate limiting map
const rateLimit = new Map<string, { count: number; timestamp: number }>();

// Helper function to generate UUID using Web Crypto API
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers adadad
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to get file extension
function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex !== -1 ? filename.substring(dotIndex) : '';
}

// Rate limiting middleware
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimit.get(userId);

  if (!userLimit) {
    rateLimit.set(userId, { count: 1, timestamp: now });
    return true;
  }

  if (now - userLimit.timestamp > 60000) {
    rateLimit.set(userId, { count: 1, timestamp: now });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => {
            cookieStore.set({ name, value, ...options });
          },
          remove: (name, options) => {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('No session found in upload route');
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Generate safe filename
    const fileExtension = getFileExtension(file.name);
    const safeFilename = `${generateUUID()}${fileExtension}`;

    // Convert to Buffer
    const stream = file.stream();
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const buffer = Buffer.concat(chunks);

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("pdfs")
      .upload(`uploads/${safeFilename}`, buffer, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Create database record
    const { error: dbError } = await supabase
      .from('pdfs')
      .insert({
        file_name: file.name,
        storage_path: `uploads/${safeFilename}`,
        user_id: session.user.id,
        file_size: file.size,
        mime_type: file.type
      });

    if (dbError) {
      // If database insert fails, delete the uploaded file
      await supabase.storage
        .from("pdfs")
        .remove([`uploads/${safeFilename}`]);
      
      return NextResponse.json(
        { error: "Failed to save file information" },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from("pdfs")
      .getPublicUrl(`uploads/${safeFilename}`);

    return NextResponse.json({ success: true, publicUrl });
  } catch (error) {
    console.error("Error in upload route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 