export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    // ТАНИЙ АЛДАА: gemini-3.5 гэж байхгүй. 2.0 эсвэл 1.5 ашиглана.
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY тохируулаагүй байна" }, { status: 500 });
    }

    const body = await request.json();
    const { base64, mimeType = "image/jpeg" } = body;

    if (!base64) {
      return Response.json({ error: "base64 image байхгүй байна" }, { status: 400 });
    }

    const promptLines = [
      "Чи Монголын ebarimt болон дэлгүүрийн баримт уншдаг санхүүгийн OCR туслах.",
      "Зурагнаас мэдээлэл уншаад зөвхөн JSON буцаа.",
      "Markdown битгий бич. Зөвхөн цэвэр JSON өг.",
      "JSON schema: { \"type\": \"expense\", \"amount\": number|null, \"date\": \"YYYY-MM-DD\"|null, \"merchant\": string|null, \"category\": string, \"description\": string, \"confidence\": number, \"rawTextSummary\": string }",
      "Ангилал сонгох: CU, GS25, Emart, Nomin, supermarket -> Хүнс; Petrovis, fuel -> Шатахуун; Mobicom, Unitel -> Утас/Интернэт; taxi, bus -> Тээвэр; pharmacy -> Эрүүл мэнд; restaurant, coffee -> Кафе/Хоол; Бусад."
    ];

    const payload = {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: promptLines.join("\n") }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return Response.json({ error: "Gemini API error", detail: data }, { status: res.status });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Найдвартай JSON парс хийх хэсэг
    let json;
    try {
      // Markdown-г арилгаад, {}-ээс гаднахыг хаяж зөвхөн JSON-оо авна
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      json = JSON.parse(match ? match[0] : cleaned);
    } catch (parseError) {
      return Response.json({ error: "JSON хөрвүүлэлтийн алдаа", raw: text }, { status: 500 });
    }

    return Response.json({ json, raw: text });
  } catch (error) {
    return Response.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
