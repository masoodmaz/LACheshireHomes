/**
 * Seeds (or refreshes) the "Three ways to own with us" blog article.
 *
 * Idempotent: keyed on the slug, so re-running updates the existing row in place
 * rather than creating duplicates. Run once with:  node scripts/seed-ownership-post.js
 */
const db = require("../db");

const SLUG = "three-ways-to-own";
const TITLE = "Three Ways to Own: Outright, Together, or Growing What You Hold";
const COVER = "/uploads/images/seed/fairfield-road.jpeg";
const EXCERPT =
  "Full ownership, a joint venture, or building on the portfolio you already have — a plain look at the three routes into Cheshire property, and how to tell which one fits.";

const CONTENT = `
<p class="post-lede">Not everyone comes to property the same way. Some want the deeds in their own name and nothing shared. Others would rather bring capital to a project and let a builder run the ground. And plenty already own — they just want the next door to open more easily than the last. Here are the three routes we work with most, and the honest trade-offs of each.</p>

<div class="ownership-glance">
  <div class="g-card"><b>Full ownership</b><span>You buy the asset outright and keep every decision, every pound of upside, and every responsibility.</span></div>
  <div class="g-card"><b>Joint venture</b><span>You partner on a scheme — money on one side, land and delivery on the other — and split the result.</span></div>
  <div class="g-card"><b>Portfolio growth</b><span>You already own. The work is refinancing, adding, and reshaping what you hold into something that compounds.</span></div>
</div>

<h2><span class="n">01</span> Full property ownership</h2>
<span class="post-kicker">One name on the deeds</span>
<p>Owning a home or a plot outright is the most direct relationship you can have with property. There is no partner to consult and no agreement to interpret. When the asset grows in value, that growth is yours; when the roof needs work, that is yours too. For a lot of people the appeal is exactly that simplicity — a single line of accountability.</p>

<figure class="post-figure">
  <img src="/uploads/images/seed/tennyson-close.jpeg" alt="A single detached plot laid out on its own site" loading="lazy">
  <figcaption>A single plot, wholly owned — the clearest form the deed can take.</figcaption>
</figure>

<p>It suits you if you have the capital ready, you want control over how a place is finished or let, and you are comfortable carrying the risk on your own balance sheet. What you give up is other people's money and other people's time: no shared deposit, no partner absorbing a cost overrun, no delivery team already on site.</p>
<ul>
  <li><b>Best when</b> — you have the funds and want full say over the asset.</li>
  <li><b>You keep</b> — all of the upside and all of the control.</li>
  <li><b>You carry</b> — the full cost of delay, maintenance, and market swings.</li>
</ul>

<h2><span class="n">02</span> Joint ventures</h2>
<span class="post-kicker">Capital meets delivery</span>
<p>A joint venture pairs two things that rarely sit in the same pair of hands: money and the ability to build. One side puts in capital, the other puts in the land, the planning know-how, and the team that turns a drawing into a finished street. Both sides agree what a fair split looks like before a spade goes in the ground, and that agreement is the whole thing — get it right and the rest tends to follow.</p>

<figure class="post-figure">
  <img src="/uploads/images/seed/cheadle-wood.png" alt="A large completed home lit at dusk on landscaped grounds" loading="lazy">
  <figcaption>Cheadle Wood — the kind of scheme a joint venture makes reachable that neither party would take on alone.</figcaption>
</figure>

<p>The reason people choose this route is reach. A JV lets an investor back a scheme far larger than they would fund single-handed, without needing to learn construction, and it lets a builder take on more work than their own cash allows. The catch is that you are tied to a partner for the life of the project, so you want clear terms, honest reporting, and a shared view of what "done" means.</p>
<ul>
  <li><b>Best when</b> — you have capital but not the time or trade to deliver, or the reverse.</li>
  <li><b>You gain</b> — access to bigger, better projects than you could run alone.</li>
  <li><b>You agree first</b> — the split, the timeline, and who decides what.</li>
</ul>

<blockquote class="post-quote">The paperwork on a joint venture is not the boring part. It is the part that decides whether year two feels like a partnership or a problem.</blockquote>

<h2><span class="n">03</span> Growing an existing portfolio</h2>
<span class="post-kicker">Compounding what you hold</span>
<p>If you already own property, the interesting question is rarely "should I buy more?" and more often "how do I make what I hold work harder?" That can mean releasing equity from a property that has risen in value and putting it into the next one, refurbishing to lift both rent and resale, or trading two tired units for one that earns more and needs less attention.</p>

<figure class="post-figure">
  <img src="/uploads/images/seed/windsor-avenue.jpg" alt="A colour-coded masterplan showing a mix of house types across a development site" loading="lazy">
  <figcaption>Windsor Avenue masterplan — growth is easier to see when the whole portfolio is laid out at once.</figcaption>
</figure>

<p>Growth like this rewards patience and a clear head about numbers. Each move should either raise income, cut work, or free capital for the next step — ideally more than one of the three. Done steadily, a modest holding becomes a portfolio that pays for its own expansion, which is the point at which property stops feeling like a series of purchases and starts feeling like a business.</p>
<ul>
  <li><b>Best when</b> — you already own and want the next asset to be easier to reach than the last.</li>
  <li><b>The levers</b> — refinancing, refurbishment, and trading up.</li>
  <li><b>The measure</b> — each step should add income, remove work, or release capital.</li>
</ul>

<h3>So which one fits?</h3>
<p>Most people recognise themselves in one of the three fairly quickly. If you have the money and want the control, ownership is clean and simple. If you want scale without running a build yourself, a joint venture brings a partner who does. And if you are already holding property, the fastest gains are usually in reshaping it rather than starting again. None of them is better than the others — they just suit different starting points.</p>

<div class="post-outro">
  <h3>Not sure where you sit?</h3>
  <p>Tell us what you already hold and what you are trying to build. We will talk you through the route that actually fits — no pressure, no jargon.</p>
  <a class="button primary" href="/contact">Start a conversation</a>
</div>
`.trim();

const existing = db.prepare("SELECT id FROM blog_posts WHERE slug = ?").get(SLUG);

if (existing) {
  db.prepare(
    `UPDATE blog_posts
       SET title = ?, excerpt = ?, content = ?, cover_image = ?, published = 1,
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(TITLE, EXCERPT, CONTENT, COVER, existing.id);
  console.log(`Updated existing post #${existing.id} (${SLUG}).`);
} else {
  const info = db
    .prepare(
      `INSERT INTO blog_posts (slug, title, excerpt, content, cover_image, published)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(SLUG, TITLE, EXCERPT, CONTENT, COVER);
  console.log(`Inserted new post #${info.lastInsertRowid} (${SLUG}).`);
}

console.log(`View it at:  /blog/${SLUG}`);
