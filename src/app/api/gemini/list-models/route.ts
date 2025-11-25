import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    // List available models
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      const modelNames = data.models?.map((m: any) => m.name) || [];
      
      return NextResponse.json({ 
        success: true, 
        availableModels: modelNames,
        totalCount: modelNames.length
      });
    } else {
      const error = await listResponse.text();
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to list models',
        details: error 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error listing models:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to list models' 
    }, { status: 500 });
  }
}