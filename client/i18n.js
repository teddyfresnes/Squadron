// i18n — Squadron localization module.
// Exposes window.I18n with: lang, t(key, params), setLang(lang), useI18n() (React hook),
// LANGS list, getMaleNames(), getFemaleNames(), localizedWeaponName(weapon).
// Emits the 'i18n:change' window event when language changes.

(function () {
'use strict';

const STORAGE_KEY = 'squadron-lang';
const DEFAULT_LANG = 'fr';
const LANGS = [
  { code: 'fr', label: 'Français', flag: 'assets/images/icons/flags/fr.svg' },
  { code: 'en', label: 'English',  flag: 'assets/images/icons/flags/en.svg' },
  { code: 'zh', label: '中文',      flag: 'assets/images/icons/flags/zh.svg' },
];

const DICT = {
  // ── Common ────────────────────────────────────────────────────────────────
  'common.cancel':   { fr: 'Annuler',     en: 'Cancel',     zh: '取消' },
  'common.confirm':  { fr: 'Valider',     en: 'Confirm',    zh: '确认' },
  'common.continue': { fr: 'Continuer',   en: 'Continue',   zh: '继续' },
  'common.back':     { fr: '← Retour',    en: '← Back',     zh: '← 返回' },
  'common.close':    { fr: 'Fermer',      en: 'Close',      zh: '关闭' },
  'common.loading':  { fr: 'Chargement…', en: 'Loading…',   zh: '加载中…' },
  'common.none':     { fr: 'Aucune',      en: 'None',       zh: '无' },
  'common.unknown':  { fr: 'Inconnu',     en: 'Unknown',    zh: '未知' },
  'common.yes':      { fr: 'Oui',         en: 'Yes',        zh: '是' },
  'common.no':       { fr: 'Non',         en: 'No',         zh: '否' },
  'common.or':       { fr: 'OU',          en: 'OR',         zh: '或' },
  'common.enter':    { fr: 'ENTER',       en: 'ENTER',      zh: '回车' },
  'common.cancelLower': { fr: '← annuler', en: '← cancel',  zh: '← 取消' },

  // ── Brand / boot ──────────────────────────────────────────────────────────
  'brand.title':    { fr: 'SQUADRON', en: 'SQUADRON', zh: 'SQUADRON' },
  'brand.subtitle': { fr: 'Une squad pour les gouverner tous', en: 'One squad to rule them all', zh: '一支小队，统御万军' },
  'brand.devTitle': { fr: 'SQUADRON DEV PART', en: 'SQUADRON DEV PART', zh: 'SQUADRON 开发模式' },
  'brand.devModeBtn':  { fr: '← DEV MODE',  en: '← DEV MODE',  zh: '← 开发模式' },
  'brand.prodModeBtn': { fr: 'PROD MODE →', en: 'PROD MODE →', zh: '游戏模式 →' },
  'brand.devModeTip':  { fr: 'Retour à l\'éditeur de personnage', en: 'Back to character editor', zh: '返回角色编辑器' },
  'brand.prodModeTip': { fr: 'Passer au mode jeu (prod)', en: 'Switch to game (prod) mode', zh: '切换到游戏模式' },

  // ── Server check ──────────────────────────────────────────────────────────
  'server.connecting': { fr: 'Connexion au serveur…', en: 'Connecting to server…', zh: '正在连接服务器…' },
  'server.notFound':   { fr: 'Serveur introuvable — toujours en recherche', en: 'Server not found — still searching', zh: '找不到服务器 — 仍在搜索' },
  'server.playOffline':{ fr: 'JOUER HORS LIGNE', en: 'PLAY OFFLINE', zh: '离线游戏' },
  'server.timeout':    { fr: 'Délai dépassé.', en: 'Timed out.', zh: '请求超时。' },
  'server.unreachable':{ fr: 'Serveur inaccessible.', en: 'Server unreachable.', zh: '无法访问服务器。' },
  'server.error':      { fr: 'Erreur serveur.', en: 'Server error.', zh: '服务器错误。' },

  // ── Offline modal ─────────────────────────────────────────────────────────
  'offline.title':  { fr: 'MODE HORS LIGNE', en: 'OFFLINE MODE', zh: '离线模式' },
  'offline.body1':  { fr: 'En mode hors ligne, aucune donnée n\'est sauvegardée sur le serveur.', en: 'In offline mode, no data is saved on the server.', zh: '离线模式下，数据不会保存到服务器。' },
  'offline.body1Strong': { fr: 'aucune donnée n\'est sauvegardée', en: 'no data is saved', zh: '数据不会保存' },
  'offline.body2':  { fr: 'Votre progression ne sera pas récupérée si vous changez d\'appareil ou videz le cache.', en: 'Your progress will not be recovered if you change device or clear the cache.', zh: '更换设备或清除缓存后，您的进度将无法恢复。' },
  'offline.body3':  { fr: 'Pour retrouver une progression existante, contactez l\'administrateur.', en: 'To recover an existing progression, contact the administrator.', zh: '如需恢复现有进度，请联系管理员。' },
  'offline.body3Em':{ fr: 'contactez l\'administrateur', en: 'contact the administrator', zh: '联系管理员' },
  'offline.badge':  { fr: 'HORS LIGNE', en: 'OFFLINE', zh: '离线' },
  'offline.badgeTip': { fr: 'Mode hors ligne — données locales', en: 'Offline mode — local data', zh: '离线模式 — 本地数据' },
  'offline.pillTip':{ fr: 'Mode hors ligne', en: 'Offline mode', zh: '离线模式' },

  // ── Home page ─────────────────────────────────────────────────────────────
  'home.createTitle':   { fr: 'CRÉER MA SQUAD', en: 'CREATE MY SQUAD', zh: '创建小队' },
  'home.joinTitle':     { fr: 'REJOINDRE UNE SQUAD', en: 'JOIN A SQUAD', zh: '加入小队' },
  'home.squadName':     { fr: 'Nom de la squad', en: 'Squad name', zh: '小队名称' },
  'home.passwordOpt':   { fr: 'Mot de passe (optionnel)', en: 'Password (optional)', zh: '密码（可选）' },
  'home.createBtn':     { fr: 'CRÉER', en: 'CREATE', zh: '创建' },
  'home.joinBtn':       { fr: 'REJOINDRE', en: 'JOIN', zh: '加入' },
  'home.lastConnection':{ fr: '↩ Dernière connexion : ', en: '↩ Last connection: ', zh: '↩ 上次连接：' },
  'home.errChooseBoth': { fr: 'Choisis un soldat et donne un nom à ta squad.', en: 'Pick a soldier and name your squad.', zh: '请选择一名士兵并为小队命名。' },
  'home.errChooseSld':  { fr: 'Choisis un soldat fondateur.', en: 'Pick a founding soldier.', zh: '请选择一名创始士兵。' },
  'home.errName2':      { fr: 'Le nom doit faire au moins 2 caractères.', en: 'Name must be at least 2 characters.', zh: '名称至少需要 2 个字符。' },
  'home.errJoinName':   { fr: 'Entre un nom de squad valide.', en: 'Enter a valid squad name.', zh: '请输入有效的小队名称。' },
  'home.errSquadExists':{ fr: 'Une squad avec ce nom existe déjà.', en: 'A squad with this name already exists.', zh: '已存在同名小队。' },

  // ── Boot intro lines ──────────────────────────────────────────────────────
  'boot.l1': { fr: '> SQUADRON-NET v3.7.1', en: '> SQUADRON-NET v3.7.1', zh: '> SQUADRON-NET v3.7.1' },
  'boot.l2': { fr: '> Initialisation du module crypto...', en: '> Initializing crypto module...', zh: '> 初始化加密模块...' },
  'boot.l3': { fr: '> Tunnel sécurisé établi            [OK]', en: '> Secure tunnel established        [OK]', zh: '> 安全通道已建立                   [OK]' },
  'boot.l4': { fr: '> Localisation du nœud squad...', en: '> Locating squad node...', zh: '> 定位小队节点...' },
  'boot.l5': { fr: '> Nœud trouvé — latence 4 ms        [OK]', en: '> Node found — latency 4 ms        [OK]', zh: '> 节点已找到 — 延迟 4 毫秒          [OK]' },
  'boot.l6': { fr: '> Protocole AUTH activé             [OK]', en: '> AUTH protocol enabled            [OK]', zh: '> AUTH 协议已启用                   [OK]' },
  'boot.l7': { fr: '> Mode CHALLENGE/RESPONSE', en: '> CHALLENGE/RESPONSE mode', zh: '> 挑战/响应模式' },
  'boot.l8': { fr: '> En attente des identifiants...', en: '> Awaiting credentials...', zh: '> 等待凭证...' },

  // ── Login page ────────────────────────────────────────────────────────────
  'login.prompt':     { fr: '> Entrez le mot de passe de la Squad « {name} »...', en: '> Enter the password for Squad "{name}"...', zh: '> 请输入小队“{name}”的密码...' },
  'login.errNotFound':{ fr: 'ACCESS DENIED — squad introuvable.', en: 'ACCESS DENIED — squad not found.', zh: '访问被拒绝 — 找不到小队。' },
  'login.errBadPwd':  { fr: 'ACCESS DENIED — mot de passe invalide.', en: 'ACCESS DENIED — invalid password.', zh: '访问被拒绝 — 密码无效。' },
  'login.errServer':  { fr: 'ACCESS DENIED — erreur serveur.', en: 'ACCESS DENIED — server error.', zh: '访问被拒绝 — 服务器错误。' },

  // ── Falling lines effect ──────────────────────────────────────────────────
  'falling.createHQ': { fr: 'CRÉATION DU QG', en: 'BUILDING HQ', zh: '正在创建总部' },
  'falling.accessHQ': { fr: 'ACCÈS AU QG',    en: 'ENTERING HQ', zh: '进入总部' },
  'falling.fallback': { fr: 'ESCADRON',       en: 'SQUADRON',     zh: '中队' },

  // ── HQ — tabs / header ────────────────────────────────────────────────────
  'hq.tab.play':     { fr: 'Jouer',      en: 'Play',     zh: '战斗' },
  'hq.tab.squad':    { fr: 'Ma squad',   en: 'My squad', zh: '我的小队' },
  'hq.tab.market':   { fr: 'Marché',     en: 'Market',   zh: '商城' },
  'hq.tab.settings': { fr: 'Paramètres', en: 'Settings', zh: '设置' },

  // ── HQ — sidebar ──────────────────────────────────────────────────────────
  'hq.sb.mySoldiers': { fr: 'MES SOLDATS', en: 'MY SOLDIERS', zh: '我的士兵' },
  'hq.sb.tokens':     { fr: 'TOKENS', en: 'TOKENS', zh: '代币' },
  'hq.sb.power':      { fr: 'POWER', en: 'POWER', zh: '战力' },
  'hq.sb.tokensTip':  { fr: 'Tokens', en: 'Tokens', zh: '代币' },
  'hq.sb.powerTip':   { fr: 'Power', en: 'Power', zh: '战力' },
  'hq.sb.recruit':    { fr: 'Recruter', en: 'Recruit', zh: '招募' },
  'hq.sb.recruitTip': { fr: 'Recruter un nouveau soldat', en: 'Recruit a new soldier', zh: '招募新士兵' },

  // ── HQ — play page ────────────────────────────────────────────────────────
  'hq.play.eyebrow':       { fr: 'QUARTIER GÉNÉRAL', en: 'HEADQUARTERS', zh: '总指挥部' },
  'hq.play.squadPrefix':   { fr: 'SQUADRON', en: 'SQUADRON', zh: 'SQUADRON' },
  'hq.play.mode.army':     { fr: 'Squad vs Squad', en: 'Squad vs Squad', zh: '小队对决' },
  'hq.play.mode.survival': { fr: 'Survie',  en: 'Survival',   zh: '生存模式' },
  'hq.play.mode.tournament':{ fr: 'Tournoi', en: 'Tournament', zh: '锦标赛' },
  'hq.play.mode.boss':     { fr: 'Boss du jour', en: 'Boss of the day', zh: '每日 BOSS' },
  'hq.play.comingSoon':    { fr: 'À VENIR', en: 'COMING SOON', zh: '敬请期待' },
  'hq.play.toUnlock':      { fr: 'À DÉBLOQUER', en: 'TO UNLOCK', zh: '待解锁' },
  'hq.play.go':            { fr: 'GO !', en: 'GO!', zh: '出击！' },

  // ── HQ — opponents ────────────────────────────────────────────────────────
  'hq.opp.title':    { fr: 'Squad vs Squad', en: 'Squad vs Squad', zh: '小队对决' },
  'hq.opp.searching':{ fr: 'Recherche d\'adversaires...', en: 'Searching for opponents...', zh: '正在搜寻对手...' },
  'hq.opp.attack':   { fr: 'ATTAQUER', en: 'ATTACK', zh: '进攻' },

  // ── HQ — recruit ──────────────────────────────────────────────────────────
  'hq.rec.eyebrow': { fr: 'RECRUTEMENT', en: 'RECRUITMENT', zh: '招募中心' },
  'hq.rec.title':   { fr: '5 soldats disponibles aujourd\'hui', en: '5 soldiers available today', zh: '今日可招募 5 名士兵' },
  'hq.rec.hint':    { fr: 'La sélection change chaque jour. Reviens demain pour de nouvelle recrues !', en: 'The selection changes every day. Come back tomorrow for new recruits!', zh: '每日刷新名单，明天再来招募新成员！' },
  'hq.rec.btn':     { fr: 'RECRUTER · ', en: 'RECRUIT · ', zh: '招募 · ' },

  // ── HQ — soldier detail ───────────────────────────────────────────────────
  'hq.sd.lvlShort':  { fr: 'NIV.', en: 'LVL', zh: '等级' },
  'hq.sd.lvlLong':   { fr: 'NIV.', en: 'LVL', zh: '等级' },
  'hq.sd.skillsAria':{ fr: 'Compétences débloquées', en: 'Unlocked skills', zh: '已解锁技能' },
  'hq.sd.perks':     { fr: 'COMPÉTENCES', en: 'PERKS', zh: '专精' },
  'hq.sd.rename':    { fr: 'Renommer le soldat', en: 'Rename soldier', zh: '重命名士兵' },
  'hq.sd.renameBtn': { fr: 'Renommer', en: 'Rename', zh: '重命名' },
  'hq.sd.renameTip': { fr: 'En attente : {time}', en: 'Waiting: {time}', zh: '冷却中：{time}' },
  'hq.sd.preferred': { fr: 'Arme préférée', en: 'Preferred weapon', zh: '首选武器' },
  'hq.sd.mystery':   { fr: '???', en: '???', zh: '???' },
  'hq.sd.upgradeBtn':{ fr: 'AMÉLIORER', en: 'UPGRADE', zh: '升级' },
  'hq.sd.choose':    { fr: 'CHOISIR', en: 'CHOOSE', zh: '选择' },
  'hq.sd.allUnlocked':{ fr: 'Toutes les compétences sont déjà débloquées.', en: 'All skills are already unlocked.', zh: '所有专精均已解锁。' },

  // ── HQ — market ───────────────────────────────────────────────────────────
  'hq.mk.title':       { fr: 'Marché', en: 'Market', zh: '商城' },
  'hq.mk.hint':        { fr: 'Skins d\'armes, équipements, boosters de tokens. Le marché ouvrira bientôt ses portes.', en: 'Weapon skins, gear, token boosters. The market will open its doors soon.', zh: '武器皮肤、装备、代币加成。商城即将开放。' },
  'hq.mk.construction':{ fr: 'EN CONSTRUCTION', en: 'UNDER CONSTRUCTION', zh: '正在建设中' },

  // ── HQ — settings ─────────────────────────────────────────────────────────
  'hq.set.logout':    { fr: 'Se déconnecter', en: 'Log out', zh: '退出登录' },
  'hq.set.language':  { fr: 'Langue', en: 'Language', zh: '语言' },
  'hq.set.langHint':  { fr: 'Choisis la langue de l\'interface.', en: 'Choose the interface language.', zh: '选择界面语言。' },

  // ── HQ — battle splash placeholder ────────────────────────────────────────
  'hq.battle.vs':      { fr: 'VS', en: 'VS', zh: 'VS' },
  'hq.battle.pending': { fr: '⚔ COMBAT À VENIR — la mécanique de bataille sera implémentée ensuite.', en: '⚔ BATTLE COMING — the combat mechanic will be implemented next.', zh: '⚔ 战斗即将开始 — 战斗机制即将实装。' },

  // ── Combat view ───────────────────────────────────────────────────────────
  'cv.preparing':  { fr: 'Préparation du combat…', en: 'Preparing the battle…', zh: '战斗准备中…' },
  'cv.win':        { fr: 'VICTOIRE !', en: 'VICTORY!', zh: '胜利！' },
  'cv.lose':       { fr: 'DÉFAITE !', en: 'DEFEAT!', zh: '失败！' },
  'cv.draw':       { fr: 'ÉGALITÉ', en: 'DRAW', zh: '平局' },
  'cv.winTitle':   { fr: 'VICTOIRE', en: 'VICTORY', zh: '胜利' },
  'cv.loseTitle':  { fr: 'DÉFAITE', en: 'DEFEAT', zh: '失败' },
  'cv.drawTitle':  { fr: 'ÉGALITÉ', en: 'DRAW', zh: '平局' },
  'cv.winMsg':     { fr: 'Vous avez gagné {tokens} token{plural} en battant la squad {name}.', en: 'You won {tokens} token{plural} by defeating squad {name}.', zh: '击败小队 {name}，赢得 {tokens} 代币。' },
  'cv.drawMsg':    { fr: 'Match nul face à la squad {name}.', en: 'Draw against squad {name}.', zh: '与小队 {name} 战成平局。' },
  'cv.loseMsg':    { fr: 'La squad {name} l\'emporte. Vous gagnez quand même {tokens} token.', en: 'Squad {name} wins. You still earn {tokens} token.', zh: '小队 {name} 获胜，您仍获得 {tokens} 代币。' },
  'cv.continue':   { fr: 'CONTINUER', en: 'CONTINUE', zh: '继续' },
  'cv.tokensWon':  { fr: '{n} tokens gagnés', en: '{n} tokens earned', zh: '获得 {n} 代币' },
  'cv.vs':         { fr: 'VS', en: 'VS', zh: 'VS' },
  'cv.pause':      { fr: 'PAUSE', en: 'PAUSE', zh: '暂停' },
  'cv.soldier':    { fr: 'Soldat', en: 'Soldier', zh: '士兵' },
  'cv.soldierAria':{ fr: '{name}, niveau {lvl}', en: '{name}, level {lvl}', zh: '{name}，等级 {lvl}' },
  'cv.hpAria':     { fr: '{cur}/{max} PV', en: '{cur}/{max} HP', zh: '{cur}/{max} 生命' },
  'cv.bodyState':  { fr: 'Etat du corps, {hp}', en: 'Body state, {hp}', zh: '身体状态，{hp}' },
  'cv.noWeapon':   { fr: 'Aucune arme', en: 'No weapon', zh: '没有武器' },
  'cv.reloadAria': { fr: 'Recharge {cur} sur {total}', en: 'Reloading {cur} of {total}', zh: '装填 {cur}/{total}' },
  'cv.reloadLabel':{ fr: 'RECHARGE', en: 'RELOAD', zh: '装填' },
  'cv.unlocked':   { fr: 'Armes débloquées', en: 'Unlocked weapons', zh: '已解锁武器' },
  'cv.lvl':        { fr: 'NIV', en: 'LVL', zh: '等级' },
  'cv.bodyPart.head':       { fr: 'Tete', en: 'Head', zh: '头部' },
  'cv.bodyPart.leftArm':    { fr: 'Bras gauche', en: 'Left arm', zh: '左臂' },
  'cv.bodyPart.rightArm':   { fr: 'Bras droit', en: 'Right arm', zh: '右臂' },
  'cv.bodyPart.leftLeg':    { fr: 'Jambe gauche', en: 'Left leg', zh: '左腿' },
  'cv.bodyPart.rightLeg':   { fr: 'Jambe droite', en: 'Right leg', zh: '右腿' },
  'cv.bodyPart.abdomen':    { fr: 'Ventre', en: 'Abdomen', zh: '腹部' },
  'cv.bodyPart.chestLeft':  { fr: 'Torse gauche', en: 'Left chest', zh: '左胸' },
  'cv.bodyPart.chestRight': { fr: 'Torse droit', en: 'Right chest', zh: '右胸' },

  // ── Weapons — types ───────────────────────────────────────────────────────
  'wt.melee':   { fr: 'Corps a corps',      en: 'Melee',   zh: '近战' },
  'wt.pistol':  { fr: 'Pistolet',           en: 'Pistol',  zh: '手枪' },
  'wt.smg':     { fr: 'Mitraillette',       en: 'SMG',     zh: '冲锋枪' },
  'wt.shotgun': { fr: 'Fusil à pompe',      en: 'Shotgun', zh: '霰弹枪' },
  'wt.rifle':   { fr: 'Fusil d\'assaut',    en: 'Assault rifle', zh: '突击步枪' },
  'wt.sniper':  { fr: 'Fusil de précision', en: 'Sniper',  zh: '狙击枪' },
  'wt.heavy':   { fr: 'Arme lourde',        en: 'Heavy',   zh: '重型武器' },

  // ── Weapons — tooltip / stats ─────────────────────────────────────────────
  'wp.damage':   { fr: 'Dégâts', en: 'Damage', zh: '伤害' },
  'wp.accuracy': { fr: 'Précision', en: 'Accuracy', zh: '精度' },
  'wp.burst':    { fr: 'Rafale', en: 'Burst', zh: '连发' },
  'wp.range':    { fr: 'Portée', en: 'Range', zh: '射程' },
  'wp.hp':       { fr: 'HP', en: 'HP', zh: '生命' },
  'wp.shots':    { fr: 'tirs', en: 'shots', zh: '发' },
  'wp.unknown':  { fr: 'Skill inconnue.', en: 'Unknown skill.', zh: '未知技能。' },
  'wp.unknownWeapon':{ fr: 'Arme inconnue', en: 'Unknown weapon', zh: '未知武器' },

  // ── Dev mode UI ───────────────────────────────────────────────────────────
  'dev.weaponSkin':    { fr: 'SKIN D\'ARME', en: 'WEAPON SKIN', zh: '武器皮肤' },
  'dev.weaponLevel':   { fr: 'NIVEAU ARME', en: 'WEAPON LEVEL', zh: '武器等级' },
  'dev.weapon':        { fr: 'ARME', en: 'WEAPON', zh: '武器' },
  'dev.character':     { fr: 'PERSONNAGE', en: 'CHARACTER', zh: '角色' },
  'dev.body':          { fr: 'Corps', en: 'Body', zh: '身材' },
  'dev.skin':          { fr: 'Peau', en: 'Skin', zh: '肤色' },
  'dev.hairStyle':     { fr: 'Coiffure', en: 'Hair Style', zh: '发型' },
  'dev.hairColor':     { fr: 'Couleur cheveux', en: 'Hair Color', zh: '发色' },
  'dev.headwear':      { fr: 'Couvre-chef', en: 'Headwear', zh: '头饰' },
  'dev.eyes':          { fr: 'Yeux', en: 'Eyes', zh: '眼睛' },
  'dev.uniformColor':  { fr: 'Couleur uniforme', en: 'Uniform Color', zh: '制服颜色' },
  'dev.vest':          { fr: 'Veste', en: 'Vest', zh: '防弹衣' },
  'dev.backpack':      { fr: 'Sac à dos', en: 'Backpack', zh: '背包' },
  'dev.male':          { fr: 'Homme', en: 'Male', zh: '男性' },
  'dev.female':        { fr: 'Femme', en: 'Female', zh: '女性' },
  'dev.light':         { fr: 'clair', en: 'light', zh: '亮色' },
  'dev.grid':          { fr: 'grille', en: 'grid', zh: '网格' },
  'dev.dark':          { fr: 'sombre', en: 'dark', zh: '暗色' },
  'dev.lightTip':      { fr: 'Fond clair', en: 'Light background', zh: '亮色背景' },
  'dev.gridTip':       { fr: 'Fond quadrillé', en: 'Grid background', zh: '网格背景' },
  'dev.darkTip':       { fr: 'Fond sombre', en: 'Dark background', zh: '暗色背景' },
  'dev.flipTip':       { fr: 'Inverser l\'orientation', en: 'Flip facing', zh: '翻转方向' },
  'dev.zoomOut':       { fr: 'Zoom arrière', en: 'Zoom out', zh: '缩小' },
  'dev.zoomIn':        { fr: 'Zoom avant', en: 'Zoom in', zh: '放大' },
  'dev.animations':    { fr: 'ANIMATIONS', en: 'ANIMATIONS', zh: '动画' },
  'dev.allAnims':      { fr: 'TOUTES LES ANIMATIONS · LIVE', en: 'ALL ANIMATIONS · LIVE', zh: '全部动画 · 实时预览' },
  'dev.frames':        { fr: 'FRAMES', en: 'FRAMES', zh: '帧序列' },
  'dev.weaponBase':    { fr: 'Base', en: 'Base', zh: '基础' },
  'dev.mk1':           { fr: 'MK1', en: 'MK1', zh: 'MK1' },
  'dev.mk2':           { fr: 'MK2', en: 'MK2', zh: 'MK2' },
  'dev.weaponLevelAria':{ fr: 'Niveau de l\'arme', en: 'Weapon level', zh: '武器等级' },
  'dev.noVariant':     { fr: 'Aucune variante', en: 'No variant', zh: '没有变体' },
  'dev.loadingGame':   { fr: 'Chargement du jeu…', en: 'Loading game…', zh: '游戏加载中…' },
  'dev.skinTip':       { fr: 'Skin {n}', en: 'Skin {n}', zh: '皮肤 {n}' },
};

// ── Name pools (used for random soldier generation) ─────────────────────────
// FR/EN share the legacy French name pool — only Chinese gets a different pool.
const FR_MALE = [
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
  'Wolfgang','Xavier','Yannick','Yorick','Zacharie','Zéphyr'
];

const FR_FEMALE = [
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
  'Zélie','Zoé'
];

const EN_MALE = [
  'Aaron','Adam','Adrian','Alan','Albert','Alex','Alfred','Andrew','Anthony','Arthur',
  'Austin','Barry','Benjamin','Bernard','Bradley','Brandon','Brian','Bruce','Caleb','Calvin',
  'Cameron','Carl','Carson','Carter','Charles','Christian','Christopher','Clark','Cody','Colin',
  'Connor','Cooper','Craig','Daniel','David','Dean','Dennis','Derek','Dominic','Donald',
  'Douglas','Dylan','Earl','Edgar','Edward','Edwin','Elijah','Eric','Ethan','Eugene',
  'Evan','Felix','Francis','Frank','Frederick','Gabriel','Gareth','Gary','George','Gerald',
  'Glenn','Gordon','Grant','Gregory','Harold','Harrison','Harvey','Hector','Henry','Howard',
  'Hugh','Ian','Isaac','Jack','Jackson','Jacob','James','Jared','Jason','Jeffrey',
  'Jeremy','Jerome','Jesse','John','Jonah','Jonathan','Jordan','Joseph','Joshua','Julian',
  'Justin','Keith','Kenneth','Kevin','Kyle','Lance','Lawrence','Leo','Leonard','Lewis',
  'Liam','Logan','Louis','Lucas','Luke','Malcolm','Marcus','Mark','Martin','Mason',
  'Matthew','Maxwell','Michael','Miles','Mitchell','Morgan','Murray','Nathan','Neil','Nicholas',
  'Noah','Norman','Oliver','Oscar','Owen','Patrick','Paul','Peter','Philip','Preston',
  'Quentin','Ralph','Randall','Raymond','Reginald','Richard','Robert','Roderick','Roger','Roland',
  'Ronald','Roy','Russell','Ryan','Samuel','Scott','Sebastian','Seth','Shane','Simon',
  'Spencer','Stanley','Stephen','Stuart','Theodore','Thomas','Timothy','Trevor','Tyler','Vernon',
  'Victor','Vincent','Walter','Warren','Wayne','Wesley','William','Xavier','Zachary'
];

const EN_FEMALE = [
  'Abigail','Adelaide','Alice','Amelia','Amy','Anna','Annabelle','Audrey','Ava','Beatrice',
  'Bella','Bethany','Bonnie','Brooke','Camille','Cara','Caroline','Cassandra','Catherine','Charlotte',
  'Chloe','Claire','Clara','Clarissa','Cordelia','Daisy','Daphne','Delilah','Diana','Dorothy',
  'Edith','Eleanor','Elena','Eliza','Elizabeth','Ella','Eloise','Emily','Emma','Esther',
  'Eva','Eve','Evelyn','Faith','Felicity','Fiona','Florence','Frances','Freya','Genevieve',
  'Georgia','Grace','Hannah','Harper','Hazel','Helen','Helena','Holly','Hope','Imogen',
  'Iris','Isabel','Isla','Ivy','Jane','Jasmine','Jessica','Joan','Josephine','Joy',
  'Julia','Juliet','Katherine','Kira','Lara','Laura','Layla','Lena','Lila','Lily',
  'Lola','Louisa','Lucia','Lucy','Luna','Mabel','Madeline','Maeve','Margaret','Maria',
  'Mary','Matilda','Maya','Megan','Mia','Molly','Naomi','Natalie','Nina','Nora',
  'Olive','Olivia','Opal','Pearl','Penelope','Phoebe','Poppy','Rachel','Rebecca','Riley',
  'Rosalind','Rose','Rowan','Ruby','Ruth','Sabrina','Sadie','Sarah','Scarlett','Selena',
  'Sienna','Skylar','Sofia','Sophia','Stella','Susan','Tessa','Thea','Tilly','Vera',
  'Victoria','Violet','Vivian','Wendy','Willow','Yvonne','Zara','Zoe'
];

const ZH_MALE = [
  '伟','强','磊','涛','超','勇','军','杰','峰','明','刚','平','辉','华','建','文','斌','龙','飞','鹏',
  '凯','健','志','学','武','永','立','春','彬','瑞','旭','宇','浩','航','晨','烨','宏','哲','楠','骏',
  '俊杰','志强','建国','明辉','子轩','宇航','梓豪','浩然','子墨','奕辰','嘉豪','梓涵','俊熙','哲瀚','奕泽',
  '皓宇','沐辰','锦程','启明','志远','文博','天佑','瑞霖','弘毅','立诚','子谦','宗政','智渊','德昌',
  '思源','安康','志诚','立群','建华','国梁','江山','长青','少华','春雨','秉文','怀瑾'
];

const ZH_FEMALE = [
  '芳','娜','静','敏','秀','丽','燕','梅','婷','玲','红','艳','霞','英','华','慧','倩','瑶','雪','月',
  '兰','桂','晶','岚','洁','雯','颖','璐','晨','曼','妍','薇','琳','璇','瑾','蕾','茜','婵','茹','蓉',
  '欣怡','梓涵','雨萱','子萱','若曦','可馨','一诺','芷若','沐瑶','艺萌','梦琪','若兮','嘉怡','若涵','思琪',
  '诗涵','雪柔','晓彤','婉清','心怡','悠然','静怡','妙音','婉君','文君','清雅','澄澈','映雪','怀玉',
  '碧瑶','凝霜','若菡','瑞云','春兰','秋月','夏荷','冬梅','念真'
];

const NAMES_BY_LANG = {
  fr: { male: FR_MALE, female: FR_FEMALE },
  en: { male: EN_MALE, female: EN_FEMALE },
  zh: { male: ZH_MALE, female: ZH_FEMALE },
};

// ── Weapon name overrides (Chinese only) ────────────────────────────────────
// Keyed by canonical English/French weapon name (Weapons.list[].name). When the
// active language is 'zh' the UI shows the override; otherwise the original name
// is used. Internal HQ storage keeps the canonical name so swapping languages
// keeps existing soldiers' unlocked weapons working.
const ZH_WEAPON_NAMES = {
  // SMG
  'M3 Grease Goon': 'M3 黄油枪',
  'TEK-9': 'TEK-9 冲锋枪',
  'MAK-11': 'MAK-11 冲锋枪',
  'Skorpian': '蝎式冲锋枪',
  'HX MP7': 'HX MP7',
  'PN P90': 'PN P90',
  'PN F2001': 'PN F2001',
  'Ozi': '乌兹冲锋枪',
  'Kolt SCAMP': '柯尔特 SCAMP',
  'TPX': 'TPX 冲锋枪',
  'MPX9': 'MPX9 冲锋枪',
  // Rifle
  'AK-48': 'AK-48 突击步枪',
  'AKS-74V': 'AKS-74V',
  'AK-74N': 'AK-74N',
  'M4A2': 'M4A2 突击步枪',
  'Mk18S': 'Mk18S 短管步枪',
  'HX G3': 'HX G3 战斗步枪',
  'PN FAL': 'PN FAL',
  'M204': 'M204 步枪',
  'FAMAZ': '法马兹步枪',
  'FAMAZ-C': '法马兹紧凑型',
  // Heavy
  'Infernal Toob': '炼狱火箭筒',
  'Lazor': '激光炮',
  'Karl Gustov': '卡尔·古斯塔夫',
  'XM26': 'XM26 榴弹枪',
  'RPG-8': 'RPG-8 火箭筒',
  'Recoillite': '轻型无后座炮',
  'Stingar': '毒刺导弹',
  'AT5': 'AT5 反坦克导弹',
  'M202 FLARE': 'M202 烈焰发射器',
  'M80': 'M80 榴弹发射器',
  'M61': 'M61 加特林',
  'M248': 'M248 班用机枪',
  'M135': 'M135 米尼岗',
  'M33': 'M33 多管榴弹枪',
  // Shotgun
  'SPAX-12': 'SPAX-12 战术霰弹枪',
  'Stooger': '斯托格双管枪',
  'Ithaka': '伊萨卡霰弹枪',
  'Mossburg': '莫斯伯格 500',
  'Dbl-Barrel': '双管霰弹枪',
  'Blunderbus': '老式喇叭枪',
  'Flintlok': '燧发霰弹枪',
  'O/U': '上下双管枪',
  // Sniper
  'AWQ': 'AWQ 狙击枪',
  'AWN': 'AWN 狙击枪',
  'SVD': 'SVD 德拉贡诺夫',
  'HX PSG1': 'HX PSG1 精确步枪',
  'M200': 'M200 干预者',
  'M82A2': 'M82A2 巴雷特',
  'HS50': 'HS .50 反器材',
  'Hekate': '赫卡忒重型狙',
  'Scout': '斯太尔侦察步枪',
  'CMR': '紧凑型精确步枪',
  // Pistol
  'Makarovv': '马卡洛夫 PM',
  'Ruger Silenst': '鲁格消音手枪',
  'Sovyet PB': '苏式 PB 消音',
  'Standart HDM': '高标准 HDM',
  'Beretta 93': '贝雷塔 93R',
  'Revolvair': '左轮手枪',
  'M1912': '黄金 M1912',
  'Makarovv Mk.II': '马卡洛夫 Mk.II',
  // Melee
  'Main nue': '赤手空拳',
};

// MK suffix label in Chinese kept ASCII (« mk1 », « mk2 ») so the variant lookup
// keeps working when concatenated in app.jsx. We render a suffix manually if needed.

// ── State + bus ─────────────────────────────────────────────────────────────
function readInitialLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && NAMES_BY_LANG[v]) return v;
  } catch (_) {}
  return DEFAULT_LANG;
}

