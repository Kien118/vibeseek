// Direct REST API test - bypass SDK issues
const apiKey = 'AIzaSyADkY8tNcmKm7-euH7uZZqt5_g7MRTbhCk';

// 1. Test listing models
console.log('=== Test 1: List models ===');
try {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.error) {
    console.log('❌ Key error:', data.error.message?.substring(0, 200));
  } else {
    const models = data.models?.filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'));
    console.log(`✅ Key valid. ${models?.length} generative models available:`);
    models?.slice(0, 8).forEach(m => console.log(`  - ${m.name}`));
  }
} catch (err) {
  console.log('❌ Network error:', err.message);
}

// 2. Test actual generation
console.log('\n=== Test 2: Generate content ===');
const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest'];
for (const model of modelsToTry) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hello in Vietnamese in 5 words' }] }]
      })
    });
    const data = await res.json();
    if (data.error) {
      console.log(`❌ ${model}: ${data.error.code} - ${data.error.message?.substring(0, 100)}`);
    } else {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ ${model}: "${text}"`);
      break;
    }
  } catch (err) {
    console.log(`❌ ${model}: ${err.message}`);
  }
}
