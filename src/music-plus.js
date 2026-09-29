import {MusicPlayer as CoreMusicPlayer} from './music.js';

// Keep the proven core music engine untouched. The live game opts into this
// small wrapper, which appends optional bonusThemes from data/music.json.
// Removing this file + switching main.js back to ./music.js restores the
// original four-song pool with no save migration or audio asset cleanup.
export function expandedMusicData(data){
 if(!data||typeof data!=='object')return data;
 const core=Array.isArray(data.themes)?data.themes:[];
 const bonus=Array.isArray(data.bonusThemes)?data.bonusThemes:[];
 if(!core.length||!bonus.length)return data;
 return {...data,themes:[...core,...bonus]};
}

export class MusicPlayer extends CoreMusicPlayer{
 constructor(data){super(expandedMusicData(data));}
}
