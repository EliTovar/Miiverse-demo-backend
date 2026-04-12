const https = require('https');

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function testAll() {
  console.log("Testing PSNProfiles...");
  try {
     const psn = await fetchHTML('https://psnprofiles.com/games');
     console.log("PSN size:", psn.length);
     // Look for <picture><img src="..." alt="title"
     const psnMatches = psn.match(/<picture>[\s\S]*?<img.+?src="([^"]+)".+?alt="([^"]+)"/g);
     if(psnMatches) {
         console.log("PSN Sample:", psnMatches[0].substring(0, 150));
     } else {
         console.log("PSN no matches");
     }
  } catch(e) { console.error(e); }

  console.log("\nTesting TrueAchievements...");
  try {
     const ta = await fetchHTML('https://www.trueachievements.com/games.aspx');
     console.log("TA size:", ta.length);
     const taMatches = ta.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"/g);
     if(taMatches && taMatches.length > 5) {
         console.log("TA Sample:", taMatches[5].substring(0, 150));
     }
  } catch(e) { console.error(e); }

  console.log("\nTesting Nintendo (DekuDeals since eShop works weirdly)...");
  try {
     const deku = await fetchHTML('https://www.dekudeals.com/hottest');
     console.log("Deku size:", deku.length);
     const dekuMatches = deku.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]+)"[^\>]*class="main-image"/g);
     if(dekuMatches) {
         console.log("Deku Sample:", dekuMatches[0].substring(0, 150));
     }
  } catch(e) { console.error(e); }
}

testAll();
