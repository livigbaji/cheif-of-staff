import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    // Test the Gemini API key with a simple request
    const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Test connection. Respond with just "OK" if this works.' }]
        }]
      })
    });

    if (testResponse.ok) {
      const data = await testResponse.json();
      const response = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      return NextResponse.json({ 
        success: true, 
        message: 'API key is valid and working',
        testResponse: response 
      });
    } else {
      const error = await testResponse.text();
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid API key or request failed',
        details: error 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error testing Gemini API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to test API connection' 
    }, { status: 500 });
  }
}