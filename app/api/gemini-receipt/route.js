export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY тохируулаагүй байна' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { base64, mimeType } = body;

    if (!base64) {
      return Response.json(
        { error: 'base64 image байхгүй байна' },
        { status: 400 }
      );
    }

    const prompt = Чи Монголын ebarimt болон дэлгүүрийн баримт уншдаг санхүүгийн OCR туслах. Зурагнаас мэдээлэл уншаад ЗӨВХӨН JSON буцаа. Markdown битгий бич.

Schema:
{
  "type": "expense",
  "amount": number|null,
  "date": "YYYY-MM-DD"|null,
  "merchant": string|null,
  "category": string,
  "description": string,
  "confidence": number,
  "rawTextSummary": string
}

Ангилал:
- Хүнс
- Тээвэр
- Кафе/Хоол
- Шатахуун
- Утас/Интернэт
- Эрүүл мэнд
- Түрээс
- Бусад зарлага

Нийт төлөх дүнг amount болго.
Огноо байхгүй бол null.
Дүн байхгүй бол null.;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    };

    const url =
      https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)};

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return Response.json(
        {
          error: data?.error?.message || Gemini API error ${res.status},
          detail: data
        },
        { status: res.status }
      );
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('\n');

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      json = JSON.parse(text.replace(/

