// The shared word list used both by the ear-test sample and by the coinage
// index. Kept in one place so the two can never drift: a word whose coinage
// Sven approved by reading it aloud is exactly a word that should be
// reversible when it comes back the other way.
export const GROUPS = {
  "Nature": ["boom","water","vuur","berg","rivier","zee","steen","aarde","hemel","wolk","regen","sneeuw","wind","storm","bos","moeras","woestijn","grot","vlakte","dal","bron","as","rook","modder","ijs","wortel","blad","doorn","zaad","schors"],
  "Animals": ["wolf","raaf","slang","paard","hond","beer","arend","rat","spin","worm","vis","kraai","hert","zwijn","vleermuis","kever","hagedis","vlieg","bij","mier"],
  "Body": ["hoofd","hand","oog","hart","bloed","bot","huid","tand","haar","voet","mond","oor","keel","vinger","rug","schouder","knie","nagel","long","maag"],
  "War and power": ["zwaard","schild","bijl","speer","boog","pijl","leger","oorlog","slag","wond","vijand","bondgenoot","verraad","bevel","troon","kroon","banier","wacht","muur","poort","toren","kerker","ketting","brandmerk","buit","losgeld","wapenstilstand","overgave","belegering","hinderlaag"],
  "People": ["koning","koningin","slaaf","meester","smid","jager","dief","priester","heks","dwaas","vreemdeling","zwerver","boodschapper","spion","beul","moeder","vader","kind","broer","zuster","stam","volk","horde","raad","oudste"],
  "Mind and feeling": ["honger","angst","hoop","woede","vreugde","verdriet","haat","liefde","schaamte","trots","moed","lafheid","geduld","twijfel","droom","herinnering","waanzin","wijsheid","dwaasheid","wil"],
  "Action": ["lopen","rennen","sterven","doden","breken","bouwen","zingen","schreeuwen","fluisteren","graven","branden","smelten","smeden","jagen","vluchten","verbergen","zoeken","vinden","geven","nemen","dragen","werpen","snijden","binden","openen","sluiten","wachten","volgen","leiden","zweren"],
  "Quality": ["donker","licht","oud","jong","snel","traag","sterk","zwak","hard","zacht","scherp","bot","diep","ondiep","hoog","laag","heet","koud","nat","droog","leeg","vol","schoon","vuil","waar","vals","dood","levend","wreed","trouw"],
  "Time and place": ["dag","nacht","ochtend","avond","winter","zomer","jaar","uur","begin","einde","noorden","zuiden","oosten","westen","hier","daar","boven","onder","binnen","buiten"],
  "Craft and thing": ["ijzer","goud","zilver","koper","hout","leer","touw","bot","zout","brood","vlees","bier","pot","mes","hamer","wiel","boot","wagen","ladder","sleutel"],
  "Modern (no cultural anchor)": ["ruimteschip","telefoon","computer","trein","elektriciteit","machine","fabriek","geweer","kaart","klok"],
};

/** Part of speech per group, matching what the sample sheet assumes. */
export const POS_OF = { Action: "verb", Quality: "adjective" };
