export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    // Энд 'models/' гэж бичих шаардлагагүй, зөвхөн моделийн нэрээ бичнэ
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY тохируулаагүй байна" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const base64 = body.base64;
    const mimeType = body.mimeType || "image/jpeg";

    if (!base64) {
      return Response.json(
        { error: "base64 image байхгүй байна" },
        { status: 400 }
      );
    }

    const promptLines = [
      "Чи Монголын ebarimt болон дэлгүүрийн баримт уншдаг санхүүгийн OCR туслах.",
      "Зурагнаас мэдээлэл уншаад зөвхөн JSON буцаа.",
      "Markdown битгий бич.",
      "",
      "JSON schema:",
      "{",
      "  \"type\": \"expense\",",
      "  \"amount\": number эсвэл null,",
      "  \"date\": \"YYYY-MM-DD\" эсвэл null,",
      "  \"merchant\": string эсвэл null,",
      "  \"category\": string,",
      "  \"description\": string,",
      "  \"confidence\": number,",
      "  \"rawTextSummary\": string",
      "}",
      "",
      "Ангилал сонгох дүрэм:",
      "CU, GS25, Emart, Nomin, supermarket, market бол Хүнс.",
      "Petrovis, Shunkhlai, fuel, gas station бол Шатахуун.",
      "Mobicom, Unitel, Skytel, интернет бол Утас/Интернэт.",
      "taxi, bus, UBCab бол Тээвэр.",
      "pharmacy, эм, hospital, clinic бол Эрүүл мэнд.",
      "restaurant, cafe, coffee, хоол бол Кафе/Хоол.",
      "Тодорхойгүй бол Бусад зарлага.",
      "",
      "Нийт төлөх дүнг amount болго.",
      "Огноо байхгүй бол null болго.",
      "Дүн байхгүй бол null болго."
    ];

    const prompt = promptLines.join("\n");

    const payload = {
      contents: [
        {
          role: "user",
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
        responseMimeType: "application/json"
      }
    };

    // Энд код өөрөө 'models/' гэдгийг URL-д нэмж байгаа учраас 
    // хувьсагч дээр давхардуулах хэрэггүй.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok) {
      let message = "Gemini API error " + res.status;
      if (data && data.error && data.error.message) {
        message = data.error.message;
      }

      return Response.json(
        {
          error: message,
          detail: data
        },
        { status: res.status }
      );
    }

    let parts = [];
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
    ) {
      parts = data.candidates[0].content.parts;
    }

    const text = parts
      .map(function (part) {
        return part.text || "";
      })
      .join("\n");

    let json;

    try {
      json = JSON.parse(text);
    } catch (parseError) {
      const cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      json = JSON.parse(cleaned);
    }

    return Response.json({
      json: json,
      raw: text
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
