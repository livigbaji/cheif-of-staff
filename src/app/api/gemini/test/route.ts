import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    // Test multiple model names to find one that works
    const models = [
      'gemini-1.5-flash-latest', 
      'gemini-1.5-pro-latest', 
      'gemini-1.0-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro', 
      'gemini-pro-latest', 
      'gemini-1.0-pro',
      'gemini-pro'
    ];
    let lastError = '';
    
    for (const model of models) {
      try {
        // Test the Gemini API key with a simple request
        const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
            message: `API key is valid and working with model: ${model}`,
            model: model,
            testResponse: response 
          });
        } else {
          const error = await testResponse.text();
          lastError = `${model}: ${error}`;
          console.log(`Model ${model} failed:`, error);
          continue; // Try next model
        }
      } catch (error) {
        lastError = `${model}: ${error}`;
        console.log(`Model ${model} error:`, error);
        continue; // Try next model
      }
    }
    
    // If we get here, all models failed
    return NextResponse.json({ 
      success: false, 
      error: 'No working models found for this API key',
      details: lastError 
    }, { status: 400 });

  } catch (error) {
    console.error('Error testing Gemini API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to test API connection' 
    }, { status: 500 });
  }
}