// generate_rss.js
const fs = require('fs');
const https = require('https');

const htmlUrl = 'https://exportservice.actorsmartbook.se/ExportGridStyle.aspx?com=5fe496d9-bdd6-4988-b679-4f249a03a2b6&con=371e91b7-b035-4d08-9c00-3c8bab4bf2de';

// Escape XML-specialtecken
function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

// Rensa ogiltiga kontrolltecken
function cleanString(str) {
  if (!str) return '';
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '');
}

// Enkel HTML-entity-dekodning
function decodeHtmlEntities(s) {
  if (!s) return '';
  s = s.replace(/&nbsp;/g, ' ')
       .replace(/&ndash;/g, '-')
       .replace(/&mdash;/g, '-')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&apos;/g, "'");
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n,10)));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h,16)));
  return s;
}

// Ta bort HTML-taggar
function stripTags(s) {
  if (!s) return '';
  return s.replace(/<[^>]*>/g, '').trim();
}

// Hämta HTML och parsa tabellen
https.get(htmlUrl, res => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    try {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let match;
      const rows = [];
      while ((match = trRegex.exec(html)) !== null) {
        rows.push(match[1]);
      }

      let items = [];

      rows.forEach(rowHtml => {
        const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cols = [];
        let m;
        while ((m = tdRegex.exec(rowHtml)) !== null) {
          let cell = decodeHtmlEntities(stripTags(m[1]));
          cell = cleanString(cell);
          cols.push(cell);
        }

        if (cols.length < 2) return;

        const startdatum = cols[0] || '';
        const slutdatum  = cols[1] || '';
        const veckodag   = cols[2] || '';
        const starttid   = cols[3] || '';
        const sluttid    = cols[4] || '';
        const objekt     = cols[5] || '';
        const info       = cols[6] || '';

        const title = `${objekt} – ${veckodag} ${starttid}-${sluttid}`;

        const description = `<![CDATA[
  <p><strong>Objekt:</strong> ${objekt}</p>
  <p><strong>Information:</strong> ${info}</p>
  <p><strong>Startdatum:</strong> ${startdatum}</p>
  <p><strong>Slutdatum:</strong> ${slutdatum}</p>
  <p><strong>Veckodag:</strong> ${veckodag}</p>
  <p><strong>Tid:</strong> ${starttid} - ${sluttid}</p>
]]>`;

        // pubDate för RSS och sortering
        let pubDate;
        let sortDate;
        try {
          const d = new Date(`${startdatum}T${starttid}:00+02:00`);
          pubDate = isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
          sortDate = isNaN(d.getTime()) ? new Date(0) : d;
        } catch (e) {
          pubDate = new Date().toUTCString();
          sortDate = new Date(0);
        }

        items.push({ title, description, pubDate, sortDate });
      });

      // Sortera items kronologiskt
      items.sort((a, b) => a.sortDate - b.sortDate);

      let rssItems = items.map(item => `
<item>
  <title>${escapeXml(item.title)}</title>
  <description>${item.description}</description>
  <pubDate>${item.pubDate}</pubDate>
</item>`).join('');

      const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Friidrottsytor HH – Schema</title>
  <link>${escapeXml(htmlUrl)}</link>
  <description>Automatiskt genererat RSS-flöde från Actorsmartbook</description>
  <language>sv-se</language>
  ${rssItems}
</channel>
</rss>`;

      fs.writeFileSync('feed.xml', rss, { encoding: 'utf8' });
      console.log('✅ RSS feed generated successfully!');
    } catch (err) {
      console.error('❌ Error parsing HTML:', err);
    }
  });
}).on('error', err => {
  console.error('❌ Error fetching HTML:', err.message || err);
});
