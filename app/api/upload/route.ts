import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Helper function to verify user authentication
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

// Helper function to generate UUID using Web Crypto API
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
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

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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

    // Upload to Supabase Storage using public client
    const { data, error } = await supabase.storage
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

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from("pdfs")
      .getPublicUrl(`uploads/${safeFilename}`);

    // Create a record in the pdfs table
    const { data: pdfData, error: pdfError } = await supabase
      .from('pdfs')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_path: `uploads/${safeFilename}`
      })
      .select()
      .single();

    if (pdfError) {
      console.error("Error creating PDF record:", pdfError);
      return NextResponse.json(
        { error: "Failed to create PDF record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      publicUrl,
      pdfId: pdfData.id 
    });
  } catch (error) {
    console.error("Error in upload route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 