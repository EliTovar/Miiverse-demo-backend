async function testScrape() {
  console.log('Testing Kworb scrape...');
  const response = await fetch('https://kworb.net/spotify/country/global_daily.html', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await response.text();
  
  const songs = [];
  // Ajuste de regex basado en el HTML real de Kworb
  // Suele ser: <td class="text"><a>Artist</a></td><td class="text"><a>Track</a></td>
  const rowMatches = html.match(/<tr[\s\S]*?\/artist\/[\s\S]*?\/track\/[\s\S]*?<\/tr>/g);

  if (rowMatches) {
     console.log(`Found ${rowMatches.length} rows`);
    for (let i = 0; i < Math.min(rowMatches.length, 5); i++) {
        const row = rowMatches[i];
        const artistMatch = row.match(/\/artist\/[^>]+>([^<]+)/);
        const trackMatch = row.match(/\/track\/[^>]+>([^<]+)/);
        
        if (artistMatch && trackMatch) {
          songs.push({
            artist: artistMatch[1].trim(),
            title: trackMatch[1].trim()
          });
        }
    }
  } else {
      console.log('No row matches found');
  }

  console.log('Parsed songs:', songs);

  for (const song of songs) {
      console.log(`Fetching cover for ${song.artist} - ${song.title}...`);
      const searchTerm = encodeURIComponent(`${song.artist} ${song.title}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
          console.log('Found cover:', data.results[0].artworkUrl100.replace('100x100bb', '600x600bb'));
      } else {
          console.log('No cover found');
      }
  }
}

testScrape();
