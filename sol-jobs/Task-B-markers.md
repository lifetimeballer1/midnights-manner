# SOL TASK B — Collection Marker Logic (queued, do NOT start until Muse releases)

Scope: src/resources.js (reserveReady, collectionBubbleScale, layoutCollectionBubbles, isCollectionCrowded), src/renderer.js drawCollections, assets/resource-*.svg.
Goal: replace giant +N pills with small building-anchored icon + readiness dot (~44px touch target). Amount only on tap/press. Full storage = icon + ! or full-ring. Density: few ready → individuals; many ready (>=8) → aggregate; zoom out → aggregate; zoom in → more individuals. Improve existing density logic, do not create a second system. Keep navy/brass identity. No emoji in production.
Gate: needs Task A findings first. Wait for Muse.
