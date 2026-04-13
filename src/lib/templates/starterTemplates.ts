// ============================================================
// PAWEN — Starter Templates
// Production-ready Shopify Liquid templates for DR marketing
// ============================================================

import { TemplateCategory } from './types';

export interface StarterTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  liquidSource: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  // ── 1. ADVERTORIAL ──────────────────────────────────────────
  {
    name: 'Advertorial — Story-Based Sales Page',
    category: 'advertorial',
    description: 'Long-form native-style article with story arc, mechanism reveal, proof, and CTA. ZAK 7-block format.',
    liquidSource: `<div style="max-width:720px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.75">

  <!-- BLOCK 1: HOOK / HEADLINE -->
  <div style="margin-bottom:32px">
    <p style="font-size:13px;color:#c0392b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-weight:600">{{ category_label }}</p>
    <h1 style="font-size:32px;line-height:1.2;margin:0 0 16px;font-weight:800;color:#111">{{ headline }}</h1>
    <p style="font-size:18px;color:#555;margin:0">{{ subheadline }}</p>
  </div>

  <!-- HERO IMAGE -->
  <div style="margin-bottom:32px;border-radius:12px;overflow:hidden">
    <img src="{{ hero_image }}" alt="{{ product_name }}" style="width:100%;height:auto;display:block" />
  </div>

  <!-- BLOCK 2: BACKGROUND STORY -->
  <div style="margin-bottom:32px">
    <p style="font-size:16px;color:#333">{{ story_opening }}</p>
    <blockquote style="margin:24px 0;padding:16px 20px;border-left:4px solid #e74c3c;background:#fdf2f2;border-radius:0 8px 8px 0;font-style:italic;color:#444">
      "{{ verbatim_quote }}"
    </blockquote>
    <p style="font-size:16px;color:#333">{{ story_bridge }}</p>
  </div>

  <!-- BLOCK 3: ROOT CAUSE / PROBLEM -->
  <div style="margin-bottom:32px;padding:24px;background:#f8f9fa;border-radius:12px;border:1px solid #e9ecef">
    <h2 style="font-size:22px;color:#111;margin:0 0 12px;font-weight:700">{{ root_cause_headline }}</h2>
    <p style="font-size:16px;color:#333">{{ root_cause }}</p>
    <p style="font-size:16px;color:#333;margin-top:12px">{{ belief_error }}</p>
  </div>

  <!-- BLOCK 4: MECHANISM REVEAL -->
  <div style="margin-bottom:32px">
    <h2 style="font-size:22px;color:#111;margin:0 0 12px;font-weight:700">{{ mechanism_headline }}</h2>
    <p style="font-size:16px;color:#333">{{ mechanism }}</p>
    <div style="margin-top:20px;padding:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px;color:#fff">
      <p style="font-size:14px;opacity:0.9;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;font-weight:600">The Discovery</p>
      <p style="font-size:18px;font-weight:600;margin:0">{{ mechanism_name }}</p>
    </div>
  </div>

  <!-- BLOCK 5: PROOF / SOCIAL PROOF -->
  <div style="margin-bottom:32px">
    <h2 style="font-size:22px;color:#111;margin:0 0 16px;font-weight:700">{{ proof_headline }}</h2>
    {% for proof in proof_points %}
    <div style="padding:16px;margin-bottom:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
      <p style="font-size:15px;color:#166534;margin:0">{{ proof }}</p>
    </div>
    {% endfor %}
  </div>

  <!-- TESTIMONIALS -->
  <div style="margin-bottom:32px">
    {% for testimonial in testimonials %}
    <div style="padding:20px;margin-bottom:16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
      <div style="display:flex;gap:4px;margin-bottom:8px">
        <span style="color:#f59e0b;font-size:16px">&#9733;</span>
        <span style="color:#f59e0b;font-size:16px">&#9733;</span>
        <span style="color:#f59e0b;font-size:16px">&#9733;</span>
        <span style="color:#f59e0b;font-size:16px">&#9733;</span>
        <span style="color:#f59e0b;font-size:16px">&#9733;</span>
      </div>
      <p style="font-size:15px;color:#333;margin:0 0 8px;font-style:italic">"{{ testimonial }}"</p>
    </div>
    {% endfor %}
  </div>

  <!-- BLOCK 6: THE OFFER -->
  <div style="margin-bottom:32px;padding:28px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;color:#fff;text-align:center">
    <h2 style="font-size:26px;margin:0 0 8px;font-weight:800">{{ product_name }}</h2>
    <p style="font-size:16px;opacity:0.85;margin:0 0 20px">{{ product_desc }}</p>
    <div style="margin-bottom:20px">
      <span style="font-size:14px;text-decoration:line-through;opacity:0.5;margin-right:8px">{{ compare_price }}</span>
      <span style="font-size:32px;font-weight:800;color:#10b981">{{ price }}</span>
    </div>
    <a href="{{ cta_url }}" style="display:inline-block;padding:16px 48px;background:#e74c3c;color:#fff;font-size:18px;font-weight:700;border-radius:10px;text-decoration:none;letter-spacing:0.5px">{{ cta }}</a>
    <p style="font-size:13px;opacity:0.7;margin:16px 0 0">{{ guarantee }}</p>
  </div>

  <!-- BLOCK 7: URGENCY / CLOSE -->
  <div style="margin-bottom:32px;padding:20px;background:#fef3c7;border-radius:12px;border:1px solid #fbbf24">
    <p style="font-size:16px;color:#92400e;margin:0;font-weight:600;text-align:center">{{ urgency_message }}</p>
  </div>

  <!-- FAQ -->
  <div style="margin-bottom:32px">
    <h3 style="font-size:20px;color:#111;margin:0 0 16px;font-weight:700">Frequently Asked Questions</h3>
    {% for faq in faqs %}
    <div style="padding:16px;margin-bottom:8px;background:#f9fafb;border-radius:8px">
      <p style="font-size:15px;font-weight:600;color:#111;margin:0 0 6px">{{ faq.question }}</p>
      <p style="font-size:14px;color:#555;margin:0">{{ faq.answer }}</p>
    </div>
    {% endfor %}
  </div>

  <!-- FINAL CTA -->
  <div style="text-align:center;padding:32px 0">
    <a href="{{ cta_url }}" style="display:inline-block;padding:18px 56px;background:#e74c3c;color:#fff;font-size:20px;font-weight:700;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(231,76,60,0.35)">{{ cta }}</a>
  </div>

</div>`,
  },

  // ── 2. LANDING PAGE ────────────────────────────────────────
  {
    name: 'Landing Page — Hero + Benefits + CTA',
    category: 'landing_page',
    description: 'Conversion-focused landing page with hero section, benefit blocks, social proof, and strong CTA.',
    liquidSource: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;margin:0;padding:0">

  <!-- HERO SECTION -->
  <div style="background:linear-gradient(135deg,{{ color_brand }} 0%,{{ color_solution }} 100%);padding:64px 24px;text-align:center;color:#fff">
    <div style="max-width:800px;margin:0 auto">
      <p style="font-size:14px;text-transform:uppercase;letter-spacing:2px;opacity:0.85;margin:0 0 12px;font-weight:600">{{ category_label }}</p>
      <h1 style="font-size:42px;line-height:1.15;margin:0 0 20px;font-weight:800">{{ headline }}</h1>
      <p style="font-size:20px;opacity:0.9;margin:0 0 32px;max-width:600px;display:inline-block">{{ subheadline }}</p>
      <div>
        <a href="{{ cta_url }}" style="display:inline-block;padding:18px 48px;background:#fff;color:{{ color_brand }};font-size:18px;font-weight:700;border-radius:50px;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,0.15)">{{ cta }}</a>
      </div>
      <p style="font-size:13px;opacity:0.7;margin:16px 0 0">{{ guarantee }}</p>
    </div>
  </div>

  <!-- PROBLEM SECTION -->
  <div style="max-width:800px;margin:0 auto;padding:56px 24px;text-align:center">
    <h2 style="font-size:28px;margin:0 0 12px;font-weight:700;color:#111">{{ problem_headline }}</h2>
    <p style="font-size:17px;color:#555;max-width:640px;margin:0 auto 32px">{{ root_cause }}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;text-align:left">
      {% for pain in pain_points %}
      <div style="padding:20px;background:#fef2f2;border-radius:12px;border:1px solid #fecaca">
        <p style="font-size:22px;margin:0 0 8px">{{ pain.icon }}</p>
        <p style="font-size:15px;color:#991b1b;margin:0;font-weight:500">{{ pain }}</p>
      </div>
      {% endfor %}
    </div>
  </div>

  <!-- SOLUTION / MECHANISM -->
  <div style="background:#f8f9fa;padding:56px 24px">
    <div style="max-width:800px;margin:0 auto;text-align:center">
      <h2 style="font-size:28px;margin:0 0 12px;font-weight:700;color:#111">{{ mechanism_headline }}</h2>
      <p style="font-size:17px;color:#555;max-width:640px;margin:0 auto 36px">{{ mechanism }}</p>
    </div>
    <div style="max-width:800px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px">
      {% for benefit in benefits %}
      <div style="padding:28px;background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,{{ color_brand }},{{ color_solution }});border-radius:14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff">{{ benefit.icon }}</div>
        <h3 style="font-size:17px;font-weight:600;margin:0 0 8px;color:#111">{{ benefit.title }}</h3>
        <p style="font-size:14px;color:#666;margin:0">{{ benefit.description }}</p>
      </div>
      {% endfor %}
    </div>
  </div>

  <!-- PRODUCT SHOWCASE -->
  <div style="max-width:800px;margin:0 auto;padding:56px 24px;text-align:center">
    <img src="{{ hero_image }}" alt="{{ product_name }}" style="width:100%;max-width:500px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.12);margin-bottom:32px" />
    <h2 style="font-size:28px;margin:0 0 8px;font-weight:700;color:#111">{{ product_name }}</h2>
    <p style="font-size:17px;color:#555;margin:0 0 24px">{{ product_desc }}</p>
    <div style="font-size:36px;font-weight:800;color:{{ color_brand }};margin-bottom:24px">{{ price }}</div>
    <a href="{{ cta_url }}" style="display:inline-block;padding:18px 56px;background:{{ color_brand }};color:#fff;font-size:18px;font-weight:700;border-radius:50px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.2)">{{ cta }}</a>
  </div>

  <!-- TESTIMONIALS -->
  <div style="background:#111;padding:56px 24px;color:#fff">
    <div style="max-width:800px;margin:0 auto">
      <h2 style="font-size:28px;margin:0 0 32px;font-weight:700;text-align:center">What People Are Saying</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">
        {% for testimonial in testimonials %}
        <div style="padding:24px;background:rgba(255,255,255,0.06);border-radius:12px;border:1px solid rgba(255,255,255,0.1)">
          <div style="display:flex;gap:3px;margin-bottom:10px">
            <span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span>
          </div>
          <p style="font-size:15px;color:#e5e7eb;margin:0;font-style:italic">"{{ testimonial }}"</p>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>

  <!-- FINAL CTA -->
  <div style="padding:56px 24px;text-align:center;background:linear-gradient(135deg,{{ color_brand }} 0%,{{ color_solution }} 100%);color:#fff">
    <h2 style="font-size:32px;margin:0 0 12px;font-weight:800">{{ final_cta_headline }}</h2>
    <p style="font-size:17px;opacity:0.9;margin:0 0 28px">{{ urgency_message }}</p>
    <a href="{{ cta_url }}" style="display:inline-block;padding:18px 56px;background:#fff;color:{{ color_brand }};font-size:18px;font-weight:700;border-radius:50px;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,0.15)">{{ cta }}</a>
    <p style="font-size:13px;opacity:0.7;margin:16px 0 0">{{ guarantee }}</p>
  </div>

</div>`,
  },

  // ── 3. PRODUCT PAGE ────────────────────────────────────────
  {
    name: 'Product Page — E-commerce Detail',
    category: 'product_page',
    description: 'Shopify-style product page with image gallery, variant selector, reviews, and trust badges.',
    liquidSource: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;margin:0;padding:0">

  <!-- PRODUCT HERO -->
  <div style="max-width:1100px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start">
    <!-- LEFT: IMAGE -->
    <div>
      <div style="border-radius:16px;overflow:hidden;background:#f5f5f5;aspect-ratio:1">
        <img src="{{ hero_image }}" alt="{{ product_name }}" style="width:100%;height:100%;object-fit:cover" />
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
        {% for img in images %}
        <div style="border-radius:8px;overflow:hidden;background:#f5f5f5;aspect-ratio:1;border:2px solid #e5e7eb">
          <img src="{{ img }}" alt="Product view" style="width:100%;height:100%;object-fit:cover" />
        </div>
        {% endfor %}
      </div>
    </div>

    <!-- RIGHT: INFO -->
    <div>
      <p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-weight:600">{{ category_label }}</p>
      <h1 style="font-size:32px;line-height:1.2;margin:0 0 8px;font-weight:800;color:#111">{{ product_name }}</h1>

      <!-- RATING -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <div style="display:flex;gap:2px">
          <span style="color:#f59e0b;font-size:16px">&#9733;</span>
          <span style="color:#f59e0b;font-size:16px">&#9733;</span>
          <span style="color:#f59e0b;font-size:16px">&#9733;</span>
          <span style="color:#f59e0b;font-size:16px">&#9733;</span>
          <span style="color:#f59e0b;font-size:16px">&#9733;</span>
        </div>
        <span style="font-size:13px;color:#666">{{ avg_rating }} ({{ review_count }} reviews)</span>
      </div>

      <p style="font-size:17px;color:#555;margin:0 0 20px;line-height:1.6">{{ product_desc }}</p>

      <!-- PRICE -->
      <div style="margin-bottom:24px">
        <span style="font-size:14px;text-decoration:line-through;color:#999;margin-right:8px">{{ compare_price }}</span>
        <span style="font-size:32px;font-weight:800;color:#111">{{ price }}</span>
        <span style="display:inline-block;margin-left:10px;padding:4px 10px;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;border-radius:20px">SAVE {{ discount_pct }}</span>
      </div>

      <!-- VARIANT SELECTOR -->
      <div style="margin-bottom:24px">
        <p style="font-size:14px;font-weight:600;margin:0 0 8px;color:#333">Select option:</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          {% for variant in variants %}
          <button style="padding:10px 20px;border:2px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;font-weight:500;color:#333">{{ variant }}</button>
          {% endfor %}
        </div>
      </div>

      <!-- ADD TO CART -->
      <a href="{{ cta_url }}" style="display:block;width:100%;padding:18px;background:#111;color:#fff;font-size:18px;font-weight:700;border-radius:12px;text-decoration:none;text-align:center;box-sizing:border-box">{{ cta }}</a>

      <!-- TRUST BADGES -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px">
        <div style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px">
          <p style="font-size:18px;margin:0 0 4px">&#128274;</p>
          <p style="font-size:11px;color:#666;margin:0;font-weight:500">Secure Checkout</p>
        </div>
        <div style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px">
          <p style="font-size:18px;margin:0 0 4px">&#128666;</p>
          <p style="font-size:11px;color:#666;margin:0;font-weight:500">Free Shipping</p>
        </div>
        <div style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px">
          <p style="font-size:18px;margin:0 0 4px">&#9889;</p>
          <p style="font-size:11px;color:#666;margin:0;font-weight:500">{{ guarantee }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- FEATURES -->
  <div style="background:#f8f9fa;padding:56px 24px">
    <div style="max-width:900px;margin:0 auto">
      <h2 style="font-size:26px;text-align:center;margin:0 0 32px;font-weight:700;color:#111">Why {{ product_name }}?</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px">
        {% for feature in features %}
        <div style="padding:24px;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
          <h3 style="font-size:16px;font-weight:600;margin:0 0 8px;color:#111">{{ feature }}</h3>
        </div>
        {% endfor %}
      </div>
    </div>
  </div>

  <!-- REVIEWS -->
  <div style="max-width:800px;margin:0 auto;padding:56px 24px">
    <h2 style="font-size:26px;text-align:center;margin:0 0 32px;font-weight:700;color:#111">Customer Reviews</h2>
    {% for testimonial in testimonials %}
    <div style="padding:24px;margin-bottom:16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
      <div style="display:flex;gap:3px;margin-bottom:8px">
        <span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span><span style="color:#f59e0b">&#9733;</span>
      </div>
      <p style="font-size:15px;color:#333;margin:0;line-height:1.6">"{{ testimonial }}"</p>
    </div>
    {% endfor %}
  </div>

</div>`,
  },

  // ── 4. EMAIL ───────────────────────────────────────────────
  {
    name: 'Email — Promotional Sequence',
    category: 'email',
    description: 'HTML email template for promotional sequences. Story hook, benefit stack, CTA button.',
    liquidSource: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;line-height:1.7">

  <!-- PREHEADER (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#fff">
    {{ preheader }}
  </div>

  <!-- HEADER -->
  <div style="padding:24px 32px;background:{{ color_brand }};text-align:center">
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0;letter-spacing:0.5px">{{ brand_name }}</p>
  </div>

  <!-- BODY -->
  <div style="padding:32px;background:#ffffff">

    <!-- GREETING -->
    <p style="font-size:16px;color:#333;margin:0 0 16px">Hey {{ avatar_name }},</p>

    <!-- HOOK -->
    <p style="font-size:16px;color:#333;margin:0 0 16px">{{ hook }}</p>

    <!-- STORY / PROBLEM -->
    <p style="font-size:16px;color:#333;margin:0 0 16px">{{ story_opening }}</p>

    <div style="margin:24px 0;padding:16px 20px;border-left:4px solid {{ color_problem }};background:#fafafa;border-radius:0 8px 8px 0">
      <p style="font-size:15px;color:#555;margin:0;font-style:italic">"{{ verbatim_quote }}"</p>
    </div>

    <!-- MECHANISM / SOLUTION -->
    <p style="font-size:16px;color:#333;margin:0 0 16px">{{ mechanism }}</p>

    <!-- BENEFITS -->
    <div style="margin:20px 0;padding:20px;background:#f0fdf4;border-radius:10px">
      {% for benefit in benefits %}
      <p style="font-size:15px;color:#166534;margin:0 0 8px">&#10003; {{ benefit }}</p>
      {% endfor %}
    </div>

    <!-- SOCIAL PROOF -->
    <div style="margin:20px 0;padding:16px;background:#fffbeb;border-radius:10px;border:1px solid #fef3c7">
      <p style="font-size:14px;color:#92400e;margin:0">{{ social_proof }}</p>
    </div>

    <!-- CTA BUTTON -->
    <div style="text-align:center;margin:28px 0">
      <a href="{{ cta_url }}" style="display:inline-block;padding:16px 48px;background:{{ color_brand }};color:#fff;font-size:17px;font-weight:700;border-radius:8px;text-decoration:none">{{ cta }}</a>
    </div>

    <!-- URGENCY -->
    <p style="font-size:14px;color:#dc2626;text-align:center;margin:0 0 20px;font-weight:600">{{ urgency_message }}</p>

    <!-- GUARANTEE -->
    <p style="font-size:14px;color:#888;text-align:center;margin:0 0 16px">{{ guarantee }}</p>

    <!-- SIGNOFF -->
    <p style="font-size:16px;color:#333;margin:24px 0 0">Talk soon,<br /><strong>{{ brand_name }}</strong></p>

  </div>

  <!-- FOOTER -->
  <div style="padding:20px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb">
    <p style="font-size:12px;color:#999;margin:0">{{ brand_name }} | {{ company_address }}</p>
    <p style="font-size:12px;color:#999;margin:4px 0 0"><a href="{{ unsubscribe_url }}" style="color:#999;text-decoration:underline">Unsubscribe</a></p>
  </div>

</div>`,
  },

  // ── 5. SQUEEZE PAGE ────────────────────────────────────────
  {
    name: 'Squeeze Page — Lead Capture',
    category: 'squeeze_page',
    description: 'Minimal, high-converting lead capture page. Headline, benefit bullets, email capture form.',
    liquidSource: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;margin:0;padding:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,{{ color_brand }} 0%,#0f0f1a 100%)">

  <div style="max-width:520px;margin:0 auto;padding:40px 24px;text-align:center;color:#fff">

    <!-- BADGE -->
    <div style="display:inline-block;padding:6px 16px;background:rgba(255,255,255,0.1);border-radius:20px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.15)">
      <p style="font-size:12px;margin:0;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.85)">{{ category_label }}</p>
    </div>

    <!-- HEADLINE -->
    <h1 style="font-size:36px;line-height:1.15;margin:0 0 16px;font-weight:800">{{ headline }}</h1>
    <p style="font-size:18px;opacity:0.85;margin:0 0 32px;line-height:1.5">{{ subheadline }}</p>

    <!-- BENEFIT BULLETS -->
    <div style="text-align:left;margin:0 auto 32px;max-width:400px">
      {% for benefit in benefits %}
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
        <span style="display:inline-flex;width:24px;height:24px;background:#10b981;border-radius:50%;flex-shrink:0;align-items:center;justify-content:center;font-size:14px;margin-top:2px">&#10003;</span>
        <p style="font-size:15px;margin:0;opacity:0.9;line-height:1.5">{{ benefit }}</p>
      </div>
      {% endfor %}
    </div>

    <!-- LEAD CAPTURE FORM -->
    <div style="padding:28px;background:rgba(255,255,255,0.08);border-radius:16px;border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(10px)">
      <p style="font-size:14px;font-weight:600;margin:0 0 16px;opacity:0.85">{{ form_headline }}</p>

      <form action="{{ form_action }}" method="POST" style="display:flex;flex-direction:column;gap:12px">
        <input type="text" name="name" placeholder="Your first name" style="width:100%;padding:14px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:15px;outline:none;box-sizing:border-box" />
        <input type="email" name="email" placeholder="Your best email" style="width:100%;padding:14px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:15px;outline:none;box-sizing:border-box" />
        <button type="submit" style="width:100%;padding:16px;background:#e74c3c;color:#fff;font-size:17px;font-weight:700;border:none;border-radius:10px;cursor:pointer;box-sizing:border-box">{{ cta }}</button>
      </form>

      <p style="font-size:12px;opacity:0.5;margin:12px 0 0">{{ privacy_note }}</p>
    </div>

    <!-- SOCIAL PROOF -->
    <div style="margin-top:24px">
      <p style="font-size:14px;opacity:0.6;margin:0">{{ social_proof }}</p>
    </div>

  </div>

</div>`,
  },
];
