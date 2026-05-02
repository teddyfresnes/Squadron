'use strict';
const { createSeed, seededRng, todayString } = require('./seed');

// ── Palette sizes — must stay in sync with palette.js ───────────────────────
const SKIN_COUNT    = 8;
const HAIR_COUNT    = 7;
const EYE_COUNT     = 9;
const UNIFORM_COUNT = 10;

// Hairstyle global indices per body type — must match app.jsx HAIRSTYLES_BY_BODY
// palette.js order: 0=Textured Crop 1=Low Fade 2=Side Part 3=Quiff 4=Curly Top
//   5=Short 6=Messy 7=Long 8=Ponytail 9=Bob 10=Wavy 11=Flowing 12=High Ponytail
//   13=Buzz Cut 14=Crew Cut 15=Bald
const HAIR_STYLES = {
  male:   [0, 1, 2, 3, 4, 13, 14, 15],
  female: [5, 6, 7, 8, 9, 10, 11, 12],
};

// ── Weapon list — order must match weapon-config.json / weapons.js ──────────
// [smg×11, rifle×10, heavy×14, shotgun×8, sniper×10, pistol×8] = 61 total
const WEAPON_NAMES = [
  // SMG 0-10
  'Uzi','MAC-10','TEC-9','Skorpion vz. 61','HK MP7','FN P90','FN P90 Tactical',
  'MP5K-PDW','MP9 Suppressed','Thompson M1A1','KRISS Vector',
  // Rifle 11-20
  'AK-47','AKS-74U','AK-74','M4A1 Suppressed','Mk18 Suppressed',
  'HK G3','FN FAL','FN FAL Tactical','FAMAS F1','FAMAS Compact',
  // Heavy 21-34
  'M202 FLASH','Laser Cannon','Carl Gustaf M3','XM25 Grenade Launcher',
  'RPG-7 Launcher','Recoilless Rifle','FIM-92 Stinger','AT4 Launcher',
  'Twin-Barrel Launcher','M79 Grenade Launcher','M60E4','M249 SAW','M134 Minigun','M32 MGL',
  // Shotgun 35-42
  'Franchi SPAS-12','Double-Barrel Shotgun','Remington 870','Mossberg 500',
  'Benelli M4','Blunderbuss','Sawed-Off Shotgun','Over-Under Shotgun',
  // Sniper 43-52
  'Accuracy International AWP','AWM Suppressed','SVD Dragunov','HK PSG1',
  'CheyTac M200','Barrett M82A1','Steyr HS .50','PGM Hecate II','Steyr Scout','Compact Marksman Rifle',
  // Pistol 53-60
  'Walther PPK','Colt Python','S&W Model 29','Ruger Super Redhawk',
  'Glock 17','Desert Eagle','Gold M1911','Makarov PM',
];

// Primary skill pool indices (Glock 17=57, Uzi=0, Mossberg 500=38, AKS-74U=12, Steyr Scout=51)
const SKILL1_INDICES = [57, 0, 38, 12, 51];

// ── Name lists (copied from game.jsx to keep client & server in sync) ────────
const MALE_NAMES = [
  'Achille','Adrien','Alaric','Albert','Aldric','Alexandre','Amaury','Anatole','Anselme','Antoine',
  'Apollon','Archibald','Aristide','Armand','Arnaud','Arsène','Arthur','Aurélien','Balthazar',
  'Barnabé','Bastien','Baudouin','Benoît','Bertrand','Boris','Brutus','Cassius','Célestin',
  'César','Charlemagne','Christophe','Clément','Constantin','Cyprien','Damien','Désiré',
  'Dimitri','Dorian','Edmond','Édouard','Egon','Eliott','Émeric','Émilien','Enguerrand',
  'Étienne','Eustache','Évrard','Fabien','Faust','Félix','Ferdinand','Florian','Gabriel',
  'Galahad','Gaspard','Gauthier','Geoffroy','Georges','Gildas','Godefroy','Grégoire',
  'Guillaume','Gustave','Hadrien','Hannibal','Hector','Henri','Hercule','Honoré','Hubert',
  'Hugo','Ignace','Igor','Ilan','Isidore','Ivan','Jacques','Jasper','Jean','Jérémie',
  'Joachim','Jules','Julien','Karl','Kaspar','Kazimir','Klaus','Lancelot','Laurent',
  'Léandre','Léon','Léonard','Léopold','Loïc','Lothaire','Louis','Lucien','Ludovic',
  'Magnus','Marc','Marius','Martin','Matthias','Maxence','Maximilien','Mirko','Modeste',
  'Mortimer','Nathaniel','Nestor','Nicéphore','Nikolaï','Norbert','Octave','Olaf',
  'Olivier','Orphée','Oscar','Othon','Owen','Pacôme','Pascal','Patrice','Pierre',
  'Quentin','Raphaël','Raoul','Régis','Rémi','Renaud','Reynold','Robin','Rodolphe',
  'Roger','Roland','Roméo','Rufus','Salomon','Samson','Saturnin','Sébastien','Séraphin',
  'Sigismond','Silas','Stanislas','Sven','Sylvestre','Tancrède','Théobald','Théodore',
  'Théophile','Thibault','Thomas','Tiago','Timothée','Titus','Tobias','Tristan','Ulrich',
  'Ulysse','Valentin','Valère','Vasco','Victor','Vincent','Vladimir','Wenceslas','Wilfried',
  'Wolfgang','Xavier','Yannick','Yorick','Zacharie','Zéphyr',
];

