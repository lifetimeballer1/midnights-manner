export function precacheFiles(files){
 return files.filter(file=>!file.startsWith('./assets/meshes/mmr-'));
}
