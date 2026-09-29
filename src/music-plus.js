import {MusicPlayer as CoreMusicPlayer} from './music.js';

// Optional expansion wrapper: the tested four-theme core remains untouched,
// while the live game can append additional original themes from music.json.
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