let CURRENT_LANG = readInitialLang();

function setLang(lang) {
  if (!NAMES_BY_LANG[lang] || lang === CURRENT_LANG) return;
  CURRENT_LANG = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  try {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
}

function t(key, params) {
  const entry = DICT[key];
  if (!entry) return key;
  const out = entry[CURRENT_LANG] || entry[DEFAULT_LANG] || key;
  return interpolate(out, params);
}

function getMaleNames(lang)   { return (NAMES_BY_LANG[lang || CURRENT_LANG] || NAMES_BY_LANG[DEFAULT_LANG]).male; }
function getFemaleNames(lang) { return (NAMES_BY_LANG[lang || CURRENT_LANG] || NAMES_BY_LANG[DEFAULT_LANG]).female; }

function localizedWeaponName(weapon, lang) {
  if (!weapon) return '';
  const L = lang || CURRENT_LANG;
  if (L === 'zh') {
    // Mk variants: base name (sans " mk1"/" mk2") → override, then re-append suffix.
    const m = /^(.*?)( mk[12])$/i.exec(weapon.name);
    if (m) {
      const baseName = ZH_WEAPON_NAMES[m[1]] || m[1];
      const suffix = m[2].toLowerCase();
      return baseName + ' ' + suffix.replace(' ', '').toUpperCase();
    }
    return ZH_WEAPON_NAMES[weapon.name] || weapon.name;
  }
  return weapon.name;
}

function getLang() { return CURRENT_LANG; }

// React hook — bumps a state value on every i18n:change so the calling
// component (and its subtree) re-renders with the new language. Components
// using this hook should be near the top of the tree so re-renders cascade.
function useI18n() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener('i18n:change', handler);
    return () => window.removeEventListener('i18n:change', handler);
  }, []);
  return {
    lang: CURRENT_LANG,
    t,
    setLang,
    localizedWeaponName,
    getMaleNames,
    getFemaleNames,
  };
}

try {
  document.documentElement.setAttribute('lang', CURRENT_LANG);
  document.documentElement.setAttribute('data-lang', CURRENT_LANG);
} catch (_) {}

window.I18n = {
  LANGS,
  DEFAULT_LANG,
  t,
  setLang,
  getLang,
  getMaleNames,
  getFemaleNames,
  localizedWeaponName,
  useI18n,
};

})();