const FEMALE_NAMES = [
  'Adèle','Agathe','Agnès','Aimée','Albane','Alice','Aliénor','Alma','Amandine','Amélie',
  'Anaïs','Andromaque','Angélique','Anouk','Apolline','Ariane','Armance','Astrid','Athéna',
  'Aude','Augustine','Aurélie','Aurore','Avril','Aziliz','Bathilde','Béatrice','Bérengère',
  'Bérénice','Blanche','Bénédicte','Bertille','Brunehaut','Calliope','Camille','Capucine',
  'Carmen','Cassandre','Catherine','Cécile','Célestine','Célia','Charlotte','Chloé',
  'Clara','Clarisse','Clémence','Cléopâtre','Clio','Clothilde','Colette','Constance',
  'Coraline','Cordélia','Cyrielle','Daphné','Delphine','Diane','Dione','Edwige','Éléonore',
  'Élisa','Éliane','Éloïse','Elsa','Elvire','Émeline','Emma','Énora','Esmée','Esther',
  'Eulalie','Eustachia','Eva','Ève','Fanny','Faustine','Félicie','Flavie','Flore',
  'Florence','Fortuna','Frédérique','Freya','Gabrielle','Gaëlle','Garance','Geneviève',
  'Gisèle','Gwendoline','Hadassa','Hannah','Hélène','Héloïse','Hermine','Hermione',
  'Hilda','Hortense','Ilona','Inès','Irène','Iris','Isabeau','Isaure','Iseult','Ismérie',
  'Ivana','Jacinthe','Jade','Jeanne','Joséphine','Judith','Julie','Juliette','Justine',
  'Kalliope','Kassia','Katarina','Lara','Laure','Léa','Léonie','Léontine','Lila',
  'Lilou','Liv','Livia','Loriane','Lou','Louise','Lucile','Lucrèce','Lydie','Mahaut',
  'Maïa','Malika','Marceline','Margaux','Marguerite','Mathilde','Maud','Mélanie',
  'Mélissande','Mila','Mireille','Morgane','Muriel','Nadia','Naïma','Naomi','Natacha',
  'Nausicaa','Nina','Nora','Norma','Nour','Océane','Octavie','Odette','Odile','Olga',
  'Olympe','Ombeline','Ondine','Ophélie','Pauline','Pénélope','Perrine','Philippa',
  'Pomeline','Prudence','Rachel','Reine','Rosalie','Rose','Roxane','Sabine','Salomé',
  'Sarah','Selma','Séraphine','Sibylle','Sienna','Sigrid','Solange','Soline','Sonia',
  'Sophie','Stella','Suzanne','Sybille','Sylvie','Tara','Tatiana','Théa','Thaïs',
  'Théodora','Tiphaine','Ursula','Valentine','Vénus','Véra','Véronique','Victoire',
  'Violette','Virginie','Vivienne','Wendy','Wilhelmine','Xena','Yael','Ysaline','Yseult',
  'Zélie','Zoé',
];

function seededPick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
function seededRandInt(n, rng) {
  return Math.floor(rng() * n);
}

function generateOneTrooper(idx, rng) {
  const skill1Idx  = seededPick(SKILL1_INDICES, rng);
  const skill1Name = WEAPON_NAMES[skill1Idx];

  // Any weapon except skill1
  const pool2      = WEAPON_NAMES.filter((_, i) => i !== skill1Idx);
  const skill2Name = seededPick(pool2, rng);

  const bodyType    = rng() < 0.5 ? 'male' : 'female';
  const hairStyles  = HAIR_STYLES[bodyType];
  const hairStyleIdx = seededPick(hairStyles, rng);

  const skinIdx    = seededRandInt(SKIN_COUNT, rng);
  const uniformIdx = seededRandInt(UNIFORM_COUNT, rng);
  let   hairIdx    = seededRandInt(HAIR_COUNT, rng);
  // Orange uniform (8) + Ginger hair (4) or Yellow uniform (7) + Blonde hair (5) are forbidden
  while ((uniformIdx === 8 && hairIdx === 4) || (uniformIdx === 7 && hairIdx === 5)) {
    hairIdx = seededRandInt(HAIR_COUNT, rng);
  }
  const eyeIdx     = seededRandInt(EYE_COUNT, rng);

  const config = {
    bodyType,
    skinIdx,
    hairIdx,
    hairStyleIdx,
    eyeIdx,
    uniformIdx,
    vestOn:       false,
    backpackOn:   false,
    hatIdx:       0,
    weaponIdx:    skill1Idx,
    weaponSkinIdx: 33,
  };

  const names = bodyType === 'female' ? FEMALE_NAMES : MALE_NAMES;
  const name  = seededPick(names, rng);
  const idSuffix = (rng() * 0xffffff | 0).toString(36);

  return { id: `soldier-${idx}-${idSuffix}`, config, name, skill1Name, skill2Name };
}

function generateTroopers(ip, dateStr, count = 8) {
  const seed = createSeed(dateStr || todayString(), ip || 'unknown');
  const rng  = seededRng(seed);
  return Array.from({ length: count }, (_, i) => generateOneTrooper(i, rng));
}

module.exports = { generateTroopers };
