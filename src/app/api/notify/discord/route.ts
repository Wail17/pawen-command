import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

type NotifyBody = {
  content?: string;
  embeds?: DiscordEmbed[];
};

export async function POST(req: NextRequest) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json({ ok: false, error: 'DISCORD_WEBHOOK_URL not set' }, { status: 200 });
  }

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Pawen Bot',
        content: body.content?.slice(0, 1900),
        embeds: body.embeds?.slice(0, 10),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: `discord ${res.status}: ${text.slice(0, 200)}` }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
