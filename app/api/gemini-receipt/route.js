export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return Response.json({ error: "API Key олдсонгүй" }, { status: 500 });
    }

    const body = await request.json();
    const { base64, mimeType = "image/jpeg" } = body;

    const payload = {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: "JSON-оор хариул." }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // 1. Хариултыг JSON-оор биш, текстээр авна
    const responseText = await res.text();

    // 2. Хэрэв API-аас 200 (OK) хариулт ирээгүй бол яг юу ирснийг лог дээр хэвлэ
    if (!res.ok) {
      console.error("API Error Response:", responseText);
      return Response.json({ error: "Gemini API failed", detail: responseText }, { status: res.status });
    }

    // 3. Зөвхөн амжилттай үед JSON-оор парс хийнэ
    try {
      const data = JSON.parse(responseText);
      const text = data.candidates[0].content.parts[0].text;
      return Response.json({ json: JSON.parse(text) });
    } catch (parseError) {
      console.error("Parse Error:", responseText); // Энд алдаа гарвал юу болсныг харна
      return Response.json({ error: "JSON парс хийхэд алдаа гарлаа", detail: responseText }, { status: 500 });
    }

  } catch (error) {
    console.error("Server Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
