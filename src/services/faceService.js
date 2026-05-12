const THRESHOLD = parseFloat(process.env.FACEPP_THRESHOLD || '80');
const ENDPOINT = 'https://api-us.faceplusplus.com/facepp/v3/compare';

function stripPrefix(b64) {
  return b64.replace(/^data:image\/\w+;base64,/, '');
}

async function compareFaces(referenceB64, newB64) {
  const API_KEY = process.env.FACEPP_API_KEY;
  const API_SECRET = process.env.FACEPP_API_SECRET;

  if (!API_KEY || !API_SECRET) {
    return { match: true, confidence: null, error: 'Face++ ไม่ได้ตั้งค่า' };
  }

  try {
    const form = new FormData();
    form.append('api_key', API_KEY);
    form.append('api_secret', API_SECRET);
    form.append('image_base64_1', stripPrefix(referenceB64));
    form.append('image_base64_2', stripPrefix(newB64));

    const res = await fetch(ENDPOINT, { method: 'POST', body: form });
    const data = await res.json();

    if (data.error_message) {
      if (data.error_message.includes('NO_FACE') || data.error_message.includes('EMPTY')) {
        return { match: false, confidence: 0, error: 'ไม่พบใบหน้าในรูป' };
      }
      console.error('Face++ error:', data.error_message);
      return { match: true, confidence: null, error: data.error_message };
    }

    const confidence = parseFloat(data.confidence || 0);
    return { match: confidence >= THRESHOLD, confidence, error: null };

  } catch (e) {
    console.error('Face++ request error:', e.message);
    // On network error → allow through (don't block employee)
    return { match: true, confidence: null, error: e.message };
  }
}

module.exports = { compareFaces, THRESHOLD };
