// generate_rss.js (ingen cheerio, ingen node-fetch — använder bara https)
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

// Enkel HTML-entity-dekodning (vanligaste)
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
  // numeriska entiteter
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n,10)));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h,16)));
  return s;
}

// Ta bort HTML-taggar (enkelt)
function stripTags(s) {
  if (!s) return '';
  return s.replace(/<[^>]*>/g, '').trim();
}

// Hämta HTML och parsa tabellen med regex
https.get(htmlUrl, res => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    try {
      // Extrahera alla <tr>...</tr>
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let match;
      const rows = [];
      while ((match = trRegex.exec(html)) !== null) {
        rows.push(match[1]);
      }

      let rssItems = '';

      rows.forEach((rowHtml, idx) => {
        // Extrahera <td>...</td> eller <th> om det skulle finnas
        const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cols = [];
        let m;
        while ((m = tdRegex.exec(rowHtml)) !== null) {
          // decoda entities och ta bort inre taggar
          let cell = decodeHtmlEntities(stripTags(m[1]));
          cell = cleanString(cell);
          cols.push(cell);
        }

        // Hoppa över rader utan <td> eller för korta rader (t.ex. header)
        if (cols.length < 2) return;

        // Fälten i ordning: [Startdatum, Slutdatum, Veckodag, Starttid, Sluttid, Objekt, Information]
        const startdatum = cols[0] || '';
        const slutdatum  = cols[1] || '';
        const veckodag   = cols[2] || '';
        const starttid   = cols[3] || '';
        const sluttid    = cols[4] || '';
        const objekt     = cols[5] || '';
        const info       = cols[6] || '';

        const title = `${objekt} – ${veckodag} ${starttid}-${sluttid}`;
        const description = `${info} (${startdatum}, ${veckodag}, ${starttid}-${sluttid})`;

        // För pubDate: försök skapa ett giltigt datum, annars använd nu
        let pubDate;
        try {
          const d = new Date(`${startdatum}T${starttid}:00+02:00`);
          pubDate = isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
        } catch (e) {
          pubDate = new Date().toUTCString();
        }

        rssItems += `
<item>
  <title>${escapeXml(title)}</title>
  <description>${escapeXml(description)}</description>
  <pubDate>${pubDate}</pubDate>
</item>`;
      });

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

      // ✅ Skriv ut antal items
      const itemCount = rssItems.split('<item>').length - 1;
      console.log(`✅ RSS feed generated successfully! Total items: ${itemCount}`);

    } catch (err) {
      console.error('❌ Error parsing HTML:', err);
    }
  });
}).on('error', err => {
  console.error('❌ Error fetching HTML:', err.message || err);
});
