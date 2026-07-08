export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

    if (!apiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY тохируулаагүй байна' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const base64 = body.base64;
    const mimeType = body.mimeType || 'image/jpeg';

    if (!base64) {
      return Response.json(
        { error: 'base64 image байхгүй байна' },
        { status: 400 }
      );
    }

    const prompt = [
      'Чи Монголын ebarimt болон дэлгүүрийн баримт уншдаг санхүүгийн OCR туслах.',
      'Зурагнаас мэдээлэл уншаад зөвхөн JSON буцаа.',
      'Markdown битгий бич.',
      '',
      'JSON schema:',
      '{',
      '  "type": "expense",',
      '  "amount": number эсвэл null,',
      '  "date": "YYYY-MM-DD" эсвэл null,',
      '  "merchant": string эсвэл null,',
      '  "category": string,',
      '  "description": string,',
      '  "confidence": number,',
      '  "rawTextSummary": string',
      '}',
      '',
      'Ангилал сонгох дүрэм:',
      '- CU, GS25, Emart, Nomin, supermarket, market бол Хүнс',
      '- Petrovis, Shunkhlai, fuel, gas station бол Шатахуун',
      '- Mobicom, Unitel, Skytel, интернет бол Утас/Интернэт',
      '- taxi, bus, UBCab бол Тээвэр',
      '- pharmacy, эм, hospital, clinic бол Эрүүл мэнд',
      '- restaurant, cafe, coffee, хоол бол Кафе/Хоол',
      '- тодорхойгүй бол Бусад зарлага',
      '',
      'Нийт төлөх дүнг amount болго.',
      'Огноо байхгүй бол null болго.',
      'Дүн байхгүй бол null болго.'
    ].join('\n');

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
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
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(apiKey);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      return Response.json(
        {
          error: data && data.error && data.error.message
            ? data.error.message
            : 'Gemini API error ' + res.status,
          detail: data
        },
        { status: res.status }
      );
    }

    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
        ? data.candidates[0].content.parts
        : [];

    const text = parts
      .map(function (part) {
        return part.text || '';
      })
      .join('\n');

    let json;

    try {
      json = JSON.parse(text);
    } catch (error) {
      const cleaned = text
        .split('
