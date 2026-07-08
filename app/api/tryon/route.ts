import { requireRole } from '@/lib/auth';
import { createServerClient } from '@/lib/insforge/server';
import { captureServerEvent } from '@/lib/posthog';
import { downloadCustomerPhoto, uploadTryonPreview } from '@/lib/insforge/storage';

// OpenAI gpt-image-2 image edit: person (image 1) + garment (image 2) in, base64 JPEG out.
// Prompt follows the image-gen prompting guide's try-on pattern: explicit identity
// preserve-list, restated every call to prevent drift.
const TRYON_PROMPT =
  'Virtual try-on: dress the person from image 1 in the garment from image 2. ' +
  'Photorealistic. Preserve the person\'s identity exactly — face, skin tone, hair, ' +
  'body shape, pose, and background unchanged. The garment should drape naturally with ' +
  'realistic fabric behavior, folds, and fit — no pasted-on look. ' +
  'Do not add text, watermarks, logos, or new elements.';

async function callGptImage(person: Blob, garment: Blob): Promise<string> {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('image[]', person, 'person.jpg');
  form.append('image[]', garment, 'garment.jpg');
  form.append('prompt', TRYON_PROMPT);
  form.append('size', '1024x1536'); // 3:4 portrait, matches the preview modal
  form.append('quality', 'medium'); // identity-sensitive edit → medium+
  form.append('output_format', 'jpeg'); // matches tryon-previews/{id}.jpg storage
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI images/edits ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const base64 = data?.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || !base64) throw new Error('No image in OpenAI response');
  return base64;
}

export async function POST(req: Request) {
  const staff = await requireRole(['stylist', 'owner']);
  const { sessionId, itemId } = await req.json();
  if (typeof sessionId !== 'string' || typeof itemId !== 'string' || !sessionId || !itemId) {
    return Response.json({ ok: false, error: 'Missing session or item.' }, { status: 400 });
  }
  const db = createServerClient().database;

  const { data: tryon, error: insErr } = await db
    .from('tryons')
    .insert({ session_id: sessionId, item_id: itemId, status: 'generating' })
    .select()
    .single();
  if (insErr || !tryon) {
    console.error('[tryon] insert failed:', insErr);
    return Response.json({ ok: false, error: 'Could not start the try-on.' }, { status: 500 });
  }
  const tryonId = tryon.id as string;

  try {
    const { data: item, error: itemErr } = await db
      .from('inventory_items')
      .select('images')
      .eq('id', itemId)
      .single();
    if (itemErr) throw itemErr;
    const garmentUrl = (item?.images as string[] | undefined)?.[0];
    if (!garmentUrl) throw new Error('No garment image');

    const person = await downloadCustomerPhoto(sessionId);
    const garment = await (await fetch(garmentUrl)).blob();

    let base64: string;
    try {
      base64 = await callGptImage(person, garment);
    } catch {
      base64 = await callGptImage(person, garment); // one retry
    }

    let url: string;
    try {
      url = await uploadTryonPreview(tryonId, base64);
    } catch {
      // InsForge presigned upload is occasionally flaky; retry once before failing
      // the whole try-on (the costly gpt-image-2 generation has already succeeded here).
      url = await uploadTryonPreview(tryonId, base64);
    }
    await db.from('tryons').update({ status: 'ready', result_image_url: url }).eq('id', tryonId);
    void captureServerEvent(staff.staffId, 'tryon_generated', { sessionId, itemId, success: true });

    return Response.json({ ok: true, data: { tryonId, image: `data:image/jpeg;base64,${base64}` } });
  } catch (error) {
    console.error('[tryon] generate failed:', error);
    await db.from('tryons').update({ status: 'failed' }).eq('id', tryonId);
    void captureServerEvent(staff.staffId, 'tryon_generated', { sessionId, itemId, success: false });
    return Response.json({ ok: false, error: "Couldn't create this preview. Try again." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  await requireRole(['stylist', 'owner']);
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  if (!sessionId) return Response.json({ ok: false, error: 'Missing session.' }, { status: 400 });
  try {
    const db = createServerClient().database;
    const { data, error } = await db
      .from('tryons')
      .select('id, created_at, item_id, inventory_items(id, name, images)')
      .eq('session_id', sessionId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const tryons = (data ?? []).map((t) => {
      // PostGREST types the to-one embed as an array; runtime is an object.
      const item = t.inventory_items as unknown as { id: string; name: string; images: string[] } | null;
      return {
        id: t.id as string,
        itemId: (item?.id ?? t.item_id) as string,
        name: item?.name ?? 'Dress',
        image: item?.images?.[0] ?? null,
        createdAt: t.created_at as string,
      };
    });
    return Response.json({ ok: true, data: { tryons } });
  } catch (error) {
    console.error('[tryon] list failed:', error);
    return Response.json({ ok: false, error: 'Could not load try-ons.' }, { status: 500 });
  }
}
