import fs from 'fs';

async function fetchCss() {
  try {
    const res = await fetch('https://tracuuhsg.db.edu.vn/');
    const html = await res.text();
    console.log("HTML length:", html.length);
    
    // Look for background colors in inline styles or style tags
    const bgMatches = html.match(/background(?:-color)?:\s*([^;>]+)/gi);
    if (bgMatches) {
      console.log("Background matches in HTML:", bgMatches.slice(0, 5));
    }
    
    // Extract linked CSS files
    const cssLinks = html.match(/href="([^"]+\.css)[^"]*"/gi);
    if (cssLinks) {
      for (const linkMatch of cssLinks) {
        const link = linkMatch.match(/href="([^"]+)"/)[1];
        const cssUrl = link.startsWith('http') ? link : "https://tracuuhsg.db.edu.vn" + (link.startsWith('/') ? '' : '/') + link;
        console.log("Fetching CSS:", cssUrl);
        try {
          const cssRes = await fetch(cssUrl);
          const css = await cssRes.text();
          // Look for body or html background color
          const bodyBgMatch = css.match(/body\s*\{[^}]*background(?:-color)?:\s*([^;!]+)/i);
          if (bodyBgMatch) {
            console.log("Body bg in " + cssUrl + ":", bodyBgMatch[1]);
          }
        } catch (e) {
          console.log("Error fetching css:", cssUrl, e.message);
        }
      }
    }
  } catch(e) {
    console.error(e);
  }
}

fetchCss();
