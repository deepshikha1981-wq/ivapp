import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { fileUrl } = await req.json()

    const fileRes = await fetch(fileUrl)
    const fileBuffer = await fileRes.arrayBuffer()
    const base64File = Buffer.from(fileBuffer).toString('base64')
    const mimeType = fileRes.headers.get('content-type') || 'application/pdf'

    const prompt = 'Extract the following fields from this invoice and return ONLY valid JSON, no extra text, no markdown formatting: vendor_name, gstin, invoice_number, invoice_date, taxable_amount, cgst, sgst, igst, total_amount'

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' + process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64File } }
              ]
            }
          ]
        })
      }
    )

    const geminiData = await geminiRes.json()
    const textOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textOutput) {
      return NextResponse.json({ raw: JSON.stringify(geminiData) })
    }

    return NextResponse.json({ raw: textOutput })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
