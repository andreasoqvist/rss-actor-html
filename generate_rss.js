const fs = require('fs');
const https = require('https');
const cheerio = require('cheerio');

const htmlUrl = 'https://exportservice.actorsmartbook.se/ExportGridStyle.aspx?com=5fe496d9-bdd6-4988-b679-4f249a03a2b6&con=371e91b7-b035-4d08-9c00-3c8bab4bf2de';

// Escapa XML-specialtecken
function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

// Ta bort ogiltiga kontrolltecken
function cleanString(str) {
  if (!str) return '';
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '');
}

https.get(htmlUrl, res => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    const $ = cheerio.load(html);
    let rssItems = '';

    $('tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length > 0) {
        const startdatum = $(cells[0]).text().trim();
        const slutdatum = $(cells[1]).text().trim();
        const veckodag  = $(cells[2]).text().trim();
        const starttid  = $(cells[3]).text().trim();
        const sluttid   = $(cells[4]).text().trim();
        const objekt    = $(cells[5]).text().trim();
        const info      = $(cells[6]).text().trim();

        const title = `${objekt} – ${veckodag} ${starttid}-${sluttid}`;
        const description = `${info} (${startdatum}, ${veckodag}, ${starttid}-${sluttid})`;
        const pubDate = new Date(`${startdatum}T${starttid}:00+02:00`).toUTCString();

        rssItems += `
<item>
  <title>${escapeXml(cleanString(title))}</title>
  <description>${escapeXml(cleanString(description))}</description>
  <pubDate>${pubDate}</pubDate>
</item>`;
      }
    });

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Friidrottsytor HH – Schema</title>
  <link>${escapeXml(cleanString(htmlUrl))}</link>
  <description>Automatiskt genererat RSS-flöde från Actorsmartbook</description>
  <language>sv-se</language>
  ${rssItems}
</channel>
</rss>`;

    fs.writeFileSync('feed.xml', rss, { encoding: 'utf8' });
    console.log('✅ RSS feed generated successfully!');
  });
}).on('error', err => {
  console.error('❌ Error fetching HTML:', err.message);
});
