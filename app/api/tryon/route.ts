import { requireRole } from '@/lib/auth';
import { createServerClient } from '@/lib/insforge/server';
import { captureServerEvent } from '@/lib/posthog';
import { downloadCustomerPhoto, uploadTryonPreview } from '@/lib/insforge/storage';
import { COUPLE_LOOKS } from '@/lib/couple-looks';

// OpenAI gpt-image-2 image edit: person (image 1) + garment (image 2) in, base64 JPEG out.
// Prompt follows the image-gen prompting guide's try-on pattern: explicit identity
// preserve-list, restated every call to prevent drift.
const TRYON_PROMPT =
  'Virtual try-on: dress the person from image 1 in the garment from image 2. ' +
  'Photorealistic. Preserve the person\'s identity exactly — face, skin tone, hair, ' +
  'body shape, pose, and background unchanged. If the photo shows more than one person, ' +
  'dress only the person the garment is intended for and keep every other person in the ' +
  'photo completely unchanged — do not remove or alter them. The garment should drape naturally with ' +
  'realistic fabric behavior, folds, and fit — no pasted-on look. ' +
  'Do not add text, watermarks, logos, or new elements.';

// Couple-look try-on: image 2 is a couple photo, both outfits get transferred at once.
const COUPLE_TRYON_PROMPT =
  'Virtual try-on: image 1 shows a couple; image 2 shows another couple wearing outfits. ' +
  'Dress the woman from image 1 in the bride\'s outfit from image 2 and the man from ' +
  'image 1 in the groom\'s outfit from image 2. Photorealistic. Preserve both people\'s ' +
  'identities exactly — faces, skin tones, hair, body shapes, poses, and background ' +
  'unchanged. The garments should drape naturally with realistic fabric behavior, folds, ' +
  'and fit — no pasted-on look. Do not add text, watermarks, logos, or new elements.';

// InsForge downloads arrive as binary/octet-stream; OpenAI requires an image/* MIME type.
function asImage(blob: Blob): Blob {
  return blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' });
}

async function callGptImage(person: Blob, garment: Blob, prompt = TRYON_PROMPT): Promise<string> {
  const form = new FormData();
  form.append('model', 'gpt-image-2');
  form.append('image[]', asImage(person), 'person.jpg');
  form.append('image[]', asImage(garment), 'garment.jpg');
  form.append('prompt', prompt);
  form.append('size', '1024x1536'); // 3:4 portrait, matches the preview modal
  form.append('quality', 'low'); // speed over fidelity — user wants fast previews
  form.append('output_format', 'jpeg'); // matches tryon-previews/{id}.jpg storage
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    // gpt-image-2 edits at 1024x1536 regularly take >60s; 60s timeouts aborted real generations.
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`OpenAI images/edits ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const base64 = data?.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || !base64) throw new Error('No image in OpenAI response');
  return base64;
}

export async function POST(req: Request) {
  const staff = await requireRole(['stylist', 'owner']);
  const { sessionId, itemId, lookImg } = await req.json();
  // Either an inventory item or a couple-look image (validated against the static list).
  const isLook = typeof lookImg === 'string' && COUPLE_LOOKS.some((l) => l.img === lookImg);
  if (typeof sessionId !== 'string' || !sessionId || (!isLook && (typeof itemId !== 'string' || !itemId))) {
    return Response.json({ ok: false, error: 'Missing session or item.' }, { status: 400 });
  }
  const db = createServerClient().database;

  const { data: tryon, error: insErr } = await db
    .from('tryons')
    .insert({ session_id: sessionId, item_id: isLook ? null : itemId, status: 'generating' })
    .select()
    .single();
  if (insErr || !tryon) {
    console.error('[tryon] insert failed:', insErr);
    return Response.json({ ok: false, error: 'Could not start the try-on.' }, { status: 500 });
  }
  const tryonId = tryon.id as string;

  try {
    let garmentUrl: string;
    if (isLook) {
      garmentUrl = new URL(lookImg, req.url).toString(); // served from public/couples/
    } else {
      const { data: item, error: itemErr } = await db
        .from('inventory_items')
        .select('images')
        .eq('id', itemId)
        .single();
      if (itemErr) throw itemErr;
      const url = (item?.images as string[] | undefined)?.[0];
      if (!url) throw new Error('No garment image');
      garmentUrl = url;
    }

    const person = await downloadCustomerPhoto(sessionId);
    const garment = await (await fetch(garmentUrl)).blob();
    const prompt = isLook ? COUPLE_TRYON_PROMPT : TRYON_PROMPT;

    let base64: string;
    try {
      base64 = await callGptImage(person, garment, prompt);
    } catch {
      base64 = await callGptImage(person, garment, prompt); // one retry
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
        name: item?.name ?? (t.item_id ? 'Dress' : 'Couple Look'),
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
