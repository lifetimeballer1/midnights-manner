export function seedOf(id){let h=2166136261;for(const ch of String(id||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
