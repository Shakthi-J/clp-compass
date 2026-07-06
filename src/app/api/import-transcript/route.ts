// src/app/api/import-transcript/route.ts
//
// Step 2 of the Google Drive transcript import feature.
// Takes a Google Doc fileId + the coach's OAuth access token (drive.readonly),
// exports the Doc as plain text via the Drive API, and returns it.
// No FFmpeg, no Whisper, no server-hosted backend — one HTTPS call, free tier.
//
// Called later by the "Import from Drive" button (Step 3, not built yet).
// For now this route can be tested directly with curl/Postman once Step 1
// (Google Cloud OAuth Client ID) is done and you have a valid access token
// from the OAuth popup flow.

export const dynamic = 'force-dynamic';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';

export async function POST(req: Request) {
  try {
    const { fileId, accessToken } = await req.json();

    if (!fileId || !accessToken) {
      return Response.json(
        { error: 'Missing fileId or accessToken' },
        { status: 400 }
      );
    }

    // 1. Check the file's mimeType before attempting export.
    //    The Drive "export" endpoint only works on native Google Docs —
    //    if the coach accidentally picks a video, PDF, or Word file this
    //    step catches it with a clear error instead of a confusing 400
    //    from the export call itself.
    const metaRes = await fetch(
      `${DRIVE_API}/files/${fileId}?fields=name,mimeType`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaRes.ok) {
      const status = metaRes.status;
      if (status === 401) {
        return Response.json(
          { error: 'Google session expired. Please reconnect Drive and try again.' },
          { status: 401 }
        );
      }
      if (status === 404) {
        return Response.json(
          { error: 'File not found, or this Google account cannot access it.' },
          { status: 404 }
        );
      }
      const detail = await metaRes.text();
      return Response.json(
        { error: `Drive API error (${status}): ${detail}` },
        { status: 502 }
      );
    }

    const meta = await metaRes.json();

    if (meta.mimeType !== GOOGLE_DOC_MIME_TYPE) {
      return Response.json(
        {
          error:
            'Selected file is not a Google Doc transcript. Make sure Meet transcription was turned on for this call — it saves a Doc, not a video, to the "Meet Recordings" folder.',
          mimeType: meta.mimeType,
        },
        { status: 422 }
      );
    }

    // 2. Export the Doc as plain text.
    const exportRes = await fetch(
      `${DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!exportRes.ok) {
      const detail = await exportRes.text();
      return Response.json(
        { error: `Failed to export transcript (${exportRes.status}): ${detail}` },
        { status: 502 }
      );
    }

    const text = await exportRes.text();

    if (!text || text.trim().length < 20) {
      return Response.json(
        {
          error:
            'Transcript came back empty. The meeting may still be processing (can take up to a few hours) — try again shortly.',
        },
        { status: 422 }
      );
    }

    // 3. Return the raw transcript text — same shape the manual-paste
    //    flow already expects, so it drops straight into gemini_doc_raw
    //    with zero changes to parse-gemini/route.ts.
    return Response.json({
      text,
      fileName: meta.name,
    });
  } catch (err) {
    console.error('import-transcript error:', err);
    return Response.json(
      { error: 'Unexpected error importing transcript.' },
      { status: 500 }
    );
  }
}