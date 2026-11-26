// ─── Seed data ────────────────────────────────────────────────────────────────
// Datos de inicio inspirados en publicaciones reales de Miiverse.
// Sin imágenes: las URLs de Imgur que tenían ya no existen (se quitaron el 2026-11-26).
export const SEED_POSTS: {
  username: string;
  mii_avatar_url: string;
  content_text: string;
  drawing_url: string | null;
  screenshot_url: string | null;
  game_title: string;
}[] = [
  {
    username: 'ZeldaMaster99',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=ZM&background=2ecc71&color=fff&bold=true&size=64',
    content_text:
      '¡Por fin terminé Breath of the Wild! La batalla final me costó mucho pero lo logré 💪',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'The Legend of Zelda: Breath of the Wild',
  },
  {
    username: 'SplatoonKing',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=SK&background=e74c3c&color=fff&bold=true&size=64',
    content_text:
      'Acabo de llegar al rango S+ en Turf War 🦑🎨 ¡Nadie pare los tentáculos!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Splatoon 3',
  },
  {
    username: 'MarioMaker2Fan',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=MM&background=e67e22&color=fff&bold=true&size=64',
    content_text:
      'Mi nuevo nivel en Super Mario Maker 2 ya está disponible. ¡A ver quién puede terminarlo sin morir!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Super Mario Maker 2',
  },
  {
    username: 'PikminAdventurer',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=PA&background=27ae60&color=fff&bold=true&size=64',
    content_text:
      'Dibujé a mi Pikmin favorito 🌿 El Pikmin roca es demasiado adorable',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Pikmin 4',
  },
  {
    username: 'AnimalCrossingIsla',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=AC&background=f39c12&color=fff&bold=true&size=64',
    content_text:
      'Mi isla ya tiene 5 estrellas con Isabelle 🌟 Tantas horas de trabajo valieron la pena',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Animal Crossing: New Horizons',
  },
  {
    username: 'KirbyArtist',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=KA&background=ff69b4&color=fff&bold=true&size=64',
    content_text:
      '¡Kirby con habilidad de copiar espada es simplemente el más poderoso! 🌟',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Kirby and the Forgotten Land',
  },
  {
    username: 'SmashBrosPro',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=SB&background=9b59b6&color=fff&bold=true&size=64',
    content_text:
      'Llevo 300 horas en Smash Ultimate y aún sigo mejorando con Link 🗡️ ¡El juego nunca envejece!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Super Smash Bros. Ultimate',
  },
  {
    username: 'MetroidHunter',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=MH&background=e74c3c&color=fff&bold=true&size=64',
    content_text:
      'Samus en Metroid Dread es BRUTAL. La sensación al esquivar a los EMMI no tiene precio 💀',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Metroid Dread',
  },
  {
    username: 'FoxMcCloud64',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=FC&background=1a252f&color=fff&bold=true&size=64',
    content_text: 'DO A BARREL ROLL! Star Fox 64 sigue sin envejecer 🚀🦊',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Star Fox 64',
  },
  {
    username: 'PokemonTrainer',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=PT&background=e74c3c&color=fff&bold=true&size=64',
    content_text:
      'Finalmente entrené mi primer equipo competitivo 6vs6. Lleva semanas pero valió la pena 🏆',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Pokémon Escarlata y Púrpura',
  },
  {
    username: 'NintendoFan_MX',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=NF&background=c0392b&color=fff&bold=true&size=64',
    content_text:
      'Pintando al estilo Miiverse es lo más relajante que existe 😌🎨',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Wii U & Switch Community Art',
  },
  {
    username: 'WaluigiTime',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=WT&background=8e44ad&color=fff&bold=true&size=64',
    content_text: 'WALUIGI NUMBER ONE!!! 🎾 El mundo me debe un juego propio',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Mario Tennis Aces',
  },
  {
    username: 'BotWExplorer',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=BE&background=3498db&color=fff&bold=true&size=64',
    content_text:
      'Mapa del Santuario más difícil de encontrar completado ✅ ¡El mundo abierto de Zelda es infinito!',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'The Legend of Zelda: Tears of the Kingdom',
  },
  {
    username: 'DonkeyKongFan',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=DK&background=8B4513&color=fff&bold=true&size=64',
    content_text:
      'Tropical Freeze sigue siendo el juego de plataformas más difícil que he jugado. Enorme DK 🍌',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Donkey Kong Country: Tropical Freeze',
  },
  {
    username: 'YoshiArtist',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=YA&background=2ecc71&color=fff&bold=true&size=64',
    content_text:
      '¡Mi dibujo de Yoshi de hoy! Practicando el estilo crayón que tiene el juego 🦎💚',
    drawing_url: null,
    screenshot_url: null,
    game_title: "Yoshi's Crafted World",
  },
  {
    username: 'BayonettaDancer',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=BD&background=2c3e50&color=fff&bold=true&size=64',
    content_text:
      'La cámara lenta en los ataques de Bayonetta es una obra de arte en sí misma 🔫💫',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Bayonetta 3',
  },
  {
    username: 'XenobladeChronicles',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=XC&background=e91e63&color=fff&bold=true&size=64',
    content_text:
      '300 horas de juego y el mundo de Xenoblade Chronicles 3 todavía me sorprende ✨',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Xenoblade Chronicles 3',
  },
  {
    username: 'MarineFishFan',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=MF&background=1abc9c&color=fff&bold=true&size=64',
    content_text:
      'Dibujé al equipo de Splatoon con estilo anime ¡Las tintas del juego me inspiran demasiado! 🦑',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Splatoon 3',
  },
  {
    username: 'FireEmblemWarrior',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=FE&background=c0392b&color=fff&bold=true&size=64',
    content_text:
      'El sistema de clases en Fire Emblem Engage es adictivo. Mis personajes favoritos acaban de evol. ⚔️',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Fire Emblem Engage',
  },
  {
    username: 'MarioOdysseyRun',
    mii_avatar_url:
      'https://ui-avatars.com/api/?name=MO&background=e74c3c&color=fff&bold=true&size=64',
    content_text:
      '999 lunas recolectadas en Super Mario Odyssey 🌙 Gracias a Cappy por todo 🎩',
    drawing_url: null,
    screenshot_url: null,
    game_title: 'Super Mario Odyssey',
  },
];
