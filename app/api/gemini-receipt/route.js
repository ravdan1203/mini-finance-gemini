export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY тохируулаагүй байна" }, { status: 500 });
    }

    const body = await request.json();
    const base64 = body.base64;
    const mimeType = body.mimeType || "image/jpeg";

    if (!base64) {
      return Response.json({ error: "base64 image байхгүй байна" }, { status: 400 });
    }

    const promptLines = [
      "You are a receipt OCR extraction engine.",
      "Read the receipt image and return ONLY valid JSON.",
      "Do not return markdown. Do not return explanation.",
      "If a field is unknown, use null.",
      "Return exactly this JSON shape:",
      "{",
      "  \"type\": \"expense\",",
      "  \"amount\": 24700,",
      "  \"date\": \"2026-06-10\",",
      "  \"merchant\": \"merchant name\",",
      "  \"category\": \"Хүнс\",",
      "  \"description\": \"Receipt expense\",",
      "  \"confidence\": 0.8,",
      "  \"rawTextSummary\": \"short summary\"",
      "}",
      "Categories must be one of: Хүнс, Тээвэр, Кафе/Хоол, Шатахуун, Утас/Интернэт, Эрүүл мэнд, Түрээс, Бусад зарлага.",
      "Use the final total amount, not VAT or subtotal."
    ];

    const prompt = promptLines.join("\n");

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mimeType, data: base64 } },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      }
    };

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(apiKey);

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(function () { return {}; });

    if (!res.ok) {
      let message = "Gemini API error " + res.status;
      if (data && data.error && data.error.message) message = data.error.message;
      return Response.json({ error: message, detail: data }, { status: res.status });
    }

    let parts = [];
    if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      parts = data.candidates[0].content.parts;
    }

    const text = parts.map(function (part) { return part.text || ""; }).join("\n");

    let json = null;

    try {
      json = JSON.parse(text);
    } catch (parseError1) {
      try {
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first >= 0 && last > first) {
          const candidate = text.slice(first, last + 1);
          json = JSON.parse(candidate);
        }
      } catch (parseError2) {
        json = null;
      }
    }

    if (!json) {
      json = {
        type: "expense",
        amount: null,
        date: null,
        merchant: null,
        category: "Бусад зарлага",
        description: "Gemini JSON parse failed. Please edit manually.",
        confidence: 0,
        rawTextSummary: text || "No text returned"
      };
    }

    return Response.json({ json: json, raw: text });
  } catch (error) {
    return Response.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
